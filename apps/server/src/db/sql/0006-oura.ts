import type { Migration } from '../migrations.js';

const sql = `
CREATE TABLE oura_personal_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER,
  weight_kg REAL,
  height_m REAL,
  biological_sex TEXT,
  email TEXT,
  raw_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE oura_sleep (
  id TEXT PRIMARY KEY,
  bedtime_start TEXT NOT NULL,
  bedtime_end TEXT NOT NULL,
  day TEXT NOT NULL,
  total_sleep_duration_s INTEGER,
  time_in_bed_s INTEGER,
  efficiency REAL,
  latency_s INTEGER,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  awake_s INTEGER,
  hr_avg REAL,
  hr_min REAL,
  hrv_avg REAL,
  respiratory_rate REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_sleep_day_idx ON oura_sleep(day);

CREATE TABLE oura_daily_sleep (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  score INTEGER,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_daily_sleep_day_idx ON oura_daily_sleep(day);

CREATE TABLE oura_daily_readiness (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  score INTEGER,
  temperature_deviation REAL,
  temperature_trend_deviation REAL,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_daily_readiness_day_idx ON oura_daily_readiness(day);

CREATE TABLE oura_daily_activity (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  score INTEGER,
  steps INTEGER,
  active_calories INTEGER,
  total_calories INTEGER,
  equivalent_walking_distance INTEGER,
  high_activity_time INTEGER,
  medium_activity_time INTEGER,
  low_activity_time INTEGER,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_daily_activity_day_idx ON oura_daily_activity(day);

CREATE TABLE oura_workout (
  id TEXT PRIMARY KEY,
  activity TEXT,
  intensity TEXT,
  source TEXT,
  day TEXT NOT NULL,
  start_datetime TEXT NOT NULL,
  end_datetime TEXT NOT NULL,
  duration_s INTEGER,
  distance_m REAL,
  calories INTEGER,
  raw_json TEXT NOT NULL
);
CREATE INDEX oura_workout_day_idx ON oura_workout(day);

INSERT INTO wearable_activity_type_map (provider, raw_type, canonical) VALUES
  ('oura','running','run'),
  ('oura','cycling','cycle'),
  ('oura','walking','walk'),
  ('oura','hiking','hike'),
  ('oura','swimming','swim'),
  ('oura','rowing','row'),
  ('oura','strength_training','strength'),
  ('oura','hiit','hiit'),
  ('oura','yoga','yoga'),
  ('oura','stretching','stretch'),
  ('oura','dancing','dance'),
  ('oura','climbing','climb');
`;

export const migration0006: Migration = {
  id: '0006-oura',
  sql,
};
