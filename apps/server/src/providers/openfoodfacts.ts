type OffNutriments = {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_g_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  'saturated-fat_100g'?: number;
  sodium_100g?: number;
  potassium_100g?: number;
  calcium_100g?: number;
  magnesium_100g?: number;
  iron_100g?: number;
};

type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
};

type OffResponse = {
  status?: number;
  product?: OffProduct;
};

export type OffNormalized = {
  source_id: string;
  name: string;
  brand: string | null;
  serving_grams: number | null;
  kcal_per_100g: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  magnesium_mg: number | null;
  iron_mg: number | null;
  raw_json: string;
};

// OFF reports minerals in grams per 100 g; the catalog stores mg.
const gToMg = (g: number | undefined): number | null => (g === undefined ? null : g * 1000);

export const fetchOffByBarcode = async (barcode: string): Promise<OffNormalized | null> => {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { 'User-Agent': 'health-mcp/0.1 (https://github.com/lukaisailovic)' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OFF HTTP ${res.status}`);
  const data = (await res.json()) as OffResponse;
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments ?? {};
  return {
    source_id: barcode,
    name: p.product_name ?? `Product ${barcode}`,
    brand: p.brands ?? null,
    serving_grams: typeof p.serving_quantity === 'number' ? p.serving_quantity : null,
    kcal_per_100g: n['energy-kcal_100g'] ?? 0,
    protein_g: n.proteins_100g ?? 0,
    carb_g: n.carbohydrates_100g ?? 0,
    fat_g: n.fat_100g ?? 0,
    fiber_g: n.fiber_100g ?? null,
    sugar_g: n.sugars_100g ?? null,
    sat_fat_g: n['saturated-fat_100g'] ?? null,
    sodium_mg: gToMg(n.sodium_100g),
    potassium_mg: gToMg(n.potassium_100g),
    calcium_mg: gToMg(n.calcium_100g),
    magnesium_mg: gToMg(n.magnesium_100g),
    iron_mg: gToMg(n.iron_100g),
    raw_json: JSON.stringify(data.product),
  };
};
