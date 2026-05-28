const WORD_RE = /[\p{L}\p{N}]+/gu;

export const normalizeTokens = (input: string): string[] =>
  input.toLowerCase().match(WORD_RE) ?? [];

export const buildFtsMatch = (tokens: string[]): string =>
  tokens.map((t) => `"${t}"*`).join(' OR ');

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
};

const FUZZY_MIN_LEN = 3;
const FUZZY_MIN_RATIO = 0.6;

// Likelihood that query token `q` refers to name/brand token `t`, in [0, 1].
const tokenSimilarity = (q: string, t: string): number => {
  if (q === t) return 1;
  if (t.startsWith(q)) return 0.9;
  if (q.startsWith(t)) return 0.7;
  if (t.includes(q) || q.includes(t)) return 0.6;
  if (Math.min(q.length, t.length) < FUZZY_MIN_LEN) return 0;
  const ratio = 1 - levenshtein(q, t) / Math.max(q.length, t.length);
  return ratio >= FUZZY_MIN_RATIO ? ratio * 0.75 : 0;
};

const BRAND_WEIGHT = 0.6;
// Label precision (how much of the matched label the query consumed) is a small
// tiebreak, not a primary factor — enough to edge an exact short name above a
// longer superset, too small to punish a generic query against a specific food.
const PRECISION_WEIGHT = 0.1;

// Results below this are not real matches and are dropped — this is what makes a
// query whose content words match nothing ("dm red lentil pasta" with no such food)
// return nothing instead of the highest-scoring piece of noise.
export const RELEVANCE_FLOOR = 0.2;
// When the top hit is this strong it's effectively exact; trim everything below
// TAIL_FRACTION of it so a clear winner doesn't drag a loose tail along.
export const CLEAR_WINNER_SCORE = 0.85;
export const TAIL_FRACTION = 0.6;
// A local hit at least this good means we needn't consult USDA to fill out results —
// padding to `limit` with remote noise is what "grabbed garbage" before.
export const STRONG_MATCH_SCORE = 0.6;

export const parseAliases = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

export type Scorable = { name: string; brand: string | null; aliases?: string | null };

// Score the query against one label. `core` defines the label (a name or an alias);
// `aux` (brand) tokens help coverage at a discount but don't count toward precision.
//
//   coverage     = mean best-similarity across query tokens
//   completeness = fraction of query tokens that matched at all
//
// coverage × completeness is the anti-false-positive core: a query where most tokens
// find nothing (the cross-language "1 of 4 matched" case) collapses toward zero, so
// no amount of name-shortness can lift it over the relevance floor.
const scoreLabel = (queryTokens: string[], core: string[], aux: string[] = []): number => {
  if (core.length === 0 && aux.length === 0) return 0;
  let coverageSum = 0;
  let matched = 0;
  const usedCore = new Set<number>();
  for (const q of queryTokens) {
    let best = 0;
    let bestCore = -1;
    core.forEach((t, i) => {
      const s = tokenSimilarity(q, t);
      if (s > best) {
        best = s;
        bestCore = i;
      }
    });
    for (const t of aux) {
      const s = tokenSimilarity(q, t) * BRAND_WEIGHT;
      if (s > best) {
        best = s;
        bestCore = -1;
      }
    }
    coverageSum += best;
    if (best > 0) {
      matched += 1;
      if (bestCore >= 0) usedCore.add(bestCore);
    }
  }
  const coverage = coverageSum / queryTokens.length;
  const completeness = matched / queryTokens.length;
  const precision = core.length === 0 ? 0 : usedCore.size / core.length;
  return coverage * completeness * (1 - PRECISION_WEIGHT) + precision * PRECISION_WEIGHT;
};

export const scoreFood = (queryTokens: string[], food: Scorable): number => {
  if (queryTokens.length === 0) return 0;
  let best = scoreLabel(queryTokens, normalizeTokens(food.name), normalizeTokens(food.brand ?? ''));
  for (const alias of parseAliases(food.aliases)) {
    best = Math.max(best, scoreLabel(queryTokens, normalizeTokens(alias)));
  }
  return best;
};

// True when the query is the food's name, "brand name", or one of its aliases
// verbatim (token-for-token). Lets a migration trust a hit without re-checking.
export const isExactMatch = (queryTokens: string[], food: Scorable): boolean => {
  if (queryTokens.length === 0) return false;
  const q = queryTokens.join(' ');
  if (q === normalizeTokens(food.name).join(' ')) return true;
  if (food.brand && q === normalizeTokens(`${food.brand} ${food.name}`).join(' ')) return true;
  return parseAliases(food.aliases).some((a) => q === normalizeTokens(a).join(' '));
};
