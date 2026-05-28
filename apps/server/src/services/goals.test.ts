import type { TrackableMacro } from '@health-mcp/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { getGoals, setGoals } from './goals.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('goals', () => {
  it('defaults tracked_macros to the original Today ring set', () => {
    expect(getGoals(ctx).tracked_macros).toEqual(['protein_g', 'carb_g', 'fat_g', 'sat_fat_g']);
  });

  it('caps sugar and sodium plain numbers (default direction → max)', () => {
    const g = setGoals(ctx, { sugar_g: 40, sodium_mg: 2300 });
    expect(g.sugar_g).toEqual({ min: null, max: 40 });
    expect(g.sodium_mg).toEqual({ min: null, max: 2300 });
  });

  it('normalizes untrusted tracked_macros: drops unknown/kcal, dedupes, caps at 4', () => {
    const dirty = [
      'fiber_g',
      'fiber_g',
      'kcal',
      'oops',
      'sugar_g',
      'sodium_mg',
      'protein_g',
      'carb_g',
    ] as unknown as TrackableMacro[];
    const g = setGoals(ctx, { tracked_macros: dirty });
    expect(g.tracked_macros).toEqual(['fiber_g', 'sugar_g', 'sodium_mg', 'protein_g']);
  });

  it('preserves tracked_macros when only bounds change, and vice versa', () => {
    setGoals(ctx, { tracked_macros: ['fiber_g', 'sugar_g'] });
    const afterBounds = setGoals(ctx, { protein_g: { min: 150 } });
    expect(afterBounds.tracked_macros).toEqual(['fiber_g', 'sugar_g']);

    const afterTracked = setGoals(ctx, { tracked_macros: ['carb_g'] });
    expect(afterTracked.protein_g).toEqual({ min: 150, max: null });
  });
});
