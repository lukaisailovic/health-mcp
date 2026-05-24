import type { Logger } from '../logger.js';
import type { Db } from './client.js';
import { migration0001 } from './sql/0001-init.js';
import { migration0002 } from './sql/0002-biomarkers.js';
import { migration0003 } from './sql/0003-recipes-batches.js';
import { migration0004 } from './sql/0004-wearables.js';
import { migration0005 } from './sql/0005-seed-biomarkers.js';

export type Migration = {
  id: string;
  sql?: string;
  run?: (db: Db) => void;
};

const migrations: Migration[] = [
  migration0001,
  migration0002,
  migration0003,
  migration0004,
  migration0005,
];

const ensureTable = (db: Db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
};

export const runMigrations = (db: Db, logger: Logger): { applied: string[] } => {
  ensureTable(db);
  const applied: string[] = [];
  const existing = db
    .prepare('SELECT id FROM _migrations')
    .all()
    .map((r) => (r as { id: string }).id);
  const done = new Set(existing);
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    const tx = db.transaction(() => {
      if (m.sql) db.exec(m.sql);
      if (m.run) m.run(db);
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(m.id);
    });
    tx();
    applied.push(m.id);
    logger.info('migration applied', { id: m.id });
  }
  return { applied };
};

export const listMigrations = (): string[] => migrations.map((m) => m.id);

export { migrations };
