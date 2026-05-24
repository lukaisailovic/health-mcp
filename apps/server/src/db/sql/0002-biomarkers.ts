import type { Migration } from '../migrations.js';

const sql = `
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
`;

export const migration0002: Migration = { id: '0002-biomarkers', sql };
