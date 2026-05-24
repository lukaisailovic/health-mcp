import type {
  ApiErrorDto,
  BatchDto,
  BiomarkerDto,
  BiomarkerTrendPointDto,
  DailySummaryDto,
  FoodDto,
  GoalsDto,
  HealthProbe,
  HydrationEntryDto,
  IntakeEntryDto,
  LabPanelDto,
  LabResultDto,
  LatestBiomarkerRowDto,
  MeasurementDto,
  RangeSummaryDto,
  RecipeDto,
  RecipeWithIngredientsDto,
  WearableActivityDto,
  WearableDailyDto,
  WearableProviderInfoDto,
  WearableReadinessDto,
  WearableSleepDto,
  WearableStatusDto,
  WeightEntryDto,
} from '@health-mcp/shared';
import { clearToken, getToken } from './auth.js';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE_URL = '';

type RequestInitJson = Omit<RequestInit, 'body'> & { body?: unknown };

const buildHeaders = (init?: HeadersInit): Headers => {
  const h = new Headers(init);
  const token = getToken();
  if (token) h.set('Authorization', `Bearer ${token}`);
  if (!h.has('Accept')) h.set('Accept', 'application/json');
  return h;
};

const request = async <T>(method: string, path: string, init?: RequestInitJson): Promise<T> => {
  const headers = buildHeaders(init?.headers);
  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    body = JSON.stringify(init.body);
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(401, 'unauthorized', 'token rejected');
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (data as ApiErrorDto | null) ?? { code: 'http_error', message: res.statusText };
    throw new ApiError(res.status, err.code, err.message);
  }
  return data as T;
};

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body });
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
const del = <T>(path: string) => request<T>('DELETE', path);

const qs = (params: Record<string, string | number | boolean | undefined | null>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of entries) sp.set(k, String(v));
  return `?${sp.toString()}`;
};

export const api = {
  health: () => get<HealthProbe>('/health'),

  foods: {
    search: (params: { query: string; source?: 'usda' | 'off' | 'manual'; limit?: number }) =>
      get<FoodDto[]>(`/api/foods/search${qs(params)}`),
    byBarcode: (barcode: string) => get<FoodDto | null>(`/api/foods/barcode/${encodeURIComponent(barcode)}`),
    get: (id: string) => get<FoodDto>(`/api/foods/${encodeURIComponent(id)}`),
    createCustom: (body: {
      name: string;
      brand?: string;
      serving_grams?: number;
      nutrients_per_100g: {
        kcal_per_100g: number;
        protein_g_per_100g: number;
        carb_g_per_100g: number;
        fat_g_per_100g: number;
        fiber_g_per_100g?: number;
        sugar_g_per_100g?: number;
        sat_fat_g_per_100g?: number;
        sodium_mg_per_100g?: number;
      };
    }) => post<FoodDto>('/api/foods', body),
    updateCustom: (id: string, body: Record<string, unknown>) =>
      patch<FoodDto>(`/api/foods/${encodeURIComponent(id)}`, body),
    deleteCustom: (id: string) => del<{ id: string }>(`/api/foods/${encodeURIComponent(id)}`),
  },

  intake: {
    list: (params: { date?: string; start?: string; end?: string; meal_type?: string; limit?: number } = {}) =>
      get<IntakeEntryDto[]>(`/api/intake${qs(params)}`),
    log: (body: unknown) =>
      post<{ entries: IntakeEntryDto[]; batch_remaining: Array<{ batch_id: string; remaining_grams: number }> }>(
        '/api/intake',
        body,
      ),
    update: (id: string, body: Record<string, unknown>) =>
      patch<IntakeEntryDto>(`/api/intake/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string; batch_id: string | null }>(`/api/intake/${encodeURIComponent(id)}`),
    undo: () => post<IntakeEntryDto | null>('/api/intake/undo'),
  },

  hydration: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<HydrationEntryDto[]>(`/api/hydration${qs(params)}`),
    log: (body: { ml: number; ts?: string; notes?: string }) => post<HydrationEntryDto>('/api/hydration', body),
    delete: (id: string) => del<{ id: string }>(`/api/hydration/${encodeURIComponent(id)}`),
  },

  weight: {
    list: (params: { date?: string; start?: string; end?: string; limit?: number } = {}) =>
      get<WeightEntryDto[]>(`/api/weight${qs(params)}`),
    log: (body: { kg: number; body_fat_pct?: number; ts?: string; notes?: string }) =>
      post<WeightEntryDto>('/api/weight', body),
    delete: (id: string) => del<{ id: string }>(`/api/weight/${encodeURIComponent(id)}`),
  },

  measurements: {
    list: (params: { date?: string; start?: string; end?: string; kind?: string; limit?: number } = {}) =>
      get<MeasurementDto[]>(`/api/measurements${qs(params)}`),
    log: (body: { kind: string; value: number; unit: string; ts?: string; notes?: string }) =>
      post<MeasurementDto>('/api/measurements', body),
    delete: (id: string) => del<{ id: string }>(`/api/measurements/${encodeURIComponent(id)}`),
  },

  goals: {
    get: () => get<GoalsDto>('/api/goals'),
    set: (body: Partial<Omit<GoalsDto, 'updated_at'>>) => put<GoalsDto>('/api/goals', body),
  },

  summary: {
    daily: (params: { date?: string; compare_to?: 'yesterday' | '7d_avg' } = {}) =>
      get<DailySummaryDto>(`/api/summary/daily${qs(params)}`),
    weekly: (params: { week_starting?: string } = {}) => get<RangeSummaryDto>(`/api/summary/weekly${qs(params)}`),
    range: (params: { start: string; end: string; bucket?: 'day' | 'week' }) =>
      get<RangeSummaryDto>(`/api/summary/range${qs(params)}`),
  },

  recipes: {
    list: (params: { query?: string; limit?: number } = {}) => get<RecipeDto[]>(`/api/recipes${qs(params)}`),
    get: (id: string) => get<RecipeWithIngredientsDto>(`/api/recipes/${encodeURIComponent(id)}`),
    create: (body: unknown) => post<RecipeWithIngredientsDto>('/api/recipes', body),
    update: (id: string, body: unknown) =>
      patch<RecipeWithIngredientsDto>(`/api/recipes/${encodeURIComponent(id)}`, body),
    delete: (id: string) => del<{ id: string }>(`/api/recipes/${encodeURIComponent(id)}`),
  },

  batches: {
    list: (params: { active_only?: boolean } = {}) =>
      get<BatchDto[]>(`/api/batches${qs({ active_only: params.active_only ? 'true' : undefined })}`),
    get: (id: string) => get<BatchDto>(`/api/batches/${encodeURIComponent(id)}`),
    create: (body: unknown) => post<BatchDto>('/api/batches', body),
    archive: (id: string) => post<BatchDto>(`/api/batches/${encodeURIComponent(id)}/archive`),
    delete: (id: string) => del<{ id: string }>(`/api/batches/${encodeURIComponent(id)}`),
  },

  biomarkers: {
    search: (params: { query?: string; category?: string; out_of_range_only?: boolean; limit?: number } = {}) =>
      get<BiomarkerDto[] | LatestBiomarkerRowDto[]>(`/api/biomarkers${qs(params)}`),
    latest: (params: { category?: string; out_of_range_only?: boolean } = {}) =>
      get<LatestBiomarkerRowDto[]>(`/api/biomarkers${qs(params)}`),
    get: (id: string) => get<BiomarkerDto>(`/api/biomarkers/${encodeURIComponent(id)}`),
    trend: (id: string, params: { start?: string; end?: string } = {}) =>
      get<BiomarkerTrendPointDto[]>(`/api/biomarkers/${encodeURIComponent(id)}/trend${qs(params)}`),
    setOptimal: (id: string, body: { low?: number | null; high?: number | null }) =>
      put<BiomarkerDto>(`/api/biomarkers/${encodeURIComponent(id)}/optimal-range`, body),
  },

  labs: {
    panels: (params: { start?: string; end?: string; limit?: number } = {}) =>
      get<LabPanelDto[]>(`/api/lab-panels${qs(params)}`),
    panel: (id: string) => get<{ panel: LabPanelDto; results: LabResultDto[] }>(`/api/lab-panels/${encodeURIComponent(id)}`),
    createPanel: (body: unknown) => post<{ panel: LabPanelDto; results: LabResultDto[] }>('/api/lab-panels', body),
    deletePanel: (id: string) => del<{ id: string }>(`/api/lab-panels/${encodeURIComponent(id)}`),
    results: (params: {
      biomarker?: string;
      category?: string;
      start?: string;
      end?: string;
      out_of_range_only?: boolean;
      limit?: number;
    } = {}) => get<LabResultDto[]>(`/api/lab-results${qs(params)}`),
    logResult: (body: unknown) => post<LabResultDto>('/api/lab-results', body),
    deleteResult: (id: string) => del<{ id: string }>(`/api/lab-results/${encodeURIComponent(id)}`),
  },

  correlate: {
    metrics: () => get<Array<{ source: string; fields: string[] }>>('/api/correlate/metrics'),
    run: (body: {
      a: { source: string; field: string; agg: string; filter?: Record<string, string> };
      b: { source: string; field: string; agg: string; filter?: Record<string, string> };
      range: { start: string; end: string };
      bucket?: 'day' | 'week' | 'month';
      lag_buckets?: number;
      method?: 'pearson' | 'spearman';
    }) =>
      post<{
        method: 'pearson' | 'spearman';
        bucket: 'day' | 'week' | 'month';
        lag_buckets: number;
        n: number;
        r: number | null;
        pairs: Array<{ bucket: string; a: number; b: number }>;
      }>('/api/correlate', body),
  },

  wearables: {
    providers: () => get<WearableProviderInfoDto[]>('/api/wearables/providers'),
    status: () => get<WearableStatusDto[]>('/api/wearables/status'),
    connect: (provider: string) => post<{ url: string; state: string }>(`/api/wearables/${encodeURIComponent(provider)}/connect`),
    disconnect: (provider: string) =>
      del<{ provider: string; disconnected: boolean }>(`/api/wearables/${encodeURIComponent(provider)}`),
    sync: (body: { providers?: string[]; resources?: string[]; since?: string } = {}) =>
      post<unknown>('/api/wearables/sync', body),
    sleep: (params: { date?: string; start?: string; end?: string; providers?: string } = {}) =>
      get<WearableSleepDto[]>(`/api/wearables/sleep${qs(params)}`),
    activity: (params: { start?: string; end?: string; type?: string; providers?: string } = {}) =>
      get<WearableActivityDto[]>(`/api/wearables/activity${qs(params)}`),
    readiness: (params: { date?: string; start?: string; end?: string; providers?: string } = {}) =>
      get<WearableReadinessDto[]>(`/api/wearables/readiness${qs(params)}`),
    daily: (params: { date?: string; start?: string; end?: string; providers?: string } = {}) =>
      get<WearableDailyDto[]>(`/api/wearables/daily${qs(params)}`),
  },
};
