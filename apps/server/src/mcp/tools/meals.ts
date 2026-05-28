import {
  logMealInputSchema,
  mealComponentInputSchema,
  mealTypeSchema,
  updateMealComponentInputSchema,
  updateMealInputSchema,
} from '@health-mcp/shared';
import { z } from 'zod';
import {
  addMealComponentWithDay,
  deleteMealWithDay,
  getMeal,
  listMeals,
  logMealWithDay,
  removeMealComponentWithDay,
  undoLastMealWithDay,
  updateMeal,
  updateMealComponentWithDay,
} from '../../services/meals.js';
import { tool } from '../tool-registry.js';

export const mealTools = [
  tool({
    name: 'log_meal',
    description:
      'Log a meal with one or more components (food / recipe_serving / batch / custom). Atomic: meal + components + batch decrements happen in one transaction. meal_type defaults to slot derived from ts; name is optional. ' +
      'A custom component is either per-100g ({ name, kcal_per_100g, ... } + grams, macros scale by weight) or absolute totals ({ name, absolute: { kcal, ... } }, no grams needed). ' +
      'For estimated items set source_trace ("estimate" | "agent_inference") and confidence (0..1). ' +
      'Returns { meal, day } where day is the updated daily total vs goals — no follow-up daily_summary call needed.',
    group: 'meal',
    inputSchema: logMealInputSchema,
    handler: (args, ctx) => logMealWithDay(ctx, args),
  }),
  tool({
    name: 'list_meals',
    description: 'List meals (with nested components) by date or time range.',
    group: 'meal',
    inputSchema: z.object({
      date: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      meal_type: mealTypeSchema.optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    handler: (args, ctx) => listMeals(ctx, args),
  }),
  tool({
    name: 'get_meal',
    description: 'Fetch a single meal with its components.',
    group: 'meal',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => getMeal(ctx, args.id),
  }),
  tool({
    name: 'update_meal',
    description:
      'Update meal header (meal_type, name, notes, tags). Does not affect components or macros.',
    group: 'meal',
    inputSchema: updateMealInputSchema,
    handler: (args, ctx) => updateMeal(ctx, args),
  }),
  tool({
    name: 'delete_meal',
    description:
      'Delete a meal and all its components. Refunds batch grams for any batch-referenced components. Returns { deleted, day } with the updated daily total.',
    group: 'meal',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteMealWithDay(ctx, args.id),
  }),
  tool({
    name: 'undo_last_meal',
    description:
      'Pop the most recent meal created within the last 10 minutes. Refunds any batch grams. Returns { meal, day }; meal is null if nothing was in range.',
    group: 'meal',
    inputSchema: z.object({}),
    handler: (_args, ctx) => undoLastMealWithDay(ctx),
  }),
  tool({
    name: 'add_meal_component',
    description:
      'Append a component to an existing meal. Atomic: derives macros and decrements batch grams as needed. Returns { meal, day } with the updated daily total.',
    group: 'meal',
    inputSchema: z.object({
      meal_id: z.string().min(1),
      component: mealComponentInputSchema,
    }),
    handler: (args, ctx) => addMealComponentWithDay(ctx, args),
  }),
  tool({
    name: 'update_meal_component',
    description:
      'Update a single component (grams for food/batch, servings for recipe_serving). Re-derives macros and adjusts batch grams. Custom components cannot have grams changed — remove and re-add. Returns { meal, day } with the updated daily total.',
    group: 'meal',
    inputSchema: updateMealComponentInputSchema,
    handler: (args, ctx) => updateMealComponentWithDay(ctx, args),
  }),
  tool({
    name: 'remove_meal_component',
    description:
      'Remove a single component from its meal. Refunds batch grams if applicable. The meal remains even if empty. Returns { meal, day } with the updated daily total.',
    group: 'meal',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => removeMealComponentWithDay(ctx, args.id),
  }),
];
