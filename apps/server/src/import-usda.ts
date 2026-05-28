import { readFileSync } from 'node:fs';
import type { Db } from './db/client.js';
import type { Logger } from './logger.js';
import { upsertFood } from './services/food.js';
import type { Ctx } from './services/types.js';

type FdcNutrient = {
  nutrient?: { name?: string; number?: string; unitName?: string };
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  amount?: number;
};

type FdcFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: FdcNutrient[];
};

type FdcDump = {
  FoundationFoods?: FdcFood[];
  SRLegacyFoods?: FdcFood[];
  BrandedFoods?: FdcFood[];
};

const NUTRIENT_MAP: Record<string, keyof MacroAccumulator> = {
  '208': 'kcal_per_100g',
  '203': 'protein_g',
  '205': 'carb_g',
  '204': 'fat_g',
  '291': 'fiber_g',
  '269': 'sugar_g',
  '606': 'sat_fat_g',
  '307': 'sodium_mg',
};

type MacroAccumulator = {
  kcal_per_100g: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
};

const extractMacros = (nutrients: FdcNutrient[]): MacroAccumulator => {
  const m: MacroAccumulator = {
    kcal_per_100g: null,
    protein_g: null,
    carb_g: null,
    fat_g: null,
    fiber_g: null,
    sugar_g: null,
    sat_fat_g: null,
    sodium_mg: null,
  };
  for (const n of nutrients) {
    const number = n.nutrient?.number ?? n.nutrientNumber;
    if (!number) continue;
    const key = NUTRIENT_MAP[number];
    if (!key || n.amount === undefined) continue;
    m[key] = n.amount;
  }
  return m;
};

const collectFoods = (dump: FdcDump): FdcFood[] => [
  ...(dump.FoundationFoods ?? []),
  ...(dump.SRLegacyFoods ?? []),
  ...(dump.BrandedFoods ?? []),
];

export type ImportUsdaResult = {
  read: number;
  imported: number;
  skipped: number;
};

export const importUsda = (ctx: Pick<Ctx, 'db' | 'logger'>, path: string): ImportUsdaResult => {
  const raw = readFileSync(path, 'utf8');
  const dump = JSON.parse(raw) as FdcDump | FdcFood[];
  const foods = Array.isArray(dump) ? dump : collectFoods(dump);
  let imported = 0;
  let skipped = 0;
  for (const f of foods) {
    const macros = extractMacros(f.foodNutrients ?? []);
    if (macros.kcal_per_100g === null || macros.protein_g === null) {
      skipped++;
      continue;
    }
    upsertFood(ctx as Ctx, {
      source: 'usda',
      source_id: String(f.fdcId),
      name: f.description,
      brand: f.brandOwner ?? null,
      barcode: f.gtinUpc ?? null,
      serving_grams: f.servingSize ?? null,
      kcal_per_100g: macros.kcal_per_100g,
      protein_g: macros.protein_g,
      carb_g: macros.carb_g ?? 0,
      fat_g: macros.fat_g ?? 0,
      fiber_g: macros.fiber_g,
      sugar_g: macros.sugar_g,
      sat_fat_g: macros.sat_fat_g,
      sodium_mg: macros.sodium_mg,
    });
    imported++;
  }
  return { read: foods.length, imported, skipped };
};

export const runImportUsda = (args: {
  db: Db;
  logger: Logger;
  path: string;
}): ImportUsdaResult => {
  const result = importUsda({ db: args.db, logger: args.logger }, args.path);
  args.logger.info('usda import complete', result);
  return result;
};
