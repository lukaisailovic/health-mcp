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

CREATE TABLE intake_entries (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack','other')),
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
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    (ref_kind = 'food' AND food_id IS NOT NULL AND grams IS NOT NULL AND recipe_id IS NULL AND batch_id IS NULL AND custom_name IS NULL AND servings IS NULL) OR
    (ref_kind = 'recipe_serving' AND recipe_id IS NOT NULL AND servings IS NOT NULL AND food_id IS NULL AND batch_id IS NULL AND custom_name IS NULL AND grams IS NULL) OR
    (ref_kind = 'batch' AND batch_id IS NOT NULL AND grams IS NOT NULL AND food_id IS NULL AND recipe_id IS NULL AND custom_name IS NULL AND servings IS NULL) OR
    (ref_kind = 'custom' AND custom_name IS NOT NULL AND grams IS NOT NULL AND food_id IS NULL AND recipe_id IS NULL AND batch_id IS NULL AND servings IS NULL)
  )
);

CREATE INDEX intake_date_idx ON intake_entries(date);
CREATE INDEX intake_ts_idx ON intake_entries(ts);
CREATE INDEX intake_meal_idx ON intake_entries(meal_type);
CREATE INDEX intake_batch_idx ON intake_entries(batch_id);

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
  kcal REAL,
  protein_g REAL,
  carb_g REAL,
  fat_g REAL,
  fiber_g REAL,
  hydration_ml REAL,
  weight_kg_target REAL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO goals (id) VALUES (1);

CREATE TABLE system (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export const migration0001: Migration = { id: '0001-init', sql };
