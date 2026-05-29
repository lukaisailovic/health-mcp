import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { createCustomFood } from './food.js';
import { setGoals } from './goals.js';
import { logMeal } from './meals.js';
import { logHydration } from './simple-logs.js';
import { dailySummary } from './summaries.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('summaries', () => {
  it('daily summary aggregates intake + hydration and subtracts from goals', () => {
    setGoals(ctx, {
      kcal: { min: 1900, max: 2100 },
      protein_g: { min: 150 },
      sat_fat_g: { max: 13 },
      hydration_ml: { min: 2500 },
    });
    const today = new Date().toISOString();
    const food = createCustomFood(ctx, {
      name: 'Bread',
      nutrients_per_100g: {
        kcal_per_100g: 250,
        protein_g_per_100g: 8,
        carb_g_per_100g: 45,
        fat_g_per_100g: 3,
      },
    });
    logMeal(ctx, { ts: today, components: [{ ref: 'food', food_id: food.id, grams: 200 }] });
    logHydration(ctx, { ml: 500, ts: today });
    const s = dailySummary(ctx);
    expect(s.totals.kcal).toBeCloseTo(500, 5);
    expect(s.totals.hydration_ml).toBe(500);
    expect(s.delta.kcal.status).toBe('under');
    expect(s.delta.kcal.under).toBeCloseTo(1400, 5);
    expect(s.delta.hydration_ml.status).toBe('under');
    expect(s.delta.hydration_ml.under).toBe(2000);
    expect(s.delta.sat_fat_g.status).toBe('in_range');
  });

  it('flags over-target macros via delta.over', () => {
    setGoals(ctx, { sat_fat_g: { max: 5 } });
    const food = createCustomFood(ctx, {
      name: 'Butter',
      nutrients_per_100g: {
        kcal_per_100g: 717,
        protein_g_per_100g: 1,
        carb_g_per_100g: 0,
        fat_g_per_100g: 81,
        sat_fat_g_per_100g: 51,
      },
    });
    logMeal(ctx, {
      ts: new Date().toISOString(),
      components: [{ ref: 'food', food_id: food.id, grams: 20 }],
    });
    const s = dailySummary(ctx);
    expect(s.delta.sat_fat_g.status).toBe('over');
    expect(s.delta.sat_fat_g.over).toBeGreaterThan(0);
  });

  it('rolls micronutrients up into the daily totals', () => {
    const food = createCustomFood(ctx, {
      name: 'Spinach',
      nutrients_per_100g: {
        kcal_per_100g: 23,
        protein_g_per_100g: 2.9,
        carb_g_per_100g: 3.6,
        fat_g_per_100g: 0.4,
        potassium_mg_per_100g: 558,
        iron_mg_per_100g: 2.7,
      },
    });
    logMeal(ctx, {
      ts: new Date().toISOString(),
      components: [{ ref: 'food', food_id: food.id, grams: 200 }],
    });
    const s = dailySummary(ctx);
    expect(s.totals.potassium_mg).toBeCloseTo(1116, 5);
    expect(s.totals.iron_mg).toBeCloseTo(5.4, 5);
  });
});
