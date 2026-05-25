# Security model

Single-user, local-first. Threat model: the legitimate operator and processes they trust have access; everyone else does not. We're not trying to be a SaaS multi-tenant fortress, but we are trying very hard to fail closed.

## Bearer auth

- HTTP mode: if `HEALTH_MCP_TOKEN` is set, every `/api/*` and `/mcp` request must carry `Authorization: Bearer <token>`. `/health`, `/version`, the static dashboard, and the OAuth callback are always reachable unauthenticated.
- Comparison uses `crypto.timingSafeEqual` over equal-length buffers. Length-mismatch is an early-out — that doesn't leak info, since the secret length is policy-fixed (≥32 chars).
- stdio mode has no auth. The parent process spawned the server, so it's trusted by definition.

## Refuse-to-start invariants

`enforceSecurityInvariants` (`apps/server/src/config.ts`) runs before anything is opened:

- **Loopback rule** — binding non-loopback (anything outside `127.0.0.0/8`, `::1`, `localhost`) **without** a token → refuse. There is no silent fallback.
- **Token entropy** — token shorter than 32 chars, or fewer than 8 distinct characters → refuse. Generate one with `openssl rand -hex 32`.

These exist because the most common operator mistake is "I set `--host 0.0.0.0` to test on my LAN" and forgetting auth. The server says no.

## File modes

| Path | Mode | Purpose |
|---|---|---|
| `~/.health-mcp/` | `0700` | Parent directory |
| `~/.health-mcp/data.db` | `0600` | SQLite |
| `~/.health-mcp/auth.json` | `0600` | Wearable OAuth tokens — treated as a secret |

On open, the server checks file mode + parent dir mode. Looser perms → refuse to open. Escape hatches `--allow-insecure-db` / `--allow-insecure-auth` exist for operator workflows (e.g. restoring from a backup that doesn't carry POSIX modes) but should not be the steady state.

## Wearable token storage

OAuth tokens deliberately live **outside** SQLite, in `~/.health-mcp/auth.json`. Two reasons:

1. **DB exportability** — `health-mcp export` and any manual backup of `data.db` can be shared/inspected without leaking credentials. The DB is your data; `auth.json` is access.
2. **Avoid the encrypt-at-rest rabbit hole** — for a single-user local tool, encrypting `data.db` at rest moves the secret problem one level (key in env, key in keychain, …) without changing the threat model.

Writes are atomic — write to `auth.json.tmp`, `fsync`, `rename` over `auth.json`. Reads + writes through the auth-store are serialized per provider by a `Mutex` so concurrent refreshes can't double-spend a rotating refresh token.

## Refresh-token rotation (the hidden footgun)

Whoop (and several other providers) rotate refresh tokens on every use. Naive implementations can lose all access by double-spending — two concurrent 401s both call `refresh()` with the same token; the first invalidates it, the second 401s permanently.

We avoid that with:

- **Per-provider mutex** on the auth-store. Refresh happens inside the lock.
- **Lazy + proactive refresh** — proactively refresh when `expires_at` is within 5 minutes; lazily retry once on 401.
- **Atomic file rewrite** — temp + fsync + rename. The old pair is replaced as a single rename, so a crash mid-write can never leave a partial file.

## OAuth state

The wearable callback (`GET /auth/wearable/callback`) is intentionally unauthenticated — it's a third-party redirect. To prevent forgery and replay:

- The OAuth `state` query parameter is an HMAC-SHA256 token over `{provider, nonce, exp}` with an app secret derived from a server-generated `system.secret_key` (created on first run, never written outside `data.db`).
- 10-minute expiry. Survives restart, can't be forged.
- The `nonce` is single-use — persisted in `oauth_state_nonces` on issue, deleted on first successful callback. Expired nonces are purged on every callback.

A second callback for the same `state` token → `400 bad nonce`. A callback with a forged signature → `400 invalid signature`. There's no useful work an attacker can do here without the app secret, and no useful work to do twice.

## Logging

- Token values are never logged. Refresh callbacks log `last_refresh_at` and provider id only.
- `health-mcp doctor` reports the presence of `auth.json` and per-provider expiry but never prints token values.
- Log level controlled by `HEALTH_MCP_LOG_LEVEL` (`debug | info | warn | error`).

## What this does *not* protect against

- An attacker with read access to the operator's home directory. They get `data.db` and `auth.json`. Mitigations: full-disk encryption on the host OS; standard practice.
- Malicious code running as the operator's user. It can spawn the server, read the DB, read `auth.json`. Mitigations: don't run untrusted code as your user.
- Network-level attacks against MCP/REST traffic when bound off-loopback. Mitigation: terminate TLS at a reverse proxy (Cloudflare Tunnel, Tailscale, nginx + LetsEncrypt) — the server itself only speaks HTTP. The loopback rule exists because that's the only safe default we can ship.

## Quick checklist before exposing the server beyond localhost

1. Set `HEALTH_MCP_TOKEN` to 32+ high-entropy chars (`openssl rand -hex 32`).
2. Bind off-loopback only behind a TLS-terminating tunnel.
3. Confirm `health-mcp doctor` reports `auth.json` and `data.db` at `0600` and the parent dir at `0700`.
4. Confirm `/health` returns `auth_required: true`.
5. Re-issue (regenerate) the token on a routine basis if you suspect leakage. Tokens are stateless — there's no revocation list, just a config rotate + restart.
