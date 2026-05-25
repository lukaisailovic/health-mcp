import { logIntakeInputSchema, mealTypeSchema } from '@health-mcp/shared';
import { z } from 'zod';
import {
  deleteIntake,
  listIntake,
  logIntake,
  undoLastIntake,
  updateIntake,
} from '../../services/intake.js';
import { tool } from '../tool-registry.js';

export const intakeTools = [
  tool({
    name: 'log_intake',
    description:
      'Log one or more foods/recipes/batches/custom items at a single timestamp. Atomic per call: all items + batch decrements + meal tagging happen in one transaction.',
    group: 'intake',
    inputSchema: logIntakeInputSchema,
    handler: (args, ctx) => logIntake(ctx, args),
  }),
  tool({
    name: 'update_intake',
    description:
      'Update grams/servings/meal_type/notes on an intake entry. Re-derives macros for food/batch/recipe_serving entries when grams or servings change. Custom entries cannot have grams changed — delete and re-log instead.',
    group: 'intake',
    inputSchema: z.object({
      id: z.string().min(1),
      grams: z.number().positive().optional(),
      servings: z.number().positive().optional(),
      meal_type: mealTypeSchema.optional(),
      notes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
    handler: (args, ctx) => updateIntake(ctx, args),
  }),
  tool({
    name: 'delete_intake',
    description:
      'Delete an intake entry (refunds batch remaining_grams if the entry pointed at a batch).',
    group: 'intake',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteIntake(ctx, args.id),
  }),
  tool({
    name: 'list_intake',
    description: 'List intake entries by date or time range.',
    group: 'intake',
    inputSchema: z.object({
      date: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      meal_type: mealTypeSchema.optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    handler: (args, ctx) => listIntake(ctx, args),
  }),
  tool({
    name: 'undo_last_intake',
    description: 'Pop the most recent intake entry from the last 10 minutes.',
    group: 'intake',
    inputSchema: z.object({}),
    handler: (_args, ctx) => undoLastIntake(ctx),
  }),
];
