/**
 * Populates the dashboard by driving the real MCP tools over StreamableHTTP,
 * exactly as an agent client would. Unlike seed-demo.ts (REST + direct SQLite),
 * this exercises the public MCP surface only.
 *
 * Wearable streams are intentionally absent: they have no MCP write tool and
 * only arrive via provider sync.
 *
 * Usage:
 *   pnpm --filter health-mcp exec tsx scripts/mcp-seed.ts
 *
 * Optional env:
 *   HEALTH_MCP_URL    base URL (default http://127.0.0.1:7777)
 *   HEALTH_MCP_TOKEN  bearer token if auth is enabled
 *   SEED_DAYS         days of meals/hydration to seed (default 21)
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
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g?: number;
  sat_fat_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
};
type MealTemplate = { name: string; components: { name: string; grams: number; macros: Macros }[] };

const custom = (name: string, grams: number, macros: Macros) => ({
  ref: 'custom' as const,
  grams,
  source_trace: 'estimate' as const,
  custom: { name, absolute: macros },
});

const breakfasts: MealTemplate[] = [
  {
    name: 'Oatmeal with berries',
    components: [
      {
        name: 'Oats, banana & blueberries',
        grams: 380,
        macros: { kcal: 420, protein_g: 14, carb_g: 72, fat_g: 8, fiber_g: 10, sugar_g: 22 },
      },
    ],
  },
  {
    name: 'Eggs & sourdough',
    components: [
      {
        name: 'Three eggs, sourdough, avocado',
        grams: 320,
        macros: { kcal: 510, protein_g: 26, carb_g: 34, fat_g: 28, fiber_g: 7, sat_fat_g: 7 },
      },
    ],
  },
  {
    name: 'Greek yogurt bowl',
    components: [
      {
        name: 'Greek yogurt, granola, honey',
        grams: 350,
        macros: { kcal: 390, protein_g: 28, carb_g: 48, fat_g: 9, fiber_g: 4, sugar_g: 30 },
      },
    ],
  },
];
const lunches: MealTemplate[] = [
  {
    name: 'Chicken rice bowl',
    components: [
      {
        name: 'Grilled chicken, rice, veg',
        grams: 480,
        macros: { kcal: 640, protein_g: 48, carb_g: 70, fat_g: 16, fiber_g: 8, sodium_mg: 720 },
      },
    ],
  },
  {
    name: 'Salmon salad',
    components: [
      {
        name: 'Salmon, greens, olive oil, quinoa',
        grams: 430,
        macros: { kcal: 560, protein_g: 38, carb_g: 32, fat_g: 28, fiber_g: 9, sat_fat_g: 5 },
      },
    ],
  },
  {
    name: 'Turkey wrap',
    components: [
      {
        name: 'Turkey, hummus, whole-wheat wrap',
        grams: 360,
        macros: { kcal: 520, protein_g: 34, carb_g: 52, fat_g: 18, fiber_g: 8, sodium_mg: 880 },
      },
    ],
  },
];
const dinners: MealTemplate[] = [
  {
    name: 'Steak & potatoes',
    components: [
      {
        name: 'Sirloin, roast potatoes, broccoli',
        grams: 520,
        macros: { kcal: 720, protein_g: 52, carb_g: 48, fat_g: 32, fiber_g: 9, sat_fat_g: 12 },
      },
    ],
  },
  {
    name: 'Pasta bolognese',
    components: [
      {
        name: 'Beef bolognese, pasta',
        grams: 500,
        macros: { kcal: 680, protein_g: 36, carb_g: 78, fat_g: 22, fiber_g: 7, sodium_mg: 760 },
      },
    ],
  },
  {
    name: 'Tofu stir-fry',
    components: [
      {
        name: 'Tofu, noodles, vegetables',
        grams: 470,
        macros: { kcal: 590, protein_g: 28, carb_g: 72, fat_g: 20, fiber_g: 11, sodium_mg: 900 },
      },
    ],
  },
];
const snacks: MealTemplate[] = [
  {
    name: 'Protein shake',
    components: [
      {
        name: 'Whey + milk',
        grams: 350,
        macros: { kcal: 230, protein_g: 32, carb_g: 12, fat_g: 5 },
      },
    ],
  },
  {
    name: 'Apple & peanut butter',
    components: [
      {
        name: 'Apple, peanut butter',
        grams: 200,
        macros: { kcal: 270, protein_g: 8, carb_g: 30, fat_g: 14, fiber_g: 5, sugar_g: 20 },
      },
    ],
  },
];

const labResultsFor = (drift: number) => [
  { biomarker: 'Total Cholesterol', value_numeric: round(195 + drift * 12), unit_ucum: 'mg/dL' },
  { biomarker: 'HDL Cholesterol', value_numeric: round(55 - drift * 3), unit_ucum: 'mg/dL' },
  { biomarker: 'LDL Cholesterol', value_numeric: round(118 + drift * 10), unit_ucum: 'mg/dL' },
  { biomarker: 'Triglycerides', value_numeric: round(110 + drift * 25), unit_ucum: 'mg/dL' },
  { biomarker: 'ApoB', value_numeric: round(92 + drift * 8), unit_ucum: 'mg/dL' },
  { biomarker: 'Glucose', value_numeric: round(92 + drift * 4), unit_ucum: 'mg/dL' },
  { biomarker: 'HbA1c', value_numeric: round(5.3 + drift * 0.2, 1), unit_ucum: '%' },
  { biomarker: 'Fasting Insulin', value_numeric: round(7.5 + drift, 1), unit_ucum: 'uIU/mL' },
  { biomarker: 'Hemoglobin', value_numeric: round(14.8 - drift * 0.3, 1), unit_ucum: 'g/dL' },
  { biomarker: 'Ferritin', value_numeric: round(120 - drift * 15), unit_ucum: 'ng/mL' },
  { biomarker: 'Vitamin D', value_numeric: round(34 + drift * 6), unit_ucum: 'ng/mL' },
  { biomarker: 'TSH', value_numeric: round(2.1 + drift * 0.3, 2), unit_ucum: 'mIU/L' },
  { biomarker: 'ALT', value_numeric: round(24 + drift * 4), unit_ucum: 'U/L' },
  { biomarker: 'Creatinine', value_numeric: round(0.95, 2), unit_ucum: 'mg/dL' },
  { biomarker: 'hs-CRP', value_numeric: round(1.2 + drift * 0.6, 1), unit_ucum: 'mg/L' },
];

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: TOKEN ? { headers: { authorization: `Bearer ${TOKEN}` } } : undefined,
  });
  const client = new Client({ name: 'health-mcp-seed', version: '0.0.0' });
  await client.connect(transport);

  const counts = { meal: 0, hydration: 0, weight: 0, measurement: 0, lab: 0 };
  const call = async (name: string, args: Record<string, unknown>) => {
    const res = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content?: unknown;
    };
    if (res.isError) throw new Error(`${name} → ${JSON.stringify(res.content)}`);
    return res;
  };

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

  for (let day = DAYS - 1; day >= 0; day--) {
    const logMeal = async (tpl: MealTemplate, meal_type: string, hour: number, minute: number) => {
      await call('log_meal', {
        ts: isoAt(day, hour, minute),
        meal_type,
        name: tpl.name,
        components: tpl.components.map((c) => custom(c.name, c.grams, c.macros)),
      });
      counts.meal++;
    };

    await logMeal(pick(breakfasts), 'breakfast', 8, round(rand(0, 40)));
    await logMeal(pick(lunches), 'lunch', 13, round(rand(0, 45)));
    await logMeal(pick(dinners), 'dinner', 19, round(rand(0, 50)));
    if (Math.random() < 0.6) await logMeal(pick(snacks), 'snack', 16, round(rand(0, 50)));

    const drinks = Math.floor(rand(3, 6));
    for (let i = 0; i < drinks; i++) {
      await call('log_hydration', {
        ml: round(rand(250, 600)),
        ts: isoAt(day, 9 + i * 3, round(rand(0, 50))),
      });
      counts.hydration++;
    }

    if (day % 2 === 0) {
      const progress = (DAYS - day) / DAYS;
      await call('log_weight', {
        kg: round(82 - progress * 3 + rand(-0.4, 0.4), 1),
        body_fat_pct: round(19 - progress * 1.5 + rand(-0.3, 0.3), 1),
        ts: isoAt(day, 7, 15),
      });
      counts.weight++;
    }

    if (day % 7 === 0) {
      const progress = (DAYS - day) / DAYS;
      await call('log_measurement', {
        kind: 'waist',
        value: round(86 - progress * 2 + rand(-0.5, 0.5), 1),
        unit: 'cm',
        ts: isoAt(day, 7, 20),
      });
      counts.measurement++;
    }
  }

  await call('log_lab_panel', {
    lab_name: 'Quest Diagnostics',
    drawn_at: isoAt(110, 8, 30),
    fasting: true,
    ordered_by: 'Dr. Patel',
    panel_name: 'Comprehensive metabolic + lipid',
    results: labResultsFor(1),
  });
  counts.lab++;
  await call('log_lab_panel', {
    lab_name: 'Quest Diagnostics',
    drawn_at: isoAt(12, 8, 15),
    fasting: true,
    ordered_by: 'Dr. Patel',
    panel_name: 'Comprehensive metabolic + lipid',
    results: labResultsFor(0),
  });
  counts.lab++;

  await client.close();
  console.log('seeded via MCP:', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
