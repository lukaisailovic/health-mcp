import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import type { Logger } from '../logger.js';

export type Ctx = {
  db: Db;
  logger: Logger;
  config: Config;
};

export class ServiceError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
