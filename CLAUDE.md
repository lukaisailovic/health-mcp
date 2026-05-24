# CLAUDE.md — health-mcp

Behavioral guide for Claude Code working in this repo. Extends `~/.claude/CLAUDE.md`; project rules win on overlap.

Architecture and design rationale: [`PLAN.md`](./PLAN.md) — read before non-trivial work.
Human-facing project overview: [`README.md`](./README.md).

## Preferred MCPs

Reach for these before generic alternatives.

### Spell UI MCP — initial and always-preferred for UI work
- Docs: https://spell.sh/docs/mcp
- Setup (once `apps/dashboard` exists):
  ```
  cd apps/dashboard
  pnpm dlx shadcn@latest mcp init
  ```
  then add `"registries": { "@spell": "https://spell.sh/r/{name}.json" }` to `components.json`.
- Policy:
  - Default to Spell for buttons, badges, charts, text effects, backgrounds, interactive cards, feedback.
  - Fall back to vanilla `@/components/ui` (shadcn) only when Spell doesn't ship the component (data tables, command palettes, complex forms).
  - Never hand-roll a component that exists in Spell or shadcn.

### shadcn MCP — the underlying surface
Spell rides on it. Use it for any registry component add/update.

### `@modelcontextprotocol/inspector` — for testing the MCP server we are building
Use when iterating on MCP tool schemas during P0–P4. Don't confuse with Spell/shadcn MCPs above (those are for the dashboard).

When a new preferred MCP is added to this project, append it under this section.

## Skills — invoke when triggers match

- `/code-guidelines` — **load before writing or modifying any code** (global rule).
- `/github-cli` — all GitHub operations (global rule).
- `/design-values` — when designing or reviewing dashboard UI/UX. Pairs naturally with Spell.
- `/run` — when verifying a UI change in the actual app.
- `/verify` — end-to-end validation of a feature/PR.
- `/local-review` — before pushing.
- `/security-review` — before merging anything touching auth, OAuth, refresh tokens, DB file permissions.
- `/sharp-edges` — when designing MCP tool schemas; we want misuse-resistant defaults.
- `/simplify` — when a service module grows accretively.
- `/humanizer` or `/stop-slop` — for any prose (PR descriptions, dashboard copy, README updates).

Don't invoke speculatively.

## Project-specific rules

- **MCP tool naming**: `snake_case` (tool names *and* parameter names).
- **Service layer is the source of truth**: `src/services/*.ts` holds all business logic. `src/mcp/tools/*.ts` and `src/rest/*.ts` are thin wrappers. No logic in route or tool handlers.
- **Shared Zod schemas in `packages/shared`** — dashboard and server must agree at the type level.
- **Timestamps stored UTC ISO**; derive `date` columns in `HEALTH_MCP_TZ` for day-bucket queries.
- **`raw_json` preserved on every provider mirror row** (Whoop, future wearables, lab imports). Forward-compat is non-negotiable.
- **Wearable OAuth**: refresh tokens rotate. Wrap refresh in a per-provider mutex; atomic write of new pair.
- **MCP SDK v2 alpha is pinned**. No floating version ranges.
- **Refuse to start** if binding off-loopback without `HEALTH_MCP_TOKEN` set. Don't soften.
- **Biomarker unit conversion**: only the hardcoded dual-unit table is safe. Unknown unit + biomarker-default mismatch → store as-supplied and emit `unit_mismatch`. No silent casts.
- **Offensive programming for invariants**; defensive validation only at trust boundaries (user input, external APIs).
- **Comments only when they add information the code can't** (global rule, reinforced).

## Out of scope — do not drift here without explicit ask

- Multi-user / accounts.
- Built-in NL parsing or photo CV — agents do estimation, the server stores structured items.
- AI-provider dependencies. The server must run without one.
- Hosted/SaaS deployment. Local-first; webhooks require a user-provided tunnel.
