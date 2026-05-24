import type { Logger } from '../../../logger.js';

const BASE_URL = 'https://api.prod.whoop.com';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

type Bucket = {
  capacity: number;
  tokens: number;
  refillPerMs: number;
  last: number;
};

export class WhoopClient {
  private bucket: Bucket = { capacity: 90, tokens: 90, refillPerMs: 90 / 60_000, last: Date.now() };
  private logger: Logger;
  private getAccessToken: () => string;

  constructor(opts: { logger: Logger; getAccessToken: () => string }) {
    this.logger = opts.logger;
    this.getAccessToken = opts.getAccessToken;
  }

  private async takeToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.bucket.last;
    this.bucket.tokens = Math.min(
      this.bucket.capacity,
      this.bucket.tokens + elapsed * this.bucket.refillPerMs,
    );
    this.bucket.last = now;
    if (this.bucket.tokens >= 1) {
      this.bucket.tokens -= 1;
      return;
    }
    const need = 1 - this.bucket.tokens;
    const waitMs = Math.ceil(need / this.bucket.refillPerMs);
    await new Promise((r) => setTimeout(r, waitMs));
    this.bucket.tokens = 0;
    this.bucket.last = Date.now();
  }

  async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    await this.takeToken();
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.getAccessToken()}`,
      Accept: 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const text = await res.text();
      throw new WhoopApiError(res.status, text);
    }
    return (await res.json()) as T;
  }
}

export class WhoopApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Whoop API ${status}`);
    this.status = status;
    this.body = body;
  }
}

export type WhoopTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

const postTokenEndpoint = async (
  body: URLSearchParams,
  label: string,
): Promise<WhoopTokenResponse> => {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Whoop ${label} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as WhoopTokenResponse;
};

export const exchangeWhoopCode = (args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<WhoopTokenResponse> =>
  postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
    }),
    'token exchange',
  );

export const refreshWhoopTokens = (args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<WhoopTokenResponse> =>
  postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
    }),
    'refresh',
  );

export const buildWhoopAuthUrl = (args: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string => {
  const u = new URL('https://api.prod.whoop.com/oauth/oauth2/auth');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  u.searchParams.set('scope', args.scopes.join(' '));
  u.searchParams.set('state', args.state);
  return u.toString();
};
