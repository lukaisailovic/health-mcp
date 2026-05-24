import { intakeItemSchema, mealTypeSchema } from '@health-mcp/shared';
import { z } from 'zod';
import {
  forgetMeal,
  getRememberedMeal,
  listRememberedMeals,
  logRememberedMeal,
  rememberMeal,
  updateRememberedMeal,
} from '../../services/remembered-meals.js';
import type { WearableServiceCtx } from '../../services/wearables.js';
import { tool } from '../tool-registry.js';

const hasRememberedMeals = (ctx: WearableServiceCtx): boolean =>
  (ctx.db.prepare('SELECT COUNT(*) AS n FROM remembered_meals').get() as { n: number }).n > 0;

export const rememberedTools = [
  tool({
    name: 'remember_meal',
    description:
      'Label a meal for fast re-logging. Provide canonical_text (for agent re-estimation), items (resolved), or both.',
    group: 'meal',
    inputSchema: z
      .object({
        label: z.string().min(1),
        aliases: z.array(z.string()).optional(),
        default_meal_type: mealTypeSchema.optional(),
        canonical_text: z.string().optional(),
        items: z.array(intakeItemSchema).optional(),
        notes: z.string().optional(),
      })
      .refine((v) => v.canonical_text || v.items, {
        message: 'one of canonical_text or items required',
      }),
    handler: (args, ctx) => rememberMeal(ctx, args),
  }),
  tool({
    name: 'list_remembered_meals',
    description: 'List remembered meals (only registered when at least one exists).',
    group: 'meal',
    inputSchema: z.object({
      query: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    handler: (args, ctx) => listRememberedMeals(ctx, args),
    isAvailable: hasRememberedMeals,
  }),
  tool({
    name: 'get_remembered_meal',
    description: 'Fetch a remembered meal by id or label.',
    group: 'meal',
    inputSchema: z.object({ id_or_label: z.string().min(1) }),
    handler: (args, ctx) => getRememberedMeal(ctx, args.id_or_label),
    isAvailable: hasRememberedMeals,
  }),
  tool({
    name: 'update_remembered_meal',
    description: 'Update a remembered meal.',
    group: 'meal',
    inputSchema: z.object({
      id: z.string().min(1),
      label: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      default_meal_type: mealTypeSchema.nullable().optional(),
      canonical_text: z.string().nullable().optional(),
      items: z.array(intakeItemSchema).nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
    handler: (args, ctx) => updateRememberedMeal(ctx, args),
    isAvailable: hasRememberedMeals,
  }),
  tool({
    name: 'forget_meal',
    description: 'Delete a remembered meal.',
    group: 'meal',
    inputSchema: z.object({ id_or_label: z.string().min(1) }),
    handler: (args, ctx) => forgetMeal(ctx, args.id_or_label),
    isAvailable: hasRememberedMeals,
  }),
  tool({
    name: 'log_remembered_meal',
    description:
      'Re-log a remembered meal. If items_json is present it creates intake entries; otherwise returns canonical_text for agent re-estimation.',
    group: 'meal',
    inputSchema: z.object({
      id_or_label: z.string().min(1),
      ts: z.string().optional(),
      meal_type: mealTypeSchema.optional(),
      scale: z.number().positive().optional(),
    }),
    handler: (args, ctx) => logRememberedMeal(ctx, args),
    isAvailable: hasRememberedMeals,
  }),
];
