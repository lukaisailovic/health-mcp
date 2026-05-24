import { chmodSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import Database, { type Database as DatabaseT } from 'better-sqlite3';
import type { Logger } from '../logger.js';

export type Db = DatabaseT;

export type OpenDbOptions = {
  path: string;
  allowInsecure: boolean;
  logger: Logger;
};

export const openDb = ({ path, allowInsecure, logger }: OpenDbOptions): Db => {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  try {
    chmodSync(dir, 0o700);
  } catch {
    // best-effort on platforms where the chmod is meaningless
  }
  const existed = existsSync(path);
  if (existed && !allowInsecure) {
    const st = statSync(path);
    const mode = st.mode & 0o777;
    if (mode & 0o077) {
      throw new Error(
        `database file ${path} has permissions ${mode.toString(8)} - refuse to open. Pass --allow-insecure-db to override.`,
      );
    }
  }
  const db = new Database(path);
  if (!existed) {
    try {
      chmodSync(path, 0o600);
    } catch {
      // best-effort
    }
  }
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  logger.debug('db opened', { path });
  return db;
};
