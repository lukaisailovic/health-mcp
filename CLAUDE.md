# CLAUDE.md — health-mcp

Behavioral guide for Claude Code working in this repo. Extends `~/.claude/CLAUDE.md`; project rules win on overlap.

Human-facing project overview: [`README.md`](./README.md).

## Preferred MCPs and tooling

Reach for these before generic alternatives.

### Kumo UI (Cloudflare) — the dashboard component library
- Package: `@cloudflare/kumo` — installed in `apps/dashboard`. Built on Base UI + Tailwind v4.
- Docs CLI (use it instead of guessing component APIs):
  ```
  npx @cloudflare/kumo ls            # list all 42 components grouped by category
  npx @cloudflare/kumo doc Button    # full prop schema + examples for one component
  npx @cloudflare/kumo docs          # dump every component's docs (very long)
  ```
- Setup wiring (already done in this repo, keep intact):
  - `apps/dashboard/src/styles.css` imports `@cloudflare/kumo/styles/tailwind` **before** `tailwindcss` and has `@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}"` so Tailwind picks up the utilities Kumo uses.
  - `apps/dashboard/vite.config.ts` registers `@tailwindcss/vite`.
  - `apps/dashboard/index.html` sets `data-mode="dark"|"light"` on `<html>` from `localStorage.theme` / `prefers-color-scheme`. Toggle theme by writing that attribute (and persisting to `localStorage`).
- Policy:
  - **Always check `npx @cloudflare/kumo doc <Name>` first** when reaching for a new Kumo primitive — examples + prop shape live there.
  - Prefer the granular `@cloudflare/kumo/components/<name>` entry point when bundle size matters; the barrel import (`@cloudflare/kumo`) is fine for general use.
  - Use semantic Kumo tokens (`bg-kumo-base`, `text-kumo-strong`, `text-kumo-subtle`, `ring-kumo-line`, `bg-kumo-{success,warning,danger,info}-tint`, etc.) instead of raw colors. They handle light + dark automatically via `light-dark()`.
  - **Compound APIs differ from shadcn**: triggers use a `render={(props) => …}` prop, not `asChild`. Dialog has `Dialog.Root`, `Dialog.Trigger`, then the `<Dialog>` panel (not `<DialogContent>` from shadcn). Tabs takes a `tabs={[{value,label}]}` array, not `<TabsList>/<TabsTrigger>`.

### Local wrapper layer — `apps/dashboard/src/components/ui/`
Thin adapters around Kumo that preserve the legacy shadcn-shaped imports used throughout routes (`Button`, `Card`, `Input`, `Badge`, `Dialog{Content,Title,…}`, `Tabs`, `Label`, `Empty`, `Spinner`, `TrendArea`). When adding a new primitive, prefer adding a wrapper here over importing Kumo directly in routes — the wrappers normalize Tailwind-classed variants (e.g. `variant="ok"` → `variant="success"`).

### `@modelcontextprotocol/inspector` — for testing the MCP server we are building
Use when iterating on MCP tool schemas during P0–P4. Different concern from Kumo (that's the dashboard).

When a new preferred MCP/tooling is added to this project, append it under this section.

## Skills — invoke when triggers match

- `/code-guidelines` — **load before writing or modifying any code** (global rule).
- `/github-cli` — all GitHub operations (global rule).
- `/design-values` — when designing or reviewing dashboard UI/UX. Pairs naturally with Kumo.
- `/run` — when verifying a UI change in the actual app.
- `/verify` — end-to-end validation of a feature/PR.
- `/local-review` — before pushing.
- `/security-review` — before merging anything touching auth, OAuth, refresh tokens, DB file permissions.
- `/sharp-edges` — when designing MCP tool schemas; we want misuse-resistant defaults.
- `/simplify` — when a service module grows accretively.
- `/humanizer` or `/stop-slop` — for any prose (PR descriptions, dashboard copy, README updates).

Don't invoke speculatively.

### Dashboard-specific (TanStack + transitions)

When touching `apps/dashboard`, default to these patterns and skill sources:

- **TanStack Router skills** ship with `@tanstack/router-core` in `apps/dashboard/node_modules/.pnpm/@tanstack+router-core@*/node_modules/@tanstack/router-core/skills/router-core/`. Load with `pnpm dlx @tanstack/intent@latest load @tanstack/router-core#<sub-skill>`. Sub-skills: `search-params`, `path-params`, `navigation`, `data-loading`, `auth-and-guards`, `code-splitting`, `not-found-and-errors`, `type-safety`, `ssr`.
  - **Always** before substantial router work or a new route, load the relevant sub-skill rather than guessing.
  - Routes are **client-first**, types are **fully inferred** (never cast `Route.useLoaderData()` etc.), and `createRootRouteWithContext<T>()({...})` is a double-call factory.
  - The router skill is the source of truth for routing patterns; this CLAUDE.md does not duplicate them.
- **`transitions-dev` skill** (`.claude/skills/transitions-dev/`) — load when adding micro-interactions (badge pop-ins, modal open/close, page slides, success checks, error shakes, panel reveals). Don't hand-roll transitions when an entry covers the case.

### Preferred component library

Order of preference for dashboard UI components:

1. **Kumo UI** (`@cloudflare/kumo`) — first choice for any primitive (button, badge, card surfaces, dialog, tabs, label, empty state, loader, meter, sidebar, table, popover, dropdown, command palette, …). 42 components total — list them with `npx @cloudflare/kumo ls`.
2. **Local wrappers** at `apps/dashboard/src/components/ui/` — extend / adapt Kumo when routes expect the legacy shadcn-style API. New routes can import Kumo directly.
3. **Recharts** — for line/area/bar charts. Styled with Kumo CSS variables (`var(--color-kumo-line)`, `var(--text-color-kumo-subtle)`, etc.) — see `src/components/ui/chart.tsx`.
4. **Plain divs + Tailwind utilities** — for layout glue only.

Never hand-roll a component that exists in Kumo.

### Dark mode

- Root attribute: `<html data-mode="dark">` (or `"light"`). The inline script in `index.html` sets it before paint to avoid flash; persist user choice in `localStorage.theme`.
- Tailwind variant: write `dark:` modifiers as usual — they resolve via the `@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *));` declaration in `src/styles.css`.
- Kumo's semantic tokens already adapt via CSS `light-dark()` — most code should not need `dark:` overrides if it uses Kumo tokens.

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
- **Docs track code in the same commit**: when a change alters user-visible behavior — tool params/descriptions/error codes, REST contracts, status semantics, config flags, capability gating rules — update the relevant `docs/*.md` file and the README tool list alongside the code. Purely internal refactors don't need doc updates.

## Out of scope — do not drift here without explicit ask

- Multi-user / accounts.
- Built-in NL parsing or photo CV — agents do estimation, the server stores structured items.
- AI-provider dependencies. The server must run without one.
- Hosted/SaaS deployment. Local-first; webhooks require a user-provided tunnel.
