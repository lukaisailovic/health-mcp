import { nowIso, toLocalDate } from '../util/tz.js';
import { getGoals } from './goals.js';
import type { Ctx } from './types.js';

export type DayTotals = {
  date: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sat_fat_g: number;
  sodium_mg: number;
  hydration_ml: number;
  entry_count: number;
  avg_confidence: number | null;
};

const dayTotals = (ctx: Ctx, date: string): DayTotals => {
  const intake = ctx.db
    .prepare(
      `SELECT
        COALESCE(SUM(kcal),0) AS kcal,
        COALESCE(SUM(protein_g),0) AS protein_g,
        COALESCE(SUM(carb_g),0) AS carb_g,
        COALESCE(SUM(fat_g),0) AS fat_g,
        COALESCE(SUM(fiber_g),0) AS fiber_g,
        COALESCE(SUM(sugar_g),0) AS sugar_g,
        COALESCE(SUM(sat_fat_g),0) AS sat_fat_g,
        COALESCE(SUM(sodium_mg),0) AS sodium_mg,
        COUNT(*) AS entry_count,
        AVG(confidence) AS avg_confidence
       FROM intake_v WHERE date = ?`,
    )
    .get(date) as Omit<DayTotals, 'date' | 'hydration_ml'>;
  const hyd = ctx.db
    .prepare('SELECT COALESCE(SUM(ml),0) AS ml FROM hydration_entries WHERE date = ?')
    .get(date) as { ml: number };
  return {
    date,
    ...intake,
    hydration_ml: hyd.ml,
  };
};

const isoDateMinus = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const SUMMABLE_KEYS = [
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'sat_fat_g',
  'sodium_mg',
  'hydration_ml',
  'entry_count',
] as const;

const sumTotals = (rows: DayTotals[]): Omit<DayTotals, 'date' | 'avg_confidence'> => {
  const out = Object.fromEntries(SUMMABLE_KEYS.map((k) => [k, 0])) as Record<
    (typeof SUMMABLE_KEYS)[number],
    number
  >;
  for (const r of rows) {
    for (const k of SUMMABLE_KEYS) out[k] += r[k];
  }
  return out;
};

export type DailySummary = ReturnType<typeof dailySummary>;

export const dailySummary = (
  ctx: Ctx,
  args: { date?: string; compare_to?: 'yesterday' | '7d_avg' } = {},
) => {
  const date = args.date ?? toLocalDate(nowIso(), ctx.config.tz);
  const totals = dayTotals(ctx, date);
  const goals = getGoals(ctx);
  const remaining = {
    kcal: goals.kcal === null ? null : goals.kcal - totals.kcal,
    protein_g: goals.protein_g === null ? null : goals.protein_g - totals.protein_g,
    carb_g: goals.carb_g === null ? null : goals.carb_g - totals.carb_g,
    fat_g: goals.fat_g === null ? null : goals.fat_g - totals.fat_g,
    fiber_g: goals.fiber_g === null ? null : goals.fiber_g - totals.fiber_g,
    hydration_ml: goals.hydration_ml === null ? null : goals.hydration_ml - totals.hydration_ml,
  };
  let compare: { kind: 'yesterday' | '7d_avg'; totals: DayTotals } | undefined;
  if (args.compare_to === 'yesterday') {
    compare = { kind: 'yesterday', totals: dayTotals(ctx, isoDateMinus(date, 1)) };
  } else if (args.compare_to === '7d_avg') {
    const rows: DayTotals[] = [];
    for (let i = 1; i <= 7; i++) rows.push(dayTotals(ctx, isoDateMinus(date, i)));
    const sums = sumTotals(rows);
    const avg = {} as Record<(typeof SUMMABLE_KEYS)[number], number>;
    for (const k of SUMMABLE_KEYS) avg[k] = sums[k] / 7;
    compare = {
      kind: '7d_avg',
      totals: {
        date: `${isoDateMinus(date, 7)}..${isoDateMinus(date, 1)}`,
        ...avg,
        avg_confidence: null,
      },
    };
  }
  return {
    date,
    totals,
    goals,
    remaining,
    compare,
  };
};

export const weeklySummary = (ctx: Ctx, args: { week_starting?: string } = {}) => {
  const today = args.week_starting ?? toLocalDate(nowIso(), ctx.config.tz);
  const start = isoDateMinus(today, 6);
  return rangeSummary(ctx, { start, end: today, bucket: 'day' });
};

export const rangeSummary = (
  ctx: Ctx,
  args: { start: string; end: string; bucket?: 'day' | 'week' },
) => {
  const bucket = args.bucket ?? 'day';
  const dates: string[] = [];
  const d = new Date(`${args.start}T12:00:00Z`);
  const last = new Date(`${args.end}T12:00:00Z`);
  while (d.getTime() <= last.getTime()) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const days = dates.map((date) => dayTotals(ctx, date));
  if (bucket === 'day') return { bucket, start: args.start, end: args.end, days };
  const weeks: DayTotals[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    weeks.push({
      date: `${slice[0]?.date}..${slice[slice.length - 1]?.date}`,
      ...sumTotals(slice),
      avg_confidence: null,
    });
  }
  return { bucket, start: args.start, end: args.end, weeks };
};
