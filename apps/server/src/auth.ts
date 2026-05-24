import { timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';

const constantTimeStringEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

export const bearerAuth = (expectedToken: string) =>
  createMiddleware(async (c, next) => {
    const header = c.req.header('authorization') ?? c.req.header('Authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const presented = header.slice(7).trim();
    if (!constantTimeStringEq(presented, expectedToken)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  });
