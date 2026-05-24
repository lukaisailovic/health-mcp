import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import type { Logger } from './logger.js';

export const runDoctor = async (opts: {
  config: Config;
  db: Db;
  logger: Logger;
}): Promise<void> => {
  const { config, db } = opts;
  const out: Record<string, unknown> = {};

  out.db_path = config.dbPath;
  const dbStat = statSync(config.dbPath);
  out.db_mode = (dbStat.mode & 0o777).toString(8);
  out.pragma_journal = (
    db.pragma('journal_mode') as Array<{ journal_mode: string }>
  )[0]?.journal_mode;
  out.pragma_fk = (db.pragma('foreign_keys') as Array<{ foreign_keys: number }>)[0]?.foreign_keys;

  const authPath = join(config.authDir, 'auth.json');
  out.auth_path = authPath;
  out.auth_present = existsSync(authPath);
  if (out.auth_present) {
    out.auth_mode = (statSync(authPath).mode & 0o777).toString(8);
  }

  out.token_set = Boolean(config.token);
  out.token_length = config.token?.length ?? 0;
  out.host = config.host;
  out.port = config.port;
  out.tz = config.tz;

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
};
