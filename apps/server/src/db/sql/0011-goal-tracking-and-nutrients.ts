import type { Migration } from '../migrations.js';

// Goals gained two more food nutrients (sugar, sodium) as targets, plus a
// `tracked_macros` selection — the up-to-4 macros shown as rings on Today (kcal
// is always shown, so it stays out of the list). ADD COLUMN is forward-only and
// safe in SQLite; the default backfills existing rows with the exact set Today
// rendered before this change, so nothing regresses.
const sql = `
ALTER TABLE goals ADD COLUMN sugar_g_min REAL;
ALTER TABLE goals ADD COLUMN sugar_g_max REAL;
ALTER TABLE goals ADD COLUMN sodium_mg_min REAL;
ALTER TABLE goals ADD COLUMN sodium_mg_max REAL;
ALTER TABLE goals ADD COLUMN tracked_macros TEXT NOT NULL DEFAULT '["protein_g","carb_g","fat_g","sat_fat_g"]';
`;

export const migration0011: Migration = { id: '0011-goal-tracking-and-nutrients', sql };
