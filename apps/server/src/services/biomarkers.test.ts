import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import {
  biomarkerTrend,
  latestBiomarkers,
  logLabPanel,
  logLabResult,
  searchBiomarker,
} from './biomarkers.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('biomarkers', () => {
  it('seeds catalog and finds glucose by name', () => {
    const results = searchBiomarker(ctx, { query: 'Glucose' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name === 'Glucose')).toBe(true);
  });

  it('finds biomarker by LOINC code', () => {
    const results = searchBiomarker(ctx, { query: '2093-3' });
    expect(results.some((r) => r.name === 'Total Cholesterol')).toBe(true);
  });

  it('logs a panel atomically with multiple results', () => {
    const { panel, results } = logLabPanel(ctx, {
      lab_name: 'Test Lab',
      drawn_at: '2026-01-15T08:00:00Z',
      fasting: true,
      results: [
        { biomarker: 'Glucose', value_numeric: 92 },
        { biomarker: 'HDL Cholesterol', value_numeric: 60 },
      ],
    });
    expect(panel.id).toBeDefined();
    expect(results.length).toBe(2);
  });

  it('converts known dual-unit values on insert', () => {
    const r = logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 5,
      unit_ucum: 'mmol/L',
      taken_at: '2026-01-15T08:00:00Z',
    });
    expect(r.unit_ucum.toLowerCase()).toBe('mg/dl');
    expect(r.value_numeric).toBeCloseTo(90.078, 2);
    expect(r.notes).toMatch(/original: 5 mmol\/L/);
  });

  it('latest_biomarkers returns status and delta', () => {
    logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 100,
      taken_at: '2026-01-10T08:00:00Z',
    });
    logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 95,
      taken_at: '2026-02-10T08:00:00Z',
    });
    const latest = latestBiomarkers(ctx);
    const glucose = latest.find((r) => r.biomarker.name === 'Glucose');
    expect(glucose).toBeDefined();
    expect(glucose?.result.value_numeric).toBe(95);
    expect(glucose?.delta_vs_prev).toBe(-5);
  });

  it('biomarker_trend returns time-ordered points', () => {
    logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 100,
      taken_at: '2026-01-10T08:00:00Z',
    });
    logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 95,
      taken_at: '2026-02-10T08:00:00Z',
    });
    const trend = biomarkerTrend(ctx, { biomarker: 'Glucose' });
    expect(trend.length).toBe(2);
    expect(new Date(trend[0]!.ts).getTime()).toBeLessThan(new Date(trend[1]!.ts).getTime());
  });
});
