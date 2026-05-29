import { MAX_TRACKED_MACROS, TRACKABLE_MACROS, type TrackableMacro } from '@health-mcp/shared';
import type { GoalBound, GoalsDto } from '@health-mcp/shared/dto';
import type { Ctx } from './types.js';

export type Goals = GoalsDto;

const BOUNDED_MACROS = [
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'sat_fat_g',
  'sodium_mg',
  'hydration_ml',
] as const;
type BoundedMacro = (typeof BOUNDED_MACROS)[number];

const DEFAULT_DIRECTION: Record<BoundedMacro, 'band' | 'min' | 'max'> = {
  kcal: 'band',
  carb_g: 'band',
  fat_g: 'band',
  protein_g: 'min',
  fiber_g: 'min',
  hydration_ml: 'min',
  sat_fat_g: 'max',
  sugar_g: 'max',
  sodium_mg: 'max',
};

type GoalRow = Record<`${BoundedMacro}_min` | `${BoundedMacro}_max`, number | null> & {
  weight_kg_target: number | null;
  tracked_macros: string;
  updated_at: string;
};

const SELECT_COLS = [
  ...BOUNDED_MACROS.flatMap((m) => [`${m}_min`, `${m}_max`]),
  'weight_kg_target',
  'tracked_macros',
  'updated_at',
].join(', ');

const TRACKABLE_SET = new Set<string>(TRACKABLE_MACROS);

// Drops unknown keys, dedupes, preserves order, and caps at MAX_TRACKED_MACROS.
// The REST PUT passes its body straight here unvalidated, so this is the boundary
// that keeps the stored selection well-formed.
const normalizeTracked = (values: unknown): TrackableMacro[] => {
  if (!Array.isArray(values)) return [];
  const out: TrackableMacro[] = [];
  for (const v of values) {
    if (out.length >= MAX_TRACKED_MACROS) break;
    if (typeof v === 'string' && TRACKABLE_SET.has(v) && !out.includes(v as TrackableMacro)) {
      out.push(v as TrackableMacro);
    }
  }
  return out;
};

const parseTrackedColumn = (raw: string): TrackableMacro[] => {
  try {
    return normalizeTracked(JSON.parse(raw));
  } catch {
    return [];
  }
};

const rowToGoals = (row: GoalRow): Goals => {
  const out = {
    weight_kg_target: row.weight_kg_target,
    tracked_macros: parseTrackedColumn(row.tracked_macros),
    updated_at: row.updated_at,
  } as Goals;
  for (const m of BOUNDED_MACROS) {
    out[m] = { min: row[`${m}_min`], max: row[`${m}_max`] };
  }
  return out;
};

export const getGoals = (ctx: Ctx): Goals => {
  const row = ctx.db.prepare(`SELECT ${SELECT_COLS} FROM goals WHERE id = 1`).get() as GoalRow;
  return rowToGoals(row);
};

type GoalFieldInput = number | { min?: number | null; max?: number | null } | null | undefined;

const normalizeField = (macro: BoundedMacro, input: GoalFieldInput): GoalBound | null => {
  if (input === undefined) return null;
  if (input === null) return { min: null, max: null };
  if (typeof input === 'number') {
    const dir = DEFAULT_DIRECTION[macro];
    if (dir === 'min') return { min: input, max: null };
    if (dir === 'max') return { min: null, max: input };
    return { min: input, max: input };
  }
  const min = input.min ?? null;
  const max = input.max ?? null;
  if (min !== null && max !== null && min > max) {
    throw new Error(`${macro}: min (${min}) must be <= max (${max})`);
  }
  return { min, max };
};

export type SetGoalsArgs = Partial<Record<BoundedMacro, GoalFieldInput>> & {
  weight_kg_target?: number | null;
  tracked_macros?: TrackableMacro[];
};

export const setGoals = (ctx: Ctx, args: SetGoalsArgs): Goals => {
  const current = getGoals(ctx);
  const next = { ...current } as Goals;
  for (const m of BOUNDED_MACROS) {
    const update = normalizeField(m, args[m]);
    if (update !== null) next[m] = update;
  }
  const weight =
    args.weight_kg_target === undefined ? current.weight_kg_target : args.weight_kg_target;
  const tracked =
    args.tracked_macros === undefined
      ? current.tracked_macros
      : normalizeTracked(args.tracked_macros);

  const setExpr = BOUNDED_MACROS.flatMap((m) => [`${m}_min = ?`, `${m}_max = ?`]).join(', ');
  const params = BOUNDED_MACROS.flatMap((m) => [next[m].min, next[m].max]);
  ctx.db
    .prepare(
      `UPDATE goals SET ${setExpr}, weight_kg_target = ?, tracked_macros = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1`,
    )
    .run(...params, weight, JSON.stringify(tracked));
  return getGoals(ctx);
};
