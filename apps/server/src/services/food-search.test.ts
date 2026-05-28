import { describe, expect, it } from 'vitest';
import {
  RELEVANCE_FLOOR,
  type Scorable,
  buildFtsMatch,
  isExactMatch,
  normalizeTokens,
  parseAliases,
  scoreFood,
} from './food-search.js';

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

describe('parseAliases', () => {
  it('parses a JSON string array and tolerates junk', () => {
    expect(parseAliases('["dm bio ketchup","whole egg"]')).toEqual(['dm bio ketchup', 'whole egg']);
    expect(parseAliases(null)).toEqual([]);
    expect(parseAliases('not json')).toEqual([]);
    expect(parseAliases('{"a":1}')).toEqual([]);
  });
});

const sauce: Scorable = { name: 'TexMex BBQ Sauce', brand: null };
const score = (q: string, food: Scorable) => scoreFood(normalizeTokens(q), food);

describe('scoreFood', () => {
  it('matches every example query for "TexMex BBQ Sauce"', () => {
    for (const q of ['tex', 'tex bqq', 'bbq sauce', 'bbq (sauce)', 'Tex sauce']) {
      expect(score(q, sauce)).toBeGreaterThan(0);
    }
  });

  it('scores nothing when no token relates to the name', () => {
    expect(score('chicken breast', sauce)).toBe(0);
  });

  it('ranks a fully-specific name above a superset name', () => {
    const exact: Scorable = { name: 'BBQ Sauce', brand: null };
    expect(score('bbq sauce', exact)).toBeGreaterThan(score('bbq sauce', sauce));
  });

  it('tolerates a single-character typo in a word of 3+ chars', () => {
    expect(score('bqq', sauce)).toBeGreaterThan(0);
  });

  it('does not let a single matched token carry a multi-word query (cross-language)', () => {
    // "dm" prefix-matches the brand-ish first token, but "red"/"lentil"/"pasta" find
    // nothing in the German name — this must stay below the floor so it is dropped,
    // not returned as the best (wrong) guess.
    const ketchup: Scorable = { name: 'dmBio Tomatenketchup', brand: null };
    expect(score('dm red lentil pasta', ketchup)).toBeLessThan(RELEVANCE_FLOOR);
  });

  it('scores an alias match as highly as a name match', () => {
    const pasta: Scorable = {
      name: 'dmBio Fusilli Rote Linsen',
      brand: null,
      aliases: '["dm red lentil pasta"]',
    };
    expect(score('dm red lentil pasta', pasta)).toBeGreaterThan(0.9);
  });
});

describe('isExactMatch', () => {
  const food: Scorable = { name: 'Egg White', brand: 'Generic', aliases: '["egg whites"]' };
  it('matches the name, the "brand name", and an alias verbatim', () => {
    expect(isExactMatch(normalizeTokens('egg white'), food)).toBe(true);
    expect(isExactMatch(normalizeTokens('Generic Egg White'), food)).toBe(true);
    expect(isExactMatch(normalizeTokens('egg whites'), food)).toBe(true);
  });
  it('is false for a partial or unrelated query', () => {
    expect(isExactMatch(normalizeTokens('egg'), food)).toBe(false);
    expect(isExactMatch(normalizeTokens('white bread'), food)).toBe(false);
  });
});
