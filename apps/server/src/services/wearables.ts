import { isoDateRange } from '../util/tz.js';
import type { AuthStore } from '../wearables/auth-store.js';
import { encodeState } from '../wearables/oauth-state.js';
import { getProvider, listProviders } from '../wearables/registry.js';
import type { AuthRecord, ResourceKind, SyncResult, TokenSet } from '../wearables/types.js';
import { recordProviderWeight } from './simple-logs.js';
import { type Ctx, ServiceError } from './types.js';

export type WearableServiceCtx = Ctx & { authStore: AuthStore };

export const wearablesListProviders = (ctx: WearableServiceCtx) => {
  return listProviders().map((p) => {
    const auth = ctx.authStore.get(p.id);
    const stateRow = ctx.db
      .prepare('SELECT id, display_name, auth_strategy FROM wearable_providers WHERE id = ?')
      .get(p.id) as { id: string; display_name: string; auth_strategy: string } | undefined;
    return {
      id: p.id,
      display_name: stateRow?.display_name ?? p.displayName,
      auth_strategy: p.authStrategy,
      scopes: p.scopes ?? [],
      status: auth ? 'linked' : 'available',
    };
  });
};

export const wearablesStatus = (ctx: WearableServiceCtx) => {
  const out: Array<{
    provider: string;
    scope: string | null;
    expires_at: string | null;
    last_refresh_at: string | null;
    resources: Array<{
      resource: string;
      last_synced_at: string | null;
      next_token: string | null;
    }>;
  }> = [];
  const all = ctx.authStore.list();
  for (const [providerId, auth] of Object.entries(all)) {
    const rows = ctx.db
      .prepare(
        'SELECT resource, last_synced_at, next_token FROM wearable_sync_state WHERE provider = ?',
      )
      .all(providerId) as Array<{
      resource: string;
      last_synced_at: string | null;
      next_token: string | null;
    }>;
    out.push({
      provider: providerId,
      scope: auth.scope ?? null,
      expires_at: auth.expires_at ?? null,
      last_refresh_at: auth.last_refresh_at ?? null,
      resources: rows,
    });
  }
  return out;
};

export const wearableConnectUrl = (
  ctx: WearableServiceCtx,
  args: { provider: string },
): { url: string; state: string } => {
  if (ctx.config.stdio) {
    throw new ServiceError('http_only', 'OAuth flows require HTTP mode', 400);
  }
  const provider = getProvider(args.provider);
  if (!provider) throw new ServiceError('unknown_provider', args.provider, 404);
  if (!provider.buildAuthUrl) {
    throw new ServiceError('not_oauth', `${args.provider} is not an OAuth2 provider`, 400);
  }
  const state = encodeState(ctx.db, args.provider);
  const redirectUri = ctx.config.wearableRedirectBase ?? '';
  return { url: provider.buildAuthUrl(state, redirectUri), state };
};

export const wearableDisconnect = async (
  ctx: WearableServiceCtx,
  args: { provider: string },
): Promise<{ provider: string; disconnected: boolean }> => {
  await ctx.authStore.set(args.provider, null);
  return { provider: args.provider, disconnected: true };
};

export const handleOAuthCallback = async (
  ctx: WearableServiceCtx,
  args: { provider: string; code: string },
): Promise<void> => {
  const provider = getProvider(args.provider);
  if (!provider) throw new ServiceError('unknown_provider', args.provider, 404);
  if (!provider.exchangeCode) {
    throw new ServiceError('not_oauth', `${args.provider} cannot exchange code`, 400);
  }
  const redirectUri = ctx.config.wearableRedirectBase ?? '';
  const tokens = await provider.exchangeCode(args.code, redirectUri);
  const now = new Date().toISOString();
  const record: AuthRecord = {
    strategy: 'oauth2',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    scope: tokens.scope,
    connected_at: now,
  };
  await ctx.authStore.set(args.provider, record);
};

export const syncWearables = async (
  ctx: WearableServiceCtx,
  args: { providers?: string[]; resources?: ResourceKind[]; since?: string } = {},
): Promise<SyncResult[]> => {
  const targets = args.providers ?? Object.keys(ctx.authStore.list());
  const results: SyncResult[] = [];
  for (const id of targets) {
    const provider = getProvider(id);
    if (!provider) continue;
    const auth = ctx.authStore.get(id);
    if (!auth) continue;
    const cursorRows = ctx.db
      .prepare('SELECT resource, next_token FROM wearable_sync_state WHERE provider = ?')
      .all(id) as Array<{ resource: string; next_token: string | null }>;
    const cursors: Record<string, string | null> = {};
    for (const r of cursorRows) cursors[r.resource] = r.next_token;
    const onAuthRefreshed = async (tokens: TokenSet) => {
      await ctx.authStore.update(id, (current) => ({
        next: current
          ? {
              ...current,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token ?? current.refresh_token,
              expires_at: tokens.expires_at ?? current.expires_at,
              scope: tokens.scope ?? current.scope,
              last_refresh_at: new Date().toISOString(),
            }
          : null,
      }));
    };
    const r = await provider.sync({
      db: ctx.db,
      auth,
      resources: args.resources,
      since: args.since,
      cursors,
      tz: ctx.config.tz,
      onAuthRefreshed,
    });
    results.push(...r);
  }
  if (results.some((r) => r.provider === 'whoop')) {
    const body = whoopBodyMeasurement(ctx) as { weight_kg: number | null } | null;
    if (body?.weight_kg != null) {
      recordProviderWeight(ctx, { kg: body.weight_kg, source: 'whoop' });
    }
  }
  return results;
};

export const wearableSleep = (
  ctx: WearableServiceCtx,
  args: { date?: string; start?: string; end?: string; providers?: string[] } = {},
) => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    const { startIso, endIso } = isoDateRange(args.date, ctx.config.tz);
    conds.push('"end" >= ? AND "end" < ?');
    params.push(startIso, endIso);
  }
  if (args.start) {
    conds.push('start >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('start <= ?');
    params.push(args.end);
  }
  applyProviderFilter(conds, params, args.providers);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return ctx.db.prepare(`SELECT * FROM wearable_sleep ${where} ORDER BY start DESC`).all(...params);
};

export const wearableActivity = (
  ctx: WearableServiceCtx,
  args: { start?: string; end?: string; type?: string; providers?: string[] } = {},
) => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.start) {
    conds.push('start >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('start <= ?');
    params.push(args.end);
  }
  if (args.type) {
    conds.push('type = ?');
    params.push(args.type);
  }
  applyProviderFilter(conds, params, args.providers);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return ctx.db
    .prepare(`SELECT * FROM wearable_activity ${where} ORDER BY start DESC`)
    .all(...params);
};

export const wearableReadiness = (
  ctx: WearableServiceCtx,
  args: { date?: string; start?: string; end?: string; providers?: string[] } = {},
) => queryByDateOrRange(ctx, 'wearable_readiness', args);

export const wearableDaily = (
  ctx: WearableServiceCtx,
  args: { date?: string; start?: string; end?: string; providers?: string[] } = {},
) => queryByDateOrRange(ctx, 'wearable_daily', args);

export const wearableMetricMinutes = (
  ctx: WearableServiceCtx,
  args: { metric: string; start: string; end: string; providers?: string[] },
) => {
  const conds: string[] = ['metric = ?', 'ts >= ?', 'ts <= ?'];
  const params: unknown[] = [args.metric, args.start, args.end];
  applyProviderFilter(conds, params, args.providers);
  return ctx.db
    .prepare(`SELECT * FROM wearable_metric_minutes WHERE ${conds.join(' AND ')} ORDER BY ts`)
    .all(...params);
};

export const setActivityTypeMap = (
  ctx: WearableServiceCtx,
  args: { provider: string; raw_type: string; canonical: string },
) => {
  ctx.db
    .prepare(
      `INSERT INTO wearable_activity_type_map (provider, raw_type, canonical) VALUES (?, ?, ?)
       ON CONFLICT(provider, raw_type) DO UPDATE SET canonical = excluded.canonical`,
    )
    .run(args.provider, args.raw_type, args.canonical);
  return { provider: args.provider, raw_type: args.raw_type, canonical: args.canonical };
};

const applyProviderFilter = (
  conds: string[],
  params: unknown[],
  providers: string[] | undefined,
): void => {
  if (!providers?.length) return;
  conds.push(`provider IN (${providers.map(() => '?').join(',')})`);
  params.push(...providers);
};

const queryByDateOrRange = (
  ctx: WearableServiceCtx,
  table: string,
  args: { date?: string; start?: string; end?: string; providers?: string[] },
) => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    conds.push('date = ?');
    params.push(args.date);
  }
  if (args.start) {
    conds.push('date >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('date <= ?');
    params.push(args.end);
  }
  applyProviderFilter(conds, params, args.providers);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return ctx.db.prepare(`SELECT * FROM ${table} ${where} ORDER BY date DESC`).all(...params);
};

const queryByStartRange = (
  ctx: WearableServiceCtx,
  table: string,
  args: { start?: string; end?: string },
) => {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.start) {
    conds.push('start >= ?');
    params.push(args.start);
  }
  if (args.end) {
    conds.push('start <= ?');
    params.push(args.end);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return ctx.db.prepare(`SELECT * FROM ${table} ${where} ORDER BY start DESC`).all(...params);
};

// Whoop-specific reads
export const whoopRecovery = (
  ctx: WearableServiceCtx,
  args: { date?: string; start?: string; end?: string } = {},
) => {
  const cycleStart = '(SELECT start FROM whoop_cycles WHERE id = whoop_recoveries.cycle_id)';
  const conds: string[] = [];
  const params: unknown[] = [];
  if (args.date) {
    conds.push(`${cycleStart} LIKE ?`);
    params.push(`${args.date}%`);
  }
  if (args.start) {
    conds.push(`${cycleStart} >= ?`);
    params.push(args.start);
  }
  if (args.end) {
    conds.push(`${cycleStart} <= ?`);
    params.push(args.end);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return ctx.db.prepare(`SELECT * FROM whoop_recoveries ${where}`).all(...params);
};

export const whoopCycles = (ctx: WearableServiceCtx, args: { start?: string; end?: string } = {}) =>
  queryByStartRange(ctx, 'whoop_cycles', args);

export const whoopSleepRaw = (
  ctx: WearableServiceCtx,
  args: { start?: string; end?: string } = {},
) => queryByStartRange(ctx, 'whoop_sleep', args);

export const whoopWorkoutsRaw = (
  ctx: WearableServiceCtx,
  args: { start?: string; end?: string } = {},
) => queryByStartRange(ctx, 'whoop_workouts', args);

export const whoopProfile = (ctx: WearableServiceCtx) =>
  ctx.db.prepare('SELECT * FROM whoop_profile WHERE id = 1').get() ?? null;

export const whoopBodyMeasurement = (ctx: WearableServiceCtx) =>
  ctx.db.prepare('SELECT * FROM whoop_body_measurement WHERE id = 1').get() ?? null;
