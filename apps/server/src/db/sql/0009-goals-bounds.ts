import type { Migration } from '../migrations.js';

const sql = `
ALTER TABLE goals ADD COLUMN kcal_min REAL;
ALTER TABLE goals ADD COLUMN kcal_max REAL;
ALTER TABLE goals ADD COLUMN protein_g_min REAL;
ALTER TABLE goals ADD COLUMN protein_g_max REAL;
ALTER TABLE goals ADD COLUMN carb_g_min REAL;
ALTER TABLE goals ADD COLUMN carb_g_max REAL;
ALTER TABLE goals ADD COLUMN fat_g_min REAL;
ALTER TABLE goals ADD COLUMN fat_g_max REAL;
ALTER TABLE goals ADD COLUMN fiber_g_min REAL;
ALTER TABLE goals ADD COLUMN fiber_g_max REAL;
ALTER TABLE goals ADD COLUMN sat_fat_g_min REAL;
ALTER TABLE goals ADD COLUMN sat_fat_g_max REAL;
ALTER TABLE goals ADD COLUMN hydration_ml_min REAL;
ALTER TABLE goals ADD COLUMN hydration_ml_max REAL;

UPDATE goals SET
  kcal_min = kcal,
  kcal_max = kcal,
  carb_g_min = carb_g,
  carb_g_max = carb_g,
  fat_g_min = fat_g,
  fat_g_max = fat_g,
  protein_g_min = protein_g,
  fiber_g_min = fiber_g,
  hydration_ml_min = hydration_ml
WHERE id = 1;

ALTER TABLE goals DROP COLUMN kcal;
ALTER TABLE goals DROP COLUMN protein_g;
ALTER TABLE goals DROP COLUMN carb_g;
ALTER TABLE goals DROP COLUMN fat_g;
ALTER TABLE goals DROP COLUMN fiber_g;
ALTER TABLE goals DROP COLUMN hydration_ml;
`;

export const migration0009: Migration = { id: '0009-goals-bounds', sql };
