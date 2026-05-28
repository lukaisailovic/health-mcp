import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { createCustomFood, searchFoodLocal, searchFoods } from './food.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

const macros = {
  kcal_per_100g: 100,
  protein_g_per_100g: 1,
  carb_g_per_100g: 10,
  fat_g_per_100g: 5,
};
const addFood = (name: string, brand?: string) =>
  createCustomFood(ctx, { name, brand, nutrients_per_100g: macros });

const names = (query: string) => searchFoodLocal(ctx, query).map((f) => f.name);

describe('searchFoodLocal', () => {
  beforeEach(() => {
    addFood('TexMex BBQ Sauce');
    addFood('Chicken Breast');
    addFood('White Potato');
  });

  it.each([['tex'], ['tex bqq'], ['bbq sauce'], ['bbq (sauce)'], ['Tex sauce']])(
    'finds "TexMex BBQ Sauce" for %j',
    (query) => {
      expect(names(query)).toContain('TexMex BBQ Sauce');
    },
  );

  it('returns nothing for an unrelated query', () => {
    expect(names('quinoa salad')).toEqual([]);
  });

  it('ranks the more specific match first', () => {
    addFood('BBQ Sauce');
    expect(names('bbq sauce')[0]).toBe('BBQ Sauce');
  });

  it('falls back to a fuzzy scan when FTS recalls nothing', () => {
    expect(names('chiken')).toContain('Chicken Breast');
  });
});

describe('searchFoods', () => {
  beforeEach(() => {
    addFood('TexMex BBQ Sauce');
    addFood('Chicken Breast');
    addFood('White Potato');
  });

  it('returns one entry per input query, in order, with results per query', async () => {
    const out = await searchFoods(ctx, { queries: ['chicken', 'bbq sauce', 'quinoa'] });
    expect(out.map((r) => r.query)).toEqual(['chicken', 'bbq sauce', 'quinoa']);
    expect(out[0]!.results.map((f) => f.name)).toContain('Chicken Breast');
    expect(out[1]!.results.map((f) => f.name)).toContain('TexMex BBQ Sauce');
    expect(out[2]!.results).toEqual([]);
  });

  it('dedupes repeated queries and preserves duplicate positions', async () => {
    const out = await searchFoods(ctx, { queries: ['chicken', 'chicken'] });
    expect(out).toHaveLength(2);
    expect(out[0]!.results).toEqual(out[1]!.results);
  });

  it('caps per-query results to limit', async () => {
    for (let i = 0; i < 8; i += 1) addFood(`Chicken Variant ${i}`);
    const out = await searchFoods(ctx, { queries: ['chicken'], limit: 3 });
    expect(out[0]!.results).toHaveLength(3);
  });
});
