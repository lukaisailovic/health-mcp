import type { Migration } from '../migrations.js';

// Day strain (wearable_daily.strain) shipped in 0013, but every wearable_daily row
// written by the pre-0013 sync kept strain NULL. The Whoop cycle sync paginates
// backward through history via a cursor, so it won't re-normalise those already-stored
// recent dates for a long time — leaving the dashboard's day-strain view empty even
// though the raw cycles carry strain. whoop_cycles preserves each raw cycle, so
// re-derive the normalised value from it: match on the same UTC start-date slice the
// sync uses, and for the rare date split across two cycles take the latest-starting one
// (the evening cycle that owns that physiological day).
const sql = `
UPDATE wearable_daily
SET strain = (
  SELECT c.strain FROM whoop_cycles c
  WHERE substr(c.start, 1, 10) = wearable_daily.date AND c.strain IS NOT NULL
  ORDER BY c.start DESC LIMIT 1
)
WHERE provider = 'whoop' AND strain IS NULL;
`;

export const migration0014: Migration = { id: '0014-backfill-day-strain', sql };
