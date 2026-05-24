import { cuid } from '../util/id.js';
import { nowIso, toLocalDate } from '../util/tz.js';
import { type Ctx, ServiceError } from './types.js';

export type HydrationEntry = {
  id: string;
  ts: string;
  date: string;
  ml: number;
  notes: string | null;
  created_at: string;
};
export type WeightEntry = {
  id: string;
  ts: string;
  date: string;
  kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
};
export type Measurement = {
  id: string;
  ts: string;
  date: string;
  kind: string;
  value: number;
  unit: string;
  notes: string | null;
  created_at: string;
};

const insertSimple = <T>(
  ctx: Ctx,
  table: string,
  cols: string[],
  values: Record<string, unknown>,
): T => {
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  ctx.db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(values);
  return ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(values.id) as T;
};

type DateRangeArgs = { date?: string; start?: string; end?: string; limit?: number };

const listByDateOrTsRange = <T>(
  ctx: Ctx,
  table: string,
  args: DateRangeArgs,
  extraConds: Array<{ sql: string; value: unknown }> = [],
): T[] => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    conds.push('date = ?');
    params.push(args.date);
  }
  if (args.start) {
    conds.push('ts >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('ts <= ?');
    params.push(args.end);
  }
  for (const c of extraConds) {
    conds.push(c.sql);
    params.push(c.value);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(args.limit ?? 200);
  return ctx.db
    .prepare(`SELECT * FROM ${table} ${where} ORDER BY ts DESC LIMIT ?`)
    .all(...params) as T[];
};

const deleteById = (
  ctx: Ctx,
  table: string,
  id: string,
  notFound: { code: string; label: string },
): { id: string } => {
  const r = ctx.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (r.changes === 0) {
    throw new ServiceError(notFound.code, `${notFound.label} ${id} not found`, 404);
  }
  return { id };
};

export const logHydration = (
  ctx: Ctx,
  args: { ml: number; ts?: string; notes?: string },
): HydrationEntry => {
  const ts = args.ts ?? nowIso();
  return insertSimple<HydrationEntry>(
    ctx,
    'hydration_entries',
    ['id', 'ts', 'date', 'ml', 'notes'],
    {
      id: cuid(),
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      ml: args.ml,
      notes: args.notes ?? null,
    },
  );
};

export const listHydration = (ctx: Ctx, args: DateRangeArgs): HydrationEntry[] =>
  listByDateOrTsRange<HydrationEntry>(ctx, 'hydration_entries', args);

export const deleteHydration = (ctx: Ctx, id: string): { id: string } =>
  deleteById(ctx, 'hydration_entries', id, { code: 'hydration_not_found', label: 'hydration' });

export const logWeight = (
  ctx: Ctx,
  args: { kg: number; body_fat_pct?: number; ts?: string; notes?: string },
): WeightEntry => {
  const ts = args.ts ?? nowIso();
  return insertSimple<WeightEntry>(
    ctx,
    'weight_entries',
    ['id', 'ts', 'date', 'kg', 'body_fat_pct', 'notes'],
    {
      id: cuid(),
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      kg: args.kg,
      body_fat_pct: args.body_fat_pct ?? null,
      notes: args.notes ?? null,
    },
  );
};

export const listWeight = (ctx: Ctx, args: DateRangeArgs): WeightEntry[] =>
  listByDateOrTsRange<WeightEntry>(ctx, 'weight_entries', args);

export const deleteWeight = (ctx: Ctx, id: string): { id: string } =>
  deleteById(ctx, 'weight_entries', id, { code: 'weight_not_found', label: 'weight' });

export const logMeasurement = (
  ctx: Ctx,
  args: { kind: string; value: number; unit: string; ts?: string; notes?: string },
): Measurement => {
  const ts = args.ts ?? nowIso();
  return insertSimple<Measurement>(
    ctx,
    'measurements',
    ['id', 'ts', 'date', 'kind', 'value', 'unit', 'notes'],
    {
      id: cuid(),
      ts,
      date: toLocalDate(ts, ctx.config.tz),
      kind: args.kind,
      value: args.value,
      unit: args.unit,
      notes: args.notes ?? null,
    },
  );
};

export const listMeasurements = (
  ctx: Ctx,
  args: DateRangeArgs & { kind?: string },
): Measurement[] =>
  listByDateOrTsRange<Measurement>(
    ctx,
    'measurements',
    args,
    args.kind ? [{ sql: 'kind = ?', value: args.kind }] : [],
  );

export const deleteMeasurement = (ctx: Ctx, id: string): { id: string } =>
  deleteById(ctx, 'measurements', id, { code: 'measurement_not_found', label: 'measurement' });
