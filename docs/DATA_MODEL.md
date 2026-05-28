# Data model

SQLite via better-sqlite3, single `data.db` at `~/.health-mcp/data.db`. Pragmas applied every connection: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`.

All timestamps stored as **UTC ISO 8601** (`2026-05-24T08:30:00.000Z`). `date` columns are denormalized `YYYY-MM-DD` strings computed in `HEALTH_MCP_TZ` at *write* time (changing TZ later does not retroactively rebucket — use `health-mcp migrate --retz`).

IDs are short `cuid()`s — not autoincrement ints. Trade-off: cuids let the server insert without coordinating with the DB, and they're URL-safe.

Migrations live in `apps/server/src/db/sql/000N-*.ts`. They run automatically on startup unless `--no-auto-migrate` is set. Current list:

| File | Adds |
|---|---|
| `0001-init.ts` | full schema — foods (+ FTS5), meals + meal_components + `intake_v` view, hydration, weight, measurements, goals (per-macro `_min` / `_max`), system, biomarkers (+ `why_it_matters` / `influences` / `how_to_improve`), biomarker_categories + map, lab_panels, lab_results, recipes, recipe_ingredients, batches, remembered_meals (with `components_json`), wearable_providers (seed), wearable_sync_state, wearable_oauth_nonces, wearable_sleep / activity / readiness / daily, wearable_metric_minutes, wearable_activity_type_map (seeded), whoop_* raw tables, oura_* raw tables; seeds ~60 curated biomarkers with categories |
| `0010-relax-meal-components-custom-check.ts` | rebuilds `meal_components` to relax the custom-component `CHECK` so absolute-totals customs (`grams` NULL) are accepted |
| `0011-food-micros-aliases-external-id.ts` | adds `external_id` (partial-unique) + `aliases` + micronutrients (potassium/calcium/magnesium/iron) to `foods`; rebuilds `foods_fts` to index `aliases`; adds the four micros to `meal_components`, to `batches` (as `_total`), and to the `intake_v` view |

## Nutrition

### `foods`
`(id, source, source_id, external_id?, name, brand, barcode, serving_grams, kcal_per_100g, protein_g, carb_g, fat_g, fiber_g?, sugar_g?, sat_fat_g?, sodium_mg?, potassium_mg?, calcium_mg?, magnesium_mg?, iron_mg?, aliases?, raw_json?, created_at)` — `UNIQUE(source, source_id)`, plus a partial `UNIQUE(external_id) WHERE external_id IS NOT NULL`. `source ∈ ('usda','off','manual')`. `external_id` is a stable cross-system key (e.g. an Obsidian slug) that manual upserts dedupe on; `aliases` is a JSON-encoded `string[]` of search synonyms. `foods_fts` is an FTS5 virtual table over `(name, brand, aliases)` with sync triggers; `searchFood` queries it first, reranks with a 0..1 relevance score (coverage × completeness, an exact alias/name match winning), drops sub-floor noise, and trims the tail when there's a clear winner.

### `meals` + `meal_components`

A **meal** is the unit of logging: one event (eaten at a single timestamp, tagged with one meal-type slot). Each meal owns one-or-more **components** that carry the actual macros. This mirrors the Cal AI / SnapCalorie pattern — a photo of a restaurant plate becomes one meal with N editable components; a quick snack is just a meal with one component.

`meals(id, ts, date, meal_type, name?, notes?, tags?, created_at, updated_at)` — `meal_type ∈ ('breakfast','lunch','dinner','snack','other')`. `name` is optional; the dashboard falls back to the slot label or to the single component's name. `tags` is a JSON-encoded `string[]` for forward compat.

`meal_components(id, meal_id FK CASCADE, position int, ref_kind, food_id?, recipe_id?, batch_id?, custom_name?, grams?, servings?, kcal, protein_g, carb_g, fat_g, fiber_g?, sugar_g?, sat_fat_g?, sodium_mg?, potassium_mg?, calcium_mg?, magnesium_mg?, iron_mg?, confidence, source_trace, notes?, created_at)` — `ref_kind ∈ ('food','recipe_serving','batch','custom')`. A `CHECK` constraint enforces the discriminator-coherence rule:

- `food` → `food_id`, `grams` not null; rest null
- `recipe_serving` → `recipe_id`, `servings` not null; rest null
- `batch` → `batch_id`, `grams` not null; rest null
- `custom` → `custom_name`, `grams` not null; rest null

Macros are **frozen on insert per component**. Later edits to the referenced food/recipe/batch do not retro-mutate. `update_meal_component` re-derives that component's macros when `grams`/`grams_delta` (food/batch) or `servings` (recipe_serving) changes — `grams_delta` is a relative correction ("add another 43g"). Custom components reject grams changes — `remove_meal_component` then `add_meal_component` with new grams. Meal totals are computed at read time from components — never denormalized.

Indexes: `meals(date)`, `meals(ts)`, `meals(meal_type)`, `meal_components(meal_id)`, `meal_components(batch_id)`.

### `intake_v` view

`CREATE VIEW intake_v AS SELECT mc.id, m.ts, m.date, m.meal_type, mc.ref_kind, <macros>, mc.confidence FROM meal_components mc JOIN meals m ON m.id = mc.meal_id;`

Flat read-only view consumed by `summaries.ts` (`SUM(kcal) … WHERE date = ?`) and `correlate.ts` (`SOURCES.intake.table = 'intake_v'`). Lets aggregation SQL stay simple without re-introducing a denormalized flat table.

### `hydration_entries` / `weight_entries` / `measurements`
Thin event tables. All carry `(id, ts, date, ..., notes, created_at)`. `measurements.kind` is freeform (e.g. `waist`, `chest`, `biceps`); `unit` is freeform but expected to be UCUM-ish (`cm`, `mm`, …).

### `goals`
Singleton — `CHECK (id = 1)`. Seeded with a row of nulls by the first migration so `set_goals` is always an `UPDATE`. Each bounded macro stores two columns — `<macro>_min` and `<macro>_max` — so a goal can be a floor (only `_min`), a cap (only `_max`), or a target band (both). Bounded macros: `kcal, protein_g, carb_g, fat_g, fiber_g, sat_fat_g, hydration_ml`. `weight_kg_target` stays a single number.

### `recipes`, `recipe_ingredients`
- `recipes(id, name, servings, notes?, created_at, updated_at)`
- `recipe_ingredients(id, recipe_id FK CASCADE, food_id FK SET NULL, free_text_name?, grams, notes?)` — `(food_id IS NOT NULL) XOR (free_text_name IS NOT NULL)` enforced in service code. `get_recipe` aggregates macros across rows with `food_id` (free-text rows contribute only to label/notes).

### `batches`
A cooked instance that depletes as it's eaten.

`(id, name?, recipe_id?, total_grams, remaining_grams, kcal_total, protein_g_total, carb_g_total, fat_g_total, fiber_g_total?, sugar_g_total?, sat_fat_g_total?, sodium_mg_total?, potassium_mg_total?, calcium_mg_total?, magnesium_mg_total?, iron_mg_total?, cooked_at, expires_at?, notes?, archived bool, created_at, updated_at)`

`remaining_grams` decrements atomically inside `log_meal` (and `add_meal_component`) whenever a component has `ref: 'batch'`. The transaction fails with `batch_insufficient` if a decrement would drop below 0 — no partial writes. `delete_meal` and `remove_meal_component` refund the grams. `update_meal_component` handles batch grams deltas in-place (decrement or refund). `archive_batch` is non-destructive: it just sets `archived = 1` so `list_batches(active_only=true)` hides it.

### `remembered_meals`
`(id, label UNIQUE NOCASE, aliases JSON, default_meal_type?, default_name?, canonical_text?, components_json?, notes?, last_used_at?, use_count int default 0, created_at, updated_at)`. At least one of `canonical_text` / `components_json` is required. `log_remembered_meal` prefers `components_json` (deterministic — creates a `meal` directly via `logMeal`) and falls back to returning `canonical_text` for the agent to re-estimate. `default_name` is used as the new meal's `name` if no override is provided; falls back to `label`.

## Biomarkers and labs

### `biomarkers`
`(id, loinc_code?, name UNIQUE NOCASE, display_name?, aliases JSON?, default_unit_ucum, value_type, default_ref_low?, default_ref_high?, optimal_low?, optimal_high?, notes?, created_at, updated_at)`. `value_type ∈ ('numeric','text','numeric_or_text')`.

Seed includes ~60 curated markers (intersection of LOINC Top 2000 with what Function / InsideTracker / Marek surface) with default UCUM units, LOINC codes, and well-known optimal ranges. Custom biomarkers (`create_custom_biomarker`) are first-class.

### `biomarker_categories`, `biomarker_category_map`
Many-to-many. Glucose lives in both `CMP` and `Glycemic`; ferritin in `Iron` and `Inflammation`. Seed categories: Lipid, CBC, CMP, Thyroid, Hormones - sex, Hormones - adrenal, Vitamins, Minerals, Inflammation, Iron, Glycemic, Liver, Kidney, Cardiac, Autoimmunity, Metals, Other.

### `lab_panels`
`(id, name?, lab_name?, ordered_by?, drawn_at, fasting? 0/1, source 'manual'|'pdf_import'|'api', source_ref?, notes?, created_at)`. Optional grouping for one draw.

### `lab_results`
`(id, biomarker_id FK, panel_id FK?, taken_at, value_numeric?, value_text?, unit_ucum, ref_low?, ref_high?, ref_text?, interpretation?, notes?, created_at)`. `taken_at` is denormalized from `lab_panels.drawn_at` for fast time queries on standalone results. Indexed on `(biomarker_id, taken_at)`, `(taken_at)`, `(panel_id)`.

See [Biomarkers](./BIOMARKERS.md) for the three-tier range model and `statusForResult` walk.

## Wearables

Two-tier schema: **per-provider raw mirrors** preserve full fidelity; **provider-agnostic normalized tables** are populated during sync.

### Provider-agnostic

- **`wearable_providers`** — static seed (`whoop`, `oura`, future: `garmin`, `apple_health`, `fitbit`, `polar`). Carries `display_name`, `auth_strategy`.
- **`wearable_sync_state(provider, resource, last_synced_at?, next_token?)`** — pagination cursor per (provider, resource).
- **`wearable_sleep`** — normalized sleep sessions: `(provider, provider_id, start, end, duration_s, efficiency_pct?, score?, light_s?, deep_s?, rem_s?, awake_s?, respiratory_rate?, hr_avg?, hr_min?, raw_ref)`. PK `(provider, provider_id)`.
- **`wearable_activity`** — `(provider, provider_id, start, end, duration_s, type, raw_type, kcal?, distance_m?, elevation_gain_m?, hr_avg?, hr_max?, strain_or_load?, raw_ref)`. `type` is the canonical enum (see below). `raw_type` is preserved verbatim. PK `(provider, provider_id)`.
- **`wearable_readiness`** — daily score: `(provider, date, score?, hrv_rmssd?, resting_hr?, spo2?, skin_temp_delta_c?, body_battery?, raw_ref)`. PK `(provider, date)`.
- **`wearable_daily`** — daily totals: `(provider, date, steps?, kcal_active?, kcal_total?, distance_m?, floors?, resting_hr?, hr_avg?, hrv_rmssd_avg?, spo2_avg?, stand_minutes?, raw_ref)`. PK `(provider, date)`. Daily *averages* are computed *during sync*, not at read time.
- **`wearable_metric_minutes(provider, metric, ts, value)`** — optional minute-resolution timeseries. Only populated when a provider exposes minute-resolution data (Oura yes, Whoop no). PK `(provider, metric, ts)`.
- **`wearable_activity_type_map(provider, raw_type, canonical)`** — extensible: per-`(provider, raw_type)` mapping, with `(provider='*', raw_type=<canonical>)` rows that act as identity entries. `set_activity_type_map` upserts here.

Canonical activity enum (the values writable to `wearable_activity.type` and `wearable_activity_type_map.canonical`):

```
run, cycle, swim, walk, hike, row, strength, hiit, yoga, stretch,
sport_team, sport_racket, sport_combat, climb, ski, board, dance, ergometer, other
```

### Per-provider raw mirrors (full fidelity, `raw_json` preserved)

- **Whoop**: `whoop_profile` (singleton), `whoop_body_measurement` (singleton), `whoop_cycles`, `whoop_recoveries`, `whoop_sleep`, `whoop_workouts`. All non-singleton tables carry `start` indexes for range queries. `whoop_recoveries` has `(cycle_id)` and `(sleep_id pk)`.
- **Oura**: `oura_sleep`, `oura_daily_sleep`, `oura_daily_activity`, `oura_daily_readiness`, `oura_workouts`. Same pattern: full payload in `raw_json`, queryable surface columns extracted.

Adding a provider = new `oura_*`-style tables + a `src/wearables/providers/<id>/` directory + a registry entry. No core changes.

### Wearable auth — outside SQLite

OAuth tokens and API keys live in `~/.health-mcp/auth.json`, **not** the DB. See [Wearables](./WEARABLES.md#auth-storage) and [Security](./SECURITY.md#wearable-token-storage) for the rationale (DB exportable without leaking credentials) and the atomic-write + per-provider-mutex implementation.

## OAuth state

`oauth_state_nonces(nonce TEXT PRIMARY KEY, provider TEXT, expires_at TEXT)`. The wearable callback flow generates a short signed token over `{provider, nonce, exp}` (HMAC-SHA256, app secret derived from `system.secret_key`). On callback the nonce is verified, consumed (deleted), and then the OAuth code is exchanged. `purgeExpiredNonces` runs on every callback so the table stays small.

## `raw_json` policy

Every per-vendor mirror row stores the original API payload in `raw_json`. Trade-offs:

- **Pro**: forward-compat — new fields surface in raw immediately and can be promoted to normalized columns later via migrations without re-syncing.
- **Pro**: debugging — we can see what the upstream API actually returned at sync time.
- **Con**: more storage. Acceptable for a single-user local app.

`health-mcp export` redacts `raw_json` by default; pass `--include-raw` to opt-in to the full dump (this can leak provider-side metadata).
