import type { Logger } from '../../../logger.js';
import type {
  ResourceKind,
  SyncArgs,
  SyncResult,
  TokenSet,
  WearableProvider,
} from '../../types.js';
import {
  WhoopClient,
  type WhoopTokenResponse,
  buildWhoopAuthUrl,
  exchangeWhoopCode,
  refreshWhoopTokens,
} from './client.js';

const SCOPES = [
  'read:profile',
  'read:body_measurement',
  'read:cycles',
  'read:recovery',
  'read:sleep',
  'read:workout',
  'offline',
];

export type WhoopOptions = {
  clientId: string | null;
  clientSecret: string | null;
  logger: Logger;
};

export const createWhoopProvider = (opts: WhoopOptions): WearableProvider | null => {
  if (!opts.clientId || !opts.clientSecret) return null;
  const clientId = opts.clientId;
  const clientSecret = opts.clientSecret;
  return {
    id: 'whoop',
    displayName: 'Whoop',
    authStrategy: 'oauth2',
    scopes: SCOPES,
    hasMinuteResolution: false,
    buildAuthUrl: (state, redirectUri) =>
      buildWhoopAuthUrl({ clientId, redirectUri, state, scopes: SCOPES }),
    exchangeCode: async (code, redirectUri) => {
      const r = await exchangeWhoopCode({ code, clientId, clientSecret, redirectUri });
      return tokenSetFromResponse(r);
    },
    refreshTokens: async (refreshToken) => {
      const r = await refreshWhoopTokens({ refreshToken, clientId, clientSecret });
      return tokenSetFromResponse(r);
    },
    sync: async (args: SyncArgs): Promise<SyncResult[]> => {
      const results: SyncResult[] = [];
      const resources: ResourceKind[] = args.resources ?? [
        'profile',
        'body',
        'sleep',
        'activity',
        'readiness',
        'daily',
      ];
      const accessToken = { current: args.auth.access_token ?? '' };
      const refresh = async () => {
        if (!args.auth.refresh_token) throw new Error('whoop: missing refresh_token');
        const r = await refreshWhoopTokens({
          refreshToken: args.auth.refresh_token,
          clientId,
          clientSecret,
        });
        const ts = tokenSetFromResponse(r);
        accessToken.current = ts.access_token;
        if (args.onAuthRefreshed) await args.onAuthRefreshed(ts);
      };
      // Proactive refresh if <5min remaining.
      if (args.auth.expires_at) {
        const remaining = new Date(args.auth.expires_at).getTime() - Date.now();
        if (remaining < 5 * 60_000) {
          await refresh();
        }
      }
      const client = new WhoopClient({
        logger: opts.logger,
        getAccessToken: () => accessToken.current,
      });
      const { runWhoopResource } = await import('./sync.js');
      for (const res of resources) {
        try {
          const r = await runWhoopResource({
            db: args.db,
            client,
            resource: res,
            cursor: args.cursors[res] ?? null,
            since: args.since,
            refresh,
          });
          results.push(r);
        } catch (err) {
          opts.logger.error('whoop sync failed', { resource: res, error: (err as Error).message });
        }
      }
      return results;
    },
  };
};

const tokenSetFromResponse = (r: WhoopTokenResponse): TokenSet => ({
  access_token: r.access_token,
  refresh_token: r.refresh_token,
  expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
  scope: r.scope,
});
