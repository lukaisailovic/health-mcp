import type {
  LogMealInput,
  MealComponentDto,
  MealComponentInput,
  MealDto,
  MealType,
  UpdateMealComponentInput,
  UpdateMealInput,
} from '@health-mcp/shared';
import { cuid } from '../util/id.js';
import { deriveMealType, nowIso, toLocalDate } from '../util/tz.js';
import { type Macros, getFood, macrosForCustom, macrosForFoodGrams, scaleMacros } from './food.js';
import { type BatchTotals, batchMacrosForGrams, recipeTotalsById } from './recipes.js';
import { type DailySummary, dailySummary } from './summaries.js';
import { type Ctx, ServiceError } from './types.js';

type MealRow = {
  id: string;
  ts: string;
  date: string;
  meal_type: MealType;
  name: string | null;
  notes: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
};

type ComponentRow = {
  id: string;
  meal_id: string;
  position: number;
  ref_kind: 'food' | 'recipe_serving' | 'batch' | 'custom';
  food_id: string | null;
  recipe_id: string | null;
  batch_id: string | null;
  custom_name: string | null;
  grams: number | null;
  servings: number | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  iron_mg: number | null;
  confidence: number;
  source_trace: string;
  notes: string | null;
  created_at: string;
  display_name: string | null;
};

type ComponentDerived = {
  ref_kind: ComponentRow['ref_kind'];
  food_id: string | null;
  recipe_id: string | null;
  batch_id: string | null;
  custom_name: string | null;
  grams: number | null;
  servings: number | null;
  macros: Macros;
};

const deriveComponent = (ctx: Ctx, input: MealComponentInput): ComponentDerived => {
  if (input.ref === 'food') {
    const food = getFood(ctx, input.food_id);
    return {
      ref_kind: 'food',
      food_id: food.id,
      recipe_id: null,
      batch_id: null,
      custom_name: null,
      grams: input.grams,
      servings: null,
      macros: macrosForFoodGrams(food, input.grams),
    };
  }
  if (input.ref === 'recipe_serving') {
    const recipe = ctx.db
      .prepare('SELECT id, servings FROM recipes WHERE id = ?')
      .get(input.recipe_id) as { id: string; servings: number } | undefined;
    if (!recipe)
      throw new ServiceError('recipe_not_found', `recipe ${input.recipe_id} not found`, 404);
    return {
      ref_kind: 'recipe_serving',
      food_id: null,
      recipe_id: input.recipe_id,
      batch_id: null,
      custom_name: null,
      grams: null,
      servings: input.servings,
      macros: scaleMacros(recipeTotalsById(ctx, input.recipe_id), input.servings / recipe.servings),
    };
  }
  if (input.ref === 'batch') {
    const batch = ctx.db.prepare('SELECT * FROM batches WHERE id = ?').get(input.batch_id) as
      | (BatchTotals & { remaining_grams: number })
      | undefined;
    if (!batch) throw new ServiceError('batch_not_found', `batch ${input.batch_id} not found`, 404);
    if (input.grams > batch.remaining_grams) {
      throw new ServiceError(
        'batch_insufficient',
        `batch ${input.batch_id} has ${batch.remaining_grams}g remaining; requested ${input.grams}g`,
        400,
      );
    }
    return {
      ref_kind: 'batch',
      food_id: null,
      recipe_id: null,
      batch_id: input.batch_id,
      custom_name: null,
      grams: input.grams,
      servings: null,
      macros: batchMacrosForGrams(batch, input.grams),
    };
  }
  if ('absolute' in input.custom) {
    return {
      ref_kind: 'custom',
      food_id: null,
      recipe_id: null,
      batch_id: null,
      custom_name: input.custom.name,
      grams: null,
      servings: null,
      macros: macrosForCustom(input.custom, 0),
    };
  }
  if (input.grams === undefined) {
    throw new ServiceError(
      'grams_required',
      'per-100g custom foods need grams; supply grams or use the { name, absolute: {...} } shape',
      400,
    );
  }
  return {
    ref_kind: 'custom',
    food_id: null,
    recipe_id: null,
    batch_id: null,
    custom_name: input.custom.name,
    grams: input.grams,
    servings: null,
    macros: macrosForCustom(input.custom, input.grams),
  };
};

const insertComponent = (
  ctx: Ctx,
  args: {
    meal_id: string;
    position: number;
    derived: ComponentDerived;
    confidence: number;
    source_trace: string;
    notes: string | null;
  },
): ComponentRow => {
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO meal_components (
        id, meal_id, position, ref_kind, food_id, recipe_id, batch_id, custom_name,
        grams, servings, kcal, protein_g, carb_g, fat_g, fiber_g, sugar_g, sat_fat_g, sodium_mg,
        potassium_mg, calcium_mg, magnesium_mg, iron_mg,
        confidence, source_trace, notes
      ) VALUES (
        @id, @meal_id, @position, @ref_kind, @food_id, @recipe_id, @batch_id, @custom_name,
        @grams, @servings, @kcal, @protein_g, @carb_g, @fat_g, @fiber_g, @sugar_g, @sat_fat_g, @sodium_mg,
        @potassium_mg, @calcium_mg, @magnesium_mg, @iron_mg,
        @confidence, @source_trace, @notes
      )`,
    )
    .run({
      id,
      meal_id: args.meal_id,
      position: args.position,
      ref_kind: args.derived.ref_kind,
      food_id: args.derived.food_id,
      recipe_id: args.derived.recipe_id,
      batch_id: args.derived.batch_id,
      custom_name: args.derived.custom_name,
      grams: args.derived.grams,
      servings: args.derived.servings,
      kcal: args.derived.macros.kcal,
      protein_g: args.derived.macros.protein_g,
      carb_g: args.derived.macros.carb_g,
      fat_g: args.derived.macros.fat_g,
      fiber_g: args.derived.macros.fiber_g,
      sugar_g: args.derived.macros.sugar_g,
      sat_fat_g: args.derived.macros.sat_fat_g,
      sodium_mg: args.derived.macros.sodium_mg,
      potassium_mg: args.derived.macros.potassium_mg,
      calcium_mg: args.derived.macros.calcium_mg,
      magnesium_mg: args.derived.macros.magnesium_mg,
      iron_mg: args.derived.macros.iron_mg,
      confidence: args.confidence,
      source_trace: args.source_trace,
      notes: args.notes,
    });
  return fetchComponent(ctx, id);
};

const decrementBatch = (ctx: Ctx, batchId: string, grams: number): void => {
  ctx.db
    .prepare('UPDATE batches SET remaining_grams = remaining_grams - ? WHERE id = ?')
    .run(grams, batchId);
  const b = ctx.db.prepare('SELECT remaining_grams FROM batches WHERE id = ?').get(batchId) as
    | { remaining_grams: number }
    | undefined;
  if (!b) throw new ServiceError('batch_not_found', batchId, 404);
  if (b.remaining_grams < 0) {
    throw new ServiceError(
      'batch_insufficient',
      `batch ${batchId} cannot supply requested grams`,
      400,
    );
  }
};

const refundBatch = (ctx: Ctx, batchId: string, grams: number): void => {
  ctx.db
    .prepare('UPDATE batches SET remaining_grams = remaining_grams + ? WHERE id = ?')
    .run(grams, batchId);
};

const fetchComponent = (ctx: Ctx, id: string): ComponentRow =>
  ctx.db
    .prepare(
      `SELECT mc.*,
              COALESCE(mc.custom_name, f.name, r.name, b.name) AS display_name
       FROM meal_components mc
       LEFT JOIN foods f ON f.id = mc.food_id
       LEFT JOIN recipes r ON r.id = mc.recipe_id
       LEFT JOIN batches b ON b.id = mc.batch_id
       WHERE mc.id = ?`,
    )
    .get(id) as ComponentRow;

const fetchComponentsForMeal = (ctx: Ctx, mealId: string): ComponentRow[] =>
  ctx.db
    .prepare(
      `SELECT mc.*,
              COALESCE(mc.custom_name, f.name, r.name, b.name) AS display_name
       FROM meal_components mc
       LEFT JOIN foods f ON f.id = mc.food_id
       LEFT JOIN recipes r ON r.id = mc.recipe_id
       LEFT JOIN batches b ON b.id = mc.batch_id
       WHERE mc.meal_id = ?
       ORDER BY mc.position ASC, mc.created_at ASC`,
    )
    .all(mealId) as ComponentRow[];

const fetchMealRow = (ctx: Ctx, id: string): MealRow => {
  const row = ctx.db.prepare('SELECT * FROM meals WHERE id = ?').get(id) as MealRow | undefined;
  if (!row) throw new ServiceError('meal_not_found', `meal ${id} not found`, 404);
  return row;
};

const nextPosition = (ctx: Ctx, mealId: string): number => {
  const row = ctx.db
    .prepare('SELECT COALESCE(MAX(position), -1) AS max FROM meal_components WHERE meal_id = ?')
    .get(mealId) as { max: number };
  return row.max + 1;
};

const touchMeal = (ctx: Ctx, id: string): void => {
  ctx.db
    .prepare("UPDATE meals SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(id);
};

const computeTotals = (components: MealComponentDto[]): MealDto['totals'] => {
  const totals = {
    kcal: 0,
    protein_g: 0,
    carb_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sat_fat_g: 0,
    sodium_mg: 0,
    potassium_mg: 0,
    calcium_mg: 0,
    magnesium_mg: 0,
    iron_mg: 0,
    avg_confidence: null as number | null,
  };
  let confidenceSum = 0;
  for (const c of components) {
    totals.kcal += c.kcal;
    totals.protein_g += c.protein_g;
    totals.carb_g += c.carb_g;
    totals.fat_g += c.fat_g;
    totals.fiber_g += c.fiber_g ?? 0;
    totals.sugar_g += c.sugar_g ?? 0;
    totals.sat_fat_g += c.sat_fat_g ?? 0;
    totals.sodium_mg += c.sodium_mg ?? 0;
    totals.potassium_mg += c.potassium_mg ?? 0;
    totals.calcium_mg += c.calcium_mg ?? 0;
    totals.magnesium_mg += c.magnesium_mg ?? 0;
    totals.iron_mg += c.iron_mg ?? 0;
    confidenceSum += c.confidence;
  }
  if (components.length > 0) totals.avg_confidence = confidenceSum / components.length;
  return totals;
};

const toMealDto = (ctx: Ctx, row: MealRow): MealDto => {
  const components = fetchComponentsForMeal(ctx, row.id) as MealComponentDto[];
  return {
    id: row.id,
    ts: row.ts,
    date: row.date,
    meal_type: row.meal_type,
    name: row.name,
    notes: row.notes,
    tags: row.tags,
    components,
    totals: computeTotals(components),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export const logMeal = (ctx: Ctx, input: LogMealInput): MealDto => {
  const ts = input.ts ?? nowIso();
  const date = toLocalDate(ts, ctx.config.tz);
  const meal_type = input.meal_type ?? deriveMealType(ts, ctx.config.tz);
  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
  const mealId = cuid();

  const tx = ctx.db.transaction(() => {
    ctx.db
      .prepare(
        `INSERT INTO meals (id, ts, date, meal_type, name, notes, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(mealId, ts, date, meal_type, input.name ?? null, input.notes ?? null, tagsJson);
    const batchDeltas = new Map<string, number>();
    let position = 0;
    for (const component of input.components) {
      const derived = deriveComponent(ctx, component);
      insertComponent(ctx, {
        meal_id: mealId,
        position,
        derived,
        confidence: component.confidence ?? 1,
        source_trace: component.source_trace ?? 'manual',
        notes: component.notes ?? null,
      });
      position += 1;
      if (derived.batch_id && derived.grams !== null) {
        batchDeltas.set(derived.batch_id, (batchDeltas.get(derived.batch_id) ?? 0) + derived.grams);
      }
    }
    for (const [batchId, delta] of batchDeltas.entries()) decrementBatch(ctx, batchId, delta);
  });
  tx();
  return toMealDto(ctx, fetchMealRow(ctx, mealId));
};

export const listMeals = (
  ctx: Ctx,
  args: { date?: string; start?: string; end?: string; meal_type?: MealType; limit?: number } = {},
): MealDto[] => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    conditions.push('date = ?');
    params.push(args.date);
  }
  if (args.start) {
    conditions.push('ts >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conditions.push('ts <= ?');
    params.push(args.end);
  }
  if (args.meal_type) {
    conditions.push('meal_type = ?');
    params.push(args.meal_type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = args.limit ?? 200;
  params.push(limit);
  const rows = ctx.db
    .prepare(`SELECT * FROM meals ${where} ORDER BY ts DESC LIMIT ?`)
    .all(...params) as MealRow[];
  return rows.map((r) => toMealDto(ctx, r));
};

export const getMeal = (ctx: Ctx, id: string): MealDto => toMealDto(ctx, fetchMealRow(ctx, id));

export const updateMeal = (ctx: Ctx, args: UpdateMealInput): MealDto => {
  const existing = fetchMealRow(ctx, args.id);
  const tags =
    args.tags === undefined ? existing.tags : args.tags === null ? null : JSON.stringify(args.tags);
  ctx.db
    .prepare(
      `UPDATE meals SET
        meal_type = COALESCE(?, meal_type),
        name = ?,
        notes = ?,
        tags = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .run(
      args.meal_type ?? null,
      args.name === undefined ? existing.name : args.name,
      args.notes === undefined ? existing.notes : args.notes,
      tags,
      args.id,
    );
  return getMeal(ctx, args.id);
};

export const deleteMeal = (ctx: Ctx, id: string): { id: string } => {
  const existing = fetchMealRow(ctx, id);
  const components = fetchComponentsForMeal(ctx, id);
  const tx = ctx.db.transaction(() => {
    for (const c of components) {
      if (c.batch_id && c.grams !== null) refundBatch(ctx, c.batch_id, c.grams);
    }
    ctx.db.prepare('DELETE FROM meals WHERE id = ?').run(existing.id);
  });
  tx();
  return { id };
};

export const undoLastMeal = (ctx: Ctx): MealDto | null => {
  const row = ctx.db
    .prepare(
      "SELECT * FROM meals WHERE created_at >= datetime('now','-10 minutes') ORDER BY created_at DESC LIMIT 1",
    )
    .get() as MealRow | undefined;
  if (!row) return null;
  const dto = toMealDto(ctx, row);
  deleteMeal(ctx, row.id);
  return dto;
};

export const addMealComponent = (
  ctx: Ctx,
  args: { meal_id: string; component: MealComponentInput },
): MealDto => {
  fetchMealRow(ctx, args.meal_id);
  const tx = ctx.db.transaction(() => {
    const derived = deriveComponent(ctx, args.component);
    insertComponent(ctx, {
      meal_id: args.meal_id,
      position: nextPosition(ctx, args.meal_id),
      derived,
      confidence: args.component.confidence ?? 1,
      source_trace: args.component.source_trace ?? 'manual',
      notes: args.component.notes ?? null,
    });
    if (derived.batch_id && derived.grams !== null) {
      decrementBatch(ctx, derived.batch_id, derived.grams);
    }
    touchMeal(ctx, args.meal_id);
  });
  tx();
  return getMeal(ctx, args.meal_id);
};

const fetchComponentOrThrow = (ctx: Ctx, id: string): ComponentRow => {
  const row = ctx.db.prepare('SELECT * FROM meal_components WHERE id = ?').get(id) as
    | ComponentRow
    | undefined;
  if (!row) throw new ServiceError('meal_component_not_found', `component ${id} not found`, 404);
  return row;
};

export const updateMealComponent = (ctx: Ctx, args: UpdateMealComponentInput): MealDto => {
  const existing = fetchComponentOrThrow(ctx, args.id);
  const wantsGrams = args.grams !== undefined || args.grams_delta !== undefined;
  if (wantsGrams && existing.ref_kind === 'custom') {
    throw new ServiceError(
      'custom_component_grams_unchangeable',
      'cannot change grams on a custom component; remove and re-add with new grams',
      400,
    );
  }
  if (wantsGrams && existing.ref_kind === 'recipe_serving') {
    throw new ServiceError(
      'recipe_serving_uses_servings',
      'recipe_serving components are scaled by servings, not grams',
      400,
    );
  }
  if (args.servings !== undefined && existing.ref_kind !== 'recipe_serving') {
    throw new ServiceError(
      'servings_only_on_recipe',
      'servings only apply to recipe_serving components',
      400,
    );
  }
  let gramsTarget = args.grams;
  if (args.grams_delta !== undefined) {
    if (existing.grams === null) {
      throw new ServiceError('component_has_no_grams', 'component has no grams to adjust', 400);
    }
    gramsTarget = existing.grams + args.grams_delta;
    if (gramsTarget <= 0) {
      throw new ServiceError(
        'grams_must_be_positive',
        `grams_delta ${args.grams_delta} would drop grams to ${gramsTarget}; remove the component instead`,
        400,
      );
    }
  }
  const tx = ctx.db.transaction(() => {
    let macros: Macros = {
      kcal: existing.kcal,
      protein_g: existing.protein_g,
      carb_g: existing.carb_g,
      fat_g: existing.fat_g,
      fiber_g: existing.fiber_g,
      sugar_g: existing.sugar_g,
      sat_fat_g: existing.sat_fat_g,
      sodium_mg: existing.sodium_mg,
      potassium_mg: existing.potassium_mg,
      calcium_mg: existing.calcium_mg,
      magnesium_mg: existing.magnesium_mg,
      iron_mg: existing.iron_mg,
    };
    let newGrams = existing.grams;
    let newServings = existing.servings;
    if (gramsTarget !== undefined && existing.ref_kind === 'food' && existing.food_id) {
      macros = macrosForFoodGrams(getFood(ctx, existing.food_id), gramsTarget);
      newGrams = gramsTarget;
    } else if (
      gramsTarget !== undefined &&
      existing.ref_kind === 'batch' &&
      existing.batch_id &&
      existing.grams !== null
    ) {
      const delta = gramsTarget - existing.grams;
      if (delta > 0) decrementBatch(ctx, existing.batch_id, delta);
      else if (delta < 0) refundBatch(ctx, existing.batch_id, -delta);
      const batch = ctx.db
        .prepare(
          `SELECT total_grams, kcal_total, protein_g_total, carb_g_total, fat_g_total,
            fiber_g_total, sugar_g_total, sat_fat_g_total, sodium_mg_total,
            potassium_mg_total, calcium_mg_total, magnesium_mg_total, iron_mg_total
           FROM batches WHERE id = ?`,
        )
        .get(existing.batch_id) as BatchTotals;
      macros = batchMacrosForGrams(batch, gramsTarget);
      newGrams = gramsTarget;
    } else if (
      args.servings !== undefined &&
      existing.ref_kind === 'recipe_serving' &&
      existing.recipe_id
    ) {
      const recipe = ctx.db
        .prepare('SELECT servings FROM recipes WHERE id = ?')
        .get(existing.recipe_id) as { servings: number };
      macros = scaleMacros(
        recipeTotalsById(ctx, existing.recipe_id),
        args.servings / recipe.servings,
      );
      newServings = args.servings;
    }
    ctx.db
      .prepare(
        `UPDATE meal_components SET
          grams = ?, servings = ?,
          notes = ?,
          confidence = COALESCE(?, confidence),
          kcal = ?, protein_g = ?, carb_g = ?, fat_g = ?,
          fiber_g = ?, sugar_g = ?, sat_fat_g = ?, sodium_mg = ?,
          potassium_mg = ?, calcium_mg = ?, magnesium_mg = ?, iron_mg = ?
         WHERE id = ?`,
      )
      .run(
        newGrams,
        newServings,
        args.notes === undefined ? existing.notes : args.notes,
        args.confidence ?? null,
        macros.kcal,
        macros.protein_g,
        macros.carb_g,
        macros.fat_g,
        macros.fiber_g,
        macros.sugar_g,
        macros.sat_fat_g,
        macros.sodium_mg,
        macros.potassium_mg,
        macros.calcium_mg,
        macros.magnesium_mg,
        macros.iron_mg,
        args.id,
      );
    touchMeal(ctx, existing.meal_id);
  });
  tx();
  return getMeal(ctx, existing.meal_id);
};

export const removeMealComponent = (ctx: Ctx, id: string): MealDto => {
  const existing = fetchComponentOrThrow(ctx, id);
  const tx = ctx.db.transaction(() => {
    if (existing.batch_id && existing.grams !== null) {
      refundBatch(ctx, existing.batch_id, existing.grams);
    }
    ctx.db.prepare('DELETE FROM meal_components WHERE id = ?').run(id);
    touchMeal(ctx, existing.meal_id);
  });
  tx();
  return getMeal(ctx, existing.meal_id);
};

// Agent-facing variants: bundle the meal with the running daily rollup so the
// agent can report "this meal + where the day stands" in a single round-trip,
// instead of chasing every mutation with a separate daily_summary call. REST
// keeps calling the plain functions above.

export type MealWithDay = { meal: MealDto; day: DailySummary };

const withDay = (ctx: Ctx, meal: MealDto): MealWithDay => ({
  meal,
  day: dailySummary(ctx, { date: meal.date }),
});

export const logMealWithDay = (ctx: Ctx, input: LogMealInput): MealWithDay =>
  withDay(ctx, logMeal(ctx, input));

export const addMealComponentWithDay = (
  ctx: Ctx,
  args: { meal_id: string; component: MealComponentInput },
): MealWithDay => withDay(ctx, addMealComponent(ctx, args));

export const updateMealComponentWithDay = (ctx: Ctx, args: UpdateMealComponentInput): MealWithDay =>
  withDay(ctx, updateMealComponent(ctx, args));

export const removeMealComponentWithDay = (ctx: Ctx, id: string): MealWithDay =>
  withDay(ctx, removeMealComponent(ctx, id));

export const deleteMealWithDay = (
  ctx: Ctx,
  id: string,
): { deleted: { id: string }; day: DailySummary } => {
  const { date } = fetchMealRow(ctx, id);
  const deleted = deleteMeal(ctx, id);
  return { deleted, day: dailySummary(ctx, { date }) };
};

export const undoLastMealWithDay = (ctx: Ctx): { meal: MealDto | null; day: DailySummary } => {
  const meal = undoLastMeal(ctx);
  const date = meal?.date ?? toLocalDate(nowIso(), ctx.config.tz);
  return { meal, day: dailySummary(ctx, { date }) };
};
