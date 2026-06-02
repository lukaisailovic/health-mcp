import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestCtx, closeCtx, makeTestCtx } from '../test-utils.js';
import { wearableSleep } from './wearables.js';

describe('wearableSleep date bucketing', () => {
  let ctx: TestCtx;

  beforeEach(() => {
    ctx = makeTestCtx();
    // A night that starts the evening of Jun 1 and ends (wakes) the morning of Jun 2.
    ctx.db
      .prepare(
        `INSERT INTO wearable_sleep (provider, provider_id, start, "end", duration_s, score)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('whoop', 's1', '2026-06-01T21:42:12.610Z', '2026-06-02T05:21:48.940Z', 27576, 94);
  });

  afterEach(() => closeCtx(ctx));

  it('attributes a sleep to its wake day, not its start day', () => {
    const onWakeDay = wearableSleep(ctx, { date: '2026-06-02' }) as Array<{ score: number }>;
    expect(onWakeDay).toHaveLength(1);
    const [row] = onWakeDay;
    expect(row?.score).toBe(94);

    const onStartDay = wearableSleep(ctx, { date: '2026-06-01' });
    expect(onStartDay).toHaveLength(0);
  });
});
