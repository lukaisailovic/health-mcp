import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { createCustomFood } from './food.js';
import { deleteIntake, listIntake, logIntake, undoLastIntake, updateIntake } from './intake.js';
import { createBatch, createRecipe, getBatch } from './recipes.js';
import { ServiceError } from './types.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('intake / food', () => {
  it('logs intake from food with grams and derives macros', () => {
    const food = createCustomFood(ctx, {
      name: 'Egg',
      nutrients_per_100g: {
        kcal_per_100g: 155,
        protein_g_per_100g: 13,
        carb_g_per_100g: 1.1,
        fat_g_per_100g: 11,
      },
    });
    const result = logIntake(ctx, {
      items: [{ ref: 'food', food_id: food.id, grams: 100 }],
    });
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0]!;
    expect(entry.kcal).toBeCloseTo(155, 5);
    expect(entry.protein_g).toBeCloseTo(13, 5);
  });

  it('atomic logging across batch + food and decrements batch', () => {
    const food = createCustomFood(ctx, {
      name: 'Rice',
      nutrients_per_100g: {
        kcal_per_100g: 130,
        protein_g_per_100g: 2.7,
        carb_g_per_100g: 28,
        fat_g_per_100g: 0.3,
      },
    });
    const recipe = createRecipe(ctx, {
      name: 'Rice bowl',
      servings: 2,
      ingredients: [{ food_id: food.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 600 });
    const before = getBatch(ctx, batch.id);
    const r = logIntake(ctx, {
      items: [
        { ref: 'batch', batch_id: batch.id, grams: 150 },
        { ref: 'food', food_id: food.id, grams: 50 },
      ],
    });
    expect(r.entries.length).toBe(2);
    expect(r.batch_remaining[0]?.remaining_grams).toBeCloseTo(before.remaining_grams - 150, 5);
  });

  it('fails atomically when batch decrement would go negative', () => {
    const food = createCustomFood(ctx, {
      name: 'Rice',
      nutrients_per_100g: {
        kcal_per_100g: 130,
        protein_g_per_100g: 2.7,
        carb_g_per_100g: 28,
        fat_g_per_100g: 0.3,
      },
    });
    const recipe = createRecipe(ctx, {
      name: 'Rice bowl',
      servings: 2,
      ingredients: [{ food_id: food.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 100 });
    expect(() =>
      logIntake(ctx, { items: [{ ref: 'batch', batch_id: batch.id, grams: 200 }] }),
    ).toThrow(ServiceError);
    // After failure, no entry exists and batch is intact
    expect(listIntake(ctx, {})).toEqual([]);
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(100);
  });

  it('update_intake rejects grams change on a custom entry', () => {
    const r = logIntake(ctx, {
      items: [
        {
          ref: 'custom',
          grams: 100,
          custom: {
            name: 'Coffee',
            kcal_per_100g: 60,
            protein_g_per_100g: 1,
            carb_g_per_100g: 2,
            fat_g_per_100g: 5,
          },
        },
      ],
    });
    const id = r.entries[0]!.id;
    expect(() => updateIntake(ctx, { id, grams: 50 })).toThrow(ServiceError);
    const after = listIntake(ctx, {}).find((e) => e.id === id)!;
    expect(after.grams).toBe(100);
    expect(after.kcal).toBe(60);
  });

  it('update_intake re-derives macros when grams change', () => {
    const food = createCustomFood(ctx, {
      name: 'Egg',
      nutrients_per_100g: {
        kcal_per_100g: 155,
        protein_g_per_100g: 13,
        carb_g_per_100g: 1.1,
        fat_g_per_100g: 11,
      },
    });
    const r = logIntake(ctx, { items: [{ ref: 'food', food_id: food.id, grams: 100 }] });
    const id = r.entries[0]!.id;
    const updated = updateIntake(ctx, { id, grams: 50 });
    expect(updated.kcal).toBeCloseTo(77.5, 5);
  });

  it('delete_intake refunds batch grams', () => {
    const food = createCustomFood(ctx, {
      name: 'Rice',
      nutrients_per_100g: {
        kcal_per_100g: 130,
        protein_g_per_100g: 2.7,
        carb_g_per_100g: 28,
        fat_g_per_100g: 0.3,
      },
    });
    const recipe = createRecipe(ctx, {
      name: 'R',
      servings: 2,
      ingredients: [{ food_id: food.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 500 });
    const r = logIntake(ctx, { items: [{ ref: 'batch', batch_id: batch.id, grams: 100 }] });
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(400);
    deleteIntake(ctx, r.entries[0]!.id);
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(500);
  });

  it('undo_last_intake removes most recent entry', () => {
    const food = createCustomFood(ctx, {
      name: 'Egg',
      nutrients_per_100g: {
        kcal_per_100g: 155,
        protein_g_per_100g: 13,
        carb_g_per_100g: 1.1,
        fat_g_per_100g: 11,
      },
    });
    logIntake(ctx, { items: [{ ref: 'food', food_id: food.id, grams: 50 }] });
    const popped = undoLastIntake(ctx);
    expect(popped).not.toBeNull();
    expect(listIntake(ctx, {})).toEqual([]);
  });

  it('logs intake with custom inline food', () => {
    const r = logIntake(ctx, {
      items: [
        {
          ref: 'custom',
          custom: {
            name: 'Apple Slice',
            kcal_per_100g: 52,
            protein_g_per_100g: 0.3,
            carb_g_per_100g: 14,
            fat_g_per_100g: 0.2,
          },
          grams: 200,
        },
      ],
    });
    const e = r.entries[0]!;
    expect(e.custom_name).toBe('Apple Slice');
    expect(e.kcal).toBeCloseTo(104, 5);
    expect(e.ref_kind).toBe('custom');
  });
});
