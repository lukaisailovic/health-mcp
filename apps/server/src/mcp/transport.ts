import { randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Logger } from '../logger.js';
import type { HealthMcpServer } from './server.js';

const transports = new Map<string, StreamableHTTPServerTransport>();

const constantTimeEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const authOk = (req: IncomingMessage, token: string | null): boolean => {
  if (!token) return true;
  const header =
    req.headers.authorization ?? req.headers['Authorization' as keyof typeof req.headers];
  const headerStr = Array.isArray(header) ? header[0] : header;
  if (!headerStr) return false;
  if (!headerStr.toLowerCase().startsWith('bearer ')) return false;
  const presented = headerStr.slice(7).trim();
  return constantTimeEq(presented, token);
};

const readBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });

export const createMcpRouter = (opts: {
  server: HealthMcpServer;
  token: string | null;
  logger: Logger;
}): ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) => {
  return async (req, res) => {
    const url = req.url ?? '/';
    if (!url.startsWith('/mcp')) return false;
    if (!authOk(req, opts.token)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return true;
    }
    const sessionId = req.headers['mcp-session-id'];
    const sidStr = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    let transport = sidStr ? transports.get(sidStr) : undefined;
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
        },
      });
      transport.onclose = () => {
        if (transport?.sessionId) transports.delete(transport.sessionId);
      };
      await opts.server.underlying().connect(transport);
    }
    let body: unknown;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        body = await readBody(req);
      } catch (err) {
        opts.logger.warn('mcp body parse failed', { error: (err as Error).message });
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
        return true;
      }
    }
    await transport.handleRequest(req, res, body);
    return true;
  };
};
