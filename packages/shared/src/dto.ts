import type { MealType } from './schemas.js';
import type { BiomarkerStatus, IntakeMacros, RefKind } from './types.js';

export type HealthProbe = {
  ok: boolean;
  db: 'up' | 'down';
  tz: string;
  version: string;
  auth_required: boolean;
  host: string;
  port: number;
  db_path: string;
  auth_path: string;
  dashboard: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  auto_migrate: boolean;
  whoop_sync_cron: string;
  wearable_redirect_base: string | null;
  providers: {
    usda: boolean;
    whoop: boolean;
    oura: boolean;
  };
};

export type GoalBound = { min: number | null; max: number | null };

export type GoalStatus = 'under' | 'in_range' | 'over' | 'no_goal';

export type GoalDelta = {
  status: GoalStatus;
  under: number | null;
  over: number | null;
};

export type GoalsDto = {
  kcal: GoalBound;
  protein_g: GoalBound;
  carb_g: GoalBound;
  fat_g: GoalBound;
  fiber_g: GoalBound;
  sat_fat_g: GoalBound;
  hydration_ml: GoalBound;
  weight_kg_target: number | null;
  updated_at: string;
};

export type FoodDto = {
  id: string;
  source: 'usda' | 'off' | 'manual';
  source_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_grams: number | null;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  created_at: string;
};

export type MealComponentDto = IntakeMacros & {
  id: string;
  meal_id: string;
  position: number;
  ref_kind: RefKind;
  food_id: string | null;
  recipe_id: string | null;
  batch_id: string | null;
  custom_name: string | null;
  display_name: string | null;
  grams: number | null;
  servings: number | null;
  confidence: number;
  source_trace: string;
  notes: string | null;
  created_at: string;
};

export type MealDto = {
  id: string;
  ts: string;
  date: string;
  meal_type: MealType;
  name: string | null;
  notes: string | null;
  tags: string | null;
  components: MealComponentDto[];
  totals: IntakeMacros & { avg_confidence: number | null };
  created_at: string;
  updated_at: string;
};

export type HydrationEntryDto = {
  id: string;
  ts: string;
  date: string;
  ml: number;
  notes: string | null;
  created_at: string;
};

export type WeightEntryDto = {
  id: string;
  ts: string;
  date: string;
  kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
};

export type MeasurementDto = {
  id: string;
  ts: string;
  date: string;
  kind: string;
  value: number;
  unit: string;
  notes: string | null;
  created_at: string;
};

export type DailySummaryDto = {
  date: string;
  totals: IntakeMacros & {
    hydration_ml: number;
    meal_count: number;
    component_count: number;
    avg_confidence: number | null;
  };
  goals: GoalsDto;
  delta: {
    kcal: GoalDelta;
    protein_g: GoalDelta;
    carb_g: GoalDelta;
    fat_g: GoalDelta;
    fiber_g: GoalDelta;
    sat_fat_g: GoalDelta;
    hydration_ml: GoalDelta;
  };
  compare?: {
    kind: 'yesterday' | '7d_avg';
    totals: IntakeMacros & {
      hydration_ml: number;
      meal_count: number;
      component_count: number;
      avg_confidence: number | null;
      date: string;
    };
  };
};

export type RangeBucketDto = IntakeMacros & {
  date: string;
  hydration_ml: number;
  meal_count: number;
  component_count: number;
};

export type RangeSummaryDto = {
  bucket: 'day' | 'week';
  start: string;
  end: string;
  days?: RangeBucketDto[];
  weeks?: RangeBucketDto[];
};

export type RecipeDto = {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeWithIngredientsDto = {
  recipe: RecipeDto;
  ingredients: Array<{
    id: string;
    recipe_id: string;
    food_id: string | null;
    food_name: string | null;
    free_text_name: string | null;
    grams: number;
    notes: string | null;
  }>;
  total: IntakeMacros;
  per_serving: IntakeMacros;
};

export type BatchDto = {
  id: string;
  name: string | null;
  recipe_id: string | null;
  total_grams: number;
  remaining_grams: number;
  kcal_total: number;
  protein_g_total: number;
  carb_g_total: number;
  fat_g_total: number;
  fiber_g_total: number | null;
  sugar_g_total: number | null;
  sat_fat_g_total: number | null;
  sodium_mg_total: number | null;
  cooked_at: string;
  expires_at: string | null;
  notes: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

export type BiomarkerDto = {
  id: string;
  loinc_code: string | null;
  name: string;
  display_name: string | null;
  aliases: string | null;
  default_unit_ucum: string;
  value_type: 'numeric' | 'text' | 'numeric_or_text';
  default_ref_low: number | null;
  default_ref_high: number | null;
  optimal_low: number | null;
  optimal_high: number | null;
  notes: string | null;
  why_it_matters: string | null;
  influences: string | null;
  how_to_improve: string | null;
  created_at: string;
  updated_at: string;
};

export type LabResultDto = {
  id: string;
  biomarker_id: string;
  panel_id: string | null;
  taken_at: string;
  value_numeric: number | null;
  value_text: string | null;
  unit_ucum: string;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  interpretation: string | null;
  notes: string | null;
  created_at: string;
};

export type LabPanelDto = {
  id: string;
  name: string | null;
  lab_name: string | null;
  ordered_by: string | null;
  drawn_at: string;
  fasting: number | null;
  source: string | null;
  source_ref: string | null;
  notes: string | null;
  created_at: string;
};

export type LatestBiomarkerRowDto = {
  biomarker: BiomarkerDto;
  result: LabResultDto;
  status: BiomarkerStatus;
  delta_vs_prev: number | null;
};

export type LabPanelDetailDto = {
  panel: LabPanelDto;
  rows: Array<{
    biomarker: BiomarkerDto;
    result: LabResultDto;
    status: BiomarkerStatus;
  }>;
};

export type BiomarkerTrendPointDto = {
  ts: string;
  value: number | null;
  unit: string;
  status: BiomarkerStatus;
};

export type WearableProviderInfoDto = {
  id: string;
  display_name: string;
  auth_strategy: 'oauth2' | 'apikey' | 'file_import' | 'manual';
  scopes: string[];
  status: 'linked' | 'available' | 'not_implemented';
};

export type WearableStatusDto = {
  provider: string;
  scope: string | null;
  expires_at: string | null;
  last_refresh_at: string | null;
  resources: Array<{
    resource: string;
    last_synced_at: string | null;
    next_token: string | null;
  }>;
};

export type WearableSleepDto = {
  provider: string;
  provider_id: string;
  start: string;
  end: string;
  duration_s: number | null;
  efficiency_pct: number | null;
  score: number | null;
  light_s: number | null;
  deep_s: number | null;
  rem_s: number | null;
  awake_s: number | null;
  respiratory_rate: number | null;
  hr_avg: number | null;
  hr_min: number | null;
  raw_ref: string | null;
};

export type WearableReadinessDto = {
  provider: string;
  date: string;
  score: number | null;
  hrv_rmssd: number | null;
  resting_hr: number | null;
  spo2: number | null;
  skin_temp_delta_c: number | null;
  body_battery: number | null;
  raw_ref: string | null;
};

export type WearableDailyDto = {
  provider: string;
  date: string;
  steps: number | null;
  kcal_active: number | null;
  kcal_total: number | null;
  distance_m: number | null;
  floors: number | null;
  resting_hr: number | null;
  hr_avg: number | null;
  hrv_rmssd_avg: number | null;
  spo2_avg: number | null;
  stand_minutes: number | null;
  raw_ref: string | null;
};

export type WearableActivityDto = {
  provider: string;
  provider_id: string;
  start: string;
  end: string;
  duration_s: number | null;
  type: string;
  raw_type: string;
  kcal: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  hr_avg: number | null;
  hr_max: number | null;
  strain_or_load: number | null;
  raw_ref: string | null;
};

export type ApiErrorDto = {
  code: string;
  message: string;
};
