# Configuration

Resolution order, highest precedence first:

1. **CLI flag** (`--token foo`)
2. **Env var** (`HEALTH_MCP_TOKEN=foo`)
3. **JSON config file** (path via `--config` or `HEALTH_MCP_CONFIG`; lowercase keys)
4. **Default**

## All options

| Option | Env | Flag | Config-file key | Default |
|---|---|---|---|---|
| Transport | `HEALTH_MCP_STDIO` | `--stdio` | `stdio` | `false` (HTTP) |
| Port | `HEALTH_MCP_PORT` | `--port` | `port` | `7777` |
| Bind host | `HEALTH_MCP_HOST` | `--host` | `host` | `127.0.0.1` |
| SQLite path | `HEALTH_MCP_DB` | `--db` | `db` | `~/.health-mcp/data.db` |
| Bearer token | `HEALTH_MCP_TOKEN` | `--token` | `token` | unset (loopback-only) |
| Dashboard | `HEALTH_MCP_DASHBOARD` | `--no-dashboard` | `dashboard` | `true` |
| Dashboard build dir | `HEALTH_MCP_PUBLIC_DIR` | `--public-dir` | `public_dir` | packaged `./public` |
| Open browser | `HEALTH_MCP_OPEN` | `--open` / `--no-open` | `open` | TTY-only, dashboard-only |
| Timezone | `HEALTH_MCP_TZ` | `--tz` | `tz` | `$TZ` → system → `UTC` |
| Log level | `HEALTH_MCP_LOG_LEVEL` | `--log-level` | `log_level` | `info` |
| USDA API key | `HEALTH_MCP_USDA_API_KEY` | — | `usda_api_key` | unset (local-only search) |
| Whoop client id | `HEALTH_MCP_WHOOP_CLIENT_ID` | — | `whoop_client_id` | — |
| Whoop client secret | `HEALTH_MCP_WHOOP_CLIENT_SECRET` | — | `whoop_client_secret` | — |
| Oura client id | `HEALTH_MCP_OURA_CLIENT_ID` | — | `oura_client_id` | — |
| Oura client secret | `HEALTH_MCP_OURA_CLIENT_SECRET` | — | `oura_client_secret` | — |
| Wearable redirect base | `HEALTH_MCP_WEARABLE_REDIRECT_BASE` | — | `wearable_redirect_base` | `http://{host}:{port}/auth/wearable/callback` |
| Whoop sync cron | `HEALTH_MCP_WHOOP_SYNC_CRON` | — | `whoop_sync_cron` | `*/30 * * * *` |
| Config file | `HEALTH_MCP_CONFIG` | `--config` | — | — |
| Auto-migrate | — | `--no-auto-migrate` | — | on |
| Insecure DB modes | — | `--allow-insecure-db` | — | off |
| Insecure auth modes | — | `--allow-insecure-auth` | — | off |

Boolean env values accept `1` / `0`, `true` / `false`, `yes` / `no`.

## Subcommands

```bash
health-mcp                       # serve (default)
health-mcp migrate               # run pending migrations and exit
health-mcp migrate --retz        # recompute the date column for all rows under current $TZ
health-mcp doctor                # self-check: DB pragmas, file modes, token entropy, auth.json
health-mcp export <out.jsonl>    # dump full DB; raw_json redacted unless --include-raw
health-mcp import-usda <path>    # ingest a USDA FoodData Central bulk JSON dump
```

`migrate` and `import-usda` honor `--no-auto-migrate`. `export` writes a JSONL file with one row per record; pass `--include-raw` to retain `raw_json` columns (these may contain provider-side personal info).

## Security invariants enforced at startup

These checks live in `enforceSecurityInvariants()` (`apps/server/src/config.ts`) and the server refuses to start if any fail:

- HTTP mode + non-loopback host (`--host 0.0.0.0` etc.) **and** no `HEALTH_MCP_TOKEN` set → refuse. Loopback is `127.0.0.1`, `::1`, `localhost`, anything in `127.0.0.0/8`.
- Token present but shorter than 32 chars, or with fewer than 8 distinct characters → refuse. `openssl rand -hex 32` is the easy mode.

Escape hatches (don't use these unless you understand them):

- `--allow-insecure-db` — open `data.db` even if its mode is looser than `0600` or its parent dir is looser than `0700`.
- `--allow-insecure-auth` — same for `auth.json`.

See [Security](./SECURITY.md) for the full model.

## Timezone behavior

`HEALTH_MCP_TZ` is the **IANA name** (`Europe/Belgrade`, `America/New_York`, …). It controls:

- The `date` column on `intake_entries`, `hydration_entries`, `weight_entries`, `measurements` — computed in this TZ at *write* time and stored as-is. `ts` is always UTC ISO and remains authoritative for ordering.
- The default `meal_type` derivation in `log_intake` when neither `meal_type` nor `ts` is supplied: <11:00 local → `breakfast`, <15:00 → `lunch`, <20:00 → `dinner`, else `snack`.

If you change `HEALTH_MCP_TZ` after data already exists, historical `date` values are **not** retroactively updated. Run `health-mcp migrate --retz` to rebucket them.

## Config file example

```json
{
  "port": 8080,
  "tz": "Europe/Belgrade",
  "token": "REPLACE_WITH_$(openssl rand -hex 32)_OUTPUT",
  "whoop_client_id": "…",
  "whoop_client_secret": "…",
  "whoop_sync_cron": "0 */4 * * *",
  "log_level": "debug"
}
```

Pass with `--config ./config.json` or set `HEALTH_MCP_CONFIG=./config.json`.

## Files created at runtime

| Path | Mode | Purpose |
|---|---|---|
| `~/.health-mcp/` | `0700` | Parent directory |
| `~/.health-mcp/data.db` | `0600` | SQLite (the only datastore) |
| `~/.health-mcp/data.db-wal` | inherited | SQLite WAL file (managed by better-sqlite3) |
| `~/.health-mcp/data.db-shm` | inherited | SQLite shared memory |
| `~/.health-mcp/auth.json` | `0600` | Wearable OAuth tokens — treated as a secret |

`data.db` and `auth.json` are deliberately separate so the DB can be exported, copied, or shared without leaking provider credentials.
