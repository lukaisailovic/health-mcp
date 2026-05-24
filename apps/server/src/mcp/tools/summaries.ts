import { z } from 'zod';
import { dailySummary, rangeSummary, weeklySummary } from '../../services/summaries.js';
import { tool } from '../tool-registry.js';

export const summaryTools = [
  tool({
    name: 'daily_summary',
    description:
      'Daily intake totals + remaining vs goals. Optionally compare to yesterday or 7d average.',
    group: 'summary',
    inputSchema: z.object({
      date: z.string().optional(),
      compare_to: z.enum(['yesterday', '7d_avg']).optional(),
    }),
    handler: (args, ctx) => dailySummary(ctx, args),
  }),
  tool({
    name: 'weekly_summary',
    description: 'Last 7 days of intake totals.',
    group: 'summary',
    inputSchema: z.object({ week_starting: z.string().optional() }),
    handler: (args, ctx) => weeklySummary(ctx, args),
  }),
  tool({
    name: 'range_summary',
    description: 'Intake totals for a date range, bucketed by day or week.',
    group: 'summary',
    inputSchema: z.object({
      start: z.string(),
      end: z.string(),
      bucket: z.enum(['day', 'week']).optional(),
    }),
    handler: (args, ctx) => rangeSummary(ctx, args),
  }),
];
