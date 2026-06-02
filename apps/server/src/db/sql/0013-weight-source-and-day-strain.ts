import type { Migration } from '../migrations.js';

// Two Whoop-driven enrichments that ship together:
//  - weight_entries.source separates hand-logged weights from provider syncs. The
//    Whoop body weight is a single latest snapshot, so the sync mirrors it as one
//    weight row per day; skipping a day that already has a 'whoop' row keeps the
//    every-30-min cron from piling up duplicates and never touches manual entries.
//    The default backfills existing rows to 'manual', which is what they all were.
//  - wearable_daily.strain surfaces Whoop's day strain (0–21) next to the kcal/HR
//    already normalised from each cycle.
const sql = `
ALTER TABLE weight_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE wearable_daily ADD COLUMN strain REAL;
`;

export const migration0013: Migration = { id: '0013-weight-source-and-day-strain', sql };
