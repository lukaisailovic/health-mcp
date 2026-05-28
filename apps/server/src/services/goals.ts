import type { GoalBound, GoalsDto } from '@health-mcp/shared/dto';
import type { Ctx } from './types.js';

export type Goals = GoalsDto;

const BOUNDED_MACROS = [
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'sat_fat_g',
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
};

type GoalRow = Record<`${BoundedMacro}_min` | `${BoundedMacro}_max`, number | null> & {
  weight_kg_target: number | null;
  updated_at: string;
};

const SELECT_COLS = [
  ...BOUNDED_MACROS.flatMap((m) => [`${m}_min`, `${m}_max`]),
  'weight_kg_target',
  'updated_at',
].join(', ');

const rowToGoals = (row: GoalRow): Goals => {
  const out = { weight_kg_target: row.weight_kg_target, updated_at: row.updated_at } as Goals;
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

  const setExpr = BOUNDED_MACROS.flatMap((m) => [`${m}_min = ?`, `${m}_max = ?`]).join(', ');
  const params = BOUNDED_MACROS.flatMap((m) => [next[m].min, next[m].max]);
  ctx.db
    .prepare(
      `UPDATE goals SET ${setExpr}, weight_kg_target = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1`,
    )
    .run(...params, weight);
  return getGoals(ctx);
};
