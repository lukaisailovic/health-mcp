type UsdaFoodNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
};

type UsdaSearchResultFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaFoodNutrient[];
};

type UsdaSearchResponse = { foods?: UsdaSearchResultFood[] };

export type UsdaNormalized = {
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

const num = (raw: UsdaFoodNutrient[] | undefined, code: string): number | null => {
  if (!raw) return null;
  for (const n of raw) {
    if (n.nutrientNumber === code) return n.value ?? null;
  }
  return null;
};

const normalize = (food: UsdaSearchResultFood): UsdaNormalized => {
  const nutrients = food.foodNutrients;
  return {
    source_id: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    serving_grams:
      food.servingSizeUnit === 'g' || food.servingSizeUnit === 'GRM'
        ? (food.servingSize ?? null)
        : null,
    kcal_per_100g: num(nutrients, '208') ?? 0,
    protein_g: num(nutrients, '203') ?? 0,
    carb_g: num(nutrients, '205') ?? 0,
    fat_g: num(nutrients, '204') ?? 0,
    fiber_g: num(nutrients, '291'),
    sugar_g: num(nutrients, '269'),
    sat_fat_g: num(nutrients, '606'),
    sodium_mg: num(nutrients, '307'),
    potassium_mg: num(nutrients, '306'),
    calcium_mg: num(nutrients, '301'),
    magnesium_mg: num(nutrients, '304'),
    iron_mg: num(nutrients, '303'),
    raw_json: JSON.stringify(food),
  };
};

export const fetchUsdaSearch = async (
  query: string,
  apiKey: string,
  pageSize: number,
): Promise<UsdaNormalized[]> => {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', String(Math.min(pageSize, 50)));
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Branded');
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`USDA HTTP ${res.status}`);
  const data = (await res.json()) as UsdaSearchResponse;
  return (data.foods ?? []).map(normalize);
};

export const fetchUsdaFood = async (
  fdcId: string,
  apiKey: string,
): Promise<UsdaNormalized | null> => {
  const url = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}`);
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`USDA HTTP ${res.status}`);
  const food = (await res.json()) as UsdaSearchResultFood;
  return normalize(food);
};
