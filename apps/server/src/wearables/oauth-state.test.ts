import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { decodeAndConsumeState, encodeState } from './oauth-state.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('oauth state', () => {
  it('encodes and decodes a state token for the right provider', () => {
    const token = encodeState(ctx.db, 'whoop');
    const r = decodeAndConsumeState(ctx.db, token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.provider).toBe('whoop');
  });

  it('rejects a tampered signature', () => {
    const token = encodeState(ctx.db, 'whoop');
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig?.slice(0, -2)}00`;
    const r = decodeAndConsumeState(ctx.db, tampered);
    expect(r.ok).toBe(false);
  });

  it('rejects replay (nonce single-use)', () => {
    const token = encodeState(ctx.db, 'whoop');
    const r1 = decodeAndConsumeState(ctx.db, token);
    const r2 = decodeAndConsumeState(ctx.db, token);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('nonce_already_used');
  });
});
