# health-mcp

Personal nutrition + wearables + biomarker tracker, exposed as an MCP server so any agent (Claude, etc.) can read and write the data.

Designed for single-user, self-hosted use. SQLite-backed. Local-first. No AI provider dependency — the calling agent does estimation; this server is the system of record and insight layer.

> **Status: P0–P7 shipped.** Nutrition, biomarkers, recipes/batches, remembered meals, MCP HTTP + stdio transports, REST mirror, a React dashboard SPA served from the same server, a `correlate` insights tool with capability gating, a USDA bulk JSON importer, and a second wearable provider (Oura) on top of Whoop.

## What works today

- **Nutrition** — foods (manual + USDA + Open Food Facts), recipes, cooked batches with depletion across days, intake entries, hydration, weight, body measurements, daily macro goals.
- **Biomarkers** — ~60 seeded biomarkers with LOINC codes and curated ranges, lab panels + results over time, three-range model (lab-supplied / per-marker default / curated optimal), unit conversion for the common dual-unit markers, trend + latest-value queries.
- **Recipes & batches** — recipes scale to per-serving macros, batches deplete as you log intake against them, atomic batch updates inside `log_intake`.
- **Remembered meals** — label re-loggable meals (canonical text for agent re-estimation, or pre-resolved items).
- **Wearables** — provider-agnostic abstraction with Whoop and Oura OAuth2 providers (raw + normalized tables, refresh-token rotation, per-provider mutex, signed-state callback).
- **Three surfaces, one service layer** — MCP Streamable-HTTP at `/mcp`, MCP stdio mode behind `--stdio`, REST at `/api/*`, and the dashboard SPA at `/`. Service modules in `src/services/` are the only place business logic lives.
- **Capability-gated tools** — Whoop and wearable tools are hidden until a provider is linked; remembered-meal read tools are hidden until at least one is saved. Keeps the agent's tool surface small.

## Quick start

The server isn't published to npm yet. Run from source:

```bash
pnpm install
pnpm build           # builds shared types, dashboard, and the server
pnpm start           # runs the compiled server with the bundled dashboard

# OR run everything in watch mode (server + dashboard dev with HMR + shared tsc --watch)
pnpm dev             # → server on :7777, dashboard dev on :5173 (auto-proxies /api/* to :7777)
```

The default HTTP mode auto-opens the dashboard in your browser at `http://127.0.0.1:7777`.
Pass `--no-open` to keep it from launching, or `--no-dashboard` to skip serving the SPA entirely.

```bash
pnpm start -- --stdio                           # MCP stdio for Claude Desktop / Inspector
HEALTH_MCP_TOKEN=$(openssl rand -hex 32) pnpm start -- --port 8080
```

Subcommands run against the compiled server:

```bash
pnpm start -- migrate              # run pending migrations and exit
pnpm start -- doctor               # self-check (DB pragmas, file modes, token)
pnpm start -- export /tmp/x.jsonl  # dump full DB; raw_json redacted unless --include-raw
```

Wire into an MCP client (Claude Desktop), in stdio mode:

```json
{
  "command": "node",
  "args": ["--import", "tsx", "/path/to/health-mcp/apps/server/src/index.ts", "--stdio"]
}
```

Once published, the same will work via `npx` (HTTP + dashboard is the default):

```bash
npx @lukaisailovic/health-mcp           # HTTP server + dashboard, opens browser
npx @lukaisailovic/health-mcp --stdio   # MCP stdio for Claude Desktop
```

## Configuration

CLI flag > env var > config file > default.

| Option | Env | Flag | Default |
|---|---|---|---|
| Transport | `HEALTH_MCP_STDIO` | `--stdio` | HTTP |
| Port | `HEALTH_MCP_PORT` | `--port` | `7777` |
| Bind host | `HEALTH_MCP_HOST` | `--host` | `127.0.0.1` |
| SQLite path | `HEALTH_MCP_DB` | `--db` | `~/.health-mcp/data.db` |
| Bearer token | `HEALTH_MCP_TOKEN` | `--token` | unset (loopback-only) |
| Dashboard | `HEALTH_MCP_DASHBOARD` | `--no-dashboard` | enabled (not yet built) |
| Timezone | `HEALTH_MCP_TZ` | `--tz` | system TZ |
| USDA API key | `HEALTH_MCP_USDA_API_KEY` | — | unset (local-only search) |
| Whoop client id | `HEALTH_MCP_WHOOP_CLIENT_ID` | — | — |
| Whoop client secret | `HEALTH_MCP_WHOOP_CLIENT_SECRET` | — | — |
| Oura client id | `HEALTH_MCP_OURA_CLIENT_ID` | — | — |
| Oura client secret | `HEALTH_MCP_OURA_CLIENT_SECRET` | — | — |
| Wearable redirect | `HEALTH_MCP_WEARABLE_REDIRECT_BASE` | — | `http://{host}:{port}/auth/wearable/callback` |
| Whoop sync cron | `HEALTH_MCP_WHOOP_SYNC_CRON` | — | `*/30 * * * *` |
| Log level | `HEALTH_MCP_LOG_LEVEL` | `--log-level` | `info` |
| Config file | `HEALTH_MCP_CONFIG` | `--config` | — |

`--no-auto-migrate`, `--allow-insecure-db`, `--allow-insecure-auth` are also available for operator workflows.

Security defaults that you'll notice on first run:

- Binding off-loopback without `HEALTH_MCP_TOKEN` is refused.
- Tokens shorter than 32 chars or with very low entropy are refused.
- `data.db` and `auth.json` are created with mode `0600`, parent dir `0700`. Existing files with looser modes refuse to open unless `--allow-insecure-*` is set.
- Wearable refresh tokens live in `~/.health-mcp/auth.json` — separate from `data.db` so the DB can be exported without leaking credentials.

## Usage examples

Once running, the dashboard is not yet built, but every behavior is reachable via REST or MCP. A few REST examples:

```bash
# health probe
curl http://127.0.0.1:7777/health

# create a custom food
curl -X POST http://127.0.0.1:7777/api/foods \
  -H 'content-type: application/json' \
  -d '{"name":"Egg","nutrients_per_100g":{"kcal_per_100g":155,"protein_g_per_100g":13,"carb_g_per_100g":1.1,"fat_g_per_100g":11}}'

# log intake (food id from above)
curl -X POST http://127.0.0.1:7777/api/intake \
  -H 'content-type: application/json' \
  -d '{"items":[{"ref":"food","food_id":"<id>","grams":150}]}'

# daily summary
curl http://127.0.0.1:7777/api/summary/daily

# search biomarkers
curl 'http://127.0.0.1:7777/api/biomarkers?query=glucose'

# log a lab panel
curl -X POST http://127.0.0.1:7777/api/lab-panels \
  -H 'content-type: application/json' \
  -d '{"lab_name":"Quest","drawn_at":"2026-05-01T08:00:00Z","fasting":true,"results":[
        {"biomarker":"Glucose","value_numeric":92},
        {"biomarker":"HDL Cholesterol","value_numeric":60}
      ]}'

# trend for one biomarker
curl 'http://127.0.0.1:7777/api/biomarkers/Glucose/trend'
```

When `HEALTH_MCP_TOKEN` is set, every `/api/*` and `/mcp` call must carry `Authorization: Bearer <token>`. `/health`, `/version`, and `/auth/wearable/callback` are unauthenticated.

For MCP, the Streamable-HTTP transport is at `/mcp` and follows the standard SDK flow (`initialize` → `notifications/initialized` → `tools/list` / `tools/call`). The stdio mode (`--stdio`) speaks the same protocol over stdin/stdout for embedding in Claude Desktop / Inspector.

## Tools available

```
ping, discover_capabilities

# food
search_food, lookup_barcode, get_food
create_custom_food, update_custom_food, delete_custom_food

# intake
log_intake, update_intake, delete_intake, list_intake, undo_last_intake

# recipes + batches
create_recipe, update_recipe, delete_recipe, list_recipes, get_recipe
create_batch, list_batches, get_batch, archive_batch, delete_batch

# remembered meals  (read tools hidden until you save one)
remember_meal, list_remembered_meals, get_remembered_meal,
update_remembered_meal, forget_meal, log_remembered_meal

# simple logs
log_hydration, list_hydration, delete_hydration
log_weight,    list_weight,    delete_weight
log_measurement, list_measurements, delete_measurement
get_goals, set_goals

# summaries
daily_summary, weekly_summary, range_summary

# biomarkers + labs
search_biomarker, get_biomarker, create_custom_biomarker, update_biomarker, set_optimal_range
log_lab_panel, log_lab_result, list_lab_results, latest_biomarkers, biomarker_trend
list_lab_panels, get_lab_panel, delete_lab_result, delete_lab_panel

# insights  (hidden until ≥7 days intake AND ≥1 wearable_daily OR ≥3 lab_results)
correlate, list_correlate_metrics

# wearables  (most hidden until a provider is linked)
wearables_list_providers, wearables_status,
wearable_connect_url, wearable_disconnect, sync_wearables,
wearable_sleep, wearable_activity, wearable_readiness, wearable_daily, wearable_metric_minutes,
set_activity_type_map

# Whoop-specific (hidden until linked)
whoop_recovery, whoop_cycles, whoop_sleep_raw, whoop_workouts_raw,
whoop_profile, whoop_body_measurement
```

Call `discover_capabilities` to get the live catalog with current enable status grouped by area.

## Architecture (one paragraph)

A single Hono app mounts the MCP Streamable-HTTP transport at `/mcp` (via a raw Node http-server handler so the SDK gets native req/res), REST routes at `/api/*`, the wearable OAuth callback at `/auth/wearable/callback`, and (later) the static dashboard at `/`. Storage is SQLite via better-sqlite3 with WAL + `foreign_keys = ON`. Migrations are checked-in SQL (no Drizzle migration tooling needed). Wearable data flows through a `WearableProvider` interface that writes both per-vendor raw mirrors (`whoop_*`) and normalized cross-vendor tables (`wearable_sleep`, `wearable_activity`, ...) in one transaction per page. Whoop refresh-token rotation is serialized through a per-provider mutex so concurrent 401s can't double-spend. Service layer (`src/services/*.ts`) is the single source of business logic — MCP tools and REST routes are thin wrappers.

## Tech

Node ≥20 · pnpm · TypeScript (ESM, strict) · Hono · `@modelcontextprotocol/sdk` (v1) · better-sqlite3 · Zod · croner · Vitest · Biome.

Dashboard (P5, not yet built): TanStack Router + Query · Tailwind · [Spell UI](https://spell.sh) + shadcn/ui · Recharts.

## Development

```bash
pnpm install
pnpm typecheck   # workspace-wide
pnpm test        # 37 tests across services + integration
pnpm build       # tsc compile of shared + server
pnpm lint        # biome
pnpm lint:fix    # biome auto-fix

# server (HTTP) from source
cd apps/server && pnpm dev

# server (stdio) from source
cd apps/server && pnpm dev -- --stdio

# inspect the MCP server during development
cd apps/server && pnpm inspect
```

The test suite runs file-backed SQLite in tmpdirs with the same pragmas as production, plus an integration test that exercises the REST surface through `app.fetch`.

## Roadmap

| Phase | Status | Scope |
|---|---|---|
| P0 | shipped | Workspace, TS, Biome, Vitest, config/CLI, DB client + migrations, MCP Streamable-HTTP + stdio transports, `/health`+`/version`, `ping` tool. |
| P1 | shipped | Nutrition: foods (USDA + OFF + manual), intake (food/custom), hydration, weight, measurements, goals, daily/weekly/range summaries. |
| P2 | shipped | Biomarkers: ~60-marker seed, lab panels + results, unit conversion, latest + trend + out-of-range filters. |
| P3 | shipped | Recipes, cooked batches with depletion, remembered meals. `log_intake` accepts `recipe_serving` + `batch` refs. |
| P4 | shipped | Wearables abstraction, provider registry, file-backed auth store (mode 0600 + atomic writes + per-provider mutex), signed-state OAuth callback with single-use nonce, Whoop provider (rate-limited client, refresh rotation, raw + normalized sync). |
| P5 | shipped | Dashboard SPA (Vite + TanStack Router + TanStack Query + shadcn primitives + Recharts), served from the same Hono app at `/` with SPA fallback. Auto-opens the browser on HTTP boot. |
| P6 | shipped | `correlate` tool + `list_correlate_metrics` companion (capability-gated), Pearson/Spearman over Day/Week/Month buckets with `forward_fill` for sparse series and signed `lag_buckets`. USDA bulk JSON import subcommand (`health-mcp import-usda <dump.json>`). Lab PDF stays agent-side by design. Dashboard exposes correlate via an Insights page. |
| P7 | shipped | Oura provider — OAuth2 + dedicated rate-limited client, raw + normalized sync for sleep, daily activity, daily readiness, daily sleep score, and workouts; type map seeded so workouts land on the canonical activity enum. |
| P7+ | not started | Fitbit, Polar, Garmin (OAuth1), Apple Health (file_import). |

See `PLAN.md` for the design rationale and detailed breakdown.

## License

Personal project. License TBD.
