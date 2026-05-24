import type { IntakeItem, LogIntakeInput, MealType } from '@health-mcp/shared';
import { cuid } from '../util/id.js';
import { logIntake } from './intake.js';
import { type Ctx, ServiceError } from './types.js';

export type RememberedMeal = {
  id: string;
  label: string;
  aliases: string | null;
  default_meal_type: string | null;
  canonical_text: string | null;
  items_json: string | null;
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
    canonical_text?: string;
    items?: IntakeItem[];
    notes?: string;
  },
): RememberedMeal => {
  if (!args.canonical_text && !args.items) {
    throw new ServiceError('missing_payload', 'either canonical_text or items required', 400);
  }
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO remembered_meals (
        id, label, aliases, default_meal_type, canonical_text, items_json, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      args.label,
      args.aliases ? JSON.stringify(args.aliases) : null,
      args.default_meal_type ?? null,
      args.canonical_text ?? null,
      args.items ? JSON.stringify(args.items) : null,
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
    canonical_text?: string | null;
    items?: IntakeItem[] | null;
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
        canonical_text = ?,
        items_json = ?,
        notes = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .run(
      args.label ?? null,
      args.aliases ? JSON.stringify(args.aliases) : null,
      args.default_meal_type === undefined ? existing.default_meal_type : args.default_meal_type,
      args.canonical_text === undefined ? existing.canonical_text : args.canonical_text,
      args.items === undefined
        ? existing.items_json
        : args.items === null
          ? null
          : JSON.stringify(args.items),
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
  args: { id_or_label: string; ts?: string; meal_type?: MealType; scale?: number },
):
  | { kind: 'logged'; meal: RememberedMeal; result: ReturnType<typeof logIntake> }
  | { kind: 'reestimate'; meal: RememberedMeal; canonical_text: string } => {
  const meal = getRememberedMeal(ctx, args.id_or_label);
  const tx = ctx.db.transaction(() => {
    ctx.db
      .prepare(
        "UPDATE remembered_meals SET use_count = use_count + 1, last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
      )
      .run(meal.id);
  });
  tx();

  if (meal.items_json) {
    const items = JSON.parse(meal.items_json) as IntakeItem[];
    const scale = args.scale ?? 1;
    const scaled: IntakeItem[] = items.map((item) => {
      if (item.ref === 'recipe_serving') {
        return { ...item, servings: item.servings * scale };
      }
      if (item.ref === 'food' || item.ref === 'batch' || item.ref === 'custom') {
        return { ...item, grams: item.grams * scale };
      }
      return item;
    });
    const input: LogIntakeInput = {
      items: scaled,
      ts: args.ts,
      meal_type: args.meal_type ?? (meal.default_meal_type as MealType | undefined),
    };
    const result = logIntake(ctx, input);
    return { kind: 'logged', meal: getRememberedMeal(ctx, meal.id), result };
  }
  return { kind: 'reestimate', meal, canonical_text: meal.canonical_text ?? '' };
};
