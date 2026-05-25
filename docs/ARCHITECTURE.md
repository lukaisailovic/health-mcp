# Architecture

Single Node process. One service layer; three surfaces sit on top of it (MCP HTTP, MCP stdio, REST). SQLite is the only datastore. Wearable OAuth credentials live in a separate file outside the DB.

```
   HTTP mode (default)                            stdio mode (--stdio)
   ──────────────────                             ────────────────────
   ┌───────────────────────────────────┐          ┌──────────────────┐
   │            Hono app               │          │  stdin / stdout  │
   │                                   │          │  (parent: agent) │
   │ GET  /health, /version            │          └────────┬─────────┘
   │ GET  /                            │ ◄────►            │
   │ POST /mcp        (Streamable HTTP)│                   │ MCP
   │ GET  /api/*      (REST mirror)    │                   │ (StdioServer
   │ GET  /auth/wearable/callback      │                   │  Transport)
   └──────────────┬────────────────────┘                   │
                  │                                        │
                  └────────────────┬───────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  service layer  │   apps/server/src/services/*.ts
                          │  (single source │   pure functions
                          │   of truth)     │
                          └────────┬────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
        ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
        │   SQLite      │  │ AuthStore     │  │ Wearable      │
        │ better-sqlite3│  │ ~/.health-mcp/│  │ providers     │
        │ WAL + FK ON   │  │   auth.json   │  │ (Whoop, Oura) │
        └───────────────┘  └───────────────┘  └───────────────┘

   HTTP mode only: a croner job calls sync_wearables() on the configured cron.
   stdio mode: no scheduler, no dashboard, no REST. Sync runs only when a tool is called.
```

## Mounts

The Hono app in `apps/server/src/http.ts` mounts:

- `GET /health` — unauthenticated. Returns `{ ok, db, tz, version, auth_required, providers: {...}, ... }`. Used by the dashboard to detect whether a token is needed.
- `GET /version` — unauthenticated. `{ version, sdk_version }`.
- `POST /mcp` — MCP Streamable-HTTP transport (`@modelcontextprotocol/sdk` v1). Bearer-guarded when `HEALTH_MCP_TOKEN` is set.
- `GET /api/*` — REST mirror. Bearer-guarded when `HEALTH_MCP_TOKEN` is set.
- `GET /` (and SPA fallback) — static dashboard from `apps/dashboard/dist`. Unauthenticated so the Setup screen can always render and prompt for a token.
- `GET /auth/wearable/callback` — unauthenticated (third-party redirect). Validates the signed `state` token before consuming the OAuth code.

## Service layer

`apps/server/src/services/*.ts` is the single source of business logic. MCP tool handlers (`src/mcp/tools/*.ts`) and REST route handlers (`src/rest/index.ts`) parse their inputs with Zod and immediately delegate. They never touch SQL directly.

Each service module is a set of plain functions over a `Ctx` (or `WearableServiceCtx`) that carries the DB handle, logger, config, and (where needed) the auth store. No classes, no DI container.

| Service | File | Owns |
|---|---|---|
| food | `services/food.ts` | foods table, USDA/OFF lookup, per-100g macro math |
| meals | `services/meals.ts` | meals + meal_components, batch decrement (transactional), component edits, undo |
| recipes | `services/recipes.ts` | recipes, recipe_ingredients, batches |
| remembered meals | `services/remembered-meals.ts` | remembered_meals |
| simple logs | `services/simple-logs.ts` | hydration, weight, measurements |
| goals | `services/goals.ts` | goals singleton |
| summaries | `services/summaries.ts` | daily / weekly / range rollups |
| biomarkers | `services/biomarkers.ts` | biomarkers, lab_panels, lab_results, status, trends |
| correlate | `services/correlate.ts` | Pearson/Spearman over two metric series |
| wearables | `services/wearables.ts` | provider list/status, OAuth callback, sync, normalized + Whoop reads |

## MCP tool registration

Tools live in `apps/server/src/mcp/tools/*.ts`. Each tool declares:

```ts
{ name, description, group, inputSchema, handler, isAvailable? }
```

`buildAllTools()` in `mcp/tools/index.ts` aggregates them. `HealthMcpServer` (`mcp/server.ts`) wraps `McpServer` from the SDK and:

1. Calls `registerTool` for every tool, returning a `RegisteredHandle`.
2. Evaluates `isAvailable(ctx)` once at startup and immediately calls `handle.disable()` for tools that should be hidden. `tools.listChanged` capability is advertised, so clients see the surface change without reconnecting.
3. Re-runs `isAvailable` every 30 s via an `unref`-ed interval; flipped tools get `enable()` / `disable()` and the server emits `notifications/tools/list_changed`.

Capability gates today:
- Most `wearable_*` tools — at least one provider linked.
- All `whoop_*` tools — Whoop specifically linked.
- `correlate` / `list_correlate_metrics` — `isCorrelateAvailable(ctx)` returns true once you have ≥7 days of intake AND (≥1 `wearable_daily` row OR ≥3 `lab_results`).
- `list_remembered_meals`, `get_remembered_meal`, `update_remembered_meal`, `forget_meal`, `log_remembered_meal` — only when `remembered_meals` is non-empty. The *write* tool `remember_meal` is always exposed.

`discover_capabilities` returns the live catalog grouped by `group`, with the current enable flag — agents can poll this instead of guessing.

## Transports

`HealthMcpServer` is transport-agnostic. The same instance is bound to either:

- **HTTP** — `mcp/transport.ts` builds a Streamable-HTTP transport and exposes a Node `http`-style handler that's mounted under `/mcp`. The Hono adapter passes the raw `req`/`res` so the SDK sees native streams.
- **stdio** — `mcp/stdio.ts` instantiates `StdioServerTransport` and calls `connect()`. No HTTP, no dashboard, no scheduler.

`--stdio` is the right choice for Claude Desktop / MCP Inspector embedding; HTTP is the default for everything else.

## SQLite

`apps/server/src/db/client.ts` opens better-sqlite3 with these pragmas, applied every connection:

```
journal_mode = WAL
foreign_keys = ON
synchronous  = NORMAL
busy_timeout = 5000
```

WAL is required because Hono handles requests concurrently while better-sqlite3 is synchronous — WAL keeps readers off the writer's path. `foreign_keys = ON` is non-negotiable: cascading deletes on `recipes → recipe_ingredients`, `lab_panels → lab_results`, etc. depend on it.

Migrations are checked-in TS modules under `apps/server/src/db/sql/000N-*.ts` (each exports `up(db)`). They run automatically on startup unless `--no-auto-migrate` is passed; `health-mcp migrate` runs them as a one-shot.

## Scheduler

In HTTP mode only, `scheduler.ts` registers a croner job (`HEALTH_MCP_WHOOP_SYNC_CRON`, default `*/30 * * * *`) that calls `syncWearables()` for all linked providers. It is created with `.unref()`-equivalent behavior — shutting down via SIGINT/SIGTERM stops the timer and closes the DB cleanly.

In stdio mode there is no scheduler. Syncs only happen when an agent calls `sync_wearables`.

## Dashboard

`apps/dashboard/` — Vite + React + TanStack Router + TanStack Query + Tailwind + Kumo UI + Recharts. Built into `apps/dashboard/dist`; the server mounts it as static under `/` with SPA fallback. The build is committed to npm packaging so `npx @lukaisailovic/health-mcp` works out of the box.

The dashboard reads `localStorage.health_mcp_token` on boot, calls `/health` (unauth) to learn whether a token is required, and either shows a Setup screen or starts fetching `/api/*` with `Authorization: Bearer …`. A global TanStack Query error boundary watches for 401s and bounces to Setup.
