import { z } from 'zod';
import { type AnyToolDef, tool } from '../tool-registry.js';

export const buildDiscoverTool = (allTools: () => AnyToolDef[]) =>
  tool({
    name: 'discover_capabilities',
    description:
      'List available tool groups and tools (with descriptions and current enable status).',
    group: 'discovery',
    inputSchema: z.object({ group: z.string().optional() }),
    handler: (args, ctx) => {
      const a = args as { group?: string };
      const tools = allTools();
      const groups = new Map<
        string,
        { description: string; tools: { name: string; description: string; enabled: boolean }[] }
      >();
      const groupDescriptions: Record<string, string> = {
        food: 'Search and create foods.',
        intake: 'Log and query meals/intake entries.',
        recipe: 'Recipes (named blueprints).',
        batch: 'Cooked batches that deplete as they are eaten.',
        meal: 'Remembered meals — labelled re-loggable shortcuts.',
        hydration: 'Hydration logging.',
        weight: 'Body weight logging.',
        measurement: 'Body measurements (waist, chest, ...).',
        goal: 'Daily targets.',
        summary: 'Daily / weekly / range summaries.',
        biomarker: 'Biomarker catalog management.',
        lab: 'Lab panels and results.',
        wearable: 'Cross-provider wearable sleep / activity / readiness / daily.',
        whoop: 'Whoop-specific raw access.',
        discovery: 'Capability discovery.',
        system: 'Health and version probes.',
      };
      for (const t of tools) {
        const enabled = t.isAvailable ? t.isAvailable(ctx) : true;
        if (a.group && t.group !== a.group) continue;
        const desc = groupDescriptions[t.group] ?? '';
        const g = groups.get(t.group) ?? { description: desc, tools: [] };
        g.tools.push({ name: t.name, description: t.description, enabled });
        groups.set(t.group, g);
      }
      return Object.fromEntries(groups);
    },
  });

export const pingTool = tool({
  name: 'ping',
  description: 'Liveness probe. Returns { ok: true, time, tz }.',
  group: 'system',
  inputSchema: z.object({}),
  handler: (_args, ctx) => ({ ok: true, time: new Date().toISOString(), tz: ctx.config.tz }),
});
