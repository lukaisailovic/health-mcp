import type { Migration } from '../migrations.js';

// The historical migrations were squashed into 0001-init, which relaxed the
// meal_components custom-component CHECK to let `grams` be NULL — the shape a
// custom component takes when it carries absolute totals ({ name, absolute }).
// Databases migrated before the squash already have 0001-init recorded, so they
// never pick up the relaxed table and keep rejecting absolute customs with
// "CHECK constraint failed". SQLite can't ALTER a CHECK, so rebuild the table to
// match 0001-init. Forward-only; rows are copied, not dropped.
const sql = `
DROP VIEW IF EXISTS intake_v;

CREATE TABLE meal_components_new (
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

INSERT INTO meal_components_new SELECT * FROM meal_components;

DROP TABLE meal_components;
ALTER TABLE meal_components_new RENAME TO meal_components;

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
`;

export const migration0010: Migration = { id: '0010-relax-meal-components-custom-check', sql };
