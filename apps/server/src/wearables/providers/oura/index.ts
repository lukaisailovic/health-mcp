import type { Logger } from '../../../logger.js';
import type {
  ResourceKind,
  SyncArgs,
  SyncResult,
  TokenSet,
  WearableProvider,
} from '../../types.js';
import {
  OuraClient,
  type OuraTokenResponse,
  buildOuraAuthUrl,
  exchangeOuraCode,
  refreshOuraTokens,
} from './client.js';

const SCOPES = [
  'email',
  'personal',
  'daily',
  'heartrate',
  'workout',
  'tag',
  'session',
  'spo2Daily',
];

export type OuraOptions = {
  clientId: string | null;
  clientSecret: string | null;
  logger: Logger;
};

export const createOuraProvider = (opts: OuraOptions): WearableProvider | null => {
  if (!opts.clientId || !opts.clientSecret) return null;
  const clientId = opts.clientId;
  const clientSecret = opts.clientSecret;
  return {
    id: 'oura',
    displayName: 'Oura',
    authStrategy: 'oauth2',
    scopes: SCOPES,
    hasMinuteResolution: true,
    buildAuthUrl: (state, redirectUri) =>
      buildOuraAuthUrl({ clientId, redirectUri, state, scopes: SCOPES }),
    exchangeCode: async (code, redirectUri) =>
      tokenSetFromResponse(await exchangeOuraCode({ code, clientId, clientSecret, redirectUri })),
    refreshTokens: async (refreshToken) =>
      tokenSetFromResponse(await refreshOuraTokens({ refreshToken, clientId, clientSecret })),
    sync: async (args: SyncArgs): Promise<SyncResult[]> => {
      const resources: ResourceKind[] = args.resources ?? [
        'profile',
        'sleep',
        'activity',
        'readiness',
        'daily',
      ];
      const accessToken = { current: args.auth.access_token ?? '' };
      const refresh = async () => {
        if (!args.auth.refresh_token) throw new Error('oura: missing refresh_token');
        const r = await refreshOuraTokens({
          refreshToken: args.auth.refresh_token,
          clientId,
          clientSecret,
        });
        const ts = tokenSetFromResponse(r);
        accessToken.current = ts.access_token;
        if (args.onAuthRefreshed) await args.onAuthRefreshed(ts);
      };
      if (args.auth.expires_at) {
        const remaining = new Date(args.auth.expires_at).getTime() - Date.now();
        if (remaining < 5 * 60_000) await refresh();
      }
      const client = new OuraClient({
        logger: opts.logger,
        getAccessToken: () => accessToken.current,
      });
      const { runOuraResource } = await import('./sync.js');
      const results: SyncResult[] = [];
      for (const res of resources) {
        try {
          results.push(
            await runOuraResource({
              db: args.db,
              client,
              resource: res,
              cursor: args.cursors[res] ?? null,
              since: args.since,
              refresh,
            }),
          );
        } catch (err) {
          opts.logger.error('oura sync failed', {
            resource: res,
            error: (err as Error).message,
          });
        }
      }
      return results;
    },
  };
};

const tokenSetFromResponse = (r: OuraTokenResponse): TokenSet => ({
  access_token: r.access_token,
  refresh_token: r.refresh_token,
  expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
  scope: r.scope,
});
