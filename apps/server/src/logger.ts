import type { LogLevel } from './config.js';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'authorization',
  'client_secret',
  'password',
]);

const redact = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k.toLowerCase())) {
        out[k] = '[redacted]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
};

export type Logger = {
  level: LogLevel;
  debug: (msg: string, ctx?: Record<string, unknown>) => void;
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
};

export const createLogger = (level: LogLevel, useStderr = false): Logger => {
  const threshold = LEVELS[level];
  const write = (lvl: LogLevel, msg: string, ctx?: Record<string, unknown>) => {
    if (LEVELS[lvl] < threshold) return;
    const entry = {
      level: lvl,
      time: new Date().toISOString(),
      msg,
      ...(ctx ? (redact(ctx) as Record<string, unknown>) : {}),
    };
    const line = `${JSON.stringify(entry)}\n`;
    if (useStderr) {
      process.stderr.write(line);
    } else if (lvl === 'error' || lvl === 'warn') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  };
  return {
    level,
    debug: (msg, ctx) => write('debug', msg, ctx),
    info: (msg, ctx) => write('info', msg, ctx),
    warn: (msg, ctx) => write('warn', msg, ctx),
    error: (msg, ctx) => write('error', msg, ctx),
  };
};
