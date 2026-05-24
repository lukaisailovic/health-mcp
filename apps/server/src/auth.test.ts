import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { bearerAuth } from './auth.js';

describe('bearer middleware', () => {
  const TOKEN = 'a'.repeat(64);

  it('rejects missing authorization header', async () => {
    const app = new Hono();
    app.use('*', bearerAuth(TOKEN));
    app.get('/x', (c) => c.text('ok'));
    const res = await app.request('/x');
    expect(res.status).toBe(401);
  });

  it('rejects wrong token', async () => {
    const app = new Hono();
    app.use('*', bearerAuth(TOKEN));
    app.get('/x', (c) => c.text('ok'));
    const res = await app.request('/x', { headers: { authorization: `Bearer ${'b'.repeat(64)}` } });
    expect(res.status).toBe(401);
  });

  it('accepts correct token', async () => {
    const app = new Hono();
    app.use('*', bearerAuth(TOKEN));
    app.get('/x', (c) => c.text('ok'));
    const res = await app.request('/x', { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});
