import { resolveBiomarker } from './biomarkers.js';
import { type Ctx, ServiceError } from './types.js';

export type MetricSource =
  | 'intake'
  | 'wearable_daily'
  | 'wearable_readiness'
  | 'wearable_sleep'
  | 'wearable_activity'
  | 'lab_results'
  | 'weight'
  | 'hydration'
  | 'measurement';

export type MetricAgg = 'sum' | 'avg' | 'min' | 'max' | 'latest' | 'forward_fill';

export type MetricSpec = {
  source: MetricSource;
  field: string;
  agg: MetricAgg;
  filter?: Record<string, string>;
};

export type Bucket = 'day' | 'week' | 'month';

export type CorrelateArgs = {
  a: MetricSpec;
  b: MetricSpec;
  range: { start: string; end: string };
  bucket?: Bucket;
  lag_buckets?: number;
  method?: 'pearson' | 'spearman';
};

export type CorrelateResult = {
  method: 'pearson' | 'spearman';
  bucket: Bucket;
  lag_buckets: number;
  range: { start: string; end: string };
  n: number;
  r: number | null;
  a: { spec: MetricSpec; series: Array<{ bucket: string; value: number | null }> };
  b: { spec: MetricSpec; series: Array<{ bucket: string; value: number | null }> };
  pairs: Array<{ bucket: string; a: number; b: number }>;
};

const INTAKE_FIELDS = new Set([
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'sat_fat_g',
  'sodium_mg',
]);

const WEARABLE_DAILY_FIELDS = new Set([
  'steps',
  'kcal_active',
  'kcal_total',
  'distance_m',
  'floors',
  'resting_hr',
  'hr_avg',
  'hrv_rmssd_avg',
  'spo2_avg',
  'stand_minutes',
]);

const WEARABLE_READINESS_FIELDS = new Set([
  'score',
  'hrv_rmssd',
  'resting_hr',
  'spo2',
  'skin_temp_delta_c',
  'body_battery',
]);

const WEARABLE_SLEEP_FIELDS = new Set([
  'duration_s',
  'efficiency_pct',
  'score',
  'light_s',
  'deep_s',
  'rem_s',
  'awake_s',
  'respiratory_rate',
  'hr_avg',
  'hr_min',
]);

const WEARABLE_ACTIVITY_FIELDS = new Set([
  'duration_s',
  'kcal',
  'distance_m',
  'elevation_gain_m',
  'hr_avg',
  'hr_max',
  'strain_or_load',
]);

const ALLOWED_FIELDS: Record<MetricSource, Set<string>> = {
  intake: INTAKE_FIELDS,
  wearable_daily: WEARABLE_DAILY_FIELDS,
  wearable_readiness: WEARABLE_READINESS_FIELDS,
  wearable_sleep: WEARABLE_SLEEP_FIELDS,
  wearable_activity: WEARABLE_ACTIVITY_FIELDS,
  lab_results: new Set(['value_numeric']),
  weight: new Set(['kg', 'body_fat_pct']),
  hydration: new Set(['ml']),
  measurement: new Set(['value']),
};

const SQL_AGG: Record<MetricAgg, string> = {
  sum: 'SUM',
  avg: 'AVG',
  min: 'MIN',
  max: 'MAX',
  latest: 'MAX', // overridden below
  forward_fill: 'AVG', // overridden during alignment
};

const validateField = (spec: MetricSpec): void => {
  const allowed = ALLOWED_FIELDS[spec.source];
  if (!allowed.has(spec.field)) {
    throw new ServiceError(
      'invalid_field',
      `field '${spec.field}' not valid for source '${spec.source}'`,
      400,
    );
  }
};

const bucketSqlFor = (bucket: Bucket, dateExpr: string): string => {
  if (bucket === 'day') return dateExpr;
  if (bucket === 'week') return `date(${dateExpr}, 'weekday 0', '-6 days')`;
  return `substr(${dateExpr}, 1, 7) || '-01'`;
};

type SourceConfig = {
  table: string;
  whereCol: 'date' | 'start' | 'taken_at';
  bucketExprCol: string;
  rangeAsIso: boolean;
  defaultAgg: 'SUM' | 'AVG';
  filterCols?: string[];
};

const SOURCES: Record<Exclude<MetricSource, 'lab_results'>, SourceConfig> = {
  intake: {
    table: 'intake_v',
    whereCol: 'date',
    bucketExprCol: 'date',
    rangeAsIso: false,
    defaultAgg: 'SUM',
    filterCols: ['meal_type'],
  },
  wearable_daily: {
    table: 'wearable_daily',
    whereCol: 'date',
    bucketExprCol: 'date',
    rangeAsIso: false,
    defaultAgg: 'AVG',
    filterCols: ['provider'],
  },
  wearable_readiness: {
    table: 'wearable_readiness',
    whereCol: 'date',
    bucketExprCol: 'date',
    rangeAsIso: false,
    defaultAgg: 'AVG',
    filterCols: ['provider'],
  },
  wearable_sleep: {
    table: 'wearable_sleep',
    whereCol: 'start',
    bucketExprCol: 'substr(start, 1, 10)',
    rangeAsIso: true,
    defaultAgg: 'AVG',
    filterCols: ['provider'],
  },
  wearable_activity: {
    table: 'wearable_activity',
    whereCol: 'start',
    bucketExprCol: 'substr(start, 1, 10)',
    rangeAsIso: true,
    defaultAgg: 'AVG',
    filterCols: ['provider', 'type'],
  },
  weight: {
    table: 'weight_entries',
    whereCol: 'date',
    bucketExprCol: 'date',
    rangeAsIso: false,
    defaultAgg: 'AVG',
  },
  hydration: {
    table: 'hydration_entries',
    whereCol: 'date',
    bucketExprCol: 'date',
    rangeAsIso: false,
    defaultAgg: 'SUM',
  },
  measurement: {
    table: 'measurements',
    whereCol: 'date',
    bucketExprCol: 'date',
    rangeAsIso: false,
    defaultAgg: 'AVG',
    filterCols: ['kind'],
  },
};

const queryConfigured = (
  ctx: Ctx,
  cfg: SourceConfig,
  spec: MetricSpec,
  range: CorrelateArgs['range'],
  bucket: Bucket,
): Array<{ bucket: string; value: number | null }> => {
  const conds: string[] = [`${cfg.whereCol} >= ?`, `${cfg.whereCol} <= ?`];
  const params: unknown[] = cfg.rangeAsIso
    ? [`${range.start}T00:00:00Z`, `${range.end}T23:59:59Z`]
    : [range.start, range.end];
  for (const col of cfg.filterCols ?? []) {
    const v = spec.filter?.[col];
    if (v) {
      conds.push(`${col} = ?`);
      params.push(v);
    }
  }
  const fn = SQL_AGG[spec.agg] ?? cfg.defaultAgg;
  const bucketExpr = bucketSqlFor(bucket, cfg.bucketExprCol);
  return ctx.db
    .prepare(
      `SELECT ${bucketExpr} AS bucket, ${fn}(${spec.field}) AS value
       FROM ${cfg.table} WHERE ${conds.join(' AND ')}
       GROUP BY bucket ORDER BY bucket`,
    )
    .all(...params) as Array<{ bucket: string; value: number | null }>;
};

const queryLabResults = (
  ctx: Ctx,
  spec: MetricSpec,
  range: CorrelateArgs['range'],
  bucket: Bucket,
): Array<{ bucket: string; value: number | null }> => {
  if (!spec.filter?.biomarker) {
    throw new ServiceError('missing_filter', 'lab_results requires filter.biomarker', 400);
  }
  const b = resolveBiomarker(ctx, spec.filter.biomarker);
  const bucketExpr = bucketSqlFor(bucket, 'substr(taken_at, 1, 10)');
  const fn = SQL_AGG[spec.agg] ?? 'AVG';
  return ctx.db
    .prepare(
      `SELECT ${bucketExpr} AS bucket, ${fn}(${spec.field}) AS value
       FROM lab_results WHERE biomarker_id = ? AND taken_at >= ? AND taken_at <= ?
       GROUP BY bucket ORDER BY bucket`,
    )
    .all(b.id, `${range.start}T00:00:00Z`, `${range.end}T23:59:59Z`) as Array<{
    bucket: string;
    value: number | null;
  }>;
};

const querySeries = (
  ctx: Ctx,
  spec: MetricSpec,
  range: CorrelateArgs['range'],
  bucket: Bucket,
): Array<{ bucket: string; value: number | null }> => {
  validateField(spec);
  if (spec.source === 'lab_results') return queryLabResults(ctx, spec, range, bucket);
  return queryConfigured(ctx, SOURCES[spec.source], spec, range, bucket);
};

const enumerateBuckets = (range: CorrelateArgs['range'], bucket: Bucket): string[] => {
  const out: string[] = [];
  const start = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.end}T23:59:59Z`);
  const cursor = new Date(start);
  if (bucket === 'day') {
    while (cursor.getTime() <= end.getTime()) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else if (bucket === 'week') {
    cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
    while (cursor.getTime() <= end.getTime()) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  } else {
    cursor.setUTCDate(1);
    while (cursor.getTime() <= end.getTime()) {
      out.push(`${cursor.toISOString().slice(0, 7)}-01`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return out;
};

const denseSeries = (
  buckets: string[],
  rows: Array<{ bucket: string; value: number | null }>,
  agg: MetricAgg,
): Array<{ bucket: string; value: number | null }> => {
  const byBucket = new Map<string, number | null>(rows.map((r) => [r.bucket, r.value]));
  if (agg !== 'forward_fill') {
    return buckets.map((b) => ({ bucket: b, value: byBucket.get(b) ?? null }));
  }
  let carry: number | null = null;
  return buckets.map((b) => {
    const v = byBucket.get(b);
    if (v != null) carry = v;
    return { bucket: b, value: carry };
  });
};

const pearson = (xs: number[], ys: number[]): number | null => {
  const n = xs.length;
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i] as number;
    sumY += ys[i] as number;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - meanX;
    const dy = (ys[i] as number) - meanY;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return num / denom;
};

const rank = (values: number[]): number[] => {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.v === indexed[i]!.v) j++;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k]!.i] = avg;
    i = j + 1;
  }
  return ranks;
};

const spearman = (xs: number[], ys: number[]): number | null => pearson(rank(xs), rank(ys));

export const correlate = (ctx: Ctx, args: CorrelateArgs): CorrelateResult => {
  const bucket = args.bucket ?? 'day';
  const method = args.method ?? 'pearson';
  const lag = args.lag_buckets ?? 0;

  const aRows = querySeries(ctx, args.a, args.range, bucket);
  const bRows = querySeries(ctx, args.b, args.range, bucket);
  const buckets = enumerateBuckets(args.range, bucket);
  const aSeries = denseSeries(buckets, aRows, args.a.agg);
  const bSeries = denseSeries(buckets, bRows, args.b.agg);

  const pairs: Array<{ bucket: string; a: number; b: number }> = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < buckets.length; i++) {
    const j = i - lag;
    if (j < 0 || j >= buckets.length) continue;
    const av = aSeries[i]?.value;
    const bv = bSeries[j]?.value;
    if (av == null || bv == null) continue;
    const bucketKey = buckets[i] as string;
    pairs.push({ bucket: bucketKey, a: av, b: bv });
    xs.push(av);
    ys.push(bv);
  }

  const r = method === 'spearman' ? spearman(xs, ys) : pearson(xs, ys);

  return {
    method,
    bucket,
    lag_buckets: lag,
    range: args.range,
    n: pairs.length,
    r,
    a: { spec: args.a, series: aSeries },
    b: { spec: args.b, series: bSeries },
    pairs,
  };
};

export const listCorrelateMetrics = (): Array<{ source: MetricSource; fields: string[] }> =>
  (Object.keys(ALLOWED_FIELDS) as MetricSource[]).map((source) => ({
    source,
    fields: Array.from(ALLOWED_FIELDS[source]).sort(),
  }));

export const isCorrelateAvailable = (ctx: Ctx): boolean => {
  const intakeDays = ctx.db
    .prepare('SELECT COUNT(DISTINCT date) AS n FROM intake_v')
    .get() as { n: number };
  if (intakeDays.n < 7) return false;
  const wearableRows = ctx.db
    .prepare('SELECT COUNT(*) AS n FROM wearable_daily')
    .get() as { n: number };
  const labRows = ctx.db
    .prepare('SELECT COUNT(*) AS n FROM lab_results')
    .get() as { n: number };
  return wearableRows.n >= 1 || labRows.n >= 3;
};
