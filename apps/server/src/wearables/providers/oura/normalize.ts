import type { NormalizedActivity, NormalizedDaily, NormalizedReadiness, NormalizedSleep } from '../../types.js';

export type OuraSleep = {
  id: string;
  bedtime_start: string;
  bedtime_end: string;
  day: string;
  total_sleep_duration?: number;
  time_in_bed?: number;
  efficiency?: number;
  latency?: number;
  light_sleep_duration?: number;
  deep_sleep_duration?: number;
  rem_sleep_duration?: number;
  awake_time?: number;
  average_heart_rate?: number;
  lowest_heart_rate?: number;
  average_hrv?: number;
  average_breath?: number;
};

export type OuraDailySleep = {
  id: string;
  day: string;
  score?: number | null;
};

export type OuraDailyReadiness = {
  id: string;
  day: string;
  score?: number | null;
  temperature_deviation?: number;
  temperature_trend_deviation?: number;
};

export type OuraDailyActivity = {
  id: string;
  day: string;
  score?: number | null;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  equivalent_walking_distance?: number;
  high_activity_time?: number;
  medium_activity_time?: number;
  low_activity_time?: number;
};

export type OuraWorkout = {
  id: string;
  activity?: string;
  intensity?: string;
  source?: string;
  day: string;
  start_datetime: string;
  end_datetime: string;
  distance?: number;
  calories?: number;
};

export const normalizeOuraSleep = (r: OuraSleep): NormalizedSleep => ({
  provider: 'oura',
  provider_id: r.id,
  start: r.bedtime_start,
  end: r.bedtime_end,
  duration_s: r.total_sleep_duration ?? 0,
  efficiency_pct: r.efficiency ?? null,
  light_s: r.light_sleep_duration ?? null,
  deep_s: r.deep_sleep_duration ?? null,
  rem_s: r.rem_sleep_duration ?? null,
  awake_s: r.awake_time ?? null,
  respiratory_rate: r.average_breath ?? null,
  hr_avg: r.average_heart_rate ?? null,
  hr_min: r.lowest_heart_rate ?? null,
  raw_provider_id: r.id,
});

export const normalizeOuraDailyReadiness = (r: OuraDailyReadiness): NormalizedReadiness => ({
  provider: 'oura',
  date: r.day,
  score: r.score ?? null,
  skin_temp_delta_c: r.temperature_deviation ?? null,
  raw_provider_id: r.id,
});

export const normalizeOuraDailyActivity = (r: OuraDailyActivity): NormalizedDaily => ({
  provider: 'oura',
  date: r.day,
  steps: r.steps ?? null,
  kcal_active: r.active_calories ?? null,
  kcal_total: r.total_calories ?? null,
  distance_m: r.equivalent_walking_distance ?? null,
  raw_provider_id: r.id,
});

export const normalizeOuraWorkout = (r: OuraWorkout, canonical: string): NormalizedActivity => {
  const start = new Date(r.start_datetime).getTime();
  const end = new Date(r.end_datetime).getTime();
  return {
    provider: 'oura',
    provider_id: r.id,
    start: r.start_datetime,
    end: r.end_datetime,
    duration_s: Math.max(0, Math.round((end - start) / 1000)),
    type: canonical,
    raw_type: r.activity ?? 'unknown',
    kcal: r.calories ?? null,
    distance_m: r.distance ?? null,
    raw_provider_id: r.id,
  };
};
