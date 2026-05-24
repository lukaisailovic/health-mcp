import { Hono } from 'hono';
import { bearerAuth } from './auth.js';
import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { mountRestRoutes } from './rest/index.js';
import type { WearableServiceCtx } from './services/wearables.js';

const VERSION = '0.1.0';

export const createHonoApp = (opts: {
  config: Config;
  logger: Logger;
  ctx: WearableServiceCtx;
  sdkVersion?: string;
}): Hono => {
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      ok: true,
      db: 'up',
      tz: opts.config.tz,
      version: VERSION,
      auth_required: Boolean(opts.config.token),
    }),
  );
  app.get('/version', (c) =>
    c.json({
      version: VERSION,
      sdk_version: opts.sdkVersion ?? null,
    }),
  );

  if (opts.config.token) {
    app.use('/api/*', bearerAuth(opts.config.token));
  }

  mountRestRoutes(app, opts.ctx);
  return app;
};
