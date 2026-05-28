import type { Db } from '../../../db/client.js';
import type { ResourceKind, SyncResult } from '../../types.js';
import { OuraApiError, type OuraClient } from './client.js';
import {
  type OuraDailyActivity,
  type OuraDailyReadiness,
  type OuraDailySleep,
  type OuraSleep,
  type OuraWorkout,
  normalizeOuraDailyActivity,
  normalizeOuraDailyReadiness,
  normalizeOuraSleep,
  normalizeOuraWorkout,
} from './normalize.js';

type Paginated<T> = { data?: T[]; next_token?: string | null };

const setCursor = (db: Db, resource: string, cursor: string | null): void => {
  db.prepare(
    `INSERT INTO wearable_sync_state (provider, resource, last_synced_at, next_token)
     VALUES ('oura', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)
     ON CONFLICT(provider, resource) DO UPDATE SET
       last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       next_token = excluded.next_token`,
  ).run(resource, cursor);
};

const callWithRefresh = async <T>(
  client: OuraClient,
  path: string,
  refresh: () => Promise<void>,
): Promise<T> => {
  try {
    return await client.fetchJson<T>(path);
  } catch (err) {
    if (err instanceof OuraApiError && err.status === 401) {
      await refresh();
      return await client.fetchJson<T>(path);
    }
    throw err;
  }
};

const dateRangeQuery = (since: string | undefined): string => {
  const params = new URLSearchParams();
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startDate = since
    ? since.slice(0, 10)
    : new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  params.set('start_date', startDate);
  params.set('end_date', end);
  return `?${params.toString()}`;
};

export type OuraRunnerArgs = {
  db: Db;
  client: OuraClient;
  resource: ResourceKind;
  cursor: string | null;
  since?: string;
  refresh: () => Promise<void>;
};

const runProfile = async (args: OuraRunnerArgs): Promise<SyncResult> => {
  const data = await callWithRefresh<{
    age?: number;
    weight?: number;
    height?: number;
    biological_sex?: string;
    email?: string;
  }>(args.client, '/v2/usercollection/personal_info', args.refresh);
  args.db
    .prepare(
      `INSERT INTO oura_personal_info (id, age, weight_kg, height_m, biological_sex, email, raw_json)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         age = excluded.age, weight_kg = excluded.weight_kg, height_m = excluded.height_m,
         biological_sex = excluded.biological_sex, email = excluded.email,
         raw_json = excluded.raw_json,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .run(
      data.age ?? null,
      data.weight ?? null,
      data.height ?? null,
      data.biological_sex ?? null,
      data.email ?? null,
      JSON.stringify(data),
    );
  setCursor(args.db, 'profile', null);
  return { provider: 'oura', resource: 'profile', raw_count: 1, normalized_count: 0, done: true };
};

const runSleep = async (args: OuraRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<OuraSleep>>(
    args.client,
    `/v2/usercollection/sleep${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: OuraSleep[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO oura_sleep
        (id, bedtime_start, bedtime_end, day, total_sleep_duration_s, time_in_bed_s,
         efficiency, latency_s, light_s, deep_s, rem_s, awake_s, hr_avg, hr_min, hrv_avg,
         respiratory_rate, raw_json)
       VALUES (@id, @bedtime_start, @bedtime_end, @day, @total_sleep_duration_s, @time_in_bed_s,
         @efficiency, @latency_s, @light_s, @deep_s, @rem_s, @awake_s, @hr_avg, @hr_min, @hrv_avg,
         @respiratory_rate, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         bedtime_start = excluded.bedtime_start, bedtime_end = excluded.bedtime_end,
         day = excluded.day,
         total_sleep_duration_s = excluded.total_sleep_duration_s,
         time_in_bed_s = excluded.time_in_bed_s, efficiency = excluded.efficiency,
         latency_s = excluded.latency_s, light_s = excluded.light_s, deep_s = excluded.deep_s,
         rem_s = excluded.rem_s, awake_s = excluded.awake_s, hr_avg = excluded.hr_avg,
         hr_min = excluded.hr_min, hrv_avg = excluded.hrv_avg,
         respiratory_rate = excluded.respiratory_rate, raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_sleep
        (provider, provider_id, start, "end", duration_s, efficiency_pct, light_s, deep_s,
         rem_s, awake_s, respiratory_rate, hr_avg, hr_min, raw_provider_id)
       VALUES (@provider, @provider_id, @start, @end, @duration_s, @efficiency_pct, @light_s,
         @deep_s, @rem_s, @awake_s, @respiratory_rate, @hr_avg, @hr_min, @raw_provider_id)
       ON CONFLICT(provider, provider_id) DO UPDATE SET
         start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
         efficiency_pct = excluded.efficiency_pct, light_s = excluded.light_s,
         deep_s = excluded.deep_s, rem_s = excluded.rem_s, awake_s = excluded.awake_s,
         respiratory_rate = excluded.respiratory_rate, hr_avg = excluded.hr_avg,
         hr_min = excluded.hr_min, raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        bedtime_start: r.bedtime_start,
        bedtime_end: r.bedtime_end,
        day: r.day,
        total_sleep_duration_s: r.total_sleep_duration ?? null,
        time_in_bed_s: r.time_in_bed ?? null,
        efficiency: r.efficiency ?? null,
        latency_s: r.latency ?? null,
        light_s: r.light_sleep_duration ?? null,
        deep_s: r.deep_sleep_duration ?? null,
        rem_s: r.rem_sleep_duration ?? null,
        awake_s: r.awake_time ?? null,
        hr_avg: r.average_heart_rate ?? null,
        hr_min: r.lowest_heart_rate ?? null,
        hrv_avg: r.average_hrv ?? null,
        respiratory_rate: r.average_breath ?? null,
        raw_json: JSON.stringify(r),
      });
      normIns.run(normalizeOuraSleep(r));
    }
  });
  tx(records);
  setCursor(args.db, 'sleep', data.next_token ?? null);
  return {
    provider: 'oura',
    resource: 'sleep',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runDailyReadiness = async (args: OuraRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<OuraDailyReadiness>>(
    args.client,
    `/v2/usercollection/daily_readiness${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: OuraDailyReadiness[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO oura_daily_readiness
        (id, day, score, temperature_deviation, temperature_trend_deviation, raw_json)
       VALUES (@id, @day, @score, @temperature_deviation, @temperature_trend_deviation, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         day = excluded.day, score = excluded.score,
         temperature_deviation = excluded.temperature_deviation,
         temperature_trend_deviation = excluded.temperature_trend_deviation,
         raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_readiness
        (provider, date, score, skin_temp_delta_c, raw_provider_id)
       VALUES (@provider, @date, @score, @skin_temp_delta_c, @raw_provider_id)
       ON CONFLICT(provider, date) DO UPDATE SET
         score = excluded.score, skin_temp_delta_c = excluded.skin_temp_delta_c,
         raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        day: r.day,
        score: r.score ?? null,
        temperature_deviation: r.temperature_deviation ?? null,
        temperature_trend_deviation: r.temperature_trend_deviation ?? null,
        raw_json: JSON.stringify(r),
      });
      normIns.run(normalizeOuraDailyReadiness(r));
    }
  });
  tx(records);
  setCursor(args.db, 'readiness', data.next_token ?? null);
  return {
    provider: 'oura',
    resource: 'readiness',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runDailyActivity = async (args: OuraRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<OuraDailyActivity>>(
    args.client,
    `/v2/usercollection/daily_activity${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: OuraDailyActivity[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO oura_daily_activity
        (id, day, score, steps, active_calories, total_calories, equivalent_walking_distance,
         high_activity_time, medium_activity_time, low_activity_time, raw_json)
       VALUES (@id, @day, @score, @steps, @active_calories, @total_calories,
         @equivalent_walking_distance, @high_activity_time, @medium_activity_time,
         @low_activity_time, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         day = excluded.day, score = excluded.score, steps = excluded.steps,
         active_calories = excluded.active_calories, total_calories = excluded.total_calories,
         equivalent_walking_distance = excluded.equivalent_walking_distance,
         high_activity_time = excluded.high_activity_time,
         medium_activity_time = excluded.medium_activity_time,
         low_activity_time = excluded.low_activity_time, raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_daily
        (provider, date, steps, kcal_active, kcal_total, distance_m, raw_provider_id)
       VALUES (@provider, @date, @steps, @kcal_active, @kcal_total, @distance_m, @raw_provider_id)
       ON CONFLICT(provider, date) DO UPDATE SET
         steps = COALESCE(excluded.steps, wearable_daily.steps),
         kcal_active = COALESCE(excluded.kcal_active, wearable_daily.kcal_active),
         kcal_total = COALESCE(excluded.kcal_total, wearable_daily.kcal_total),
         distance_m = COALESCE(excluded.distance_m, wearable_daily.distance_m),
         raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        day: r.day,
        score: r.score ?? null,
        steps: r.steps ?? null,
        active_calories: r.active_calories ?? null,
        total_calories: r.total_calories ?? null,
        equivalent_walking_distance: r.equivalent_walking_distance ?? null,
        high_activity_time: r.high_activity_time ?? null,
        medium_activity_time: r.medium_activity_time ?? null,
        low_activity_time: r.low_activity_time ?? null,
        raw_json: JSON.stringify(r),
      });
      normIns.run(normalizeOuraDailyActivity(r));
    }
  });
  tx(records);
  setCursor(args.db, 'daily', data.next_token ?? null);
  return {
    provider: 'oura',
    resource: 'daily',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runDailySleep = async (args: OuraRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<OuraDailySleep>>(
    args.client,
    `/v2/usercollection/daily_sleep${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: OuraDailySleep[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO oura_daily_sleep (id, day, score, raw_json)
       VALUES (@id, @day, @score, @raw_json)
       ON CONFLICT(id) DO UPDATE SET day = excluded.day, score = excluded.score, raw_json = excluded.raw_json`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        day: r.day,
        score: r.score ?? null,
        raw_json: JSON.stringify(r),
      });
    }
  });
  tx(records);
  return {
    provider: 'oura',
    resource: 'sleep',
    raw_count: records.length,
    normalized_count: 0,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

const runWorkout = async (args: OuraRunnerArgs): Promise<SyncResult> => {
  const qs = dateRangeQuery(args.since);
  const data = await callWithRefresh<Paginated<OuraWorkout>>(
    args.client,
    `/v2/usercollection/workout${qs}`,
    args.refresh,
  );
  const records = data.data ?? [];
  const tx = args.db.transaction((rs: OuraWorkout[]) => {
    const rawIns = args.db.prepare(
      `INSERT INTO oura_workout
        (id, activity, intensity, source, day, start_datetime, end_datetime, duration_s,
         distance_m, calories, raw_json)
       VALUES (@id, @activity, @intensity, @source, @day, @start_datetime, @end_datetime,
         @duration_s, @distance_m, @calories, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         activity = excluded.activity, intensity = excluded.intensity, source = excluded.source,
         day = excluded.day, start_datetime = excluded.start_datetime,
         end_datetime = excluded.end_datetime, duration_s = excluded.duration_s,
         distance_m = excluded.distance_m, calories = excluded.calories,
         raw_json = excluded.raw_json`,
    );
    const normIns = args.db.prepare(
      `INSERT INTO wearable_activity
        (provider, provider_id, start, "end", duration_s, type, raw_type, kcal, distance_m,
         raw_provider_id)
       VALUES (@provider, @provider_id, @start, @end, @duration_s, @type, @raw_type, @kcal,
         @distance_m, @raw_provider_id)
       ON CONFLICT(provider, provider_id) DO UPDATE SET
         start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
         type = excluded.type, raw_type = excluded.raw_type, kcal = excluded.kcal,
         distance_m = excluded.distance_m, raw_provider_id = excluded.raw_provider_id`,
    );
    const lookupCanonical = args.db.prepare(
      `SELECT canonical FROM wearable_activity_type_map
       WHERE (provider = ? AND raw_type = ? COLLATE NOCASE)
          OR (provider = '*' AND raw_type = ? COLLATE NOCASE)
       ORDER BY CASE provider WHEN ? THEN 0 ELSE 1 END LIMIT 1`,
    );
    for (const r of rs) {
      const duration_s = Math.max(
        0,
        Math.round(
          (new Date(r.end_datetime).getTime() - new Date(r.start_datetime).getTime()) / 1000,
        ),
      );
      rawIns.run({
        id: r.id,
        activity: r.activity ?? null,
        intensity: r.intensity ?? null,
        source: r.source ?? null,
        day: r.day,
        start_datetime: r.start_datetime,
        end_datetime: r.end_datetime,
        duration_s,
        distance_m: r.distance ?? null,
        calories: r.calories ?? null,
        raw_json: JSON.stringify(r),
      });
      const rawType = r.activity ?? 'unknown';
      const mapped = lookupCanonical.get('oura', rawType, rawType, 'oura') as
        | { canonical: string }
        | undefined;
      normIns.run(normalizeOuraWorkout(r, mapped?.canonical ?? 'other'));
    }
  });
  tx(records);
  setCursor(args.db, 'activity', data.next_token ?? null);
  return {
    provider: 'oura',
    resource: 'activity',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};

export const runOuraResource = (args: OuraRunnerArgs): Promise<SyncResult> => {
  switch (args.resource) {
    case 'profile':
    case 'body':
      return runProfile(args);
    case 'sleep':
      return runSleep(args).then(async (sleep) => {
        await runDailySleep(args);
        return sleep;
      });
    case 'readiness':
      return runDailyReadiness(args);
    case 'daily':
      return runDailyActivity(args);
    case 'activity':
      return runWorkout(args);
  }
};
