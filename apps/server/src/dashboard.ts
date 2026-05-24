import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';
import type { Logger } from './logger.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const HERE = dirname(fileURLToPath(import.meta.url));

export const resolvePublicDir = (override?: string | null): string | null => {
  const candidates = [
    override ? resolve(override) : null,
    resolve(HERE, '..', 'public'),
    resolve(HERE, '..', '..', 'public'),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? null;
};

const isServerRoute = (path: string): boolean =>
  path === '/health' ||
  path === '/version' ||
  path === '/mcp' ||
  path.startsWith('/api/') ||
  path.startsWith('/auth/');

export const mountDashboard = (
  app: Hono,
  opts: { publicDir: string; logger: Logger },
): void => {
  const indexHtml = readFileSync(join(opts.publicDir, 'index.html'), 'utf8');

  app.get('*', (c) => {
    const pathname = decodeURIComponent(new URL(c.req.url).pathname);
    if (isServerRoute(pathname)) return c.notFound();

    const relPath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = resolve(opts.publicDir, relPath);
    const inside = filePath === opts.publicDir || filePath.startsWith(`${opts.publicDir}/`);
    if (inside && existsSync(filePath) && statSync(filePath).isFile()) {
      const mime = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      c.header('Content-Type', mime);
      c.header(
        'Cache-Control',
        pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      return c.body(readFileSync(filePath));
    }
    if (pathname.includes('.')) return c.notFound();
    return c.html(indexHtml);
  });

  opts.logger.info('dashboard served', { from: opts.publicDir });
};
