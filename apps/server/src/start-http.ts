import type { IncomingMessage, ServerResponse } from 'node:http';
import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import type { Config } from './config.js';
import type { Logger } from './logger.js';

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

  logger.info('listening', { host: config.host, port: config.port, tz: config.tz });

  return () => new Promise<void>((resolve) => httpServer.close(() => resolve()));
};
