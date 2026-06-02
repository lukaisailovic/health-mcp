import { toLocalDate } from '../../../util/tz.js';

type WhoopSleepRaw = {
  id: string;
  start: string;
  end: string;
  score?: {
    sleep_performance_percentage?: number;
    sleep_efficiency_percentage?: number;
    stage_summary?: {
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      total_awake_time_milli?: number;
    };
    respiratory_rate?: number;
  };
};

const durationS = (start: string, end: string): number =>
  Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));

export const normalizeWhoopSleep = (r: WhoopSleepRaw) => {
  const stages = r.score?.stage_summary ?? {};
  return {
    provider: 'whoop',
    provider_id: r.id,
    start: r.start,
    end: r.end,
    duration_s: durationS(r.start, r.end),
    efficiency_pct: r.score?.sleep_efficiency_percentage ?? null,
    score: r.score?.sleep_performance_percentage ?? null,
    light_s:
      stages.total_light_sleep_time_milli !== undefined
        ? Math.round(stages.total_light_sleep_time_milli / 1000)
        : null,
    deep_s:
      stages.total_slow_wave_sleep_time_milli !== undefined
        ? Math.round(stages.total_slow_wave_sleep_time_milli / 1000)
        : null,
    rem_s:
      stages.total_rem_sleep_time_milli !== undefined
        ? Math.round(stages.total_rem_sleep_time_milli / 1000)
        : null,
    awake_s:
      stages.total_awake_time_milli !== undefined
        ? Math.round(stages.total_awake_time_milli / 1000)
        : null,
    respiratory_rate: r.score?.respiratory_rate ?? null,
    raw_provider_id: r.id,
  };
};

type WhoopRecoveryRaw = {
  cycle_id: string;
  sleep_id: string;
  created_at: string;
  score?: {
    recovery_score?: number;
    hrv_rmssd_milli?: number;
    resting_heart_rate?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
};

export const normalizeWhoopRecovery = (
  r: WhoopRecoveryRaw,
  tz: string,
): {
  provider: string;
  date: string;
  score: number | null;
  hrv_rmssd: number | null;
  resting_hr: number | null;
  spo2: number | null;
  skin_temp_delta_c: number | null;
  raw_provider_id: string;
} | null => {
  return {
    provider: 'whoop',
    date: toLocalDate(r.created_at, tz),
    score: r.score?.recovery_score ?? null,
    hrv_rmssd: r.score?.hrv_rmssd_milli ?? null,
    resting_hr: r.score?.resting_heart_rate ?? null,
    spo2: r.score?.spo2_percentage ?? null,
    skin_temp_delta_c: r.score?.skin_temp_celsius ?? null,
    raw_provider_id: r.sleep_id,
  };
};

type WhoopWorkoutRaw = {
  id: string;
  start: string;
  end: string;
  sport_name?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
  };
};

const KJ_TO_KCAL = 0.239006;

export const normalizeWhoopWorkout = (r: WhoopWorkoutRaw, canonical: string) => ({
  provider: 'whoop',
  provider_id: r.id,
  start: r.start,
  end: r.end,
  duration_s: durationS(r.start, r.end),
  type: canonical,
  raw_type: r.sport_name ?? 'unknown',
  kcal: r.score?.kilojoule !== undefined ? r.score.kilojoule * KJ_TO_KCAL : null,
  distance_m: r.score?.distance_meter ?? null,
  elevation_gain_m: r.score?.altitude_gain_meter ?? null,
  strain_or_load: r.score?.strain ?? null,
  raw_provider_id: r.id,
});

type WhoopCycleRaw = {
  id: string;
  start: string;
  end?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
  };
};

export const normalizeWhoopCycle = (r: WhoopCycleRaw) => {
  const date = r.start.slice(0, 10);
  if (!date) return null;
  return {
    provider: 'whoop',
    date,
    kcal_active: r.score?.kilojoule !== undefined ? r.score.kilojoule * KJ_TO_KCAL : null,
    hr_avg: r.score?.average_heart_rate ?? null,
    strain: r.score?.strain ?? null,
    raw_provider_id: r.id,
  };
};
