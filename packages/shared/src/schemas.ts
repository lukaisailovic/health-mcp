import { z } from 'zod';

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']);
export type MealType = z.infer<typeof mealTypeSchema>;

export const sourceTraceSchema = z.enum([
  'exact',
  'estimate',
  'barcode',
  'manual',
  'agent_inference',
]);
export type SourceTrace = z.infer<typeof sourceTraceSchema>;

export const foodSourceSchema = z.enum(['usda', 'off', 'manual']);
export type FoodSource = z.infer<typeof foodSourceSchema>;

export const nutrientsPer100gSchema = z.object({
  kcal_per_100g: z.number().nonnegative(),
  protein_g_per_100g: z.number().nonnegative(),
  carb_g_per_100g: z.number().nonnegative(),
  fat_g_per_100g: z.number().nonnegative(),
  fiber_g_per_100g: z.number().nonnegative().optional(),
  sugar_g_per_100g: z.number().nonnegative().optional(),
  sat_fat_g_per_100g: z.number().nonnegative().optional(),
  sodium_mg_per_100g: z.number().nonnegative().optional(),
});

export const absoluteMacrosSchema = z.object({
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carb_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative().optional(),
  sugar_g: z.number().nonnegative().optional(),
  sat_fat_g: z.number().nonnegative().optional(),
  sodium_mg: z.number().nonnegative().optional(),
});

export const customFoodSpecSchema = z.union([
  z
    .object({
      name: z.string().min(1),
    })
    .merge(nutrientsPer100gSchema),
  z.object({
    name: z.string().min(1),
    absolute: absoluteMacrosSchema,
  }),
]);
export type CustomFoodSpec = z.infer<typeof customFoodSpecSchema>;

export const isoTimestamp = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'must be an ISO timestamp',
});

const baseItemFields = {
  confidence: z.number().min(0).max(1).optional(),
  source_trace: sourceTraceSchema.optional(),
  notes: z.string().optional(),
};

export const mealComponentInputSchema = z.discriminatedUnion('ref', [
  z.object({
    ref: z.literal('food'),
    food_id: z.string().min(1),
    grams: z.number().positive(),
    ...baseItemFields,
  }),
  z.object({
    ref: z.literal('recipe_serving'),
    recipe_id: z.string().min(1),
    servings: z.number().positive(),
    ...baseItemFields,
  }),
  z.object({
    ref: z.literal('batch'),
    batch_id: z.string().min(1),
    grams: z.number().positive(),
    ...baseItemFields,
  }),
  z.object({
    ref: z.literal('custom'),
    custom: customFoodSpecSchema,
    // Required for the per-100g shape (macros scale by grams); ignored for the
    // absolute-totals shape. Enforced in the service so the union stays discriminable.
    grams: z.number().positive().optional(),
    ...baseItemFields,
  }),
]);
export type MealComponentInput = z.infer<typeof mealComponentInputSchema>;

export const logMealInputSchema = z.object({
  ts: isoTimestamp.optional(),
  meal_type: mealTypeSchema.optional(),
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  components: z.array(mealComponentInputSchema).min(1),
});
export type LogMealInput = z.infer<typeof logMealInputSchema>;

export const updateMealInputSchema = z.object({
  id: z.string().min(1),
  meal_type: mealTypeSchema.optional(),
  name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
export type UpdateMealInput = z.infer<typeof updateMealInputSchema>;

export const updateMealComponentInputSchema = z.object({
  id: z.string().min(1),
  grams: z.number().positive().optional(),
  servings: z.number().positive().optional(),
  notes: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type UpdateMealComponentInput = z.infer<typeof updateMealComponentInputSchema>;

export const goalBoundSchema = z
  .object({
    min: z.number().nonnegative().nullable().optional(),
    max: z.number().nonnegative().nullable().optional(),
  })
  .refine((v) => v.min == null || v.max == null || v.min <= v.max, {
    message: 'min must be <= max',
  });
export type GoalBoundInput = z.infer<typeof goalBoundSchema>;

export const goalFieldSchema = z.union([z.number().nonnegative(), goalBoundSchema, z.null()]);

export const goalsSchema = z.object({
  kcal: goalFieldSchema.optional(),
  protein_g: goalFieldSchema.optional(),
  carb_g: goalFieldSchema.optional(),
  fat_g: goalFieldSchema.optional(),
  fiber_g: goalFieldSchema.optional(),
  sat_fat_g: goalFieldSchema.optional(),
  hydration_ml: goalFieldSchema.optional(),
  weight_kg_target: z.number().positive().nullable().optional(),
});
export type GoalsInput = z.infer<typeof goalsSchema>;

export const recipeIngredientInputSchema = z
  .object({
    food_id: z.string().min(1).optional(),
    free_text_name: z.string().min(1).optional(),
    grams: z.number().positive(),
    notes: z.string().optional(),
  })
  .refine((v) => Boolean(v.food_id) !== Boolean(v.free_text_name), {
    message: 'exactly one of food_id or free_text_name required',
  });

export const createRecipeInputSchema = z.object({
  name: z.string().min(1),
  servings: z.number().positive(),
  notes: z.string().optional(),
  ingredients: z.array(recipeIngredientInputSchema).min(1),
});

export const createBatchInputSchema = z
  .object({
    name: z.string().optional(),
    recipe_id: z.string().min(1).optional(),
    total_grams: z.number().positive(),
    ingredients_override: z.array(recipeIngredientInputSchema).optional(),
    cooked_at: isoTimestamp.optional(),
    expires_at: isoTimestamp.optional(),
    notes: z.string().optional(),
  })
  .refine((v) => Boolean(v.recipe_id) || Boolean(v.ingredients_override), {
    message: 'either recipe_id or ingredients_override required',
  });

export const biomarkerValueTypeSchema = z.enum(['numeric', 'text', 'numeric_or_text']);
export type BiomarkerValueType = z.infer<typeof biomarkerValueTypeSchema>;

export const createCustomBiomarkerInputSchema = z.object({
  name: z.string().min(1),
  default_unit_ucum: z.string().min(1),
  value_type: biomarkerValueTypeSchema.optional(),
  loinc_code: z.string().optional(),
  display_name: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  default_ref_low: z.number().optional(),
  default_ref_high: z.number().optional(),
  optimal_low: z.number().optional(),
  optimal_high: z.number().optional(),
  notes: z.string().optional(),
});

export const labResultInputSchema = z.object({
  biomarker: z.string().min(1),
  value_numeric: z.number().optional(),
  value_text: z.string().optional(),
  unit_ucum: z.string().optional(),
  ref_low: z.number().optional(),
  ref_high: z.number().optional(),
  ref_text: z.string().optional(),
  interpretation: z.string().optional(),
  notes: z.string().optional(),
});

export const logLabPanelInputSchema = z.object({
  lab_name: z.string().optional(),
  drawn_at: isoTimestamp,
  fasting: z.boolean().optional(),
  ordered_by: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['manual', 'pdf_import', 'api']).optional(),
  source_ref: z.string().optional(),
  panel_name: z.string().optional(),
  results: z.array(labResultInputSchema).min(1),
});

export const logSingleLabResultInputSchema = labResultInputSchema.extend({
  taken_at: isoTimestamp,
});

export const wearableResourceSchema = z.enum([
  'sleep',
  'activity',
  'readiness',
  'daily',
  'profile',
  'body',
]);
export type WearableResource = z.infer<typeof wearableResourceSchema>;

export const canonicalActivityTypeSchema = z.enum([
  'run',
  'cycle',
  'swim',
  'walk',
  'hike',
  'row',
  'strength',
  'hiit',
  'yoga',
  'stretch',
  'sport_team',
  'sport_racket',
  'sport_combat',
  'climb',
  'ski',
  'board',
  'dance',
  'ergometer',
  'other',
]);
export type CanonicalActivityType = z.infer<typeof canonicalActivityTypeSchema>;
