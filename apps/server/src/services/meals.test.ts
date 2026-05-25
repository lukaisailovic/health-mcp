import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { createCustomFood } from './food.js';
import {
  addMealComponent,
  deleteMeal,
  listMeals,
  logMeal,
  removeMealComponent,
  undoLastMeal,
  updateMealComponent,
} from './meals.js';
import { createBatch, createRecipe, getBatch } from './recipes.js';
import { ServiceError } from './types.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

const eggFood = () =>
  createCustomFood(ctx, {
    name: 'Egg',
    nutrients_per_100g: {
      kcal_per_100g: 155,
      protein_g_per_100g: 13,
      carb_g_per_100g: 1.1,
      fat_g_per_100g: 11,
    },
  });

const riceFood = () =>
  createCustomFood(ctx, {
    name: 'Rice',
    nutrients_per_100g: {
      kcal_per_100g: 130,
      protein_g_per_100g: 2.7,
      carb_g_per_100g: 28,
      fat_g_per_100g: 0.3,
    },
  });

describe('meals — log_meal', () => {
  it('creates a meal with one food component and derives macros', () => {
    const food = eggFood();
    const meal = logMeal(ctx, {
      meal_type: 'breakfast',
      components: [{ ref: 'food', food_id: food.id, grams: 100 }],
    });
    expect(meal.components.length).toBe(1);
    expect(meal.components[0]!.kcal).toBeCloseTo(155, 5);
    expect(meal.totals.kcal).toBeCloseTo(155, 5);
    expect(meal.meal_type).toBe('breakfast');
  });

  it('aggregates totals across multiple components', () => {
    const egg = eggFood();
    const rice = riceFood();
    const meal = logMeal(ctx, {
      meal_type: 'lunch',
      name: 'Egg over rice',
      components: [
        { ref: 'food', food_id: egg.id, grams: 100 },
        { ref: 'food', food_id: rice.id, grams: 200 },
      ],
    });
    expect(meal.components.length).toBe(2);
    expect(meal.totals.kcal).toBeCloseTo(155 + 260, 5);
    expect(meal.name).toBe('Egg over rice');
  });

  it('atomic batch decrement across components', () => {
    const rice = riceFood();
    const recipe = createRecipe(ctx, {
      name: 'Rice bowl',
      servings: 2,
      ingredients: [{ food_id: rice.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 600 });
    const before = getBatch(ctx, batch.id);
    logMeal(ctx, {
      meal_type: 'dinner',
      components: [
        { ref: 'batch', batch_id: batch.id, grams: 150 },
        { ref: 'food', food_id: rice.id, grams: 50 },
      ],
    });
    expect(getBatch(ctx, batch.id).remaining_grams).toBeCloseTo(before.remaining_grams - 150, 5);
  });

  it('fails atomically when batch would go negative', () => {
    const rice = riceFood();
    const recipe = createRecipe(ctx, {
      name: 'Rice bowl',
      servings: 2,
      ingredients: [{ food_id: rice.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 100 });
    expect(() =>
      logMeal(ctx, {
        meal_type: 'dinner',
        components: [{ ref: 'batch', batch_id: batch.id, grams: 200 }],
      }),
    ).toThrow(ServiceError);
    expect(listMeals(ctx, {})).toEqual([]);
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(100);
  });

  it('logs a custom component', () => {
    const meal = logMeal(ctx, {
      meal_type: 'snack',
      components: [
        {
          ref: 'custom',
          custom: {
            name: 'Apple slice',
            kcal_per_100g: 52,
            protein_g_per_100g: 0.3,
            carb_g_per_100g: 14,
            fat_g_per_100g: 0.2,
          },
          grams: 200,
        },
      ],
    });
    const c = meal.components[0]!;
    expect(c.custom_name).toBe('Apple slice');
    expect(c.ref_kind).toBe('custom');
    expect(c.kcal).toBeCloseTo(104, 5);
  });
});

describe('meals — component edits', () => {
  it('update_meal_component re-derives macros when grams change', () => {
    const egg = eggFood();
    const meal = logMeal(ctx, {
      meal_type: 'breakfast',
      components: [{ ref: 'food', food_id: egg.id, grams: 100 }],
    });
    const componentId = meal.components[0]!.id;
    const updated = updateMealComponent(ctx, { id: componentId, grams: 50 });
    expect(updated.components[0]!.kcal).toBeCloseTo(77.5, 5);
  });

  it('rejects grams change on a custom component', () => {
    const meal = logMeal(ctx, {
      meal_type: 'snack',
      components: [
        {
          ref: 'custom',
          custom: {
            name: 'Coffee',
            kcal_per_100g: 60,
            protein_g_per_100g: 1,
            carb_g_per_100g: 2,
            fat_g_per_100g: 5,
          },
          grams: 100,
        },
      ],
    });
    const componentId = meal.components[0]!.id;
    expect(() => updateMealComponent(ctx, { id: componentId, grams: 50 })).toThrow(ServiceError);
  });

  it('add_meal_component appends and updates totals', () => {
    const egg = eggFood();
    const rice = riceFood();
    const meal = logMeal(ctx, {
      meal_type: 'lunch',
      components: [{ ref: 'food', food_id: egg.id, grams: 100 }],
    });
    const updated = addMealComponent(ctx, {
      meal_id: meal.id,
      component: { ref: 'food', food_id: rice.id, grams: 100 },
    });
    expect(updated.components.length).toBe(2);
    expect(updated.totals.kcal).toBeCloseTo(155 + 130, 5);
  });

  it('remove_meal_component refunds batch grams', () => {
    const rice = riceFood();
    const recipe = createRecipe(ctx, {
      name: 'Rice bowl',
      servings: 2,
      ingredients: [{ food_id: rice.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 500 });
    const meal = logMeal(ctx, {
      meal_type: 'dinner',
      components: [{ ref: 'batch', batch_id: batch.id, grams: 100 }],
    });
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(400);
    removeMealComponent(ctx, meal.components[0]!.id);
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(500);
  });
});

describe('meals — meal-level ops', () => {
  it('delete_meal refunds batches and removes components', () => {
    const rice = riceFood();
    const recipe = createRecipe(ctx, {
      name: 'Rice bowl',
      servings: 2,
      ingredients: [{ food_id: rice.id, grams: 300 }],
    });
    const batch = createBatch(ctx, { recipe_id: recipe.recipe.id, total_grams: 500 });
    const meal = logMeal(ctx, {
      meal_type: 'dinner',
      components: [{ ref: 'batch', batch_id: batch.id, grams: 200 }],
    });
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(300);
    deleteMeal(ctx, meal.id);
    expect(getBatch(ctx, batch.id).remaining_grams).toBe(500);
    expect(listMeals(ctx, {})).toEqual([]);
  });

  it('undo_last_meal pops the most recent meal', () => {
    const egg = eggFood();
    logMeal(ctx, {
      meal_type: 'breakfast',
      components: [{ ref: 'food', food_id: egg.id, grams: 50 }],
    });
    const popped = undoLastMeal(ctx);
    expect(popped).not.toBeNull();
    expect(listMeals(ctx, {})).toEqual([]);
  });
});
