import type { IncomingMessage, ServerResponse } from 'node:http';
import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import { isLoopback } from './config.js';
import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { openBrowser } from './open-browser.js';

export type StartHttpServerArgs = {
  app: Hono;
  mcpHandler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  config: Config;
  logger: Logger;
};

type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;
type NodeHttpServer = {
  on: (event: string, listener: RequestListener) => void;
  listeners: (event: string) => RequestListener[];
  removeAllListeners: (event: string) => void;
  close: (cb?: () => void) => void;
};

const dashboardUrl = (config: Config): string => {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return `http://${host}:${config.port}`;
};

export const startHttpServer = async ({
  app,
  mcpHandler,
  config,
  logger,
}: StartHttpServerArgs): Promise<() => Promise<void>> => {
  // Hook into the underlying http.Server so /mcp routes to the native handler before Hono.
  const httpServer = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  }) as unknown as NodeHttpServer;

  const existing = httpServer.listeners('request');
  httpServer.removeAllListeners('request');
  httpServer.on('request', async (req, res) => {
    try {
      const handled = await mcpHandler(req, res);
      if (handled) return;
    } catch (err) {
      logger.error('mcp handler failed', { error: (err as Error).message });
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
      return;
    }
    for (const l of existing) l(req, res);
  });

  const url = dashboardUrl(config);
  logger.info('listening', { bind: `${config.host}:${config.port}`, url, tz: config.tz });
  if (!isLoopback(config.host) && config.wearableRedirectBase?.includes('127.0.0.1')) {
    logger.warn(
      'wearable OAuth callback defaults to localhost while bound off-loopback; set HEALTH_MCP_WEARABLE_REDIRECT_BASE to a reachable URL for Whoop/Oura linking',
      { host: config.host, wearableRedirectBase: config.wearableRedirectBase },
    );
  }
  if (config.dashboard) {
    const scope = config.host === '0.0.0.0' ? ' (all interfaces)' : '';
    process.stdout.write(`\n  health-mcp · ${url}${scope}\n  press ctrl-c to stop\n\n`);
  }

  if (config.openBrowser) {
    openBrowser(url);
  }

  return () => new Promise<void>((resolve) => httpServer.close(() => resolve()));
};
