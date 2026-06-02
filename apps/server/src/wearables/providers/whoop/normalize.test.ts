import { describe, expect, it } from 'vitest';
import { normalizeWhoopRecovery } from './normalize.js';

describe('normalizeWhoopRecovery', () => {
  const recovery = {
    cycle_id: '1540119468',
    sleep_id: '793c1c32',
    created_at: '2026-06-02T05:23:53.615Z',
    score: {
      recovery_score: 77,
      hrv_rmssd_milli: 46.1,
      resting_heart_rate: 55,
      spo2_percentage: 96.7,
      skin_temp_celsius: 33.4,
    },
  };

  it('dates by the recovery created_at, not the run date', () => {
    const norm = normalizeWhoopRecovery(recovery, 'UTC');
    expect(norm?.date).toBe('2026-06-02');
    expect(norm?.score).toBe(77);
    expect(norm?.hrv_rmssd).toBe(46.1);
    expect(norm?.resting_hr).toBe(55);
  });

  it('buckets created_at into the local day for non-UTC zones', () => {
    // 23:30Z on Jun 1 is already Jun 2 in Madrid (UTC+2 in summer).
    const lateNight = { ...recovery, created_at: '2026-06-01T23:30:00.000Z' };
    expect(normalizeWhoopRecovery(lateNight, 'Europe/Madrid')?.date).toBe('2026-06-02');
    expect(normalizeWhoopRecovery(lateNight, 'UTC')?.date).toBe('2026-06-01');
  });
});
