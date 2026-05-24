import type { Migration } from '../migrations.js';

const sql = `
CREATE TABLE wearable_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  auth_strategy TEXT NOT NULL CHECK (auth_strategy IN ('oauth2','apikey','file_import','manual'))
);

INSERT INTO wearable_providers (id, display_name, auth_strategy) VALUES
  ('whoop','Whoop','oauth2'),
  ('oura','Oura','oauth2'),
  ('garmin','Garmin','oauth2'),
  ('apple_health','Apple Health','file_import'),
  ('fitbit','Fitbit','oauth2'),
  ('polar','Polar','oauth2');

CREATE TABLE wearable_sync_state (
  provider TEXT NOT NULL,
  resource TEXT NOT NULL,
  last_synced_at TEXT,
  next_token TEXT,
  PRIMARY KEY (provider, resource)
);

CREATE TABLE wearable_oauth_nonces (
  nonce TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX wearable_oauth_nonces_expires_idx ON wearable_oauth_nonces(expires_at);

CREATE TABLE wearable_sleep (
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  efficiency_pct REAL,
  score REAL,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  awake_s INTEGER,
  respiratory_rate REAL,
  hr_avg REAL,
  hr_min REAL,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, provider_id)
);
CREATE INDEX wearable_sleep_provider_start_idx ON wearable_sleep(provider, start);

CREATE TABLE wearable_activity (
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  type TEXT NOT NULL,
  raw_type TEXT NOT NULL,
  kcal REAL,
  distance_m REAL,
  elevation_gain_m REAL,
  hr_avg REAL,
  hr_max REAL,
  strain_or_load REAL,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, provider_id)
);
CREATE INDEX wearable_activity_provider_start_idx ON wearable_activity(provider, start);
CREATE INDEX wearable_activity_type_start_idx ON wearable_activity(type, start);

CREATE TABLE wearable_readiness (
  provider TEXT NOT NULL,
  date TEXT NOT NULL,
  score REAL,
  hrv_rmssd REAL,
  resting_hr REAL,
  spo2 REAL,
  skin_temp_delta_c REAL,
  body_battery REAL,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, date)
);
CREATE INDEX wearable_readiness_provider_date_idx ON wearable_readiness(provider, date);

CREATE TABLE wearable_daily (
  provider TEXT NOT NULL,
  date TEXT NOT NULL,
  steps INTEGER,
  kcal_active REAL,
  kcal_total REAL,
  distance_m REAL,
  floors INTEGER,
  resting_hr REAL,
  hr_avg REAL,
  hrv_rmssd_avg REAL,
  spo2_avg REAL,
  stand_minutes INTEGER,
  raw_provider_id TEXT,
  PRIMARY KEY (provider, date)
);
CREATE INDEX wearable_daily_provider_date_idx ON wearable_daily(provider, date);

CREATE TABLE wearable_metric_minutes (
  provider TEXT NOT NULL,
  metric TEXT NOT NULL,
  ts TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (provider, metric, ts)
);

CREATE TABLE wearable_activity_type_map (
  provider TEXT NOT NULL,
  raw_type TEXT NOT NULL,
  canonical TEXT NOT NULL,
  PRIMARY KEY (provider, raw_type)
);

INSERT INTO wearable_activity_type_map (provider, raw_type, canonical) VALUES
  ('*','run','run'),
  ('*','running','run'),
  ('*','cycle','cycle'),
  ('*','cycling','cycle'),
  ('*','bike','cycle'),
  ('*','swim','swim'),
  ('*','swimming','swim'),
  ('*','walk','walk'),
  ('*','walking','walk'),
  ('*','hike','hike'),
  ('*','hiking','hike'),
  ('*','row','row'),
  ('*','rowing','row'),
  ('*','strength','strength'),
  ('*','weightlifting','strength'),
  ('*','hiit','hiit'),
  ('*','yoga','yoga'),
  ('*','stretching','stretch'),
  ('*','climbing','climb'),
  ('*','skiing','ski'),
  ('*','snowboarding','board'),
  ('*','dance','dance');

CREATE TABLE whoop_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE whoop_body_measurement (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  height_m REAL,
  weight_kg REAL,
  max_hr REAL,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE whoop_cycles (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  "end" TEXT,
  strain REAL,
  kj REAL,
  avg_hr REAL,
  max_hr REAL,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_cycles_start_idx ON whoop_cycles(start);

CREATE TABLE whoop_recoveries (
  sleep_id TEXT PRIMARY KEY,
  cycle_id TEXT,
  score REAL,
  hrv_rmssd REAL,
  resting_hr REAL,
  spo2 REAL,
  skin_temp_c REAL,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_recoveries_cycle_idx ON whoop_recoveries(cycle_id);

CREATE TABLE whoop_sleep (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  score REAL,
  efficiency_pct REAL,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  awake_s INTEGER,
  respiratory_rate REAL,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_sleep_start_idx ON whoop_sleep(start);

CREATE TABLE whoop_workouts (
  id TEXT PRIMARY KEY,
  sport_id INTEGER,
  sport_name TEXT,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  strain REAL,
  kj REAL,
  distance_m REAL,
  altitude_gain_m REAL,
  hr_zone_0_s INTEGER,
  hr_zone_1_s INTEGER,
  hr_zone_2_s INTEGER,
  hr_zone_3_s INTEGER,
  hr_zone_4_s INTEGER,
  hr_zone_5_s INTEGER,
  score_state TEXT,
  raw_json TEXT NOT NULL
);
CREATE INDEX whoop_workouts_start_idx ON whoop_workouts(start);
`;

export const migration0004: Migration = { id: '0004-wearables', sql };
