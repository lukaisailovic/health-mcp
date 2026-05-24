import type { Migration } from '../migrations.js';

const sql = `
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
  canonical_text TEXT,
  items_json TEXT,
  notes TEXT,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (canonical_text IS NOT NULL OR items_json IS NOT NULL)
);
CREATE UNIQUE INDEX remembered_meals_label_unique ON remembered_meals(label COLLATE NOCASE);
`;

export const migration0003: Migration = { id: '0003-recipes-batches', sql };
