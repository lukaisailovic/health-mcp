import { describe, expect, it } from 'vitest';
import { createCustomBiomarker } from '../../services/biomarkers.js';
import { type TestCtx, closeCtx, makeTestCtx } from '../../test-utils.js';
import { migration0015 } from './0015-backfill-biomarker-ranges.js';

const rangeOf = (ctx: TestCtx, name: string) =>
  ctx.db
    .prepare(
      'SELECT default_ref_low, default_ref_high, optimal_high FROM biomarkers WHERE name = ?',
    )
    .get(name) as {
    default_ref_low: number | null;
    default_ref_high: number | null;
    optimal_high: number | null;
  };

describe('0015 biomarker range backfill', () => {
  it('fills a range onto a catalog marker that shipped without one', () => {
    const ctx = makeTestCtx(); // migrations (incl. 0015) already applied
    expect(rangeOf(ctx, 'FSH')).toMatchObject({ default_ref_low: 1.5, default_ref_high: 12.4 });
    closeCtx(ctx);
  });

  it('fills a rangeless imported marker, by exact name', () => {
    const ctx = makeTestCtx();
    createCustomBiomarker(ctx, { name: 'Granulocytes (%)', default_unit_ucum: '%' });
    migration0015.run?.(ctx.db);
    expect(rangeOf(ctx, 'Granulocytes (%)')).toMatchObject({
      default_ref_low: 40,
      default_ref_high: 75,
    });
    closeCtx(ctx);
  });

  it('sets optimal-only ranges where a population range is not meaningful', () => {
    const ctx = makeTestCtx();
    createCustomBiomarker(ctx, { name: 'HOMA-IR', default_unit_ucum: '1' });
    migration0015.run?.(ctx.db);
    expect(rangeOf(ctx, 'HOMA-IR')).toMatchObject({
      default_ref_low: null,
      default_ref_high: null,
      optimal_high: 2.0,
    });
    closeCtx(ctx);
  });

  it('never overwrites a range the user already set', () => {
    const ctx = makeTestCtx();
    createCustomBiomarker(ctx, {
      name: 'Urea',
      default_unit_ucum: 'mmol/L',
      default_ref_low: 1,
      default_ref_high: 9,
    });
    migration0015.run?.(ctx.db);
    expect(rangeOf(ctx, 'Urea')).toMatchObject({ default_ref_low: 1, default_ref_high: 9 });
    closeCtx(ctx);
  });
});
