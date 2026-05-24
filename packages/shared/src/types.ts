export type RefKind = 'food' | 'recipe_serving' | 'batch' | 'custom';

export type FoodMacros = {
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};

export type IntakeMacros = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};

export type DailySummary = {
  date: string;
  totals: IntakeMacros & { hydration_ml: number };
  remaining: {
    kcal: number | null;
    protein_g: number | null;
    carb_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    hydration_ml: number | null;
  };
  entry_count: number;
  avg_confidence: number | null;
  compare?: {
    kind: 'yesterday' | '7d_avg';
    totals: IntakeMacros & { hydration_ml: number };
  };
};

export type BiomarkerStatus = 'optimal' | 'in_ref' | 'out_of_ref' | 'unknown';

export type WearableProviderId = string;
