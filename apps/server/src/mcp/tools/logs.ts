import { MAX_TRACKED_MACROS, goalFieldSchema, trackableMacroSchema } from '@health-mcp/shared';
import { z } from 'zod';
import { getGoals, setGoals } from '../../services/goals.js';
import {
  deleteHydration,
  deleteMeasurement,
  deleteWeight,
  listHydration,
  listMeasurements,
  listWeight,
  logHydration,
  logMeasurement,
  logWeight,
} from '../../services/simple-logs.js';
import { tool } from '../tool-registry.js';

const rangeArgs = z.object({
  date: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const logTools = [
  tool({
    name: 'log_hydration',
    description: 'Record hydration in millilitres.',
    group: 'hydration',
    inputSchema: z.object({
      ml: z.number().positive(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logHydration(ctx, args),
  }),
  tool({
    name: 'list_hydration',
    description: 'List hydration entries by date or range.',
    group: 'hydration',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listHydration(ctx, args),
  }),
  tool({
    name: 'delete_hydration',
    description: 'Delete a hydration entry.',
    group: 'hydration',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteHydration(ctx, args.id),
  }),
  tool({
    name: 'log_weight',
    description: 'Record body weight (kg) + optional body fat %.',
    group: 'weight',
    inputSchema: z.object({
      kg: z.number().positive(),
      body_fat_pct: z.number().min(0).max(100).optional(),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logWeight(ctx, args),
  }),
  tool({
    name: 'list_weight',
    description: 'List weight entries by date or range.',
    group: 'weight',
    inputSchema: rangeArgs,
    handler: (args, ctx) => listWeight(ctx, args),
  }),
  tool({
    name: 'delete_weight',
    description: 'Delete a weight entry.',
    group: 'weight',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteWeight(ctx, args.id),
  }),
  tool({
    name: 'log_measurement',
    description: 'Record a body measurement (waist, chest, biceps, ...) with value + unit.',
    group: 'measurement',
    inputSchema: z.object({
      kind: z.string().min(1),
      value: z.number(),
      unit: z.string().min(1),
      ts: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: (args, ctx) => logMeasurement(ctx, args),
  }),
  tool({
    name: 'list_measurements',
    description: 'List measurements by date or range, optionally filtered by kind.',
    group: 'measurement',
    inputSchema: rangeArgs.extend({ kind: z.string().optional() }),
    handler: (args, ctx) => listMeasurements(ctx, args),
  }),
  tool({
    name: 'delete_measurement',
    description: 'Delete a measurement.',
    group: 'measurement',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteMeasurement(ctx, args.id),
  }),
  tool({
    name: 'get_goals',
    description: 'Get current daily targets.',
    group: 'goal',
    inputSchema: z.object({}),
    handler: (_args, ctx) => getGoals(ctx),
  }),
  tool({
    name: 'set_goals',
    description:
      'Update one or more daily targets. Each macro accepts {min, max} bounds, a plain number (interpreted per macro: protein/fiber/hydration → floor, sat_fat/sugar/sodium → cap, kcal/carbs/fat → exact target), or null to clear. tracked_macros picks up to 4 macros to show as rings on Today (calories is always shown).',
    group: 'goal',
    inputSchema: z.object({
      kcal: goalFieldSchema.optional(),
      protein_g: goalFieldSchema.optional(),
      carb_g: goalFieldSchema.optional(),
      fat_g: goalFieldSchema.optional(),
      fiber_g: goalFieldSchema.optional(),
      sugar_g: goalFieldSchema.optional(),
      sat_fat_g: goalFieldSchema.optional(),
      sodium_mg: goalFieldSchema.optional(),
      hydration_ml: goalFieldSchema.optional(),
      weight_kg_target: z.number().positive().nullable().optional(),
      tracked_macros: z.array(trackableMacroSchema).max(MAX_TRACKED_MACROS).optional(),
    }),
    handler: (args, ctx) => setGoals(ctx, args),
  }),
];
