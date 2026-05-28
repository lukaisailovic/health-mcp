import type { TrackableMacro } from '@health-mcp/shared';

export type MacroKey = 'kcal' | TrackableMacro;

export type MacroMeta = {
  label: string;
  unit: string;
  color: string;
};

// Display identity for each macro ring — label, unit suffix, and a stable color.
// kcal is always the hero ring; the rest are the trackable Today rings.
export const MACRO_META: Record<MacroKey, MacroMeta> = {
  kcal: { label: 'kcal', unit: '', color: 'var(--color-kumo-brand)' },
  protein_g: { label: 'protein', unit: 'g', color: 'var(--macro-protein)' },
  carb_g: { label: 'carbs', unit: 'g', color: 'var(--macro-carb)' },
  fat_g: { label: 'fat', unit: 'g', color: 'var(--macro-fat)' },
  fiber_g: { label: 'fiber', unit: 'g', color: 'var(--macro-fiber)' },
  sugar_g: { label: 'sugar', unit: 'g', color: 'var(--macro-sugar)' },
  sat_fat_g: { label: 'sat fat', unit: 'g', color: 'var(--macro-sat-fat)' },
  sodium_mg: { label: 'sodium', unit: 'mg', color: 'var(--macro-sodium)' },
};
