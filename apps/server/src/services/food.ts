import type { CustomFoodSpec } from '@health-mcp/shared';
import { fetchOffByBarcode } from '../providers/openfoodfacts.js';
import { fetchUsdaSearch } from '../providers/usda.js';
import { cuid } from '../util/id.js';
import { buildFtsMatch, normalizeTokens, scoreFood } from './food-search.js';
import { type Ctx, ServiceError } from './types.js';

export type FoodRow = {
  id: string;
  source: 'usda' | 'off' | 'manual';
  source_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_grams: number | null;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  created_at: string;
};

// FTS recall pool reranked in JS; bm25 already front-loads the most relevant rows.
const CANDIDATE_POOL = 200;
// When every query token is a typo, FTS recalls nothing; rerank a bounded window instead.
const FUZZY_SCAN_CAP = 2000;

const rankFoods = (tokens: string[], pool: FoodRow[], limit: number): FoodRow[] =>
  pool
    .map((food) => ({ food, score: scoreFood(tokens, food) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((s) => s.food);

export const searchFoodLocal = (ctx: Ctx, query: string, limit = 20): FoodRow[] => {
  const tokens = normalizeTokens(query);
  if (tokens.length === 0) return [];
  const candidates = ctx.db
    .prepare(
      `SELECT f.* FROM foods_fts JOIN foods f ON f.rowid = foods_fts.rowid
       WHERE foods_fts MATCH ? ORDER BY rank LIMIT ?`,
    )
    .all(buildFtsMatch(tokens), CANDIDATE_POOL) as FoodRow[];
  if (candidates.length > 0) return rankFoods(tokens, candidates, limit);
  const recent = ctx.db
    .prepare(`SELECT * FROM foods ORDER BY source = 'manual' DESC, created_at DESC LIMIT ?`)
    .all(FUZZY_SCAN_CAP) as FoodRow[];
  return rankFoods(tokens, recent, limit);
};

export const upsertFood = (
  ctx: Ctx,
  row: Omit<FoodRow, 'id' | 'created_at'> & { raw_json?: string },
): FoodRow => {
  if (row.source_id) {
    const existing = ctx.db
      .prepare('SELECT * FROM foods WHERE source = ? AND source_id = ?')
      .get(row.source, row.source_id) as FoodRow | undefined;
    if (existing) return existing;
  }
  const id = cuid();
  ctx.db
    .prepare(
      `INSERT INTO foods (id, source, source_id, name, brand, barcode, serving_grams,
        kcal_per_100g, protein_g, carb_g, fat_g, fiber_g, sugar_g, sat_fat_g, sodium_mg, raw_json)
       VALUES (@id, @source, @source_id, @name, @brand, @barcode, @serving_grams,
        @kcal_per_100g, @protein_g, @carb_g, @fat_g, @fiber_g, @sugar_g, @sat_fat_g, @sodium_mg, @raw_json)`,
    )
    .run({
      id,
      source: row.source,
      source_id: row.source_id,
      name: row.name,
      brand: row.brand ?? null,
      barcode: row.barcode ?? null,
      serving_grams: row.serving_grams ?? null,
      kcal_per_100g: row.kcal_per_100g,
      protein_g: row.protein_g,
      carb_g: row.carb_g,
      fat_g: row.fat_g,
      fiber_g: row.fiber_g ?? null,
      sugar_g: row.sugar_g ?? null,
      sat_fat_g: row.sat_fat_g ?? null,
      sodium_mg: row.sodium_mg ?? null,
      raw_json: row.raw_json ?? null,
    });
  const created = ctx.db.prepare('SELECT * FROM foods WHERE id = ?').get(id) as FoodRow;
  return created;
};

export const getFood = (ctx: Ctx, id: string): FoodRow => {
  const row = ctx.db.prepare('SELECT * FROM foods WHERE id = ?').get(id) as FoodRow | undefined;
  if (!row) throw new ServiceError('food_not_found', `food ${id} not found`, 404);
  return row;
};

export const searchFood = async (
  ctx: Ctx,
  args: { query: string; source?: 'usda' | 'off' | 'manual'; limit?: number },
): Promise<FoodRow[]> => {
  const limit = args.limit ?? 5;
  const local = searchFoodLocal(ctx, args.query, limit);
  if (local.length >= limit || args.source === 'manual') return local;
  if (args.source && args.source !== 'usda') return local;
  if (!ctx.config.usdaApiKey) return local;
  try {
    const remote = await fetchUsdaSearch(args.query, ctx.config.usdaApiKey, limit - local.length);
    const merged: FoodRow[] = [...local];
    for (const r of remote) {
      const row = upsertFood(ctx, {
        source: 'usda',
        source_id: r.source_id,
        name: r.name,
        brand: r.brand ?? null,
        barcode: null,
        serving_grams: r.serving_grams ?? null,
        kcal_per_100g: r.kcal_per_100g,
        protein_g: r.protein_g,
        carb_g: r.carb_g,
        fat_g: r.fat_g,
        fiber_g: r.fiber_g ?? null,
        sugar_g: r.sugar_g ?? null,
        sat_fat_g: r.sat_fat_g ?? null,
        sodium_mg: r.sodium_mg ?? null,
        raw_json: r.raw_json,
      });
      merged.push(row);
      if (merged.length >= limit) break;
    }
    return merged;
  } catch (err) {
    ctx.logger.warn('usda search failed', { error: (err as Error).message });
    return local;
  }
};

export type FoodQueryResult = { query: string; results: FoodRow[] };

export const searchFoods = async (
  ctx: Ctx,
  args: { queries: string[]; source?: 'usda' | 'off' | 'manual'; limit?: number },
): Promise<FoodQueryResult[]> => {
  const unique = Array.from(new Set(args.queries));
  const settled = await Promise.all(
    unique.map((query) => searchFood(ctx, { query, source: args.source, limit: args.limit })),
  );
  const byQuery = new Map(unique.map((q, i) => [q, settled[i]!]));
  return args.queries.map((query) => ({ query, results: byQuery.get(query) ?? [] }));
};

export const lookupBarcode = async (ctx: Ctx, barcode: string): Promise<FoodRow | null> => {
  const local = ctx.db.prepare('SELECT * FROM foods WHERE barcode = ? LIMIT 1').get(barcode) as
    | FoodRow
    | undefined;
  if (local) return local;
  try {
    const remote = await fetchOffByBarcode(barcode);
    if (!remote) return null;
    return upsertFood(ctx, {
      source: 'off',
      source_id: remote.source_id,
      name: remote.name,
      brand: remote.brand ?? null,
      barcode,
      serving_grams: remote.serving_grams ?? null,
      kcal_per_100g: remote.kcal_per_100g,
      protein_g: remote.protein_g,
      carb_g: remote.carb_g,
      fat_g: remote.fat_g,
      fiber_g: remote.fiber_g ?? null,
      sugar_g: remote.sugar_g ?? null,
      sat_fat_g: remote.sat_fat_g ?? null,
      sodium_mg: remote.sodium_mg ?? null,
      raw_json: remote.raw_json,
    });
  } catch (err) {
    ctx.logger.warn('off lookup failed', { error: (err as Error).message });
    return null;
  }
};

export type CreateCustomFoodArgs = {
  name: string;
  brand?: string;
  serving_grams?: number;
  nutrients_per_100g: {
    kcal_per_100g: number;
    protein_g_per_100g: number;
    carb_g_per_100g: number;
    fat_g_per_100g: number;
    fiber_g_per_100g?: number;
    sugar_g_per_100g?: number;
    sat_fat_g_per_100g?: number;
    sodium_mg_per_100g?: number;
  };
};

export const createCustomFood = (ctx: Ctx, args: CreateCustomFoodArgs): FoodRow => {
  const n = args.nutrients_per_100g;
  return upsertFood(ctx, {
    source: 'manual',
    source_id: null,
    name: args.name,
    brand: args.brand ?? null,
    barcode: null,
    serving_grams: args.serving_grams ?? null,
    kcal_per_100g: n.kcal_per_100g,
    protein_g: n.protein_g_per_100g,
    carb_g: n.carb_g_per_100g,
    fat_g: n.fat_g_per_100g,
    fiber_g: n.fiber_g_per_100g ?? null,
    sugar_g: n.sugar_g_per_100g ?? null,
    sat_fat_g: n.sat_fat_g_per_100g ?? null,
    sodium_mg: n.sodium_mg_per_100g ?? null,
  });
};

export const updateCustomFood = (
  ctx: Ctx,
  args: { id: string } & Partial<CreateCustomFoodArgs>,
): FoodRow => {
  const existing = getFood(ctx, args.id);
  if (existing.source !== 'manual') {
    throw new ServiceError('not_custom', `food ${args.id} is not a custom food`, 400);
  }
  const n = args.nutrients_per_100g;
  ctx.db
    .prepare(
      `UPDATE foods SET
        name = COALESCE(?, name),
        brand = COALESCE(?, brand),
        serving_grams = COALESCE(?, serving_grams),
        kcal_per_100g = COALESCE(?, kcal_per_100g),
        protein_g = COALESCE(?, protein_g),
        carb_g = COALESCE(?, carb_g),
        fat_g = COALESCE(?, fat_g),
        fiber_g = COALESCE(?, fiber_g),
        sugar_g = COALESCE(?, sugar_g),
        sat_fat_g = COALESCE(?, sat_fat_g),
        sodium_mg = COALESCE(?, sodium_mg)
      WHERE id = ?`,
    )
    .run(
      args.name ?? null,
      args.brand ?? null,
      args.serving_grams ?? null,
      n?.kcal_per_100g ?? null,
      n?.protein_g_per_100g ?? null,
      n?.carb_g_per_100g ?? null,
      n?.fat_g_per_100g ?? null,
      n?.fiber_g_per_100g ?? null,
      n?.sugar_g_per_100g ?? null,
      n?.sat_fat_g_per_100g ?? null,
      n?.sodium_mg_per_100g ?? null,
      args.id,
    );
  return getFood(ctx, args.id);
};

export const deleteCustomFood = (ctx: Ctx, id: string): void => {
  const existing = getFood(ctx, id);
  if (existing.source !== 'manual') {
    throw new ServiceError('not_custom', `food ${id} is not a custom food`, 400);
  }
  ctx.db.prepare('DELETE FROM foods WHERE id = ?').run(id);
};

export type Macros = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};

const scaleOrNull = (v: number | null, factor: number): number | null =>
  v === null ? null : v * factor;

export const scaleMacros = (m: Macros, factor: number): Macros => ({
  kcal: m.kcal * factor,
  protein_g: m.protein_g * factor,
  carb_g: m.carb_g * factor,
  fat_g: m.fat_g * factor,
  fiber_g: scaleOrNull(m.fiber_g, factor),
  sugar_g: scaleOrNull(m.sugar_g, factor),
  sat_fat_g: scaleOrNull(m.sat_fat_g, factor),
  sodium_mg: scaleOrNull(m.sodium_mg, factor),
});

export const emptyMacros = (): Macros => ({
  kcal: 0,
  protein_g: 0,
  carb_g: 0,
  fat_g: 0,
  fiber_g: null,
  sugar_g: null,
  sat_fat_g: null,
  sodium_mg: null,
});

export const accumulateMacros = (totals: Macros, m: Macros): void => {
  totals.kcal += m.kcal;
  totals.protein_g += m.protein_g;
  totals.carb_g += m.carb_g;
  totals.fat_g += m.fat_g;
  totals.fiber_g = (totals.fiber_g ?? 0) + (m.fiber_g ?? 0);
  totals.sugar_g = (totals.sugar_g ?? 0) + (m.sugar_g ?? 0);
  totals.sat_fat_g = (totals.sat_fat_g ?? 0) + (m.sat_fat_g ?? 0);
  totals.sodium_mg = (totals.sodium_mg ?? 0) + (m.sodium_mg ?? 0);
};

export const macrosForFoodGrams = (food: FoodRow, grams: number): Macros =>
  scaleMacros(
    {
      kcal: food.kcal_per_100g,
      protein_g: food.protein_g,
      carb_g: food.carb_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g,
      sugar_g: food.sugar_g,
      sat_fat_g: food.sat_fat_g,
      sodium_mg: food.sodium_mg,
    },
    grams / 100,
  );

export const macrosForCustom = (spec: CustomFoodSpec, grams: number): Macros => {
  if ('absolute' in spec) {
    const a = spec.absolute;
    return {
      kcal: a.kcal,
      protein_g: a.protein_g,
      carb_g: a.carb_g,
      fat_g: a.fat_g,
      fiber_g: a.fiber_g ?? null,
      sugar_g: a.sugar_g ?? null,
      sat_fat_g: a.sat_fat_g ?? null,
      sodium_mg: a.sodium_mg ?? null,
    };
  }
  return scaleMacros(
    {
      kcal: spec.kcal_per_100g,
      protein_g: spec.protein_g_per_100g,
      carb_g: spec.carb_g_per_100g,
      fat_g: spec.fat_g_per_100g,
      fiber_g: spec.fiber_g_per_100g ?? null,
      sugar_g: spec.sugar_g_per_100g ?? null,
      sat_fat_g: spec.sat_fat_g_per_100g ?? null,
      sodium_mg: spec.sodium_mg_per_100g ?? null,
    },
    grams / 100,
  );
};
