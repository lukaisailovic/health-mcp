# health-mcp documentation

Reference docs for the running server. The [project README](../README.md) covers what it is and how to install; these files cover *how it works* and *how to call it*.

| Doc | What's in it |
|---|---|
| [Architecture](./ARCHITECTURE.md) | One-process layout: Hono app, MCP transports, service layer, SQLite, scheduler. |
| [Configuration](./CONFIGURATION.md) | Every CLI flag, env var, and config-file key — plus subcommands and security invariants. |
| [API](./API.md) | REST endpoints exposed under `/api/*` (mirror of the MCP tool surface, used by the dashboard). |
| [MCP](./MCP.md) | MCP tool catalog: names, params, return shapes, and which gating rules hide which tools. |
| [Data model](./DATA_MODEL.md) | SQLite schema, indexes, the three-tier range model, raw-vs-normalized wearable split. |
| [Biomarkers](./BIOMARKERS.md) | How labs are modelled: catalog, panels, results, status, unit conversion. |
| [Wearables](./WEARABLES.md) | Provider abstraction, OAuth flow, auth-file storage, Whoop + Oura specifics. |
| [Security](./SECURITY.md) | Bearer auth, loopback rule, file modes, refresh-token rotation, OAuth state. |

## Conventions

- All timestamps are **UTC ISO 8601** (`2026-05-24T08:00:00Z`). The `date` column is `YYYY-MM-DD` computed in `HEALTH_MCP_TZ` at write time.
- All names are **snake_case** — tool names, parameter keys, response keys, table names.
- All mutating tools/endpoints return the created or updated row. List endpoints return arrays.
- Errors carry a stable `{ code, message }` shape — see [API](./API.md#errors).

## Where the source of truth lives

- **Service layer** — `apps/server/src/services/*.ts`. All business logic.
- **MCP tools** — `apps/server/src/mcp/tools/*.ts`. Thin wrappers that parse Zod schemas and call services.
- **REST routes** — `apps/server/src/rest/index.ts`. Thin wrappers that parse query/body and call services.
- **Shared schemas** — `packages/shared/src/schemas.ts` (Zod) and `dto.ts` (TS DTOs). Dashboard + server agree at the type level.
- **Migrations** — `apps/server/src/db/sql/000N-*.ts`. Checked-in SQL.
