import { Cron } from 'croner';
import type { Logger } from './logger.js';
import type { WearableServiceCtx } from './services/wearables.js';
import { syncWearables } from './services/wearables.js';

export type Scheduler = { stop: () => void };

export const startScheduler = (
  ctx: WearableServiceCtx,
  cronExpr: string,
  logger: Logger,
): Scheduler => {
  const job = new Cron(cronExpr, async () => {
    if (Object.keys(ctx.authStore.list()).length === 0) return;
    try {
      const r = await syncWearables(ctx);
      logger.info('scheduled sync done', { results: r.length });
    } catch (err) {
      logger.error('scheduled sync failed', { error: (err as Error).message });
    }
  });
  return { stop: () => job.stop() };
};
