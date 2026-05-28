import { describe, expect, it } from 'vitest';
import { type Scorable, buildFtsMatch, normalizeTokens, scoreFood } from './food-search.js';

describe('normalizeTokens', () => {
  it('lowercases and splits on punctuation/whitespace', () => {
    expect(normalizeTokens('bbq (sauce)')).toEqual(['bbq', 'sauce']);
    expect(normalizeTokens('TexMex  BBQ-Sauce')).toEqual(['texmex', 'bbq', 'sauce']);
    expect(normalizeTokens('   ')).toEqual([]);
  });
});

describe('buildFtsMatch', () => {
  it('prefix-matches every token, OR-combined', () => {
    expect(buildFtsMatch(['tex', 'sauce'])).toBe('"tex"* OR "sauce"*');
  });
});

const sauce: Scorable = { name: 'TexMex BBQ Sauce', brand: null, source: 'manual' };

describe('scoreFood', () => {
  const score = (q: string) => scoreFood(normalizeTokens(q), sauce);

  it('matches every example query for "TexMex BBQ Sauce"', () => {
    for (const q of ['tex', 'tex bqq', 'bbq sauce', 'bbq (sauce)', 'Tex sauce']) {
      expect(score(q)).toBeGreaterThan(0);
    }
  });

  it('scores nothing when no token relates to the name', () => {
    expect(score('chicken breast')).toBe(0);
  });

  it('ranks a fully-specific name above a superset name', () => {
    const exact: Scorable = { name: 'BBQ Sauce', brand: null, source: 'manual' };
    const q = normalizeTokens('bbq sauce');
    expect(scoreFood(q, exact)).toBeGreaterThan(scoreFood(q, sauce));
  });

  it('tolerates a single-character typo in a word of 3+ chars', () => {
    expect(scoreFood(normalizeTokens('bqq'), sauce)).toBeGreaterThan(0);
  });
});
