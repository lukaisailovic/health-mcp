import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import {
  bulkUpsertCustomFoods,
  createCustomFood,
  getFoodByExternalId,
  searchFoodLocal,
  searchFoods,
} from './food.js';

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

describe('search relevance', () => {
  it('returns nothing when only one token of a multi-word query matches', () => {
    addFood('dmBio Tomatenketchup');
    addFood('dmBio Spaghetti Integrale');
    expect(searchFoodLocal(ctx, 'dm red lentil pasta')).toEqual([]);
  });

  it('an alias makes a cross-language food findable as an exact hit', () => {
    createCustomFood(ctx, {
      name: 'dmBio Fusilli Rote Linsen',
      aliases: ['dm red lentil pasta'],
      nutrients_per_100g: macros,
    });
    addFood('dmBio Tomatenketchup');
    const [top] = searchFoodLocal(ctx, 'dm red lentil pasta');
    expect(top?.name).toBe('dmBio Fusilli Rote Linsen');
    expect(top?.exact).toBe(true);
  });

  it('trims the loose tail when there is a clear winner', () => {
    addFood('Egg White');
    addFood('Egg');
    addFood('White Bread');
    addFood('Baked White Potato');
    expect(names('egg white')).toEqual(['Egg White']);
  });

  it('attaches a 0..1 score and an exact flag to each hit', () => {
    addFood('Chicken Breast');
    const [hit] = searchFoodLocal(ctx, 'chicken breast');
    expect(hit?.score).toBeGreaterThan(0.8);
    expect(hit?.score).toBeLessThanOrEqual(1);
    expect(hit?.exact).toBe(true);
  });
});

describe('bulkUpsertCustomFoods', () => {
  it('creates new foods and reports per-item actions', () => {
    const res = bulkUpsertCustomFoods(ctx, {
      foods: [
        { name: 'Oats', external_id: 'oats', nutrients_per_100g: macros },
        { name: 'Milk', nutrients_per_100g: macros },
      ],
    });
    expect(res.created).toBe(2);
    expect(res.updated).toBe(0);
    expect(res.foods.every((f) => f.action === 'created')).toBe(true);
  });

  it('upserts on external_id instead of duplicating', () => {
    bulkUpsertCustomFoods(ctx, {
      foods: [{ name: 'Oats', external_id: 'oats', nutrients_per_100g: macros }],
    });
    const res = bulkUpsertCustomFoods(ctx, {
      foods: [
        {
          name: 'Rolled Oats',
          external_id: 'oats',
          nutrients_per_100g: { ...macros, kcal_per_100g: 389 },
        },
      ],
    });
    expect(res.created).toBe(0);
    expect(res.updated).toBe(1);
    const food = getFoodByExternalId(ctx, 'oats');
    expect(food.name).toBe('Rolled Oats');
    expect(food.kcal_per_100g).toBe(389);
  });

  it('upserts on exact (name, brand) when no external_id is given', () => {
    createCustomFood(ctx, { name: 'Banana', nutrients_per_100g: macros });
    const res = bulkUpsertCustomFoods(ctx, {
      foods: [{ name: 'banana', nutrients_per_100g: { ...macros, kcal_per_100g: 89 } }],
    });
    expect(res.updated).toBe(1);
    const hits = searchFoodLocal(ctx, 'banana');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.kcal_per_100g).toBe(89);
  });
});

describe('getFoodByExternalId', () => {
  it('resolves a plain key and an Obsidian wikilink to the same food', () => {
    createCustomFood(ctx, {
      name: 'Ketchup',
      external_id: 'dm-ketchup',
      nutrients_per_100g: macros,
    });
    expect(getFoodByExternalId(ctx, 'dm-ketchup').name).toBe('Ketchup');
    expect(getFoodByExternalId(ctx, '[[dm-ketchup|DM Ketchup]]').name).toBe('Ketchup');
  });

  it('throws when the key is unknown', () => {
    expect(() => getFoodByExternalId(ctx, 'missing')).toThrow();
  });
});

describe('micronutrients', () => {
  it('round-trips potassium/calcium/magnesium/iron on a custom food', () => {
    const food = createCustomFood(ctx, {
      name: 'Spinach',
      nutrients_per_100g: {
        ...macros,
        potassium_mg_per_100g: 558,
        calcium_mg_per_100g: 99,
        magnesium_mg_per_100g: 79,
        iron_mg_per_100g: 2.7,
      },
    });
    expect(food.potassium_mg).toBe(558);
    expect(food.calcium_mg).toBe(99);
    expect(food.magnesium_mg).toBe(79);
    expect(food.iron_mg).toBe(2.7);
  });
});
