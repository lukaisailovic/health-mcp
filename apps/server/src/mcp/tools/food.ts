import { z } from 'zod';
import {
  createCustomFood,
  deleteCustomFood,
  getFood,
  lookupBarcode,
  searchFood,
  searchFoods,
  updateCustomFood,
} from '../../services/food.js';
import { tool } from '../tool-registry.js';

export const foodTools = [
  tool({
    name: 'search_food',
    description:
      'Search the catalog for one food. Use search_foods when logging a multi-component meal — pass every component up front and only estimate macros yourself for queries that return nothing. Ranks by likelihood, tolerates typos and punctuation ("bbq (sauce)", "tex bqq" → "TexMex BBQ Sauce"). Local SQLite first; falls back to USDA when the local set is thin and a USDA key is configured. Returns up to `limit` (default 5).',
    group: 'food',
    inputSchema: z.object({
      query: z.string().min(1),
      source: z.enum(['usda', 'off', 'manual']).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
    handler: async (args, ctx) => searchFood(ctx, args),
  }),
  tool({
    name: 'search_foods',
    description:
      'Batch variant of search_food for multi-component meals: search every component in one call before estimating any macros. Returns `[{ query, results }]` preserving input order. Same ranking, typo tolerance, and USDA fallback as search_food. Default `limit` is 5 results per query.',
    group: 'food',
    inputSchema: z.object({
      queries: z.array(z.string().min(1)).min(1).max(20),
      source: z.enum(['usda', 'off', 'manual']).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
    handler: async (args, ctx) => searchFoods(ctx, args),
  }),
  tool({
    name: 'lookup_barcode',
    description: 'Look up a food by UPC/EAN barcode. Checks local cache, then Open Food Facts.',
    group: 'food',
    inputSchema: z.object({ barcode: z.string().min(4) }),
    handler: async (args, ctx) => lookupBarcode(ctx, args.barcode),
  }),
  tool({
    name: 'get_food',
    description: 'Fetch a single food by id.',
    group: 'food',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => getFood(ctx, args.id),
  }),
  tool({
    name: 'create_custom_food',
    description: 'Create a manual food with per-100g macros.',
    group: 'food',
    inputSchema: z.object({
      name: z.string().min(1),
      brand: z.string().optional(),
      serving_grams: z.number().positive().optional(),
      nutrients_per_100g: z.object({
        kcal_per_100g: z.number().nonnegative(),
        protein_g_per_100g: z.number().nonnegative(),
        carb_g_per_100g: z.number().nonnegative(),
        fat_g_per_100g: z.number().nonnegative(),
        fiber_g_per_100g: z.number().nonnegative().optional(),
        sugar_g_per_100g: z.number().nonnegative().optional(),
        sat_fat_g_per_100g: z.number().nonnegative().optional(),
        sodium_mg_per_100g: z.number().nonnegative().optional(),
      }),
    }),
    handler: (args, ctx) => createCustomFood(ctx, args),
  }),
  tool({
    name: 'update_custom_food',
    description: 'Update a manual food (manual source only).',
    group: 'food',
    inputSchema: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      brand: z.string().optional(),
      serving_grams: z.number().positive().optional(),
      nutrients_per_100g: z
        .object({
          kcal_per_100g: z.number().nonnegative(),
          protein_g_per_100g: z.number().nonnegative(),
          carb_g_per_100g: z.number().nonnegative(),
          fat_g_per_100g: z.number().nonnegative(),
          fiber_g_per_100g: z.number().nonnegative().optional(),
          sugar_g_per_100g: z.number().nonnegative().optional(),
          sat_fat_g_per_100g: z.number().nonnegative().optional(),
          sodium_mg_per_100g: z.number().nonnegative().optional(),
        })
        .optional(),
    }),
    handler: (args, ctx) => updateCustomFood(ctx, args),
  }),
  tool({
    name: 'delete_custom_food',
    description: 'Delete a manual food (manual source only).',
    group: 'food',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: (args, ctx) => deleteCustomFood(ctx, args.id),
  }),
];
