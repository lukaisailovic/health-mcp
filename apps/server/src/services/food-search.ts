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

export type Scorable = { name: string; brand: string | null; source: string };

export const scoreFood = (queryTokens: string[], food: Scorable): number => {
  if (queryTokens.length === 0) return 0;
  const nameTokens = normalizeTokens(food.name);
  const brandTokens = normalizeTokens(food.brand ?? '');
  let coverage = 0;
  let matched = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const t of nameTokens) best = Math.max(best, tokenSimilarity(q, t));
    for (const t of brandTokens) best = Math.max(best, tokenSimilarity(q, t) * BRAND_WEIGHT);
    coverage += best;
    if (best > 0) matched += 1;
  }
  if (matched === 0) return 0;
  coverage /= queryTokens.length;
  const density = matched / Math.max(nameTokens.length, 1);
  let score = coverage * 0.8 + density * 0.2;
  if (matched === queryTokens.length) score += 0.1;
  if (food.source === 'manual') score += 0.05;
  return score;
};
