import type { LogMealInput, MealComponentInput, MealDto, MealType } from '@health-mcp/shared';
import { cuid } from '../util/id.js';
import { logMeal } from './meals.js';
import { type Ctx, ServiceError } from './types.js';

export type RememberedMeal = {
  id: string;
  label: string;
  aliases: string | null;
  default_meal_type: string | null;
  default_name: string | null;
  canonical_text: string | null;
  components_json: string | null;
  notes: string | null;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
};

export const rememberMeal = (
  ctx: Ctx,
  args: {
    label: string;
    aliases?: string[];
    default_meal_type?: MealType;
    default_name?: string;
    canonical_text?: string;
    components?: MealComponentInput[];
    notes?: string;
  },
): RememberedMeal => {
  if (!args.canonical_text && !args.components) {
    throw new ServiceError('missing_payload', 'either canonical_text or components required', 400);
  }
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO remembered_meals (
        id, label, aliases, default_meal_type, default_name, canonical_text, components_json, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      args.label,
      args.aliases ? JSON.stringify(args.aliases) : null,
      args.default_meal_type ?? null,
      args.default_name ?? null,
      args.canonical_text ?? null,
      args.components ? JSON.stringify(args.components) : null,
      args.notes ?? null,
    );
  return ctx.db.prepare('SELECT * FROM remembered_meals WHERE id = ?').get(id) as RememberedMeal;
};

const matchLabelOrId = (ctx: Ctx, idOrLabel: string): RememberedMeal | null => {
  const byId = ctx.db.prepare('SELECT * FROM remembered_meals WHERE id = ?').get(idOrLabel) as
    | RememberedMeal
    | undefined;
  if (byId) return byId;
  const byLabel = ctx.db
    .prepare('SELECT * FROM remembered_meals WHERE label = ? COLLATE NOCASE')
    .get(idOrLabel) as RememberedMeal | undefined;
  return byLabel ?? null;
};

export const listRememberedMeals = (
  ctx: Ctx,
  args: { query?: string; limit?: number } = {},
): RememberedMeal[] => {
  const limit = args.limit ?? 50;
  if (args.query) {
    const like = `%${args.query}%`;
    return ctx.db
      .prepare(
        `SELECT * FROM remembered_meals
         WHERE label LIKE ? COLLATE NOCASE OR aliases LIKE ? COLLATE NOCASE
         ORDER BY use_count DESC, last_used_at DESC NULLS LAST
         LIMIT ?`,
      )
      .all(like, like, limit) as RememberedMeal[];
  }
  return ctx.db
    .prepare(
      'SELECT * FROM remembered_meals ORDER BY use_count DESC, last_used_at DESC NULLS LAST LIMIT ?',
    )
    .all(limit) as RememberedMeal[];
};

export const getRememberedMeal = (ctx: Ctx, idOrLabel: string): RememberedMeal => {
  const r = matchLabelOrId(ctx, idOrLabel);
  if (!r) throw new ServiceError('remembered_meal_not_found', `not found: ${idOrLabel}`, 404);
  return r;
};

export const updateRememberedMeal = (
  ctx: Ctx,
  args: {
    id: string;
    label?: string;
    aliases?: string[];
    default_meal_type?: MealType | null;
    default_name?: string | null;
    canonical_text?: string | null;
    components?: MealComponentInput[] | null;
    notes?: string | null;
  },
): RememberedMeal => {
  const existing = getRememberedMeal(ctx, args.id);
  ctx.db
    .prepare(
      `UPDATE remembered_meals SET
        label = COALESCE(?, label),
        aliases = COALESCE(?, aliases),
        default_meal_type = ?,
        default_name = ?,
        canonical_text = ?,
        components_json = ?,
        notes = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .run(
      args.label ?? null,
      args.aliases ? JSON.stringify(args.aliases) : null,
      args.default_meal_type === undefined ? existing.default_meal_type : args.default_meal_type,
      args.default_name === undefined ? existing.default_name : args.default_name,
      args.canonical_text === undefined ? existing.canonical_text : args.canonical_text,
      args.components === undefined
        ? existing.components_json
        : args.components === null
          ? null
          : JSON.stringify(args.components),
      args.notes === undefined ? existing.notes : args.notes,
      existing.id,
    );
  return getRememberedMeal(ctx, existing.id);
};

export const forgetMeal = (ctx: Ctx, idOrLabel: string): { id: string } => {
  const r = getRememberedMeal(ctx, idOrLabel);
  ctx.db.prepare('DELETE FROM remembered_meals WHERE id = ?').run(r.id);
  return { id: r.id };
};

export const logRememberedMeal = (
  ctx: Ctx,
  args: { id_or_label: string; ts?: string; meal_type?: MealType; name?: string; scale?: number },
):
  | { kind: 'logged'; remembered: RememberedMeal; meal: MealDto }
  | { kind: 'reestimate'; remembered: RememberedMeal; canonical_text: string } => {
  const remembered = getRememberedMeal(ctx, args.id_or_label);
  ctx.db
    .prepare(
      "UPDATE remembered_meals SET use_count = use_count + 1, last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
    .run(remembered.id);

  if (!remembered.components_json) {
    return { kind: 'reestimate', remembered, canonical_text: remembered.canonical_text ?? '' };
  }
  const components = JSON.parse(remembered.components_json) as MealComponentInput[];
  const scale = args.scale ?? 1;
  const scaled: MealComponentInput[] = components.map((c) => {
    if (c.ref === 'recipe_serving') return { ...c, servings: c.servings * scale };
    return { ...c, grams: c.grams * scale };
  });
  const input: LogMealInput = {
    ts: args.ts,
    meal_type: args.meal_type ?? (remembered.default_meal_type as MealType | undefined),
    name: args.name ?? remembered.default_name ?? remembered.label,
    components: scaled,
  };
  const meal = logMeal(ctx, input);
  return { kind: 'logged', remembered: getRememberedMeal(ctx, remembered.id), meal };
};
