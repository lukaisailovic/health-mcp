import type { Ctx } from './types.js';

export type Goals = {
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  hydration_ml: number | null;
  weight_kg_target: number | null;
  updated_at: string;
};

export const getGoals = (ctx: Ctx): Goals => {
  return ctx.db
    .prepare(
      'SELECT kcal, protein_g, carb_g, fat_g, fiber_g, hydration_ml, weight_kg_target, updated_at FROM goals WHERE id = 1',
    )
    .get() as Goals;
};

export const setGoals = (
  ctx: Ctx,
  args: {
    kcal?: number | null;
    protein_g?: number | null;
    carb_g?: number | null;
    fat_g?: number | null;
    fiber_g?: number | null;
    hydration_ml?: number | null;
    weight_kg_target?: number | null;
  },
): Goals => {
  const current = getGoals(ctx);
  ctx.db
    .prepare(
      `UPDATE goals SET
        kcal = ?, protein_g = ?, carb_g = ?, fat_g = ?, fiber_g = ?, hydration_ml = ?, weight_kg_target = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = 1`,
    )
    .run(
      args.kcal === undefined ? current.kcal : args.kcal,
      args.protein_g === undefined ? current.protein_g : args.protein_g,
      args.carb_g === undefined ? current.carb_g : args.carb_g,
      args.fat_g === undefined ? current.fat_g : args.fat_g,
      args.fiber_g === undefined ? current.fiber_g : args.fiber_g,
      args.hydration_ml === undefined ? current.hydration_ml : args.hydration_ml,
      args.weight_kg_target === undefined ? current.weight_kg_target : args.weight_kg_target,
    );
  return getGoals(ctx);
};
