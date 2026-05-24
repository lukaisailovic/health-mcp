import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db/client.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const SECRET_KEY = 'wearable_oauth_secret';

const getOrCreateSecret = (db: Db): string => {
  const existing = db.prepare('SELECT value FROM system WHERE key = ?').get(SECRET_KEY) as
    | { value: string }
    | undefined;
  if (existing) return existing.value;
  const secret = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO system (key, value) VALUES (?, ?)').run(SECRET_KEY, secret);
  return secret;
};

const sign = (secret: string, payload: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

export type StatePayload = {
  provider: string;
  nonce: string;
  exp: number;
};

export const encodeState = (db: Db, provider: string): string => {
  const secret = getOrCreateSecret(db);
  const nonce = randomBytes(16).toString('hex');
  const exp = Date.now() + STATE_TTL_MS;
  db.prepare(
    "INSERT INTO wearable_oauth_nonces (nonce, provider, expires_at) VALUES (?, ?, datetime(?, 'unixepoch'))",
  ).run(nonce, provider, Math.floor(exp / 1000));
  const payload = JSON.stringify({ provider, nonce, exp });
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = sign(secret, b64);
  return `${b64}.${sig}`;
};

export type DecodeError = { ok: false; reason: string };
export type DecodeOk = { ok: true; payload: StatePayload };

export const decodeAndConsumeState = (db: Db, token: string): DecodeOk | DecodeError => {
  const secret = getOrCreateSecret(db);
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed_state' };
  const [b64, sig] = parts;
  if (!b64 || !sig) return { ok: false, reason: 'malformed_state' };
  const expectedSig = sign(secret, b64);
  if (sig.length !== expectedSig.length) return { ok: false, reason: 'bad_signature' };
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as StatePayload;
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
  if (payload.exp < Date.now()) return { ok: false, reason: 'expired' };
  // Consume nonce atomically.
  const result = db
    .prepare(
      "UPDATE wearable_oauth_nonces SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE nonce = ? AND used_at IS NULL",
    )
    .run(payload.nonce);
  if (result.changes === 0) return { ok: false, reason: 'nonce_already_used' };
  return { ok: true, payload };
};

export const purgeExpiredNonces = (db: Db): void => {
  db.prepare("DELETE FROM wearable_oauth_nonces WHERE expires_at < datetime('now')").run();
};
