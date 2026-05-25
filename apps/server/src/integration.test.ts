import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHonoApp } from './http.js';
import { HealthMcpServer } from './mcp/server.js';
import { buildAllTools } from './mcp/tools/index.js';
import { closeCtx, makeTestCtx } from './test-utils.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('integration: REST + MCP tool registry', () => {
  it('GET /health returns auth_required and tz', async () => {
    const app = createHonoApp({ config: ctx.config, logger: ctx.logger, ctx, sdkVersion: '1.x' });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; tz: string; auth_required: boolean };
    expect(body.ok).toBe(true);
    expect(body.tz).toBe('UTC');
    expect(body.auth_required).toBe(false);
  });

  it('POST /api/meals creates a meal via REST', async () => {
    const app = createHonoApp({ config: ctx.config, logger: ctx.logger, ctx, sdkVersion: '1.x' });
    const foodRes = await app.request('/api/foods', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Egg',
        nutrients_per_100g: {
          kcal_per_100g: 155,
          protein_g_per_100g: 13,
          carb_g_per_100g: 1.1,
          fat_g_per_100g: 11,
        },
      }),
    });
    expect(foodRes.status).toBe(200);
    const food = (await foodRes.json()) as { id: string };

    const mealRes = await app.request('/api/meals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        meal_type: 'breakfast',
        components: [{ ref: 'food', food_id: food.id, grams: 100 }],
      }),
    });
    expect(mealRes.status).toBe(200);
    const meal = (await mealRes.json()) as {
      id: string;
      totals: { kcal: number };
      components: Array<{ kcal: number }>;
    };
    expect(meal.components[0]?.kcal).toBeCloseTo(155, 3);
    expect(meal.totals.kcal).toBeCloseTo(155, 3);

    const listRes = await app.request('/api/meals?limit=5');
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as unknown[];
    expect(list.length).toBe(1);
  });

  it('all tools register and capability gating filters wearable-dependent tools', () => {
    const tools = buildAllTools();
    const server = new HealthMcpServer({ tools, ctx });
    server.attach();
    // No wearable linked → wearable_sleep should be disabled, ping always enabled.
    const ping = tools.find((t) => t.name === 'ping');
    expect(ping).toBeDefined();
    const wsleep = tools.find((t) => t.name === 'wearable_sleep');
    expect(wsleep?.isAvailable?.(ctx)).toBe(false);
  });

  it('discover_capabilities returns groups', async () => {
    const tools = buildAllTools();
    const discover = tools.find((t) => t.name === 'discover_capabilities');
    expect(discover).toBeDefined();
    const groups = (await discover!.handler({}, ctx)) as Record<
      string,
      { tools: Array<{ name: string }> }
    >;
    expect(Object.keys(groups)).toContain('food');
    expect(Object.keys(groups)).toContain('meal');
    expect(Object.keys(groups)).toContain('biomarker');
  });
});
