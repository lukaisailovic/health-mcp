import { seedBiomarkers, seedCategories } from '../../biomarkers/seed.js';
import { cuid } from '../../util/id.js';
import type { Db } from '../client.js';
import type { Migration } from '../migrations.js';

const sql = `
CREATE TABLE foods (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('usda','off','manual')),
  source_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  serving_grams REAL,
  kcal_per_100g REAL NOT NULL,
  protein_g REAL NOT NULL,
  carb_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  fiber_g REAL,
  sugar_g REAL,
  sat_fat_g REAL,
  sodium_mg REAL,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(source, source_id)
);

CREATE INDEX foods_barcode_idx ON foods(barcode);
CREATE INDEX foods_name_idx ON foods(name COLLATE NOCASE);

CREATE VIRTUAL TABLE foods_fts USING fts5(
  name,
  brand,
  content='foods',
  content_rowid='rowid'
);

CREATE TRIGGER foods_ai AFTER INSERT ON foods BEGIN
  INSERT INTO foods_fts(rowid, name, brand) VALUES (new.rowid, new.name, COALESCE(new.brand,''));
END;
CREATE TRIGGER foods_ad AFTER DELETE ON foods BEGIN
  INSERT INTO foods_fts(foods_fts, rowid, name, brand) VALUES ('delete', old.rowid, old.name, COALESCE(old.brand,''));
END;
CREATE TRIGGER foods_au AFTER UPDATE ON foods BEGIN
  INSERT INTO foods_fts(foods_fts, rowid, name, brand) VALUES ('delete', old.rowid, old.name, COALESCE(old.brand,''));
  INSERT INTO foods_fts(rowid, name, brand) VALUES (new.rowid, new.name, COALESCE(new.brand,''));
END;

CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack','other')),
  name TEXT,
  notes TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX meals_date_idx ON meals(date);
CREATE INDEX meals_ts_idx ON meals(ts);
CREATE INDEX meals_meal_type_idx ON meals(meal_type);

CREATE TABLE meal_components (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  ref_kind TEXT NOT NULL CHECK (ref_kind IN ('food','recipe_serving','batch','custom')),
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  recipe_id TEXT,
  batch_id TEXT,
  custom_name TEXT,
  grams REAL,
  servings REAL,
  kcal REAL NOT NULL,
  protein_g REAL NOT NULL,
  carb_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  fiber_g REAL,
  sugar_g REAL,
  sat_fat_g REAL,
  sodium_mg REAL,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source_trace TEXT NOT NULL CHECK (source_trace IN ('exact','estimate','barcode','manual','agent_inference')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    (ref_kind = 'food' AND food_id IS NOT NULL AND grams IS NOT NULL AND recipe_id IS NULL AND batch_id IS NULL AND custom_name IS NULL AND servings IS NULL) OR
    (ref_kind = 'recipe_serving' AND recipe_id IS NOT NULL AND servings IS NOT NULL AND food_id IS NULL AND batch_id IS NULL AND custom_name IS NULL AND grams IS NULL) OR
    (ref_kind = 'batch' AND batch_id IS NOT NULL AND grams IS NOT NULL AND food_id IS NULL AND recipe_id IS NULL AND custom_name IS NULL AND servings IS NULL) OR
    (ref_kind = 'custom' AND custom_name IS NOT NULL AND food_id IS NULL AND recipe_id IS NULL AND batch_id IS NULL AND servings IS NULL)
  )
);
CREATE INDEX meal_components_meal_idx ON meal_components(meal_id);
CREATE INDEX meal_components_batch_idx ON meal_components(batch_id);

CREATE VIEW intake_v AS
SELECT
  mc.id AS id,
  m.ts AS ts,
  m.date AS date,
  m.meal_type AS meal_type,
  mc.ref_kind AS ref_kind,
  mc.kcal AS kcal,
  mc.protein_g AS protein_g,
  mc.carb_g AS carb_g,
  mc.fat_g AS fat_g,
  mc.fiber_g AS fiber_g,
  mc.sugar_g AS sugar_g,
  mc.sat_fat_g AS sat_fat_g,
  mc.sodium_mg AS sodium_mg,
  mc.confidence AS confidence
FROM meal_components mc
JOIN meals m ON m.id = mc.meal_id;

CREATE TABLE hydration_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  ml REAL NOT NULL CHECK (ml > 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX hydration_date_idx ON hydration_entries(date);

CREATE TABLE weight_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  kg REAL NOT NULL CHECK (kg > 0),
  body_fat_pct REAL CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX weight_date_idx ON weight_entries(date);

CREATE TABLE measurements (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX measurements_date_kind_idx ON measurements(date, kind);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  weight_kg_target REAL,
  kcal_min REAL,
  kcal_max REAL,
  protein_g_min REAL,
  protein_g_max REAL,
  carb_g_min REAL,
  carb_g_max REAL,
  fat_g_min REAL,
  fat_g_max REAL,
  fiber_g_min REAL,
  fiber_g_max REAL,
  sat_fat_g_min REAL,
  sat_fat_g_max REAL,
  hydration_ml_min REAL,
  hydration_ml_max REAL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO goals (id) VALUES (1);

CREATE TABLE system (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE biomarkers (
  id TEXT PRIMARY KEY,
  loinc_code TEXT,
  name TEXT NOT NULL,
  display_name TEXT,
  aliases TEXT,
  default_unit_ucum TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'numeric' CHECK (value_type IN ('numeric','text','numeric_or_text')),
  default_ref_low REAL,
  default_ref_high REAL,
  optimal_low REAL,
  optimal_high REAL,
  notes TEXT,
  why_it_matters TEXT,
  influences TEXT,
  how_to_improve TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX biomarkers_name_unique ON biomarkers(name COLLATE NOCASE);
CREATE INDEX biomarkers_loinc_idx ON biomarkers(loinc_code);

CREATE TABLE biomarker_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE UNIQUE INDEX biomarker_categories_name_unique ON biomarker_categories(name COLLATE NOCASE);

CREATE TABLE biomarker_category_map (
  biomarker_id TEXT NOT NULL REFERENCES biomarkers(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES biomarker_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (biomarker_id, category_id)
);

CREATE TABLE lab_panels (
  id TEXT PRIMARY KEY,
  name TEXT,
  lab_name TEXT,
  ordered_by TEXT,
  drawn_at TEXT NOT NULL,
  fasting INTEGER,
  source TEXT CHECK (source IN ('manual','pdf_import','api')),
  source_ref TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX lab_panels_drawn_idx ON lab_panels(drawn_at);

CREATE TABLE lab_results (
  id TEXT PRIMARY KEY,
  biomarker_id TEXT NOT NULL REFERENCES biomarkers(id) ON DELETE CASCADE,
  panel_id TEXT REFERENCES lab_panels(id) ON DELETE SET NULL,
  taken_at TEXT NOT NULL,
  value_numeric REAL,
  value_text TEXT,
  unit_ucum TEXT NOT NULL,
  ref_low REAL,
  ref_high REAL,
  ref_text TEXT,
  interpretation TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);
CREATE INDEX lab_results_biomarker_taken_idx ON lab_results(biomarker_id, taken_at);
CREATE INDEX lab_results_taken_idx ON lab_results(taken_at);
CREATE INDEX lab_results_panel_idx ON lab_results(panel_id);

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  servings REAL NOT NULL CHECK (servings > 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX recipes_name_idx ON recipes(name COLLATE NOCASE);

CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  free_text_name TEXT,
  grams REAL NOT NULL CHECK (grams > 0),
  notes TEXT,
  CHECK ((food_id IS NOT NULL AND free_text_name IS NULL) OR (food_id IS NULL AND free_text_name IS NOT NULL))
);
CREATE INDEX recipe_ingredients_recipe_idx ON recipe_ingredients(recipe_id);

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  name TEXT,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  total_grams REAL NOT NULL CHECK (total_grams > 0),
  remaining_grams REAL NOT NULL CHECK (remaining_grams >= 0),
  kcal_total REAL NOT NULL,
  protein_g_total REAL NOT NULL,
  carb_g_total REAL NOT NULL,
  fat_g_total REAL NOT NULL,
  fiber_g_total REAL,
  sugar_g_total REAL,
  sat_fat_g_total REAL,
  sodium_mg_total REAL,
  cooked_at TEXT NOT NULL,
  expires_at TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX batches_active_idx ON batches(archived, remaining_grams);

CREATE TABLE remembered_meals (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  aliases TEXT,
  default_meal_type TEXT,
  default_name TEXT,
  canonical_text TEXT,
  components_json TEXT,
  notes TEXT,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (canonical_text IS NOT NULL OR components_json IS NOT NULL)
);
CREATE UNIQUE INDEX remembered_meals_label_unique ON remembered_meals(label COLLATE NOCASE);

CREATE TABLE wearable_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  auth_strategy TEXT NOT NULL CHECK (auth_strategy IN ('oauth2','apikey','file_import','manual'))
);

INSERT INTO wearable_providers (id, display_name, auth_strategy) VALUES
  ('whoop','Whoop','oauth2'),
  ('oura','Oura','oauth2'),
  ('garmin','Garmin','oauth2'),
  ('apple_health','Apple Health','file_import'),
  ('fitbit','Fitbit','oauth2'),
  ('polar','Polar','oauth2');

CREATE TABLE wearable_sync_state (
  provider TEXT NOT NULL,
  resource TEXT NOT NULL,
  last_synced_at TEXT,
  next_token TEXT,
  PRIMARY KEY (provider, resource)
);

CREATE TABLE wearable_oauth_nonces (
  nonce TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX wearable_oauth_nonces_expires_idx ON wearable_oauth_nonces(expires_at);

CREATE TABLE wearable_sleep (
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  efficiency_pct REAL,
  score REAL,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  awake_s INTEGER,
  respiratory_rate REAL,
  hr_avg REAL,
  hr_min REAL,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, provider_id)
);
CREATE INDEX wearable_sleep_provider_start_idx ON wearable_sleep(provider, start);

CREATE TABLE wearable_activity (
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  type TEXT NOT NULL,
  raw_type TEXT NOT NULL,
  kcal REAL,
  distance_m REAL,
  elevation_gain_m REAL,
  hr_avg REAL,
  hr_max REAL,
  strain_or_load REAL,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, provider_id)
);
CREATE INDEX wearable_activity_provider_start_idx ON wearable_activity(provider, start);
CREATE INDEX wearable_activity_type_start_idx ON wearable_activity(type, start);

CREATE TABLE wearable_readiness (
  provider TEXT NOT NULL,
  date TEXT NOT NULL,
  score REAL,
  hrv_rmssd REAL,
  resting_hr REAL,
  spo2 REAL,
  skin_temp_delta_c REAL,
  body_battery REAL,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, date)
);
CREATE INDEX wearable_readiness_provider_date_idx ON wearable_readiness(provider, date);

CREATE TABLE wearable_daily (
  provider TEXT NOT NULL,
  date TEXT NOT NULL,
  steps INTEGER,
  kcal_active REAL,
  kcal_total REAL,
  distance_m REAL,
  floors INTEGER,
  resting_hr REAL,
  hr_avg REAL,
  hrv_rmssd_avg REAL,
  spo2_avg REAL,
  stand_minutes INTEGER,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, date)
);
CREATE INDEX wearable_daily_provider_date_idx ON wearable_daily(provider, date);

CREATE TABLE wearable_metric_minutes (
  provider TEXT NOT NULL,
  metric TEXT NOT NULL,
  ts TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (provider, metric, ts)
);

CREATE TABLE wearable_activity_type_map (
  provider TEXT NOT NULL,
  raw_type TEXT NOT NULL,
  canonical TEXT NOT NULL,
  PRIMARY KEY (provider, raw_type)
);

INSERT INTO wearable_activity_type_map (provider, raw_type, canonical) VALUES
  ('*','run','run'),
  ('*','running','run'),
  ('*','cycle','cycle'),
  ('*','cycling','cycle'),
  ('*','bike','cycle'),
  ('*','swim','swim'),
  ('*','swimming','swim'),
  ('*','walk','walk'),
  ('*','walking','walk'),
  ('*','hike','hike'),
  ('*','hiking','hike'),
  ('*','row','row'),
  ('*','rowing','row'),
  ('*','strength','strength'),
  ('*','weightlifting','strength'),
  ('*','hiit','hiit'),
  ('*','yoga','yoga'),
  ('*','stretching','stretch'),
  ('*','climbing','climb'),
  ('*','skiing','ski'),
  ('*','snowboarding','board'),
  ('*','dance','dance'),
  ('oura','running','run'),
  ('oura','cycling','cycle'),
  ('oura','walking','walk'),
  ('oura','hiking','hike'),
  ('oura','swimming','swim'),
  ('oura','rowing','row'),
  ('oura','strength_training','strength'),
  ('oura','hiit','hiit'),
  ('oura','yoga','yoga'),
  ('oura','stretching','stretch'),
  ('oura','dancing','dance'),
  ('oura','climbing','climb');

CREATE TABLE whoop_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE whoop_body_measurement (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  height_m REAL,
  weight_kg REAL,
  max_hr REAL,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE whoop_cycles (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  "end" TEXT,
  strain REAL,
  kj REAL,
  avg_hr REAL,
  max_hr REAL,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_cycles_start_idx ON whoop_cycles(start);

CREATE TABLE whoop_recoveries (
  sleep_id TEXT PRIMARY KEY,
  cycle_id TEXT,
  score REAL,
  hrv_rmssd REAL,
  resting_hr REAL,
  spo2 REAL,
  skin_temp_c REAL,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_recoveries_cycle_idx ON whoop_recoveries(cycle_id);

CREATE TABLE whoop_sleep (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  score REAL,
  efficiency_pct REAL,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  awake_s INTEGER,
  respiratory_rate REAL,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_sleep_start_idx ON whoop_sleep(start);

CREATE TABLE whoop_workouts (
  id TEXT PRIMARY KEY,
  sport_id INTEGER,
  sport_name TEXT,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  strain REAL,
  kj REAL,
  distance_m REAL,
  altitude_gain_m REAL,
  hr_zone_0_s INTEGER,
  hr_zone_1_s INTEGER,
  hr_zone_2_s INTEGER,
  hr_zone_3_s INTEGER,
  hr_zone_4_s INTEGER,
  hr_zone_5_s INTEGER,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_workouts_start_idx ON whoop_workouts(start);

CREATE TABLE oura_personal_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER,
  weight_kg REAL,
  height_m REAL,
  biological_sex TEXT,
  email TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE oura_sleep (
  id TEXT PRIMARY KEY,
  bedtime_start TEXT NOT NULL,
  bedtime_end TEXT NOT NULL,
  day TEXT NOT NULL,
  total_sleep_duration_s INTEGER,
  time_in_bed_s INTEGER,
  efficiency REAL,
  latency_s INTEGER,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  awake_s INTEGER,
  hr_avg REAL,
  hr_min REAL,
  hrv_avg REAL,
  respiratory_rate REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_sleep_day_idx ON oura_sleep(day);

CREATE TABLE oura_daily_sleep (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  score INTEGER,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_daily_sleep_day_idx ON oura_daily_sleep(day);

CREATE TABLE oura_daily_readiness (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  score INTEGER,
  temperature_deviation REAL,
  temperature_trend_deviation REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_daily_readiness_day_idx ON oura_daily_readiness(day);

CREATE TABLE oura_daily_activity (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  score INTEGER,
  steps INTEGER,
  active_calories INTEGER,
  total_calories INTEGER,
  equivalent_walking_distance INTEGER,
  high_activity_time INTEGER,
  medium_activity_time INTEGER,
  low_activity_time INTEGER,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_daily_activity_day_idx ON oura_daily_activity(day);

CREATE TABLE oura_workout (
  id TEXT PRIMARY KEY,
  activity TEXT,
  intensity TEXT,
  source TEXT,
  day TEXT NOT NULL,
  start_datetime TEXT NOT NULL,
  end_datetime TEXT NOT NULL,
  duration_s INTEGER,
  distance_m REAL,
  calories INTEGER,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_workout_day_idx ON oura_workout(day);
`;

const run = (db: Db) => {
  const catInsert = db.prepare(
    'INSERT INTO biomarker_categories (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
  );
  const catLookup = db.prepare('SELECT id FROM biomarker_categories WHERE name = ? COLLATE NOCASE');
  const catIdByName = new Map<string, string>();
  for (const cat of seedCategories) {
    const id = cuid();
    catInsert.run(id, cat);
    const row = catLookup.get(cat) as { id: string } | undefined;
    if (row) catIdByName.set(cat.toLowerCase(), row.id);
  }

  const biomarkerInsert = db.prepare(`
    INSERT INTO biomarkers (
      id, loinc_code, name, display_name, aliases, default_unit_ucum, value_type,
      default_ref_low, default_ref_high, optimal_low, optimal_high, notes,
      why_it_matters, influences, how_to_improve
    ) VALUES (
      @id, @loinc_code, @name, @display_name, @aliases, @default_unit_ucum, @value_type,
      @default_ref_low, @default_ref_high, @optimal_low, @optimal_high, @notes,
      @why_it_matters, @influences, @how_to_improve
    )
  `);
  const mapInsert = db.prepare(
    'INSERT INTO biomarker_category_map (biomarker_id, category_id) VALUES (?, ?)',
  );

  for (const b of seedBiomarkers) {
    const id = cuid();
    biomarkerInsert.run({
      id,
      loinc_code: b.loinc_code ?? null,
      name: b.name,
      display_name: b.display_name ?? null,
      aliases: b.aliases ? JSON.stringify(b.aliases) : null,
      default_unit_ucum: b.default_unit_ucum,
      value_type: b.value_type ?? 'numeric',
      default_ref_low: b.default_ref_low ?? null,
      default_ref_high: b.default_ref_high ?? null,
      optimal_low: b.optimal_low ?? null,
      optimal_high: b.optimal_high ?? null,
      notes: b.notes ?? null,
      why_it_matters: b.why_it_matters ?? null,
      influences: b.influences ?? null,
      how_to_improve: b.how_to_improve ?? null,
    });
    for (const cat of b.categories ?? []) {
      const catId = catIdByName.get(cat.toLowerCase());
      if (catId) mapInsert.run(id, catId);
    }
  }
};

export const migration0001: Migration = { id: '0001-init', sql, run };
