import { describe, expect, it } from 'vitest';
import { type TestCtx, closeCtx, makeTestCtx } from '../../test-utils.js';
import { migration0014 } from './0014-backfill-day-strain.js';

const seedCycle = (ctx: TestCtx, id: string, start: string, strain: number | null) =>
  ctx.db
    .prepare('INSERT INTO whoop_cycles (id, start, strain, raw_json) VALUES (?, ?, ?, ?)')
    .run(id, start, strain, '{}');

const seedDaily = (ctx: TestCtx, date: string, strain: number | null) =>
  ctx.db
    .prepare("INSERT INTO wearable_daily (provider, date, strain) VALUES ('whoop', ?, ?)")
    .run(date, strain);

const strainOn = (ctx: TestCtx, date: string): number | null =>
  (
    ctx.db
      .prepare("SELECT strain FROM wearable_daily WHERE provider = 'whoop' AND date = ?")
      .get(date) as { strain: number | null }
  ).strain;

const backfill = (ctx: TestCtx) => ctx.db.exec(migration0014.sql ?? '');

describe('0014 day-strain backfill', () => {
  it('re-derives a null day strain from the raw cycle for that date', () => {
    const ctx = makeTestCtx();
    seedCycle(ctx, 'c1', '2026-05-31T21:06:34.800Z', 12.45);
    seedDaily(ctx, '2026-05-31', null);

    backfill(ctx);

    expect(strainOn(ctx, '2026-05-31')).toBeCloseTo(12.45);
    closeCtx(ctx);
  });

  it('prefers the latest-starting cycle when a UTC date holds two', () => {
    const ctx = makeTestCtx();
    seedCycle(ctx, 'early', '2026-03-03T00:13:35.460Z', 4.07);
    seedCycle(ctx, 'evening', '2026-03-03T19:57:03.760Z', 14.25);
    seedDaily(ctx, '2026-03-03', null);

    backfill(ctx);

    expect(strainOn(ctx, '2026-03-03')).toBeCloseTo(14.25);
    closeCtx(ctx);
  });

  it('leaves an already-populated strain untouched', () => {
    const ctx = makeTestCtx();
    seedCycle(ctx, 'c1', '2026-05-31T21:06:34.800Z', 12.45);
    seedDaily(ctx, '2026-05-31', 9.99);

    backfill(ctx);

    expect(strainOn(ctx, '2026-05-31')).toBeCloseTo(9.99);
    closeCtx(ctx);
  });
});
