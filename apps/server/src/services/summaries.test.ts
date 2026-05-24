import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { createCustomFood } from './food.js';
import { setGoals } from './goals.js';
import { logIntake } from './intake.js';
import { logHydration } from './simple-logs.js';
import { dailySummary } from './summaries.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('summaries', () => {
  it('daily summary aggregates intake + hydration and subtracts from goals', () => {
    setGoals(ctx, { kcal: 2000, protein_g: 150, hydration_ml: 2500 });
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
    logIntake(ctx, { ts: today, items: [{ ref: 'food', food_id: food.id, grams: 200 }] });
    logHydration(ctx, { ml: 500, ts: today });
    const s = dailySummary(ctx);
    expect(s.totals.kcal).toBeCloseTo(500, 5);
    expect(s.totals.hydration_ml).toBe(500);
    expect(s.remaining.kcal).toBeCloseTo(1500, 5);
    expect(s.remaining.hydration_ml).toBe(2000);
  });
});
