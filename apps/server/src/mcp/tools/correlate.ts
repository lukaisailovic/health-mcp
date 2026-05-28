import { z } from 'zod';
import { correlate, isCorrelateAvailable, listCorrelateMetrics } from '../../services/correlate.js';
import { tool } from '../tool-registry.js';

const metricSpec = z.object({
  source: z.enum([
    'intake',
    'wearable_daily',
    'wearable_readiness',
    'wearable_sleep',
    'wearable_activity',
    'lab_results',
    'weight',
    'hydration',
    'measurement',
  ]),
  field: z.string().min(1),
  agg: z.enum(['sum', 'avg', 'min', 'max', 'latest', 'forward_fill']),
  filter: z.record(z.string()).optional(),
});

export const correlateTools = [
  tool({
    name: 'correlate',
    description:
      'Compute Pearson/Spearman correlation between two time series (intake, wearables, labs, weight, etc.) over a date range, optionally with a lag in buckets. Use list_correlate_metrics first to see valid sources and fields.',
    group: 'summary',
    inputSchema: z.object({
      a: metricSpec,
      b: metricSpec,
      range: z.object({ start: z.string(), end: z.string() }),
      bucket: z.enum(['day', 'week', 'month']).optional(),
      lag_buckets: z.number().int().optional(),
      method: z.enum(['pearson', 'spearman']).optional(),
    }),
    handler: (args, ctx) => correlate(ctx, args),
    isAvailable: (ctx) => isCorrelateAvailable(ctx),
  }),
  tool({
    name: 'list_correlate_metrics',
    description:
      'List the metric sources and fields callable by correlate(). Use this to discover what fields are valid on each source.',
    group: 'summary',
    inputSchema: z.object({}),
    handler: () => listCorrelateMetrics(),
    isAvailable: (ctx) => isCorrelateAvailable(ctx),
  }),
];
