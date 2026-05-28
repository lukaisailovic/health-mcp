/**
 * One-shot demo seeder. Hits the running health-mcp server over REST for
 * everything that has an endpoint, and writes wearable rows directly into
 * SQLite (no public ingest API for those).
 *
 * Usage:
 *   pnpm --filter health-mcp exec tsx scripts/seed-demo.ts
 *
 * Optional env:
 *   HEALTH_MCP_URL    base URL of the server (default http://127.0.0.1:7777)
 *   HEALTH_MCP_TOKEN  bearer token if the server requires auth
 *   SEED_DAYS         number of days back to seed (default 30)
 */

import Database from 'better-sqlite3';

const BASE = process.env.HEALTH_MCP_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:7777';
const TOKEN = process.env.HEALTH_MCP_TOKEN ?? null;
const DAYS = Number(process.env.SEED_DAYS ?? '30');
const ONLY_WEARABLES = process.argv.includes('--only-wearables');

type Probe = {
  ok: boolean;
  tz: string;
  db_path: string;
  auth_required: boolean;
};

const headers = (): Record<string, string> => {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`;
  return h;
};

const req = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return data as T;
};

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const jitter = (base: number, pct: number): number => base * (1 + rand(-pct, pct));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
const round = (n: number, d = 0): number => Math.round(n * 10 ** d) / 10 ** d;
const isoAt = (daysAgo: number, hour: number, minute = 0): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};
const dateOnly = (daysAgo: number): string => isoAt(daysAgo, 12, 0).slice(0, 10);

// --- Foods ----------------------------------------------------------------

type Food = { id: string; name: string };

const FOOD_DEFS = [
  { name: 'Oats (rolled, dry)', kcal: 380, p: 13, c: 67, f: 7, fiber: 10 },
  { name: 'Greek yogurt 2%', kcal: 73, p: 10, c: 4, f: 2, fiber: 0 },
  { name: 'Banana', kcal: 89, p: 1.1, c: 23, f: 0.3, fiber: 2.6 },
  { name: 'Chicken breast, grilled', kcal: 165, p: 31, c: 0, f: 3.6, fiber: 0 },
  { name: 'White rice, cooked', kcal: 130, p: 2.7, c: 28, f: 0.3, fiber: 0.4 },
  { name: 'Olive oil', kcal: 884, p: 0, c: 0, f: 100, fiber: 0 },
  { name: 'Egg, whole', kcal: 155, p: 13, c: 1.1, f: 11, fiber: 0 },
  { name: 'Almonds', kcal: 579, p: 21, c: 22, f: 50, fiber: 12.5 },
  { name: 'Avocado', kcal: 160, p: 2, c: 9, f: 15, fiber: 7 },
  { name: 'Salmon, baked', kcal: 208, p: 20, c: 0, f: 13, fiber: 0 },
  { name: 'Spinach, raw', kcal: 23, p: 2.9, c: 3.6, f: 0.4, fiber: 2.2 },
  { name: 'Sourdough bread', kcal: 289, p: 11, c: 56, f: 1.8, fiber: 2.5 },
  { name: 'Dark chocolate 85%', kcal: 600, p: 7, c: 30, f: 47, fiber: 11 },
  { name: 'Coffee, black', kcal: 2, p: 0.3, c: 0, f: 0, fiber: 0 },
];

const seedFoods = async (): Promise<Food[]> => {
  const out: Food[] = [];
  for (const f of FOOD_DEFS) {
    const food = await req<{ id: string; name: string }>('POST', '/api/foods', {
      name: f.name,
      nutrients_per_100g: {
        kcal_per_100g: f.kcal,
        protein_g_per_100g: f.p,
        carb_g_per_100g: f.c,
        fat_g_per_100g: f.f,
        fiber_g_per_100g: f.fiber,
      },
    });
    out.push({ id: food.id, name: food.name });
  }
  return out;
};

// --- Goals ----------------------------------------------------------------

const seedGoals = async (): Promise<void> => {
  await req('PUT', '/api/goals', {
    kcal: 2400,
    protein_g: 165,
    carb_g: 270,
    fat_g: 80,
    fiber_g: 35,
    hydration_ml: 3000,
    weight_kg_target: 78,
  });
};

// --- Intake ---------------------------------------------------------------

type MealTemplate = {
  hour: number;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  components: Array<{ name: string; grams: number }>;
};

const MEAL_TEMPLATES: MealTemplate[] = [
  {
    hour: 8,
    type: 'breakfast',
    name: 'Oats & yogurt',
    components: [
      { name: 'Oats (rolled, dry)', grams: 60 },
      { name: 'Greek yogurt 2%', grams: 150 },
      { name: 'Banana', grams: 120 },
      { name: 'Coffee, black', grams: 250 },
    ],
  },
  {
    hour: 8,
    type: 'breakfast',
    name: 'Egg toast & avocado',
    components: [
      { name: 'Egg, whole', grams: 150 },
      { name: 'Sourdough bread', grams: 80 },
      { name: 'Avocado', grams: 60 },
    ],
  },
  {
    hour: 13,
    type: 'lunch',
    name: 'Chicken rice bowl',
    components: [
      { name: 'Chicken breast, grilled', grams: 180 },
      { name: 'White rice, cooked', grams: 220 },
      { name: 'Spinach, raw', grams: 80 },
      { name: 'Olive oil', grams: 10 },
    ],
  },
  {
    hour: 13,
    type: 'lunch',
    name: 'Salmon & rice',
    components: [
      { name: 'Salmon, baked', grams: 170 },
      { name: 'White rice, cooked', grams: 200 },
      { name: 'Spinach, raw', grams: 100 },
    ],
  },
  {
    hour: 16,
    type: 'snack',
    name: 'Almonds & dark chocolate',
    components: [
      { name: 'Almonds', grams: 30 },
      { name: 'Dark chocolate 85%', grams: 20 },
    ],
  },
  {
    hour: 20,
    type: 'dinner',
    name: 'Chicken & avocado plate',
    components: [
      { name: 'Chicken breast, grilled', grams: 160 },
      { name: 'Avocado', grams: 100 },
      { name: 'Spinach, raw', grams: 120 },
      { name: 'Olive oil', grams: 12 },
    ],
  },
];

const seedMeals = async (foods: Food[]): Promise<void> => {
  const foodByName = new Map(foods.map((f) => [f.name, f.id]));
  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const mealsToday = [
      MEAL_TEMPLATES[Math.floor(Math.random() * 2)],
      MEAL_TEMPLATES[2 + Math.floor(Math.random() * 2)],
      MEAL_TEMPLATES[4],
      MEAL_TEMPLATES[5],
    ];
    for (const meal of mealsToday) {
      if (!meal) continue;
      if (meal.type === 'snack' && Math.random() < 0.35) continue;
      await req('POST', '/api/meals', {
        meal_type: meal.type,
        name: meal.name,
        ts: isoAt(daysAgo, meal.hour, Math.floor(rand(0, 50))),
        components: meal.components
          .map((it) => {
            const id = foodByName.get(it.name);
            if (!id) return null;
            return {
              ref: 'food' as const,
              food_id: id,
              grams: Math.max(20, round(jitter(it.grams, 0.18))),
              confidence: round(rand(0.7, 0.98), 2),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      });
    }
  }
};

// --- Hydration ------------------------------------------------------------

const seedHydration = async (): Promise<void> => {
  const pours = [250, 350, 500, 600, 750];
  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const count = 4 + Math.floor(rand(0, 5));
    for (let i = 0; i < count; i++) {
      await req('POST', '/api/hydration', {
        ml: pick(pours),
        ts: isoAt(daysAgo, 7 + Math.floor((14 * i) / count), Math.floor(rand(0, 59))),
      });
    }
  }
};

// --- Weight ---------------------------------------------------------------

const seedWeight = async (): Promise<void> => {
  const start = 80.5;
  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    if (Math.random() < 0.25) continue;
    const trend = start - (DAYS - daysAgo) * 0.04;
    await req('POST', '/api/weight', {
      kg: round(jitter(trend, 0.008), 2),
      body_fat_pct: round(jitter(18, 0.06), 1),
      ts: isoAt(daysAgo, 7, 15),
    });
  }
};

// --- Recipes + batches ----------------------------------------------------

const seedRecipesAndBatches = async (foods: Food[]): Promise<void> => {
  const id = (name: string) => foods.find((f) => f.name === name)?.id;
  const chickenRice = id('Chicken breast, grilled');
  const rice = id('White rice, cooked');
  const oil = id('Olive oil');
  const spinach = id('Spinach, raw');
  if (!chickenRice || !rice || !oil || !spinach) return;

  const r1 = await req<{ recipe: { id: string } }>('POST', '/api/recipes', {
    name: 'Chicken & rice meal-prep',
    servings: 5,
    notes: 'Sunday batch cook.',
    ingredients: [
      { food_id: chickenRice, grams: 800 },
      { food_id: rice, grams: 1100 },
      { food_id: spinach, grams: 400 },
      { food_id: oil, grams: 50 },
    ],
  });

  await req('POST', '/api/batches', {
    name: `Chicken & rice — week of ${dateOnly(0)}`,
    recipe_id: r1.recipe.id,
    total_grams: 2350,
    cooked_at: isoAt(2, 18, 0),
  });

  const salmon = id('Salmon, baked');
  const avocado = id('Avocado');
  if (!salmon || !avocado) return;
  await req('POST', '/api/recipes', {
    name: 'Salmon bowls',
    servings: 3,
    ingredients: [
      { food_id: salmon, grams: 510 },
      { food_id: rice, grams: 600 },
      { food_id: avocado, grams: 300 },
      { food_id: spinach, grams: 300 },
    ],
  });
};

// --- Lab panel ------------------------------------------------------------

const LAB_RESULTS = [
  { biomarker: 'Total Cholesterol', value_numeric: 182, unit_ucum: 'mg/dL' },
  { biomarker: 'HDL Cholesterol', value_numeric: 58, unit_ucum: 'mg/dL' },
  { biomarker: 'LDL Cholesterol', value_numeric: 102, unit_ucum: 'mg/dL' },
  { biomarker: 'Triglycerides', value_numeric: 88, unit_ucum: 'mg/dL' },
  { biomarker: 'ApoB', value_numeric: 78, unit_ucum: 'mg/dL' },
  { biomarker: 'Glucose', value_numeric: 91, unit_ucum: 'mg/dL' },
  { biomarker: 'HbA1c', value_numeric: 5.3, unit_ucum: '%' },
  { biomarker: 'Fasting Insulin', value_numeric: 6.1, unit_ucum: 'uIU/mL' },
  { biomarker: 'Vitamin D', value_numeric: 34, unit_ucum: 'ng/mL' },
  { biomarker: 'Ferritin', value_numeric: 95, unit_ucum: 'ng/mL' },
  { biomarker: 'TSH', value_numeric: 1.7, unit_ucum: 'mIU/L' },
];

const seedLabPanels = async (): Promise<void> => {
  for (const monthsAgo of [6, 3, 0]) {
    const drawnAt = isoAt(monthsAgo * 30, 9, 30);
    await req('POST', '/api/lab-panels', {
      panel_name: monthsAgo === 0 ? 'Annual screen' : `Follow-up (${monthsAgo}mo ago)`,
      lab_name: 'Quest Diagnostics',
      drawn_at: drawnAt,
      fasting: true,
      source: 'manual',
      results: LAB_RESULTS.map((r) => ({
        biomarker: r.biomarker,
        value_numeric: round(jitter(r.value_numeric, 0.08), r.value_numeric < 10 ? 2 : 1),
        unit_ucum: r.unit_ucum,
      })),
    });
  }
};

// --- Wearables (direct SQLite) -------------------------------------------

const seedWearables = (dbPath: string): void => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  const insertSleep = db.prepare(
    `INSERT OR REPLACE INTO wearable_sleep
       (provider, provider_id, start, "end", duration_s, efficiency_pct, score,
        light_s, deep_s, rem_s, awake_s, respiratory_rate, hr_avg, hr_min, raw_provider_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReadiness = db.prepare(
    `INSERT OR REPLACE INTO wearable_readiness
       (provider, date, score, hrv_rmssd, resting_hr, spo2, skin_temp_delta_c, raw_provider_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertDaily = db.prepare(
    `INSERT OR REPLACE INTO wearable_daily
       (provider, date, steps, kcal_active, kcal_total, distance_m, floors,
        resting_hr, hr_avg, hrv_rmssd_avg, spo2_avg, stand_minutes, raw_provider_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
      const date = dateOnly(daysAgo);
      const sleepStart = isoAt(daysAgo, 0, 15);
      const durationS = Math.round(jitter(7.4 * 3600, 0.12));
      const sleepEnd = new Date(new Date(sleepStart).getTime() + durationS * 1000).toISOString();
      const efficiency = round(jitter(89, 0.05), 1);
      const sleepScore = round(jitter(78, 0.13), 0);
      const deep = Math.round(durationS * jitter(0.18, 0.15));
      const rem = Math.round(durationS * jitter(0.22, 0.15));
      const light = Math.round(durationS - deep - rem - durationS * 0.07);
      const awake = durationS - deep - rem - light;

      insertSleep.run(
        'demo',
        `demo-sleep-${date}`,
        sleepStart,
        sleepEnd,
        durationS,
        efficiency,
        sleepScore,
        light,
        deep,
        rem,
        awake,
        round(jitter(14.5, 0.05), 1),
        round(jitter(54, 0.05), 1),
        round(jitter(48, 0.04), 1),
        null,
      );

      const readinessScore = round(jitter(72, 0.18), 0);
      insertReadiness.run(
        'demo',
        date,
        readinessScore,
        round(jitter(58, 0.2), 1),
        round(jitter(54, 0.07), 1),
        round(jitter(97, 0.01), 1),
        round(rand(-0.4, 0.4), 2),
        null,
      );

      insertDaily.run(
        'demo',
        date,
        Math.round(jitter(8500, 0.22)),
        round(jitter(540, 0.25), 0),
        round(jitter(2650, 0.1), 0),
        round(jitter(7200, 0.22), 0),
        Math.round(jitter(8, 0.5)),
        round(jitter(54, 0.05), 1),
        round(jitter(72, 0.06), 1),
        round(jitter(58, 0.2), 1),
        round(jitter(97, 0.01), 1),
        Math.round(jitter(10, 0.3)),
        null,
      );
    }
  });
  tx();
  db.close();
};

// --- Main -----------------------------------------------------------------

const main = async (): Promise<void> => {
  const probe = await req<Probe>('GET', '/health');
  if (!probe.ok) throw new Error('server probe failed');
  process.stdout.write(
    `seeding ${BASE} (db ${probe.db_path}, tz ${probe.tz}, ${DAYS}d${ONLY_WEARABLES ? ', wearables only' : ''})\n`,
  );

  if (ONLY_WEARABLES) {
    process.stdout.write('  wearables (direct sqlite)…\n');
    seedWearables(probe.db_path);
    process.stdout.write('done.\n');
    return;
  }

  process.stdout.write('  goals…\n');
  await seedGoals();

  process.stdout.write('  foods…\n');
  const foods = await seedFoods();

  process.stdout.write('  intake (this can take a moment)…\n');
  await seedMeals(foods);

  process.stdout.write('  hydration…\n');
  await seedHydration();

  process.stdout.write('  weight…\n');
  await seedWeight();

  process.stdout.write('  recipes + batches…\n');
  await seedRecipesAndBatches(foods);

  process.stdout.write('  lab panels…\n');
  await seedLabPanels();

  process.stdout.write('  wearables (direct sqlite)…\n');
  seedWearables(probe.db_path);

  process.stdout.write('done.\n');
};

main().catch((err) => {
  process.stderr.write(`seed failed: ${(err as Error).message}\n`);
  process.exit(1);
});
