import type { IntakeItem, LogIntakeInput, MealType } from '@health-mcp/shared';
import { cuid } from '../util/id.js';
import { deriveMealType, nowIso, toLocalDate } from '../util/tz.js';
import {
  type Macros,
  accumulateMacros,
  emptyMacros,
  getFood,
  macrosForCustom,
  macrosForFoodGrams,
  scaleMacros,
} from './food.js';
import { type Ctx, ServiceError } from './types.js';

export type IntakeEntry = {
  id: string;
  ts: string;
  date: string;
  meal_type: MealType;
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
  confidence: number;
  source_trace: string;
  notes: string | null;
  tags: string | null;
  created_at: string;
};

export type LogIntakeResult = {
  entries: IntakeEntry[];
  batch_remaining: { batch_id: string; remaining_grams: number }[];
};

const insertEntry = (ctx: Ctx, e: Omit<IntakeEntry, 'created_at'>): IntakeEntry => {
  ctx.db
    .prepare(
      `INSERT INTO intake_entries (
        id, ts, date, meal_type, ref_kind, food_id, recipe_id, batch_id, custom_name,
        grams, servings, kcal, protein_g, carb_g, fat_g, fiber_g, sugar_g, sat_fat_g, sodium_mg,
        confidence, source_trace, notes, tags
      ) VALUES (
        @id, @ts, @date, @meal_type, @ref_kind, @food_id, @recipe_id, @batch_id, @custom_name,
        @grams, @servings, @kcal, @protein_g, @carb_g, @fat_g, @fiber_g, @sugar_g, @sat_fat_g, @sodium_mg,
        @confidence, @source_trace, @notes, @tags
      )`,
    )
    .run(e);
  return ctx.db.prepare('SELECT * FROM intake_entries WHERE id = ?').get(e.id) as IntakeEntry;
};

const deriveForItem = (
  ctx: Ctx,
  item: IntakeItem,
): {
  ref_kind: IntakeEntry['ref_kind'];
  food_id: string | null;
  recipe_id: string | null;
  batch_id: string | null;
  custom_name: string | null;
  grams: number | null;
  servings: number | null;
  macros: Macros;
  batch_remaining?: number;
} => {
  if (item.ref === 'food') {
    const food = getFood(ctx, item.food_id);
    return {
      ref_kind: 'food',
      food_id: food.id,
      recipe_id: null,
      batch_id: null,
      custom_name: null,
      grams: item.grams,
      servings: null,
      macros: macrosForFoodGrams(food, item.grams),
    };
  }
  if (item.ref === 'recipe_serving') {
    const recipe = ctx.db.prepare('SELECT * FROM recipes WHERE id = ?').get(item.recipe_id) as
      | { id: string; servings: number }
      | undefined;
    if (!recipe)
      throw new ServiceError('recipe_not_found', `recipe ${item.recipe_id} not found`, 404);
    const totals = computeRecipeTotals(ctx, item.recipe_id);
    return {
      ref_kind: 'recipe_serving',
      food_id: null,
      recipe_id: item.recipe_id,
      batch_id: null,
      custom_name: null,
      grams: null,
      servings: item.servings,
      macros: scaleMacros(totals, item.servings / recipe.servings),
    };
  }
  if (item.ref === 'batch') {
    const batch = ctx.db.prepare('SELECT * FROM batches WHERE id = ?').get(item.batch_id) as
      | {
          id: string;
          total_grams: number;
          remaining_grams: number;
          kcal_total: number;
          protein_g_total: number;
          carb_g_total: number;
          fat_g_total: number;
          fiber_g_total: number | null;
          sugar_g_total: number | null;
          sat_fat_g_total: number | null;
          sodium_mg_total: number | null;
        }
      | undefined;
    if (!batch) throw new ServiceError('batch_not_found', `batch ${item.batch_id} not found`, 404);
    if (item.grams > batch.remaining_grams) {
      throw new ServiceError(
        'batch_insufficient',
        `batch ${item.batch_id} has ${batch.remaining_grams}g remaining; requested ${item.grams}g`,
        400,
      );
    }
    const macros = scaleMacros(
      {
        kcal: batch.kcal_total,
        protein_g: batch.protein_g_total,
        carb_g: batch.carb_g_total,
        fat_g: batch.fat_g_total,
        fiber_g: batch.fiber_g_total,
        sugar_g: batch.sugar_g_total,
        sat_fat_g: batch.sat_fat_g_total,
        sodium_mg: batch.sodium_mg_total,
      },
      item.grams / batch.total_grams,
    );
    return {
      ref_kind: 'batch',
      food_id: null,
      recipe_id: null,
      batch_id: item.batch_id,
      custom_name: null,
      grams: item.grams,
      servings: null,
      macros,
      batch_remaining: batch.remaining_grams - item.grams,
    };
  }
  // custom
  const macros = macrosForCustom(item.custom, item.grams);
  return {
    ref_kind: 'custom',
    food_id: null,
    recipe_id: null,
    batch_id: null,
    custom_name: item.custom.name,
    grams: item.grams,
    servings: null,
    macros,
  };
};

const computeRecipeTotals = (ctx: Ctx, recipeId: string): Macros => {
  const rows = ctx.db
    .prepare(
      'SELECT food_id, grams FROM recipe_ingredients WHERE recipe_id = ? AND food_id IS NOT NULL',
    )
    .all(recipeId) as { food_id: string; grams: number }[];
  const totals = emptyMacros();
  for (const r of rows) {
    accumulateMacros(totals, macrosForFoodGrams(getFood(ctx, r.food_id), r.grams));
  }
  return totals;
};

export const logIntake = (ctx: Ctx, input: LogIntakeInput): LogIntakeResult => {
  const ts = input.ts ?? nowIso();
  const date = toLocalDate(ts, ctx.config.tz);
  const meal_type = input.meal_type ?? deriveMealType(ts, ctx.config.tz);
  const notes = input.notes ?? null;
  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;

  const result: LogIntakeResult = { entries: [], batch_remaining: [] };
  const batchDeltas = new Map<string, number>();

  const tx = ctx.db.transaction(() => {
    for (const item of input.items) {
      const derived = deriveForItem(ctx, item);
      const e: Omit<IntakeEntry, 'created_at'> = {
        id: cuid(),
        ts,
        date,
        meal_type,
        ref_kind: derived.ref_kind,
        food_id: derived.food_id,
        recipe_id: derived.recipe_id,
        batch_id: derived.batch_id,
        custom_name: derived.custom_name,
        grams: derived.grams,
        servings: derived.servings,
        kcal: derived.macros.kcal,
        protein_g: derived.macros.protein_g,
        carb_g: derived.macros.carb_g,
        fat_g: derived.macros.fat_g,
        fiber_g: derived.macros.fiber_g,
        sugar_g: derived.macros.sugar_g,
        sat_fat_g: derived.macros.sat_fat_g,
        sodium_mg: derived.macros.sodium_mg,
        confidence: item.confidence ?? 1,
        source_trace: item.source_trace ?? 'manual',
        notes,
        tags: tagsJson,
      };
      const created = insertEntry(ctx, e);
      result.entries.push(created);
      if (derived.batch_id && derived.grams !== null) {
        batchDeltas.set(derived.batch_id, (batchDeltas.get(derived.batch_id) ?? 0) + derived.grams);
      }
    }
    for (const [batchId, delta] of batchDeltas.entries()) {
      const updated = ctx.db
        .prepare(
          'UPDATE batches SET remaining_grams = remaining_grams - ? WHERE id = ? RETURNING remaining_grams',
        )
        .get(delta, batchId) as { remaining_grams: number } | undefined;
      if (!updated) throw new ServiceError('batch_not_found', batchId, 404);
      if (updated.remaining_grams < 0) {
        throw new ServiceError('batch_insufficient', `batch ${batchId} went negative`, 400);
      }
      result.batch_remaining.push({ batch_id: batchId, remaining_grams: updated.remaining_grams });
    }
  });
  tx();
  return result;
};

export const listIntake = (
  ctx: Ctx,
  args: { date?: string; start?: string; end?: string; meal_type?: MealType; limit?: number },
): Array<IntakeEntry & { display_name: string | null }> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    conditions.push('ie.date = ?');
    params.push(args.date);
  }
  if (args.start) {
    conditions.push('ie.ts >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conditions.push('ie.ts <= ?');
    params.push(args.end);
  }
  if (args.meal_type) {
    conditions.push('ie.meal_type = ?');
    params.push(args.meal_type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = args.limit ?? 200;
  params.push(limit);
  return ctx.db
    .prepare(
      `SELECT ie.*,
              COALESCE(ie.custom_name, f.name, r.name, b.name) AS display_name
       FROM intake_entries ie
       LEFT JOIN foods f ON f.id = ie.food_id
       LEFT JOIN recipes r ON r.id = ie.recipe_id
       LEFT JOIN batches b ON b.id = ie.batch_id
       ${where}
       ORDER BY ie.ts DESC
       LIMIT ?`,
    )
    .all(...params) as Array<IntakeEntry & { display_name: string | null }>;
};

export const deleteIntake = (ctx: Ctx, id: string): { id: string; batch_id: string | null } => {
  const existing = ctx.db.prepare('SELECT * FROM intake_entries WHERE id = ?').get(id) as
    | IntakeEntry
    | undefined;
  if (!existing) throw new ServiceError('intake_not_found', `intake ${id} not found`, 404);
  const tx = ctx.db.transaction(() => {
    if (existing.batch_id && existing.grams !== null) {
      ctx.db
        .prepare('UPDATE batches SET remaining_grams = remaining_grams + ? WHERE id = ?')
        .run(existing.grams, existing.batch_id);
    }
    ctx.db.prepare('DELETE FROM intake_entries WHERE id = ?').run(id);
  });
  tx();
  return { id, batch_id: existing.batch_id };
};

export const updateIntake = (
  ctx: Ctx,
  args: {
    id: string;
    grams?: number;
    servings?: number;
    meal_type?: MealType;
    notes?: string | null;
    tags?: string[];
    confidence?: number;
  },
): IntakeEntry => {
  const existing = ctx.db.prepare('SELECT * FROM intake_entries WHERE id = ?').get(args.id) as
    | IntakeEntry
    | undefined;
  if (!existing) throw new ServiceError('intake_not_found', `intake ${args.id} not found`, 404);

  const tx = ctx.db.transaction(() => {
    let newGrams = existing.grams;
    let newServings = existing.servings;
    let recalcMacros = false;
    if (args.grams !== undefined && existing.ref_kind === 'custom') {
      throw new ServiceError(
        'custom_intake_grams_unchangeable',
        'cannot change grams on a custom intake entry; delete and re-log with new grams',
        400,
      );
    }
    if (args.grams !== undefined && existing.ref_kind !== 'recipe_serving') {
      if (existing.ref_kind === 'batch' && existing.batch_id && existing.grams !== null) {
        const delta = args.grams - existing.grams;
        if (delta !== 0) {
          ctx.db
            .prepare('UPDATE batches SET remaining_grams = remaining_grams - ? WHERE id = ?')
            .run(delta, existing.batch_id);
          const b = ctx.db
            .prepare('SELECT remaining_grams FROM batches WHERE id = ?')
            .get(existing.batch_id) as { remaining_grams: number };
          if (b.remaining_grams < 0) {
            throw new ServiceError(
              'batch_insufficient',
              `batch ${existing.batch_id} cannot supply requested grams`,
              400,
            );
          }
        }
      }
      newGrams = args.grams;
      recalcMacros = true;
    }
    if (args.servings !== undefined && existing.ref_kind === 'recipe_serving') {
      newServings = args.servings;
      recalcMacros = true;
    }

    let macros = {
      kcal: existing.kcal,
      protein_g: existing.protein_g,
      carb_g: existing.carb_g,
      fat_g: existing.fat_g,
      fiber_g: existing.fiber_g,
      sugar_g: existing.sugar_g,
      sat_fat_g: existing.sat_fat_g,
      sodium_mg: existing.sodium_mg,
    };

    if (recalcMacros) {
      if (existing.ref_kind === 'food' && existing.food_id !== null && newGrams !== null) {
        const food = getFood(ctx, existing.food_id);
        macros = macrosForFoodGrams(food, newGrams);
      } else if (existing.ref_kind === 'batch' && existing.batch_id && newGrams !== null) {
        const batch = ctx.db
          .prepare(
            'SELECT total_grams, kcal_total, protein_g_total, carb_g_total, fat_g_total, fiber_g_total, sugar_g_total, sat_fat_g_total, sodium_mg_total FROM batches WHERE id = ?',
          )
          .get(existing.batch_id) as {
          total_grams: number;
          kcal_total: number;
          protein_g_total: number;
          carb_g_total: number;
          fat_g_total: number;
          fiber_g_total: number | null;
          sugar_g_total: number | null;
          sat_fat_g_total: number | null;
          sodium_mg_total: number | null;
        };
        macros = scaleMacros(
          {
            kcal: batch.kcal_total,
            protein_g: batch.protein_g_total,
            carb_g: batch.carb_g_total,
            fat_g: batch.fat_g_total,
            fiber_g: batch.fiber_g_total,
            sugar_g: batch.sugar_g_total,
            sat_fat_g: batch.sat_fat_g_total,
            sodium_mg: batch.sodium_mg_total,
          },
          newGrams / batch.total_grams,
        );
      } else if (
        existing.ref_kind === 'recipe_serving' &&
        existing.recipe_id &&
        newServings !== null
      ) {
        const recipe = ctx.db
          .prepare('SELECT servings FROM recipes WHERE id = ?')
          .get(existing.recipe_id) as { servings: number };
        const totals = computeRecipeTotals(ctx, existing.recipe_id);
        macros = scaleMacros(totals, newServings / recipe.servings);
      }
    }

    ctx.db
      .prepare(
        `UPDATE intake_entries SET
          grams = ?,
          servings = ?,
          meal_type = COALESCE(?, meal_type),
          notes = ?,
          tags = COALESCE(?, tags),
          confidence = COALESCE(?, confidence),
          kcal = ?, protein_g = ?, carb_g = ?, fat_g = ?,
          fiber_g = ?, sugar_g = ?, sat_fat_g = ?, sodium_mg = ?
        WHERE id = ?`,
      )
      .run(
        newGrams,
        newServings,
        args.meal_type ?? null,
        args.notes === undefined ? existing.notes : args.notes,
        args.tags ? JSON.stringify(args.tags) : null,
        args.confidence ?? null,
        macros.kcal,
        macros.protein_g,
        macros.carb_g,
        macros.fat_g,
        macros.fiber_g,
        macros.sugar_g,
        macros.sat_fat_g,
        macros.sodium_mg,
        args.id,
      );
  });
  tx();
  return ctx.db.prepare('SELECT * FROM intake_entries WHERE id = ?').get(args.id) as IntakeEntry;
};

export const undoLastIntake = (ctx: Ctx): IntakeEntry | null => {
  const row = ctx.db
    .prepare(
      "SELECT * FROM intake_entries WHERE created_at >= datetime('now','-10 minutes') ORDER BY created_at DESC LIMIT 1",
    )
    .get() as IntakeEntry | undefined;
  if (!row) return null;
  deleteIntake(ctx, row.id);
  return row;
};
