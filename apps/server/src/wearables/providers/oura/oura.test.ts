import { describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../../../test-utils.js';
import { normalizeOuraSleep, normalizeOuraWorkout } from './normalize.js';

describe('oura provider', () => {
  it('migration creates oura_* tables', () => {
    const ctx = makeTestCtx();
    const tables = ctx.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'oura_%'")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const expected of [
      'oura_personal_info',
      'oura_sleep',
      'oura_daily_sleep',
      'oura_daily_readiness',
      'oura_daily_activity',
      'oura_workout',
    ]) {
      expect(tables).toContain(expected);
    }
    closeCtx(ctx);
  });

  it('seeds oura activity type mappings', () => {
    const ctx = makeTestCtx();
    const mapping = ctx.db
      .prepare(
        "SELECT canonical FROM wearable_activity_type_map WHERE provider = 'oura' AND raw_type = 'running'",
      )
      .get() as { canonical: string } | undefined;
    expect(mapping?.canonical).toBe('run');
    closeCtx(ctx);
  });

  it('normalizes a sleep record into the canonical shape', () => {
    const out = normalizeOuraSleep({
      id: 'abc',
      bedtime_start: '2026-05-23T23:00:00+00:00',
      bedtime_end: '2026-05-24T07:00:00+00:00',
      day: '2026-05-24',
      total_sleep_duration: 27000,
      efficiency: 92.5,
      deep_sleep_duration: 5400,
      rem_sleep_duration: 7200,
      light_sleep_duration: 14400,
      awake_time: 1800,
      average_heart_rate: 54,
      lowest_heart_rate: 48,
      average_breath: 13.2,
    });
    expect(out.provider).toBe('oura');
    expect(out.duration_s).toBe(27000);
    expect(out.efficiency_pct).toBe(92.5);
    expect(out.deep_s).toBe(5400);
    expect(out.hr_avg).toBe(54);
  });

  it('normalizes a workout record with a canonical mapping', () => {
    const out = normalizeOuraWorkout(
      {
        id: 'w1',
        activity: 'running',
        intensity: 'hard',
        source: 'manual',
        day: '2026-05-23',
        start_datetime: '2026-05-23T08:00:00+00:00',
        end_datetime: '2026-05-23T08:45:00+00:00',
        distance: 7800,
        calories: 410,
      },
      'run',
    );
    expect(out.type).toBe('run');
    expect(out.raw_type).toBe('running');
    expect(out.duration_s).toBe(2700);
    expect(out.distance_m).toBe(7800);
    expect(out.kcal).toBe(410);
  });
});
