import type { Db } from '../../../db/client.js';
import type { ResourceKind, SyncResult } from '../../types.js';
import { WhoopApiError, type WhoopClient } from './client.js';
import {
  normalizeWhoopCycle,
  normalizeWhoopRecovery,
  normalizeWhoopSleep,
  normalizeWhoopWorkout,
} from './normalize.js';

type Paginated<T> = { records?: T[]; next_token?: string | null };

type WhoopSleep = {
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
  score_state?: string;
};

type WhoopRecovery = {
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
  score_state?: string;
};

type WhoopWorkout = {
  id: string;
  sport_id?: number;
  sport_name?: string;
  start: string;
  end: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
    zone_duration?: {
      zone_zero_milli?: number;
      zone_one_milli?: number;
      zone_two_milli?: number;
      zone_three_milli?: number;
      zone_four_milli?: number;
      zone_five_milli?: number;
    };
  };
  score_state?: string;
};

type WhoopCycle = {
  id: string;
  start: string;
  end?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
  score_state?: string;
};

const setCursor = (db: Db, provider: string, resource: string, cursor: string | null): void => {
  db.prepare(
    `INSERT INTO wearable_sync_state (provider, resource, last_synced_at, next_token)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)
     ON CONFLICT(provider, resource) DO UPDATE SET
       last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       next_token = excluded.next_token`,
  ).run(provider, resource, cursor);
};

export type WhoopRunnerArgs = {
  db: Db;
  client: WhoopClient;
  resource: ResourceKind;
  cursor: string | null;
  since?: string;
  tz: string;
  refresh: () => Promise<void>;
};

const callWithRefresh = async <T>(
  client: WhoopClient,
  path: string,
  refresh: () => Promise<void>,
): Promise<T> => {
  try {
    return await client.fetchJson<T>(path);
  } catch (err) {
    if (err instanceof WhoopApiError && err.status === 401) {
      await refresh();
      return await client.fetchJson<T>(path);
    }
    throw err;
  }
};

export const runWhoopResource = async ({
  db,
  client,
  resource,
  cursor,
  since,
  tz,
  refresh,
}: WhoopRunnerArgs): Promise<SyncResult> => {
  const query = new URLSearchParams();
  if (cursor) query.set('nextToken', cursor);
  if (since) query.set('start', since);
  query.set('limit', '25');
  const qs = query.toString() ? `?${query.toString()}` : '';

  let path: string;
  switch (resource) {
    case 'sleep':
      path = `/developer/v2/activity/sleep${qs}`;
      break;
    case 'readiness':
      path = `/developer/v2/recovery${qs}`;
      break;
    case 'activity':
      path = `/developer/v2/activity/workout${qs}`;
      break;
    case 'daily':
      path = `/developer/v2/cycle${qs}`;
      break;
    case 'profile':
      path = '/developer/v2/user/profile/basic';
      break;
    case 'body':
      path = '/developer/v2/user/measurement/body';
      break;
  }

  if (resource === 'profile') {
    const data = await callWithRefresh<{
      user_id?: number;
      email?: string;
      first_name?: string;
      last_name?: string;
    }>(client, path, refresh);
    db.prepare(
      `INSERT INTO whoop_profile (id, user_id, email, first_name, last_name, raw_json)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         email = excluded.email,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         raw_json = excluded.raw_json,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    ).run(
      data.user_id ? String(data.user_id) : null,
      data.email ?? null,
      data.first_name ?? null,
      data.last_name ?? null,
      JSON.stringify(data),
    );
    setCursor(db, 'whoop', 'profile', null);
    return {
      provider: 'whoop',
      resource: 'profile',
      raw_count: 1,
      normalized_count: 0,
      done: true,
    };
  }

  if (resource === 'body') {
    const data = await callWithRefresh<{
      height_meter?: number;
      weight_kilogram?: number;
      max_heart_rate?: number;
    }>(client, path, refresh);
    db.prepare(
      `INSERT INTO whoop_body_measurement (id, height_m, weight_kg, max_hr, raw_json)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         height_m = excluded.height_m,
         weight_kg = excluded.weight_kg,
         max_hr = excluded.max_hr,
         raw_json = excluded.raw_json,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    ).run(
      data.height_meter ?? null,
      data.weight_kilogram ?? null,
      data.max_heart_rate ?? null,
      JSON.stringify(data),
    );
    setCursor(db, 'whoop', 'body', null);
    return { provider: 'whoop', resource: 'body', raw_count: 1, normalized_count: 0, done: true };
  }

  if (resource === 'sleep') {
    const data = await callWithRefresh<Paginated<WhoopSleep>>(client, path, refresh);
    const records = data.records ?? [];
    const tx = db.transaction((rs: WhoopSleep[]) => {
      const rawIns = db.prepare(
        `INSERT INTO whoop_sleep (id, start, "end", score, efficiency_pct, light_s, deep_s, rem_s, awake_s, respiratory_rate, score_state, raw_json)
         VALUES (@id, @start, @end, @score, @efficiency_pct, @light_s, @deep_s, @rem_s, @awake_s, @respiratory_rate, @score_state, @raw_json)
         ON CONFLICT(id) DO UPDATE SET
           start = excluded.start, "end" = excluded.end, score = excluded.score,
           efficiency_pct = excluded.efficiency_pct, light_s = excluded.light_s,
           deep_s = excluded.deep_s, rem_s = excluded.rem_s, awake_s = excluded.awake_s,
           respiratory_rate = excluded.respiratory_rate, score_state = excluded.score_state,
           raw_json = excluded.raw_json`,
      );
      const normIns = db.prepare(
        `INSERT INTO wearable_sleep (provider, provider_id, start, "end", duration_s, efficiency_pct, score, light_s, deep_s, rem_s, awake_s, respiratory_rate, raw_provider_id)
         VALUES (@provider, @provider_id, @start, @end, @duration_s, @efficiency_pct, @score, @light_s, @deep_s, @rem_s, @awake_s, @respiratory_rate, @raw_provider_id)
         ON CONFLICT(provider, provider_id) DO UPDATE SET
           start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
           efficiency_pct = excluded.efficiency_pct, score = excluded.score,
           light_s = excluded.light_s, deep_s = excluded.deep_s, rem_s = excluded.rem_s,
           awake_s = excluded.awake_s, respiratory_rate = excluded.respiratory_rate,
           raw_provider_id = excluded.raw_provider_id`,
      );
      for (const r of rs) {
        const efficiency = r.score?.sleep_efficiency_percentage ?? null;
        const stages = r.score?.stage_summary ?? {};
        rawIns.run({
          id: r.id,
          start: r.start,
          end: r.end,
          score: r.score?.sleep_performance_percentage ?? null,
          efficiency_pct: efficiency,
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
          score_state: r.score_state ?? null,
          raw_json: JSON.stringify(r),
        });
        normIns.run(normalizeWhoopSleep(r));
      }
    });
    tx(records);
    setCursor(db, 'whoop', 'sleep', data.next_token ?? null);
    return {
      provider: 'whoop',
      resource: 'sleep',
      raw_count: records.length,
      normalized_count: records.length,
      next_token: data.next_token ?? null,
      done: !data.next_token,
    };
  }

  if (resource === 'readiness') {
    const data = await callWithRefresh<Paginated<WhoopRecovery>>(client, path, refresh);
    const records = data.records ?? [];
    const tx = db.transaction((rs: WhoopRecovery[]) => {
      const rawIns = db.prepare(
        `INSERT INTO whoop_recoveries (sleep_id, cycle_id, score, hrv_rmssd, resting_hr, spo2, skin_temp_c, score_state, raw_json)
         VALUES (@sleep_id, @cycle_id, @score, @hrv_rmssd, @resting_hr, @spo2, @skin_temp_c, @score_state, @raw_json)
         ON CONFLICT(sleep_id) DO UPDATE SET
           cycle_id = excluded.cycle_id, score = excluded.score, hrv_rmssd = excluded.hrv_rmssd,
           resting_hr = excluded.resting_hr, spo2 = excluded.spo2, skin_temp_c = excluded.skin_temp_c,
           score_state = excluded.score_state, raw_json = excluded.raw_json`,
      );
      const normIns = db.prepare(
        `INSERT INTO wearable_readiness (provider, date, score, hrv_rmssd, resting_hr, spo2, skin_temp_delta_c, raw_provider_id)
         VALUES (@provider, @date, @score, @hrv_rmssd, @resting_hr, @spo2, @skin_temp_delta_c, @raw_provider_id)
         ON CONFLICT(provider, date) DO UPDATE SET
           score = excluded.score, hrv_rmssd = excluded.hrv_rmssd, resting_hr = excluded.resting_hr,
           spo2 = excluded.spo2, skin_temp_delta_c = excluded.skin_temp_delta_c,
           raw_provider_id = excluded.raw_provider_id`,
      );
      for (const r of rs) {
        rawIns.run({
          sleep_id: r.sleep_id,
          cycle_id: r.cycle_id ?? null,
          score: r.score?.recovery_score ?? null,
          hrv_rmssd: r.score?.hrv_rmssd_milli ?? null,
          resting_hr: r.score?.resting_heart_rate ?? null,
          spo2: r.score?.spo2_percentage ?? null,
          skin_temp_c: r.score?.skin_temp_celsius ?? null,
          score_state: r.score_state ?? null,
          raw_json: JSON.stringify(r),
        });
        const norm = normalizeWhoopRecovery(r, tz);
        if (norm) normIns.run(norm);
      }
    });
    tx(records);
    setCursor(db, 'whoop', 'readiness', data.next_token ?? null);
    return {
      provider: 'whoop',
      resource: 'readiness',
      raw_count: records.length,
      normalized_count: records.length,
      next_token: data.next_token ?? null,
      done: !data.next_token,
    };
  }

  if (resource === 'activity') {
    const data = await callWithRefresh<Paginated<WhoopWorkout>>(client, path, refresh);
    const records = data.records ?? [];
    const tx = db.transaction((rs: WhoopWorkout[]) => {
      const rawIns = db.prepare(
        `INSERT INTO whoop_workouts (id, sport_id, sport_name, start, "end", strain, kj, distance_m, altitude_gain_m,
          hr_zone_0_s, hr_zone_1_s, hr_zone_2_s, hr_zone_3_s, hr_zone_4_s, hr_zone_5_s, score_state, raw_json)
         VALUES (@id, @sport_id, @sport_name, @start, @end, @strain, @kj, @distance_m, @altitude_gain_m,
          @hr_zone_0_s, @hr_zone_1_s, @hr_zone_2_s, @hr_zone_3_s, @hr_zone_4_s, @hr_zone_5_s, @score_state, @raw_json)
         ON CONFLICT(id) DO UPDATE SET
           sport_id = excluded.sport_id, sport_name = excluded.sport_name, start = excluded.start,
           "end" = excluded.end, strain = excluded.strain, kj = excluded.kj, distance_m = excluded.distance_m,
           altitude_gain_m = excluded.altitude_gain_m, hr_zone_0_s = excluded.hr_zone_0_s,
           hr_zone_1_s = excluded.hr_zone_1_s, hr_zone_2_s = excluded.hr_zone_2_s,
           hr_zone_3_s = excluded.hr_zone_3_s, hr_zone_4_s = excluded.hr_zone_4_s,
           hr_zone_5_s = excluded.hr_zone_5_s, score_state = excluded.score_state, raw_json = excluded.raw_json`,
      );
      const normIns = db.prepare(
        `INSERT INTO wearable_activity (provider, provider_id, start, "end", duration_s, type, raw_type, kcal, distance_m, elevation_gain_m, strain_or_load, raw_provider_id)
         VALUES (@provider, @provider_id, @start, @end, @duration_s, @type, @raw_type, @kcal, @distance_m, @elevation_gain_m, @strain_or_load, @raw_provider_id)
         ON CONFLICT(provider, provider_id) DO UPDATE SET
           start = excluded.start, "end" = excluded.end, duration_s = excluded.duration_s,
           type = excluded.type, raw_type = excluded.raw_type, kcal = excluded.kcal,
           distance_m = excluded.distance_m, elevation_gain_m = excluded.elevation_gain_m,
           strain_or_load = excluded.strain_or_load, raw_provider_id = excluded.raw_provider_id`,
      );
      const lookupCanonical = db.prepare(
        `SELECT canonical FROM wearable_activity_type_map
         WHERE (provider = ? AND raw_type = ? COLLATE NOCASE)
            OR (provider = '*' AND raw_type = ? COLLATE NOCASE)
         ORDER BY CASE provider WHEN ? THEN 0 ELSE 1 END LIMIT 1`,
      );
      for (const r of rs) {
        const zones = r.score?.zone_duration ?? {};
        const msToS = (v: number | undefined) => (v !== undefined ? Math.round(v / 1000) : null);
        rawIns.run({
          id: r.id,
          sport_id: r.sport_id ?? null,
          sport_name: r.sport_name ?? null,
          start: r.start,
          end: r.end,
          strain: r.score?.strain ?? null,
          kj: r.score?.kilojoule ?? null,
          distance_m: r.score?.distance_meter ?? null,
          altitude_gain_m: r.score?.altitude_gain_meter ?? null,
          hr_zone_0_s: msToS(zones.zone_zero_milli),
          hr_zone_1_s: msToS(zones.zone_one_milli),
          hr_zone_2_s: msToS(zones.zone_two_milli),
          hr_zone_3_s: msToS(zones.zone_three_milli),
          hr_zone_4_s: msToS(zones.zone_four_milli),
          hr_zone_5_s: msToS(zones.zone_five_milli),
          score_state: r.score_state ?? null,
          raw_json: JSON.stringify(r),
        });
        const rawType = r.sport_name ?? `sport_${r.sport_id ?? 'unknown'}`;
        const mapped = lookupCanonical.get('whoop', rawType, rawType, 'whoop') as
          | { canonical: string }
          | undefined;
        const canonical = mapped?.canonical ?? 'other';
        normIns.run(normalizeWhoopWorkout(r, canonical));
      }
    });
    tx(records);
    setCursor(db, 'whoop', 'activity', data.next_token ?? null);
    return {
      provider: 'whoop',
      resource: 'activity',
      raw_count: records.length,
      normalized_count: records.length,
      next_token: data.next_token ?? null,
      done: !data.next_token,
    };
  }

  // daily (cycle → daily totals)
  const data = await callWithRefresh<Paginated<WhoopCycle>>(client, path, refresh);
  const records = data.records ?? [];
  const tx = db.transaction((rs: WhoopCycle[]) => {
    const rawIns = db.prepare(
      `INSERT INTO whoop_cycles (id, start, "end", strain, kj, avg_hr, max_hr, score_state, raw_json)
       VALUES (@id, @start, @end, @strain, @kj, @avg_hr, @max_hr, @score_state, @raw_json)
       ON CONFLICT(id) DO UPDATE SET
         start = excluded.start, "end" = excluded.end, strain = excluded.strain,
         kj = excluded.kj, avg_hr = excluded.avg_hr, max_hr = excluded.max_hr,
         score_state = excluded.score_state, raw_json = excluded.raw_json`,
    );
    const normIns = db.prepare(
      `INSERT INTO wearable_daily (provider, date, kcal_active, hr_avg, raw_provider_id)
       VALUES (@provider, @date, @kcal_active, @hr_avg, @raw_provider_id)
       ON CONFLICT(provider, date) DO UPDATE SET
         kcal_active = COALESCE(excluded.kcal_active, wearable_daily.kcal_active),
         hr_avg = COALESCE(excluded.hr_avg, wearable_daily.hr_avg),
         raw_provider_id = excluded.raw_provider_id`,
    );
    for (const r of rs) {
      rawIns.run({
        id: r.id,
        start: r.start,
        end: r.end ?? null,
        strain: r.score?.strain ?? null,
        kj: r.score?.kilojoule ?? null,
        avg_hr: r.score?.average_heart_rate ?? null,
        max_hr: r.score?.max_heart_rate ?? null,
        score_state: r.score_state ?? null,
        raw_json: JSON.stringify(r),
      });
      const norm = normalizeWhoopCycle(r);
      if (norm) normIns.run(norm);
    }
  });
  tx(records);
  setCursor(db, 'whoop', 'daily', data.next_token ?? null);
  return {
    provider: 'whoop',
    resource: 'daily',
    raw_count: records.length,
    normalized_count: records.length,
    next_token: data.next_token ?? null,
    done: !data.next_token,
  };
};
