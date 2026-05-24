import { describe, expect, it } from 'vitest';
import { logIntake } from './intake.js';
import { logHydration, logWeight } from './simple-logs.js';
import { logLabPanel } from './biomarkers.js';
import { correlate, isCorrelateAvailable, listCorrelateMetrics } from './correlate.js';
import { createCustomFood } from './food.js';
import { closeCtx, makeTestCtx } from '../test-utils.js';

describe('correlate', () => {
  it('lists discoverable metric sources and fields', () => {
    const list = listCorrelateMetrics();
    const intake = list.find((m) => m.source === 'intake');
    expect(intake?.fields).toContain('kcal');
    expect(intake?.fields).toContain('protein_g');
    const labs = list.find((m) => m.source === 'lab_results');
    expect(labs?.fields).toContain('value_numeric');
  });

  it('gating returns false without enough data', () => {
    const ctx = makeTestCtx();
    expect(isCorrelateAvailable(ctx)).toBe(false);
    closeCtx(ctx);
  });

  it('computes Pearson on aligned intake+weight day buckets', () => {
    const ctx = makeTestCtx();
    const food = createCustomFood(ctx, {
      name: 'Test',
      nutrients_per_100g: {
        kcal_per_100g: 100,
        protein_g_per_100g: 10,
        carb_g_per_100g: 10,
        fat_g_per_100g: 4,
      },
    });
    for (let i = 0; i < 8; i++) {
      const day = `2026-05-${String(10 + i).padStart(2, '0')}`;
      const ts = `${day}T12:00:00Z`;
      logIntake(ctx, { ts, items: [{ ref: 'food', food_id: food.id, grams: 100 * (i + 1) }] });
      logWeight(ctx, { ts, kg: 70 + i * 0.1 });
    }
    const result = correlate(ctx, {
      a: { source: 'intake', field: 'kcal', agg: 'sum' },
      b: { source: 'weight', field: 'kg', agg: 'avg' },
      range: { start: '2026-05-10', end: '2026-05-17' },
      method: 'pearson',
    });
    expect(result.n).toBe(8);
    expect(result.r).not.toBeNull();
    expect((result.r ?? 0) > 0.99).toBe(true);
    closeCtx(ctx);
  });

  it('supports forward_fill on sparse lab series against dense intake', () => {
    const ctx = makeTestCtx();
    const food = createCustomFood(ctx, {
      name: 'Test',
      nutrients_per_100g: {
        kcal_per_100g: 100,
        protein_g_per_100g: 10,
        carb_g_per_100g: 10,
        fat_g_per_100g: 4,
      },
    });
    for (let i = 0; i < 14; i++) {
      const day = `2026-05-${String(1 + i).padStart(2, '0')}`;
      logIntake(ctx, { ts: `${day}T12:00:00Z`, items: [{ ref: 'food', food_id: food.id, grams: 100 + i * 5 }] });
    }
    logLabPanel(ctx, {
      drawn_at: '2026-05-03T08:00:00Z',
      results: [{ biomarker: 'Glucose', value_numeric: 88 }],
    });
    logLabPanel(ctx, {
      drawn_at: '2026-05-09T08:00:00Z',
      results: [{ biomarker: 'Glucose', value_numeric: 92 }],
    });
    logLabPanel(ctx, {
      drawn_at: '2026-05-14T08:00:00Z',
      results: [{ biomarker: 'Glucose', value_numeric: 95 }],
    });

    const result = correlate(ctx, {
      a: { source: 'intake', field: 'kcal', agg: 'sum' },
      b: {
        source: 'lab_results',
        field: 'value_numeric',
        agg: 'forward_fill',
        filter: { biomarker: 'Glucose' },
      },
      range: { start: '2026-05-01', end: '2026-05-14' },
    });
    expect(result.n).toBeGreaterThan(5);
    closeCtx(ctx);
  });

  it('rejects unknown field for a source', () => {
    const ctx = makeTestCtx();
    expect(() =>
      correlate(ctx, {
        a: { source: 'intake', field: 'not_a_field', agg: 'sum' },
        b: { source: 'weight', field: 'kg', agg: 'avg' },
        range: { start: '2026-05-01', end: '2026-05-10' },
      }),
    ).toThrow();
    closeCtx(ctx);
  });
});
