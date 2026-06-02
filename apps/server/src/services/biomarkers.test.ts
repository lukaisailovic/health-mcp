import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { cuid } from '../util/id.js';
import {
  biomarkerTrend,
  latestBiomarkers,
  listLabResults,
  logLabPanel,
  logLabResult,
  resolveBiomarker,
  searchBiomarker,
} from './biomarkers.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

// Insert a result verbatim in its reported unit, bypassing the insert-time conversion —
// this mirrors rows stored before the dual-unit table covered them.
const rawInsert = (biomarkerName: string, value: number, unit: string, takenAt: string): void => {
  const b = resolveBiomarker(ctx, biomarkerName);
  ctx.db
    .prepare(
      `INSERT INTO lab_results (id, biomarker_id, panel_id, taken_at, value_numeric, value_text, unit_ucum)
       VALUES (?, ?, NULL, ?, ?, NULL, ?)`,
    )
    .run(cuid(), b.id, takenAt, value, unit);
};
const latestStatus = (name: string): string | undefined =>
  latestBiomarkers(ctx).find((r) => r.biomarker.name === name)?.status;

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

  it('unit-mismatch results report status=unknown, not a numeric range hit', () => {
    logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 5.1,
      unit_ucum: 'banana/L',
      taken_at: '2026-01-10T08:00:00Z',
    });
    const trend = biomarkerTrend(ctx, { biomarker: 'Glucose' });
    expect(trend[0]?.status).toBe('unknown');
    const latest = latestBiomarkers(ctx).find((r) => r.biomarker.name === 'Glucose');
    expect(latest?.status).toBe('unknown');
  });

  it('latest_biomarkers does not leak the SQL row-number column', () => {
    logLabResult(ctx, {
      biomarker: 'Glucose',
      value_numeric: 90,
      taken_at: '2026-01-10T08:00:00Z',
    });
    const latest = latestBiomarkers(ctx);
    expect(latest.length).toBeGreaterThan(0);
    for (const row of latest) {
      expect(row.result).not.toHaveProperty('rn');
    }
  });

  it('classifies foreign-unit results by converting to the default unit', () => {
    rawInsert('RBC', 4.9, '10*12/L', '2026-01-10T08:00:00Z'); // ≡ 4.9 10*6/uL, ref [4.2,5.9]
    rawInsert('Creatinine', 94, 'µmol/L', '2026-01-10T08:00:00Z'); // = 1.06 mg/dL, ref [0.6,1.3]
    rawInsert('TSH', 3.2, 'µIU/mL', '2026-01-10T08:00:00Z'); // = 3.2 mIU/L, ref [0.4,4.5]
    rawInsert('Hematocrit', 0.435, 'L/L', '2026-01-10T08:00:00Z'); // = 43.5%, ref [38,50]
    expect(latestStatus('RBC')).toBe('in_ref');
    expect(latestStatus('Creatinine')).toBe('in_ref');
    expect(latestStatus('TSH')).toBe('in_ref');
    expect(latestStatus('Hematocrit')).toBe('in_ref');
  });

  it('reports unknown when no safe conversion exists for the unit pair', () => {
    rawInsert('Lp(a)', 10.5, 'mg/dL', '2026-01-10T08:00:00Z'); // default nmol/L, no fixed factor
    expect(latestStatus('Lp(a)')).toBe('unknown');
  });

  it('list_lab_results carries server-computed status per row', () => {
    rawInsert('Creatinine', 94, 'µmol/L', '2026-01-10T08:00:00Z');
    const rows = listLabResults(ctx, { biomarker: 'Creatinine' });
    expect(rows[0]?.status).toBe('in_ref');
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
