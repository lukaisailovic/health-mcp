/**
 * Seeds a realistic food pantry and multi-component meals by driving the real
 * MCP tools over StreamableHTTP, exactly as an agent client would.
 *
 * Everyday foods (eggs, oats, blueberries, …) are created once as manual foods
 * and referenced by food_id across meals — so the catalog stays the source of
 * truth and meals show a real per-component breakdown. A few one-offs (sauces,
 * drizzles) stay as inline `custom` components to show the mix.
 *
 * Idempotent for meals: existing meals in the window are cleared before
 * re-seeding. Hydration, weight, measurements, and labs are left untouched.
 *
 * Usage:
 *   pnpm --filter health-mcp exec tsx scripts/mcp-seed.ts
 *
 * Optional env:
 *   HEALTH_MCP_URL    base URL (default http://127.0.0.1:7777)
 *   HEALTH_MCP_TOKEN  bearer token if auth is enabled
 *   SEED_DAYS         days of meals to seed (default 21)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = (process.env.HEALTH_MCP_URL ?? 'http://127.0.0.1:7777').replace(/\/$/, '');
const TOKEN = process.env.HEALTH_MCP_TOKEN ?? null;
const DAYS = Number(process.env.SEED_DAYS ?? '21');

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const round = (n: number, d = 0): number => Math.round(n * 10 ** d) / 10 ** d;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
const isoAt = (daysAgo: number, hour: number, minute = 0): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

type Macros = {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sat_fat?: number;
  sodium?: number;
};

// Everyday foods, macros per 100 g. Created once, referenced by id everywhere.
const PANTRY: Record<string, Macros> = {
  'Rolled oats': { kcal: 379, protein: 13, carb: 67, fat: 7, fiber: 10, sugar: 1 },
  Banana: { kcal: 89, protein: 1.1, carb: 23, fat: 0.3, fiber: 2.6, sugar: 12 },
  Blueberries: { kcal: 57, protein: 0.7, carb: 14, fat: 0.3, fiber: 2.4, sugar: 10 },
  Eggs: { kcal: 155, protein: 13, carb: 1.1, fat: 11, sat_fat: 3.3, sodium: 124 },
  'Sourdough bread': { kcal: 270, protein: 11, carb: 52, fat: 2, fiber: 3, sodium: 540 },
  Avocado: { kcal: 160, protein: 2, carb: 9, fat: 15, fiber: 7 },
  'Greek yogurt': { kcal: 59, protein: 10, carb: 3.6, fat: 0.4, sugar: 3.2 },
  Granola: { kcal: 471, protein: 10, carb: 64, fat: 20, fiber: 7, sugar: 21 },
  Honey: { kcal: 304, protein: 0.3, carb: 82, fat: 0, sugar: 82 },
  'Chicken breast': { kcal: 165, protein: 31, carb: 0, fat: 3.6, sat_fat: 1, sodium: 74 },
  'White rice': { kcal: 130, protein: 2.7, carb: 28, fat: 0.3 },
  Broccoli: { kcal: 35, protein: 2.4, carb: 7, fat: 0.4, fiber: 3.3 },
  'Salmon fillet': { kcal: 208, protein: 20, carb: 0, fat: 13, sat_fat: 3, sodium: 59 },
  Quinoa: { kcal: 120, protein: 4.4, carb: 21, fat: 1.9, fiber: 2.8 },
  'Mixed greens': { kcal: 23, protein: 2.2, carb: 3.6, fat: 0.4, fiber: 2 },
  'Whole-wheat tortilla': { kcal: 310, protein: 8, carb: 50, fat: 8, fiber: 6, sodium: 600 },
  'Turkey breast': { kcal: 104, protein: 17, carb: 4, fat: 2, sodium: 1000 },
  Hummus: { kcal: 166, protein: 8, carb: 14, fat: 10, fiber: 6, sodium: 380 },
  'Sirloin steak': { kcal: 271, protein: 27, carb: 0, fat: 18, sat_fat: 7, sodium: 55 },
  'Roast potatoes': { kcal: 150, protein: 3, carb: 26, fat: 4, fiber: 2, sodium: 240 },
  Pasta: { kcal: 158, protein: 6, carb: 31, fat: 0.9, fiber: 2 },
  'Ground beef': { kcal: 250, protein: 26, carb: 0, fat: 17, sat_fat: 6, sodium: 75 },
  'Tomato sauce': { kcal: 32, protein: 1.6, carb: 7, fat: 0.3, fiber: 1.5, sugar: 5, sodium: 400 },
  'Firm tofu': { kcal: 144, protein: 17, carb: 3, fat: 9, fiber: 2, sodium: 14 },
  'Egg noodles': { kcal: 138, protein: 5, carb: 25, fat: 2, sodium: 5 },
  'Mixed vegetables': { kcal: 60, protein: 3, carb: 12, fat: 0.5, fiber: 4, sodium: 40 },
  'Whey protein': { kcal: 400, protein: 80, carb: 8, fat: 6, sodium: 300 },
  'Milk (2%)': { kcal: 50, protein: 3.4, carb: 5, fat: 2, sugar: 5, sodium: 44 },
  Apple: { kcal: 52, protein: 0.3, carb: 14, fat: 0.2, fiber: 2.4, sugar: 10 },
  'Peanut butter': { kcal: 588, protein: 25, carb: 20, fat: 50, fiber: 6, sugar: 9, sodium: 450 },
};

const per100g = (m: Macros) => ({
  kcal_per_100g: m.kcal,
  protein_g_per_100g: m.protein,
  carb_g_per_100g: m.carb,
  fat_g_per_100g: m.fat,
  ...(m.fiber != null ? { fiber_g_per_100g: m.fiber } : {}),
  ...(m.sugar != null ? { sugar_g_per_100g: m.sugar } : {}),
  ...(m.sat_fat != null ? { sat_fat_g_per_100g: m.sat_fat } : {}),
  ...(m.sodium != null ? { sodium_mg_per_100g: m.sodium } : {}),
});

type FoodComp = { food: string; grams: number };
type CustomComp = { custom: string; grams: number; macros: Macros };
type Comp = FoodComp | CustomComp;
type MealTemplate = { name: string; comps: Comp[] };

const breakfasts: MealTemplate[] = [
  {
    name: 'Oatmeal with berries',
    comps: [
      { food: 'Rolled oats', grams: 60 },
      { food: 'Banana', grams: 100 },
      { food: 'Blueberries', grams: 50 },
      {
        custom: 'Almond butter drizzle',
        grams: 15,
        macros: { kcal: 98, protein: 3.4, carb: 3, fat: 9, fiber: 1.5 },
      },
    ],
  },
  {
    name: 'Eggs & sourdough',
    comps: [
      { food: 'Eggs', grams: 150 },
      { food: 'Sourdough bread', grams: 80 },
      { food: 'Avocado', grams: 70 },
    ],
  },
  {
    name: 'Greek yogurt bowl',
    comps: [
      { food: 'Greek yogurt', grams: 200 },
      { food: 'Granola', grams: 50 },
      { food: 'Blueberries', grams: 40 },
      { food: 'Honey', grams: 15 },
    ],
  },
];
const lunches: MealTemplate[] = [
  {
    name: 'Chicken rice bowl',
    comps: [
      { food: 'Chicken breast', grams: 180 },
      { food: 'White rice', grams: 200 },
      { food: 'Broccoli', grams: 100 },
    ],
  },
  {
    name: 'Salmon salad',
    comps: [
      { food: 'Salmon fillet', grams: 150 },
      { food: 'Mixed greens', grams: 80 },
      { food: 'Quinoa', grams: 100 },
      {
        custom: 'Lemon vinaigrette',
        grams: 15,
        macros: { kcal: 70, protein: 0, carb: 1, fat: 7.5 },
      },
    ],
  },
  {
    name: 'Turkey wrap',
    comps: [
      { food: 'Whole-wheat tortilla', grams: 70 },
      { food: 'Turkey breast', grams: 100 },
      { food: 'Hummus', grams: 40 },
      { food: 'Mixed greens', grams: 30 },
    ],
  },
];
const dinners: MealTemplate[] = [
  {
    name: 'Steak & potatoes',
    comps: [
      { food: 'Sirloin steak', grams: 200 },
      { food: 'Roast potatoes', grams: 200 },
      { food: 'Broccoli', grams: 100 },
    ],
  },
  {
    name: 'Pasta bolognese',
    comps: [
      { food: 'Pasta', grams: 250 },
      { food: 'Ground beef', grams: 120 },
      { food: 'Tomato sauce', grams: 100 },
    ],
  },
  {
    name: 'Tofu stir-fry',
    comps: [
      { food: 'Firm tofu', grams: 150 },
      { food: 'Egg noodles', grams: 150 },
      { food: 'Mixed vegetables', grams: 120 },
      {
        custom: 'Soy-ginger sauce',
        grams: 30,
        macros: { kcal: 45, protein: 1.5, carb: 8, fat: 0.5, sugar: 6, sodium: 900 },
      },
    ],
  },
];
const snacks: MealTemplate[] = [
  {
    name: 'Protein shake',
    comps: [
      { food: 'Whey protein', grams: 30 },
      { food: 'Milk (2%)', grams: 300 },
    ],
  },
  {
    name: 'Apple & peanut butter',
    comps: [
      { food: 'Apple', grams: 150 },
      { food: 'Peanut butter', grams: 30 },
    ],
  },
];

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: TOKEN ? { headers: { authorization: `Bearer ${TOKEN}` } } : undefined,
  });
  const client = new Client({ name: 'health-mcp-seed', version: '0.0.0' });
  await client.connect(transport);

  const call = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const res = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content?: { text?: string }[];
    };
    const text = res.content?.[0]?.text;
    const data = text ? JSON.parse(text) : null;
    if (res.isError) throw new Error(`${name} → ${text}`);
    return data;
  };

  // Pantry: reuse an existing manual food by exact name, else create it.
  const foodIds = new Map<string, string>();
  for (const [name, macros] of Object.entries(PANTRY)) {
    const token =
      name
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .trim()
        .split(/\s+/)[0] ?? name;
    const hits = (await call('search_food', { query: token, source: 'manual', limit: 50 })) as
      | { id: string; name: string }[]
      | null;
    const existing = hits?.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      foodIds.set(name, existing.id);
      continue;
    }
    const created = (await call('create_custom_food', {
      name,
      nutrients_per_100g: per100g(macros),
    })) as { id: string };
    foodIds.set(name, created.id);
  }

  // Clear existing meals in the window so re-runs stay clean.
  const stale = (await call('list_meals', {
    start: isoAt(60, 0, 0),
    end: isoAt(-2, 0, 0),
    limit: 500,
  })) as { id: string }[] | null;
  for (const m of stale ?? []) await call('delete_meal', { id: m.id });

  await call('set_goals', {
    kcal: 2200,
    protein_g: { min: 150 },
    carb_g: 230,
    fat_g: 75,
    fiber_g: { min: 30 },
    sat_fat_g: { max: 22 },
    hydration_ml: { min: 2500 },
    weight_kg_target: 78,
  });

  const componentOf = (c: Comp) => {
    if ('food' in c) {
      return {
        ref: 'food' as const,
        food_id: foodIds.get(c.food)!,
        grams: c.grams,
        source_trace: 'exact' as const,
        confidence: round(rand(0.9, 0.99), 2),
      };
    }
    const m = c.macros;
    return {
      ref: 'custom' as const,
      grams: c.grams,
      source_trace: 'estimate' as const,
      confidence: round(rand(0.6, 0.8), 2),
      custom: {
        name: c.custom,
        absolute: {
          kcal: m.kcal,
          protein_g: m.protein,
          carb_g: m.carb,
          fat_g: m.fat,
          ...(m.fiber != null ? { fiber_g: m.fiber } : {}),
          ...(m.sugar != null ? { sugar_g: m.sugar } : {}),
          ...(m.sat_fat != null ? { sat_fat_g: m.sat_fat } : {}),
          ...(m.sodium != null ? { sodium_mg: m.sodium } : {}),
        },
      },
    };
  };

  let mealCount = 0;
  const logMeal = async (tpl: MealTemplate, meal_type: string, day: number, hour: number) => {
    await call('log_meal', {
      ts: isoAt(day, hour, round(rand(0, 50))),
      meal_type,
      name: tpl.name,
      components: tpl.comps.map(componentOf),
    });
    mealCount++;
  };

  for (let day = DAYS - 1; day >= 0; day--) {
    await logMeal(pick(breakfasts), 'breakfast', day, 8);
    await logMeal(pick(lunches), 'lunch', day, 13);
    await logMeal(pick(dinners), 'dinner', day, 19);
    if (Math.random() < 0.6) await logMeal(pick(snacks), 'snack', day, 16);
  }

  await client.close();
  console.log('seeded via MCP:', {
    foods: foodIds.size,
    mealsCleared: stale?.length ?? 0,
    meals: mealCount,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
