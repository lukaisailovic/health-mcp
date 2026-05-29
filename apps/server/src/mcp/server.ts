import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ZodError, type ZodRawShape, type ZodTypeAny } from 'zod';
import { ServiceError } from '../services/types.js';
import type { WearableServiceCtx } from '../services/wearables.js';
import { VERSION } from '../version.js';
import type { AnyToolDef } from './tool-registry.js';

const INSTRUCTIONS = `health-mcp is the user's personal health database — nutrition, biomarkers/labs, and wearables. You do the estimation; the server stores structured, typed records. It does not parse free text or photos, so turn descriptions into structured tool calls yourself.

Call discover_capabilities first. The tool surface is capability-gated and changes as data accrues and wearable providers link, so read the live catalog instead of assuming a tool exists.

Conventions:
- Meals are structured components. From "two eggs and toast", estimate portions and log them with log_meal. For meals the user repeats, remember_meal once, then log_remembered_meal to relog in a single call.
- Timestamps are UTC ISO-8601. Daily and weekly summaries bucket by local day in the server's configured timezone.
- Log lab panels with log_lab_panel so every result lands atomically; biomarker status is computed server-side from reference and optimal ranges.
- correlate compares two metric series — set lag_buckets to surface next-day effects, e.g. today's protein against tomorrow's recovery.
- Tool errors return { code, message }; read the code, fix the input, and retry.`;

const toContent = (value: unknown): Array<{ type: 'text'; text: string }> => {
  if (value === undefined) return [{ type: 'text', text: '' }];
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
};

export const shapeOf = (schema: ZodTypeAny): ZodRawShape => {
  let current: ZodTypeAny | undefined = schema;
  while (current && !('shape' in current)) {
    current = (current as unknown as { _def?: { schema?: ZodTypeAny } })._def?.schema;
  }
  return (current as unknown as { shape?: ZodRawShape } | undefined)?.shape ?? {};
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
      { capabilities: { tools: { listChanged: true } }, instructions: INSTRUCTIONS },
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
            if (err instanceof ZodError) {
              const detail = err.issues
                .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
                .join('; ');
              return errorContent('invalid_input', detail);
            }
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
