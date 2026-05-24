import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape, ZodTypeAny } from 'zod';
import { ServiceError } from '../services/types.js';
import type { WearableServiceCtx } from '../services/wearables.js';
import type { AnyToolDef } from './tool-registry.js';

const VERSION = '0.1.0';

const toContent = (value: unknown): Array<{ type: 'text'; text: string }> => {
  if (value === undefined) return [{ type: 'text', text: '' }];
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
};

const shapeOf = (schema: ZodTypeAny): ZodRawShape => {
  const anySchema = schema as unknown as { shape?: ZodRawShape };
  return anySchema.shape ?? {};
};

const errorContent = (code: string, message: string) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: JSON.stringify({ code, message }) }],
});

export type RegisteredHandle = {
  enable: () => void;
  disable: () => void;
  remove: () => void;
};

export class HealthMcpServer {
  private server: McpServer;
  private handles = new Map<string, RegisteredHandle>();
  private tools: AnyToolDef[];
  private ctx: WearableServiceCtx;
  private lastAvailability = new Map<string, boolean>();

  constructor(opts: { tools: AnyToolDef[]; ctx: WearableServiceCtx }) {
    this.tools = opts.tools;
    this.ctx = opts.ctx;
    this.server = new McpServer(
      { name: 'health-mcp', version: VERSION },
      { capabilities: { tools: { listChanged: true } } },
    );
  }

  attach(): void {
    for (const tool of this.tools) {
      const handle = this.server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: shapeOf(tool.inputSchema),
        },
        async (args: Record<string, unknown>) => {
          try {
            const parsed = tool.inputSchema.parse(args);
            const out = await tool.handler(parsed, this.ctx);
            return { content: toContent(out) };
          } catch (err) {
            if (err instanceof ServiceError) {
              return errorContent(err.code, err.message);
            }
            return errorContent('internal_error', (err as Error).message ?? String(err));
          }
        },
      );
      this.handles.set(tool.name, handle);
      const available = tool.isAvailable ? tool.isAvailable(this.ctx) : true;
      this.lastAvailability.set(tool.name, available);
      if (!available) handle.disable();
    }
  }

  reevaluateAvailability(): void {
    for (const tool of this.tools) {
      if (!tool.isAvailable) continue;
      const handle = this.handles.get(tool.name);
      if (!handle) continue;
      const now = tool.isAvailable(this.ctx);
      const prev = this.lastAvailability.get(tool.name);
      if (now === prev) continue;
      this.lastAvailability.set(tool.name, now);
      if (now) handle.enable();
      else handle.disable();
    }
  }

  underlying(): McpServer {
    return this.server;
  }
}
