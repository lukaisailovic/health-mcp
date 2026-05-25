import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { shapeOf } from './server.js';

describe('shapeOf', () => {
  it('returns the shape of a plain z.object', () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    expect(Object.keys(shapeOf(schema))).toEqual(['a', 'b']);
  });

  it('unwraps z.object().refine() so MCP gets the underlying shape', () => {
    const schema = z
      .object({ x: z.string().optional(), y: z.number().optional() })
      .refine((v) => Boolean(v.x) || Boolean(v.y), { message: 'one of x or y required' });
    expect(Object.keys(shapeOf(schema))).toEqual(['x', 'y']);
  });

  it('unwraps nested ZodEffects', () => {
    const schema = z
      .object({ a: z.string() })
      .refine(() => true)
      .superRefine(() => undefined);
    expect(Object.keys(shapeOf(schema))).toEqual(['a']);
  });

  it('returns empty shape for non-object schemas', () => {
    expect(shapeOf(z.string())).toEqual({});
  });
});
