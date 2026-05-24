import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export const cuid = (): string => {
  const buf = randomBytes(12);
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte === undefined) continue;
    const ch = ALPHABET[byte % ALPHABET.length];
    if (ch === undefined) continue;
    s += ch;
  }
  return `c${Date.now().toString(36)}${s}`;
};
