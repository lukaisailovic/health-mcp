import type { Migration } from '../migrations.js';

// Three forward-compatible additions surfaced by migrating a large external food DB:
//   * micronutrients (potassium/calcium/magnesium/iron) on foods, the meal_components
//     snapshot, and batch totals — so day rollups don't silently lose them;
//   * `external_id` — a stable cross-system key (e.g. an Obsidian slug) that upserts
//     dedupe on, so re-importing never duplicates;
//   * `aliases` — search synonyms, indexed in FTS so an alias match recalls the row.
// All columns are appended (ALTER ADD), so the squash-era `INSERT ... SELECT *` table
// rebuild in 0010 is unaffected. foods_fts is rebuilt to index the new alias column.
const sql = `
ALTER TABLE foods ADD COLUMN external_id TEXT;
ALTER TABLE foods ADD COLUMN aliases TEXT;
ALTER TABLE foods ADD COLUMN potassium_mg REAL;
ALTER TABLE foods ADD COLUMN calcium_mg REAL;
ALTER TABLE foods ADD COLUMN magnesium_mg REAL;
ALTER TABLE foods ADD COLUMN iron_mg REAL;

CREATE UNIQUE INDEX foods_external_id_unique ON foods(external_id) WHERE external_id IS NOT NULL;

DROP TRIGGER foods_ai;
DROP TRIGGER foods_ad;
DROP TRIGGER foods_au;
DROP TABLE foods_fts;

CREATE VIRTUAL TABLE foods_fts USING fts5(
  name,
  brand,
  aliases,
  content='foods',
  content_rowid='rowid'
);

CREATE TRIGGER foods_ai AFTER INSERT ON foods BEGIN
  INSERT INTO foods_fts(rowid, name, brand, aliases)
  VALUES (new.rowid, new.name, COALESCE(new.brand,''), COALESCE(new.aliases,''));
END;
CREATE TRIGGER foods_ad AFTER DELETE ON foods BEGIN
  INSERT INTO foods_fts(foods_fts, rowid, name, brand, aliases)
  VALUES ('delete', old.rowid, old.name, COALESCE(old.brand,''), COALESCE(old.aliases,''));
END;
CREATE TRIGGER foods_au AFTER UPDATE ON foods BEGIN
  INSERT INTO foods_fts(foods_fts, rowid, name, brand, aliases)
  VALUES ('delete', old.rowid, old.name, COALESCE(old.brand,''), COALESCE(old.aliases,''));
  INSERT INTO foods_fts(rowid, name, brand, aliases)
  VALUES (new.rowid, new.name, COALESCE(new.brand,''), COALESCE(new.aliases,''));
END;

INSERT INTO foods_fts(foods_fts) VALUES('rebuild');

ALTER TABLE meal_components ADD COLUMN potassium_mg REAL;
ALTER TABLE meal_components ADD COLUMN calcium_mg REAL;
ALTER TABLE meal_components ADD COLUMN magnesium_mg REAL;
ALTER TABLE meal_components ADD COLUMN iron_mg REAL;

ALTER TABLE batches ADD COLUMN potassium_mg_total REAL;
ALTER TABLE batches ADD COLUMN calcium_mg_total REAL;
ALTER TABLE batches ADD COLUMN magnesium_mg_total REAL;
ALTER TABLE batches ADD COLUMN iron_mg_total REAL;

DROP VIEW intake_v;
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
  mc.potassium_mg AS potassium_mg,
  mc.calcium_mg AS calcium_mg,
  mc.magnesium_mg AS magnesium_mg,
  mc.iron_mg AS iron_mg,
  mc.confidence AS confidence
FROM meal_components mc
JOIN meals m ON m.id = mc.meal_id;
`;

export const migration0012: Migration = {
  id: '0012-food-micros-aliases-external-id',
  sql,
};
