# MCP tools

`health-mcp` advertises its tool surface over MCP. Two transports, same business logic:

- **Streamable-HTTP** at `POST /mcp` — for any HTTP-aware MCP client (Inspector, custom agents).
- **stdio** when started with `--stdio` — for Claude Desktop and embedding in subprocess-based clients.

All tools are snake_case. Tools that hit external services or write to SQLite return the created/updated row; list tools return arrays; errors come back as MCP errors with stable `code` + `message`.

## Discovery first

Two meta-tools — call these first to learn what's live.

| Tool | Description |
|---|---|
| `ping` | Liveness probe. Returns `{ ok, time, tz }`. |
| `discover_capabilities({ group? })` | Live catalog grouped by `group`. Each tool entry carries `name`, `description`, and `enabled` (true if currently registered). Pass `group` to filter. |

The fastest way to learn the surface from a fresh install is `discover_capabilities()` — it tells you which tools are hidden today, so you don't waste tokens on schemas for tools the user can't run.

## Capability gating

Some tools are hidden until certain preconditions are met. The server re-evaluates every 30 s and emits `notifications/tools/list_changed`. Today's gates:

| Tools | Gate |
|---|---|
| `wearables_status`, `wearable_disconnect`, `sync_wearables`, all `wearable_*` reads | at least one wearable provider linked (`auth.json` has an entry) |
| `whoop_*` (recovery, cycles, sleep_raw, workouts_raw, profile, body_measurement) | Whoop specifically linked |
| `correlate`, `list_correlate_metrics` | ≥7 distinct days of intake AND (≥1 `wearable_daily` row OR ≥3 `lab_results`) |
| `list_remembered_meals`, `get_remembered_meal`, `update_remembered_meal`, `forget_meal`, `log_remembered_meal` | at least one row in `remembered_meals` |

`remember_meal` (write) is always exposed so the surface can be bootstrapped. `wearables_list_providers` and `wearable_connect_url` are always exposed so connecting works on a fresh install.

## Surface by group

Below is the full surface. Schemas are condensed — the wire format is JSON, all parameters are exactly as listed.

### `system`

| Tool | Params | Notes |
|---|---|---|
| `ping` | `{}` | `{ ok, time, tz }` |

### `discovery`

| Tool | Params | Notes |
|---|---|---|
| `discover_capabilities` | `{ group? }` | Catalog with enable status. |

### `food`

| Tool | Params | Notes |
|---|---|---|
| `search_food` | `{ query, source?: 'usda'\|'off'\|'manual', limit? }` | Local FTS first. |
| `lookup_barcode` | `{ barcode }` | Local cache then Open Food Facts. |
| `get_food` | `{ id }` | |
| `create_custom_food` | `{ name, brand?, serving_grams?, nutrients_per_100g: {...} }` | Per-100g shape. |
| `update_custom_food` | `{ id, name?, brand?, serving_grams?, nutrients_per_100g? }` | Manual foods only. |
| `delete_custom_food` | `{ id }` | Manual foods only. |

### `intake`

| Tool | Params | Notes |
|---|---|---|
| `log_intake` | `{ meal_type?, ts?, items: Item[], notes?, tags? }` | See [Intake item shape](#intake-item-shape). Atomic. |
| `update_intake` | `{ id, grams?, servings?, meal_type?, notes?, tags?, confidence? }` | Re-derives macros on grams/servings change for food/batch/recipe_serving entries. Custom entries reject grams changes (`custom_intake_grams_unchangeable`) — delete and re-log instead. |
| `delete_intake` | `{ id }` | Refunds batch `remaining_grams` if applicable. |
| `list_intake` | `{ date?, start?, end?, meal_type?, limit? }` | |
| `undo_last_intake` | `{}` | Pops most recent entry within last 10 minutes; returns `null` if none. |

### `recipe` / `batch`

| Tool | Params |
|---|---|
| `create_recipe` | `{ name, servings, notes?, ingredients: [{ food_id?, free_text_name?, grams, notes? }] }` |
| `update_recipe` | `{ id, name?, servings?, notes?, ingredients? }` (full replace) |
| `delete_recipe` | `{ id }` (cascades to ingredients) |
| `list_recipes` | `{ query?, limit? }` |
| `get_recipe` | `{ id }` — returns `{ recipe, ingredients, total, per_serving }` |
| `create_batch` | `{ name?, recipe_id?, total_grams, ingredients_override?, cooked_at?, expires_at?, notes? }` |
| `list_batches` | `{ active_only? }` |
| `get_batch` | `{ id }` |
| `archive_batch` | `{ id }` |
| `delete_batch` | `{ id }` |

A batch needs either a `recipe_id` (macros scaled to `total_grams`) or `ingredients_override`. Macros are frozen at cook time — later recipe edits don't retro-mutate.

### `meal` (remembered meals)

| Tool | Params | Gating |
|---|---|---|
| `remember_meal` | `{ label, aliases?, default_meal_type?, canonical_text?, items?, notes? }` | always exposed |
| `list_remembered_meals` | `{ query?, limit? }` | non-empty table |
| `get_remembered_meal` | `{ id_or_label }` | non-empty table |
| `update_remembered_meal` | `{ id, label?, aliases?, default_meal_type?, canonical_text?, items?, notes? }` | non-empty table |
| `forget_meal` | `{ id_or_label }` | non-empty table |
| `log_remembered_meal` | `{ id_or_label, ts?, meal_type?, scale? }` | non-empty table |

`remember_meal` requires at least one of `canonical_text` or `items`. If `items` is present, `log_remembered_meal` creates intake entries directly; otherwise it returns the canonical text for the agent to re-estimate.

### `hydration` / `weight` / `measurement` / `goal`

| Tool | Params |
|---|---|
| `log_hydration` | `{ ml, ts?, notes? }` |
| `list_hydration` | `{ date?, start?, end?, limit? }` |
| `delete_hydration` | `{ id }` |
| `log_weight` | `{ kg, body_fat_pct?, ts?, notes? }` |
| `list_weight` | `{ date?, start?, end?, limit? }` |
| `delete_weight` | `{ id }` |
| `log_measurement` | `{ kind, value, unit, ts?, notes? }` |
| `list_measurements` | `{ date?, start?, end?, kind?, limit? }` |
| `delete_measurement` | `{ id }` |
| `get_goals` | `{}` |
| `set_goals` | any subset of `{ kcal, protein_g, carb_g, fat_g, fiber_g, hydration_ml, weight_kg_target }`; null clears |

### `summary`

| Tool | Params |
|---|---|
| `daily_summary` | `{ date?, compare_to?: 'yesterday'\|'7d_avg' }` |
| `weekly_summary` | `{ week_starting? }` |
| `range_summary` | `{ start, end, bucket?: 'day'\|'week' }` |

### `summary` — correlate (gated)

| Tool | Params |
|---|---|
| `list_correlate_metrics` | `{}` — returns `[{ source, fields: [...] }]` |
| `correlate` | `{ a, b, range: {start,end}, bucket?: 'day'\|'week'\|'month', lag_buckets?, method?: 'pearson'\|'spearman' }` |

A `MetricSpec` is:

```ts
{
  source: 'intake' | 'wearable_daily' | 'wearable_readiness' | 'wearable_sleep'
        | 'wearable_activity' | 'lab_results' | 'weight' | 'hydration' | 'measurement',
  field: string,           // see list_correlate_metrics for the allow-list per source
  agg: 'sum' | 'avg' | 'min' | 'max' | 'latest' | 'forward_fill',
  filter?: { [col: string]: string }
}
```

- `lab_results` requires `filter.biomarker`.
- `wearable_*` sources accept `filter.provider`; `wearable_activity` also `filter.type`; `intake` accepts `filter.meal_type`; `measurement` accepts `filter.kind`.
- `agg: 'forward_fill'` carries the last value forward through gaps — useful for sparse series (lab markers vs. daily wearables).
- `lag_buckets` is signed: positive lag means series B is sampled from `i - lag_buckets` (B precedes A).
- Returns `r: number | null` (`null` when `n < 2` or variance is zero) plus the aligned `pairs`.

### `biomarker` / `lab`

| Tool | Params | Notes |
|---|---|---|
| `search_biomarker` | `{ query, category?, limit? }` | Fuzzy on name/aliases/LOINC. |
| `get_biomarker` | `{ id_or_name }` | Accepts id, name, alias, or LOINC. |
| `create_custom_biomarker` | `{ name, default_unit_ucum, value_type?, loinc_code?, display_name?, aliases?, categories?, default_ref_low?, default_ref_high?, optimal_low?, optimal_high?, notes? }` | |
| `update_biomarker` | `{ id, ...partial }` | |
| `set_optimal_range` | `{ biomarker, low?, high? }` | Pass `null` to clear. |
| `log_lab_panel` | `{ lab_name?, drawn_at, fasting?, ordered_by?, notes?, source?, source_ref?, panel_name?, results: LabResult[] }` | Atomic. |
| `log_lab_result` | `LabResult & { taken_at }` | Single result, no panel. |
| `list_lab_results` | `{ biomarker?, category?, start?, end?, out_of_range_only?, limit? }` | |
| `latest_biomarkers` | `{ category?, out_of_range_only? }` | Most-recent per biomarker, with status + `delta_vs_prev`. |
| `biomarker_trend` | `{ biomarker, start?, end? }` | `[{ ts, value, unit, status }]` |
| `list_lab_panels` | `{ start?, end?, limit? }` | |
| `get_lab_panel` | `{ id }` | Panel + raw results. |
| `delete_lab_result` | `{ id }` | |
| `delete_lab_panel` | `{ id }` | Cascades to results. |

`LabResult` shape: `{ biomarker, value_numeric?, value_text?, unit_ucum?, ref_low?, ref_high?, ref_text?, interpretation?, notes? }` — `biomarker` accepts id/name/alias/LOINC. `value_numeric` or `value_text` is required.

See [Biomarkers](./BIOMARKERS.md) for status semantics (`optimal` → `in_ref` → `out_of_ref` walk).

### `wearable` (cross-provider)

| Tool | Params | Gating |
|---|---|---|
| `wearables_list_providers` | `{}` | always |
| `wearables_status` | `{}` | any linked |
| `wearable_connect_url` | `{ provider }` | always (HTTP-mode only) |
| `wearable_disconnect` | `{ provider }` | any linked |
| `sync_wearables` | `{ providers?, resources?, since? }` | any linked |
| `wearable_sleep` | `{ date?, start?, end?, providers? }` | any linked |
| `wearable_activity` | `{ start?, end?, type?, providers? }` | any linked |
| `wearable_readiness` | `{ date?, start?, end?, providers? }` | any linked |
| `wearable_daily` | `{ date?, start?, end?, providers? }` | any linked |
| `wearable_metric_minutes` | `{ metric, start, end, providers? }` | any linked |
| `set_activity_type_map` | `{ provider, raw_type, canonical }` | always |

`resources` is the subset of `['sleep','activity','readiness','daily','profile','body']` to pull. `canonical` for `set_activity_type_map` is one of the canonical enum (`run, cycle, swim, walk, hike, row, strength, hiit, yoga, stretch, sport_team, sport_racket, sport_combat, climb, ski, board, dance, ergometer, other`).

### `whoop` (raw, full fidelity)

| Tool | Params |
|---|---|
| `whoop_recovery` | `{ date?, start?, end? }` |
| `whoop_cycles` | `{ start?, end? }` |
| `whoop_sleep_raw` | `{ start?, end? }` |
| `whoop_workouts_raw` | `{ start?, end? }` |
| `whoop_profile` | `{}` |
| `whoop_body_measurement` | `{}` |

All gated on Whoop being linked.

## Intake item shape

The `items` parameter of `log_intake` is a Zod **discriminated union** on `ref`:

```ts
type Item =
  | { ref: 'food';           food_id: string;   grams: number;
      confidence?, source_trace?, notes? }
  | { ref: 'recipe_serving'; recipe_id: string; servings: number;
      confidence?, source_trace?, notes? }
  | { ref: 'batch';          batch_id: string;  grams: number;
      confidence?, source_trace?, notes? }
  | { ref: 'custom';         custom: CustomFoodSpec; grams: number;
      confidence?, source_trace?, notes? };

// CustomFoodSpec is per-100g (composes with grams) OR absolute totals — exactly one shape.
type CustomFoodSpec =
  | { name: string;
      kcal_per_100g: number; protein_g_per_100g: number;
      carb_g_per_100g: number; fat_g_per_100g: number;
      fiber_g_per_100g?, sugar_g_per_100g?, sat_fat_g_per_100g?, sodium_mg_per_100g? }
  | { name: string; absolute: { kcal, protein_g, carb_g, fat_g, fiber_g?, sugar_g?, sat_fat_g?, sodium_mg? } };
```

Whole call is atomic — either all items + all batch decrements land, or none of them. A batch ref that would push `remaining_grams` below zero fails with `batch_insufficient`.

## Wiring into Claude Desktop

`claude_desktop_config.json` entry (stdio mode):

```json
{
  "mcpServers": {
    "health": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/health-mcp/apps/server/src/index.ts", "--stdio"]
    }
  }
}
```

Or once published to npm:

```json
{
  "mcpServers": {
    "health": {
      "command": "npx",
      "args": ["-y", "@lukaisailovic/health-mcp", "--stdio"]
    }
  }
}
```

Set `HEALTH_MCP_WHOOP_CLIENT_ID` / `_SECRET` / `HEALTH_MCP_OURA_*` in the entry's `env` block to enable wearables. The first OAuth link still needs HTTP mode — start the HTTP server once, link Whoop/Oura, then stdio mode can sync on demand using the persisted refresh tokens.

## Inspector

```bash
cd apps/server && pnpm inspect
```

Opens `@modelcontextprotocol/inspector` against the local server for interactive tool calling.
