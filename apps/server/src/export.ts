import { closeSync, openSync, writeSync } from 'node:fs';
import type { Db } from './db/client.js';

const TABLES_WITH_RAW = new Set([
  'foods',
  'whoop_cycles',
  'whoop_recoveries',
  'whoop_sleep',
  'whoop_workouts',
  'whoop_profile',
  'whoop_body_measurement',
]);

const tablesToExport = (db: Db): string[] => {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%' AND name NOT IN ('foods_fts','foods_fts_data','foods_fts_idx','foods_fts_content','foods_fts_docsize','foods_fts_config')",
    )
    .all() as { name: string }[];
  return rows.map((r) => r.name).filter((n) => !n.startsWith('foods_fts'));
};

export const runExport = (opts: { db: Db; outPath: string; includeRaw: boolean }): void => {
  const fd = openSync(opts.outPath, 'w');
  try {
    for (const table of tablesToExport(opts.db)) {
      const rows = opts.db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
      for (const row of rows) {
        if (!opts.includeRaw && TABLES_WITH_RAW.has(table) && 'raw_json' in row) {
          row.raw_json = null;
        }
        writeSync(fd, `${JSON.stringify({ table, row })}\n`);
      }
    }
  } finally {
    closeSync(fd);
  }
};
