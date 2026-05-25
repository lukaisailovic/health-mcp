# REST API

All routes mounted under `/api/*` by `apps/server/src/rest/index.ts`. The dashboard SPA consumes these; agents should prefer the [MCP surface](./MCP.md), which is the same business logic exposed as tools.

## Auth

- If `HEALTH_MCP_TOKEN` is set, every `/api/*` request must carry `Authorization: Bearer <token>`. Missing/invalid → `401`.
- `/health`, `/version`, and `/auth/wearable/callback` are always unauthenticated.
- Auth check uses a constant-time compare on equal-length buffers.

## Errors

All errors are JSON with a stable shape:

```json
{ "code": "biomarker_not_found", "message": "biomarker 'Foobar' not found" }
```

| HTTP | When |
|---|---|
| `400` | Validation failed, `batch_insufficient`, `missing_filter`, `not_oauth`, etc. |
| `401` | Bearer required and missing/invalid. |
| `404` | `*_not_found` codes — id/name didn't resolve. |
| `500` | `internal_error` — unhandled exception (server logs the stack). |

Service-level errors throw `ServiceError(code, message, status)` and propagate the status verbatim. Anything else becomes `internal_error: 500`.

## System

```http
GET /health
GET /version
```

`/health` returns:

```json
{
  "ok": true,
  "db": "up",
  "tz": "Europe/Belgrade",
  "version": "0.1.0",
  "auth_required": true,
  "host": "127.0.0.1",
  "port": 7777,
  "db_path": "~/.health-mcp/data.db",
  "auth_path": "~/.health-mcp/auth.json",
  "dashboard": true,
  "log_level": "info",
  "auto_migrate": true,
  "whoop_sync_cron": "*/30 * * * *",
  "wearable_redirect_base": "http://127.0.0.1:7777/auth/wearable/callback",
  "providers": { "usda": true, "whoop": true, "oura": false }
}
```

`providers.*` reflects which credentials are *configured*, not which are linked. Use `GET /api/wearables/status` for link state.

## Foods

```http
GET    /api/foods/search?query=<q>&source=<usda|off|manual>&limit=<n>
GET    /api/foods/barcode/:barcode
GET    /api/foods/:id
POST   /api/foods
PATCH  /api/foods/:id
DELETE /api/foods/:id
```

- `search` — local FTS first; falls back to USDA when configured and the local set is sparse.
- `barcode` — local cache, then Open Food Facts.
- `POST` body: `{ name, brand?, serving_grams?, nutrients_per_100g: { kcal_per_100g, protein_g_per_100g, carb_g_per_100g, fat_g_per_100g, fiber_g_per_100g?, sugar_g_per_100g?, sat_fat_g_per_100g?, sodium_mg_per_100g? } }`.
- `PATCH` accepts any subset. `nutrients_per_100g` must be passed whole if supplied.
- `DELETE` only works on `source = 'manual'` foods.

## Intake

```http
GET    /api/intake?date=YYYY-MM-DD&start=&end=&meal_type=&limit=
POST   /api/intake
PATCH  /api/intake/:id
DELETE /api/intake/:id
POST   /api/intake/undo
```

**POST body** (atomic — all items + batch decrements happen in one transaction):

```json
{
  "meal_type": "breakfast",
  "ts": "2026-05-24T08:30:00Z",
  "items": [
    { "ref": "food", "food_id": "cuid…", "grams": 150 },
    { "ref": "recipe_serving", "recipe_id": "cuid…", "servings": 1.5 },
    { "ref": "batch", "batch_id": "cuid…", "grams": 200 },
    { "ref": "custom",
      "custom": { "name": "Granny's pancake",
                  "kcal_per_100g": 220, "protein_g_per_100g": 6,
                  "carb_g_per_100g": 35, "fat_g_per_100g": 7 },
      "grams": 90 }
  ],
  "notes": "post-run brunch",
  "tags": ["weekend"]
}
```

- `ts` default: now. `meal_type` default: derived from `ts` against TZ-local windows.
- Each item may carry `confidence` (`0..1`, default `1`), `source_trace` (`exact|estimate|barcode|manual|agent_inference`), and `notes`.
- Returns `{ entries: IntakeEntry[], batch_remaining: [{ batch_id, remaining_grams }] }`.
- A batch ref that would push `remaining_grams` negative fails the entire call with `batch_insufficient: 400` — no partial writes.

**PATCH** accepts `grams?`, `servings?`, `meal_type?`, `notes?`, `tags?`, `confidence?`. Macros are re-derived when grams/servings change. Batch deltas update `remaining_grams`.

**`POST /api/intake/undo`** removes the most recent entry created within the last 10 minutes (refunds the batch if applicable). Returns `null` if nothing qualifies.

## Hydration / weight / measurements

```http
GET    /api/hydration?date=&start=&end=&limit=
POST   /api/hydration            # { ml, ts?, notes? }
DELETE /api/hydration/:id

GET    /api/weight?date=&start=&end=&limit=
POST   /api/weight               # { kg, body_fat_pct?, ts?, notes? }
DELETE /api/weight/:id

GET    /api/measurements?date=&start=&end=&kind=&limit=
POST   /api/measurements         # { kind, value, unit, ts?, notes? }
DELETE /api/measurements/:id
```

## Goals

```http
GET /api/goals
PUT /api/goals      # any subset of: kcal, protein_g, carb_g, fat_g, fiber_g, hydration_ml, weight_kg_target — null clears
```

## Summaries

```http
GET /api/summary/daily?date=YYYY-MM-DD&compare_to=yesterday|7d_avg
GET /api/summary/weekly?week_starting=YYYY-MM-DD
GET /api/summary/range?start=&end=&bucket=day|week
```

`daily` returns totals, current goals, remaining vs goals, optional compare block. `weekly` is `range` pinned to a week. `range` aggregates by day (default) or week.

## Correlate

```http
GET  /api/correlate/metrics
POST /api/correlate
```

`GET /api/correlate/metrics` lists the (source, fields) pairs accepted by correlate — call this first if you don't know the field set.

`POST /api/correlate` body:

```json
{
  "a": { "source": "intake", "field": "protein_g", "agg": "sum" },
  "b": { "source": "wearable_readiness", "field": "score", "agg": "avg",
         "filter": { "provider": "whoop" } },
  "range": { "start": "2026-04-01", "end": "2026-05-01" },
  "bucket": "day",
  "lag_buckets": 1,
  "method": "pearson"
}
```

Returns `{ method, bucket, lag_buckets, range, n, r, a: { spec, series }, b: { spec, series }, pairs }`. `r` is `null` if `n < 2` or variance is zero. Use `agg: "forward_fill"` to carry forward the last known value through gaps (handy for sparse lab series). See [MCP — correlate](./MCP.md#correlate) for the full field allow-list.

## Recipes

```http
GET    /api/recipes?query=&limit=
POST   /api/recipes
GET    /api/recipes/:id
PATCH  /api/recipes/:id
DELETE /api/recipes/:id
```

`POST` body:

```json
{
  "name": "Oat porridge",
  "servings": 2,
  "notes": "weekday breakfast",
  "ingredients": [
    { "food_id": "cuid…", "grams": 80 },
    { "free_text_name": "honey", "grams": 15 }
  ]
}
```

Exactly one of `food_id` / `free_text_name` per ingredient. `GET /:id` returns ingredients + computed totals + per-serving macros.

## Batches

```http
GET    /api/batches?active_only=true
POST   /api/batches
GET    /api/batches/:id
POST   /api/batches/:id/archive
DELETE /api/batches/:id
```

`POST` body:

```json
{
  "name": "Chili Sunday",
  "recipe_id": "cuid…",
  "total_grams": 1800,
  "cooked_at": "2026-05-24T17:00:00Z",
  "expires_at": "2026-05-28T00:00:00Z",
  "notes": "double batch"
}
```

Either `recipe_id` (macros scaled to `total_grams` from the recipe's per-gram density) or `ingredients_override` (a recipe-shaped ingredient array). Macros are *frozen* at cook time — later edits to the source recipe do not retro-mutate.

## Remembered meals

```http
GET    /api/remembered-meals?query=&limit=
POST   /api/remembered-meals
GET    /api/remembered-meals/:id_or_label
PATCH  /api/remembered-meals/:id
DELETE /api/remembered-meals/:id_or_label
POST   /api/remembered-meals/:id_or_label/log     # { ts?, meal_type?, scale? }
```

A remembered meal carries either:
- `canonical_text` — short freeform string for the agent to re-estimate ("2 eggs and a banana"), or
- `items` — a resolved `IntakeItem[]` (same shape as `POST /api/intake`'s `items`),
- or both. If both are present, `items` wins on log.

`POST .../log`: if `items` is set, it inserts intake entries (with `scale` multiplying every `grams`); if only `canonical_text`, it returns the text for the agent to re-estimate and call `/api/intake`. Either path bumps `use_count` and `last_used_at`.

## Biomarkers and labs

```http
GET    /api/biomarkers?query=&category=&out_of_range_only=&limit=
POST   /api/biomarkers                         # create_custom_biomarker
GET    /api/biomarkers/:id
PATCH  /api/biomarkers/:id
PUT    /api/biomarkers/:id/optimal-range       # { low?, high? }
GET    /api/biomarkers/:id/trend?start=&end=
```

The `GET /api/biomarkers` endpoint is dual: `?query=…` returns search hits; no `query` returns `latestBiomarkers` (one row per marker, with status + delta vs previous).

```http
GET    /api/lab-panels?start=&end=&limit=
POST   /api/lab-panels
GET    /api/lab-panels/:id
DELETE /api/lab-panels/:id
GET    /api/lab-results?biomarker=&category=&start=&end=&out_of_range_only=&limit=
POST   /api/lab-results
DELETE /api/lab-results/:id
```

`POST /api/lab-panels` body:

```json
{
  "lab_name": "Quest",
  "drawn_at": "2026-05-01T08:00:00Z",
  "fasting": true,
  "ordered_by": "Dr Foo",
  "source": "manual",
  "panel_name": "Annual physical",
  "results": [
    { "biomarker": "Glucose", "value_numeric": 92, "unit_ucum": "mg/dL" },
    { "biomarker": "HDL Cholesterol", "value_numeric": 60 },
    { "biomarker": "TSH", "value_numeric": 1.8, "ref_low": 0.5, "ref_high": 4.5 }
  ]
}
```

- `biomarker` accepts an id, canonical name, alias, or LOINC code.
- If `unit_ucum` differs from the biomarker's default and the pair is in the [unit conversion table](./BIOMARKERS.md#unit-conversion), value is converted and the original is appended to `notes`. Otherwise it's stored as-supplied and `notes` gets a `unit_mismatch` tag.
- `value_numeric` *or* `value_text` is required.
- `GET /api/lab-panels/:id` returns `{ panel, rows: [{ biomarker, result, status }] }` for each row in the panel.

See [Biomarkers](./BIOMARKERS.md) for the status/range model.

## Wearables

```http
GET    /api/wearables/providers
GET    /api/wearables/status

POST   /api/wearables/:provider/connect       # returns { url, state }
DELETE /api/wearables/:provider               # disconnect
POST   /api/wearables/sync                    # { providers?, resources?, since? }

GET    /api/wearables/sleep?date=&start=&end=&providers=whoop,oura
GET    /api/wearables/activity?start=&end=&type=&providers=
GET    /api/wearables/readiness?date=&start=&end=&providers=
GET    /api/wearables/daily?date=&start=&end=&providers=

PUT    /api/wearables/:provider/activity-type-map    # { raw_type, canonical }

GET    /api/whoop/recovery?date=&start=&end=
```

- `POST .../connect` returns a fully-formed OAuth start URL plus the signed `state` token. The dashboard `window.open`s it.
- The callback (`GET /auth/wearable/callback`) lives at the app root, not under `/api`. It verifies the state, consumes a single-use nonce, exchanges the code, and writes `auth.json`.
- `providers` query param is a comma-separated allow-list. When omitted, rows from all linked providers are returned with `provider` discriminator preserved.

For the per-provider raw shapes (full fidelity, Whoop-only today) use the MCP tools `whoop_recovery`, `whoop_cycles`, `whoop_sleep_raw`, `whoop_workouts_raw`, `whoop_profile`, `whoop_body_measurement`. Only `whoop_recovery` has a REST mirror (`/api/whoop/recovery`) since the dashboard needs it.

See [Wearables](./WEARABLES.md) for the OAuth flow, refresh-token rotation, and provider matrix.

## OAuth callback (not under /api)

```http
GET /auth/wearable/callback?state=<signed>&code=<oauth-code>
```

- Unauthenticated by necessity (third-party redirect).
- `state` is an HMAC-signed payload `{ provider, nonce, exp }` with a 10-minute expiry; the nonce is single-use (persisted in SQLite, purged on expiry).
- On success, returns an HTML page reading "Connected. You can close this window." On failure, returns JSON `{ error }`.
