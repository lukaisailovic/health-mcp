import {
  bulkUpsertCustomFoodsInputSchema,
  customFoodInputSchema,
  updateCustomFoodInputSchema,
} from '@health-mcp/shared';
import { z } from 'zod';
import {
  bulkUpsertCustomFoods,
  createCustomFood,
  deleteCustomFood,
  getFoodByRef,
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
      'Search the catalog for one food. Use search_foods when logging a multi-component meal — pass every component up front and only estimate macros yourself for queries that return nothing. ' +
      'Ranks by relevance (each hit carries a 0..1 `score` and an `exact` flag) and tolerates typos and punctuation ("bbq (sauce)", "tex bqq" → "TexMex BBQ Sauce"). A query whose content words match nothing returns nothing rather than a wrong best-guess, and a clear top hit trims the loose tail — so when a result comes back you can trust it. ' +
      'Add `aliases` to a food (create/update/bulk) to make it findable by other names. Local SQLite first; consults USDA only when there is no strong local hit and a USDA key is configured. Returns up to `limit` (default 5).',
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
      'Batch variant of search_food for multi-component meals: search every component in one call before estimating any macros. Returns `[{ query, results }]` preserving input order. Same relevance ranking (`score` + `exact` per hit), typo tolerance, and USDA fallback as search_food. Default `limit` is 5 results per query.',
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
    description:
      'Fetch a single food by `id`, or by `external_id` (the stable import key, e.g. an Obsidian slug). Obsidian-style "[[slug|Display]]" / "[[slug]]" wikilinks are accepted for external_id and resolved to the slug.',
    group: 'food',
    inputSchema: z
      .object({
        id: z.string().min(1).optional(),
        external_id: z.string().min(1).optional(),
      })
      .refine((v) => Boolean(v.id) !== Boolean(v.external_id), {
        message: 'provide exactly one of id or external_id',
      }),
    handler: (args, ctx) => getFoodByRef(ctx, args),
  }),
  tool({
    name: 'create_custom_food',
    description:
      'Create a manual food with per-100g macros (and optional micros: potassium/calcium/magnesium/iron). ' +
      'Set `external_id` to a stable key (e.g. an Obsidian slug) to make the food idempotent — creating again with the same external_id overwrites it instead of duplicating. ' +
      'Set `aliases` (search synonyms) so it stays findable under other names.',
    group: 'food',
    inputSchema: customFoodInputSchema,
    handler: (args, ctx) => createCustomFood(ctx, args),
  }),
  tool({
    name: 'bulk_upsert_custom_foods',
    description:
      'Create or update many manual foods in one transaction — the tool for migrating an external food DB. ' +
      'Each food upserts on `external_id` when present, otherwise on exact (name, brand); existing rows are overwritten with the payload, so re-running an import is safe and never duplicates. ' +
      'Carry `aliases` and micros (potassium/calcium/magnesium/iron) through here too. Returns { created, updated, foods: [{ id, name, external_id, action }] }.',
    group: 'food',
    inputSchema: bulkUpsertCustomFoodsInputSchema,
    handler: (args, ctx) => bulkUpsertCustomFoods(ctx, args),
  }),
  tool({
    name: 'update_custom_food',
    description:
      'Patch a manual food (manual source only). Only the fields you pass change; pass null to clear brand/serving_grams/external_id/aliases. Pass `aliases` to replace the whole synonym list.',
    group: 'food',
    inputSchema: updateCustomFoodInputSchema,
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
