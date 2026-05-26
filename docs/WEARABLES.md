# Wearables

Provider-agnostic abstraction over OAuth wearables. Today: **Whoop** and **Oura**. Future: Fitbit, Polar, Garmin (OAuth1), Apple Health (file_import).

Read the [Data model — Wearables](./DATA_MODEL.md#wearables) section first if you haven't — it explains the raw / normalized two-tier split.

## Provider interface

`apps/server/src/wearables/types.ts` defines `WearableProvider`. Every provider implements:

```ts
interface WearableProvider {
  id: 'whoop' | 'oura' | ...;
  displayName: string;
  authStrategy: 'oauth2' | 'apikey' | 'file_import' | 'manual';
  scopes?: string[];

  // OAuth (when authStrategy === 'oauth2')
  buildAuthUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<TokenSet>;
  refreshTokens?(refreshToken: string): Promise<TokenSet>;

  // Sync — writes raw + normalized in one transaction per page
  sync(args: {
    db: Database;
    auth: AuthRecord;
    resources?: ResourceKind[];
    since?: string;
    cursors: Record<string, string | null>;
    onAuthRefreshed: (tokens: TokenSet) => Promise<void>;
  }): Promise<SyncResult[]>;
}

type ResourceKind = 'sleep' | 'activity' | 'readiness' | 'daily' | 'profile' | 'body';
```

What `sync()` is responsible for:

1. Calling the upstream API page-by-page, respecting rate limits.
2. Inserting raw rows into the per-provider table (`whoop_sleep`, `oura_sleep`, …) with `raw_json` preserved verbatim.
3. Normalizing each raw row into the cross-vendor shape and upserting into `wearable_sleep` / `_activity` / `_readiness` / `_daily`.
4. Updating `wearable_sync_state(provider, resource).next_token` after each page.
5. When the upstream returns a fresh token pair, calling `onAuthRefreshed(tokens)` so the auth-store can atomically rewrite `auth.json`.

The provider gets a Database handle and is expected to wrap each page in a transaction. Providers own their rate-limit strategy.

`apps/server/src/wearables/registry.ts` constructs providers from `Config` (`whoopClientId`/`whoopClientSecret`, `ouraClientId`/`ouraClientSecret`). A provider whose credentials aren't configured is simply not registered, so its tools never enable.

## Sync timing

- **HTTP mode** — `apps/server/src/scheduler.ts` registers a [croner](https://github.com/Hexagon/croner) job (`HEALTH_MCP_WHOOP_SYNC_CRON`, default `*/30 * * * *`) that calls `syncWearables` for all linked providers. On SIGINT/SIGTERM the scheduler stops cleanly.
- **stdio mode** — no scheduler. The agent must call `sync_wearables` explicitly. (Refresh-token rotation still works because all providers wrap upstream calls in lazy refresh.)
- **On-demand** — `sync_wearables({ providers?, resources?, since? })` always works, both modes. Useful right after linking, or to force a re-pull.

## OAuth flow

Single callback URL, **single signed state** — provider is encoded inside the state, not passed as a query param the user can swap.

```
1. Agent / dashboard calls  wearable_connect_url({ provider: 'whoop' })
   → server returns { url, state }.

2. User opens `url` in browser, signs in with the provider, approves scopes.

3. Provider redirects to GET /auth/wearable/callback?state=<signed>&code=<...>
   → server:
     - purges expired nonces
     - verifies HMAC, decodes { provider, nonce, exp }
     - looks up nonce in `oauth_state_nonces`, deletes it (single use)
     - calls provider.exchangeCode(code, redirectUri)
     - atomically writes the token pair to ~/.health-mcp/auth.json (mode 0600)
     - returns "Connected. You can close this window."

4. Next `sync_wearables` call uses the new tokens. Tools that were gated
   on a link (whoop_*, wearable_status, ...) enable within 30 s.
```

The redirect URI defaults to `http://{host}:{port}/auth/wearable/callback` — override with `HEALTH_MCP_WEARABLE_REDIRECT_BASE` if the server is behind a tunnel. The OAuth app registration on the provider's side must match exactly.

### State token

- Format: HMAC-SHA256 over `{provider, nonce, exp}` with an app secret derived from `system.secret_key` (generated on first run, persisted in `data.db`).
- TTL: 10 minutes.
- Nonce: single-use. Persisted in `oauth_state_nonces`; deleted on use; expired rows purged on every callback.
- Survives server restart, can't be forged, replay-resistant.

### Refresh-token rotation

Providers like Whoop **rotate** refresh tokens on every use — the old one is invalidated immediately. Two concurrent 401s would race to refresh, and one would lose the only valid refresh token.

The auth-store (`apps/server/src/wearables/auth-store.ts`) serializes refreshes per provider with a `Mutex` (`apps/server/src/wearables/mutex.ts`). Inside the mutex:

1. Read current record.
2. Call `provider.refreshTokens(refresh_token)`.
3. Write the new pair (and `last_refresh_at`) atomically — write to `auth.json.tmp`, `fsync`, `rename`.

Lazy refresh: any HTTP call that returns 401 retries once after a refresh. Proactive refresh: if `expires_at` is within 5 minutes, refresh before the call.

## Auth storage

OAuth credentials live in `~/.health-mcp/auth.json` — **not** SQLite. Trade-off accepted:

- DB can be exported, copied, and shared (`health-mcp export`) without leaking tokens.
- Avoids the encrypt-at-rest rabbit hole for a single-user local tool.
- File is treated as a secret: mode `0600`, parent dir `0700`. Server refuses to open a looser file unless `--allow-insecure-auth` is set.

File shape:

```json
{
  "version": 1,
  "providers": {
    "whoop": {
      "strategy": "oauth2",
      "access_token": "…",
      "refresh_token": "…",
      "expires_at": "2026-05-25T08:30:00.000Z",
      "scope": "read:profile read:cycles read:sleep read:workout offline",
      "connected_at": "2026-05-01T10:00:00.000Z",
      "last_refresh_at": "2026-05-24T22:00:00.000Z"
    },
    "oura": { "strategy": "oauth2", "...": "..." }
  }
}
```

`health-mcp doctor` reports file presence, mode, and per-provider expiry. It never prints token values.

## Cross-provider query shape

The cross-provider read tools (`wearable_sleep`, `_activity`, `_readiness`, `_daily`, `_metric_minutes`) query the normalized tables. When `providers` is omitted, rows from all linked providers are returned with the `provider` column preserved — the caller decides whether to dedupe / pick a winner.

`wearable_activity` accepts `type` filter against the canonical enum:

```
run, cycle, swim, walk, hike, row, strength, hiit, yoga, stretch,
sport_team, sport_racket, sport_combat, climb, ski, board, dance,
ergometer, other
```

Each provider's sync writes the original upstream string into `raw_type` and the resolved canonical into `type`. Resolution order:

1. Per-`(provider, raw_type)` row in `wearable_activity_type_map`.
2. Fallback to `(provider='*', raw_type=<provider-string>)` row (seeded identity rows for canonical labels).
3. Fallback to `other`.

Extending = `set_activity_type_map({ provider, raw_type, canonical })`. Zero code change, persisted in SQLite.

## Provider matrix today

| Provider | Auth | Sleep | Activity | Readiness | Daily | Minute metrics | Notes |
|---|---|---|---|---|---|---|---|
| Whoop | OAuth2 | ✓ stage + respiratory | ✓ HR zones, strain, kj | ✓ HRV / RHR / SpO2 / skin temp | ✓ via cycles → kcal_active | — | v2 API. Refresh tokens rotate. 90/min ceiling. |
| Oura | OAuth2 | ✓ | ✓ | ✓ | ✓ | (planned) | Daily endpoints, dedicated rate-limited client. |
| Fitbit | (not implemented) | | | | | | OAuth2; sleep/activities/heart. |
| Polar | (not implemented) | | | | | | OAuth2 AccessLink. |
| Garmin | (not implemented) | | | | | | OAuth 1.0a; needs provider interface to tolerate older OAuth. |
| Apple Health | (not implemented) | | | | | | `file_import` strategy — user exports XML from Health app. Plan: SAX/streaming parser, chunked transactions, idempotent on Apple UUIDs. |

## Whoop specifics

- v2 API base: `https://api.prod.whoop.com/v2/...`. Scopes: `read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout offline`. `offline` is mandatory for refresh.
- Pagination via `nextToken`; persisted per resource in `wearable_sync_state`.
- Rate limit: provider docs say 100/min / 10k/day. Client wraps fetch with a 90/min token bucket to stay clear.
- Refresh tokens rotate per use — per-provider mutex on the auth-store prevents double-spend on concurrent 401s.
- Normalization map (raw → normalized): see `apps/server/src/wearables/providers/whoop/normalize.ts`. Sleep stages from `stage_summary`, respiratory rate, efficiency; recovery → readiness (`score`, `hrv_rmssd`, `resting_hr`, `spo2`, `skin_temp_delta`); workouts → activity (sport name → canonical type, `strain` → `strain_or_load`, kj → kcal); cycles → daily (kj → kcal_active for that date).

## Oura specifics

- OAuth2, daily endpoint family. Dedicated rate-limited client mirrors the Whoop approach.
- Resources synced: `sleep`, `daily_sleep` (score), `daily_activity`, `daily_readiness`, `workouts`.
- Activity type map seeded so common workout strings land on canonical types.

## Adding a new provider

1. Create `apps/server/src/wearables/providers/<id>/` with `client.ts`, `index.ts`, `normalize.ts`, `sync.ts`.
2. Add a migration introducing the per-provider raw tables (`oura_*`-style) and an `INSERT INTO wearable_providers`.
3. Register in `apps/server/src/wearables/registry.ts`.
4. Wire config keys for client id/secret (or API key) in `Config` and `helpText()`.

No changes to MCP tools, REST routes, or the dashboard. The normalized tables and cross-provider read tools just start returning the new `provider` automatically.

## Stdio caveat

OAuth flows require an HTTP listener (the callback). `wearable_connect_url` and the callback route are **HTTP-only** — first-time linking has to happen with the server running in HTTP mode. Once linked, refresh tokens persist in `auth.json` and stdio mode can sync indefinitely.
