export type Tone = 'default' | 'ok' | 'warn' | 'bad';

// Map a 0–100 score to a status tone: `good`+ is ok, `ok`+ is warn, below is bad,
// null is neutral. Whoop-style cutoffs differ per metric, so callers pass thresholds.
export const scoreTone = (score: number | null | undefined, good: number, ok: number): Tone => {
  if (score == null) return 'default';
  if (score >= good) return 'ok';
  if (score >= ok) return 'warn';
  return 'bad';
};
