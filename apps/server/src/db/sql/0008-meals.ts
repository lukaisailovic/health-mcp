import type { Migration } from '../migrations.js';

const sql = `
DROP TABLE IF EXISTS intake_entries;
DROP TABLE IF EXISTS remembered_meals;

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
    (ref_kind = 'custom' AND custom_name IS NOT NULL AND grams IS NOT NULL AND food_id IS NULL AND recipe_id IS NULL AND batch_id IS NULL AND servings IS NULL)
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
`;

export const migration0008: Migration = { id: '0008-meals', sql };
