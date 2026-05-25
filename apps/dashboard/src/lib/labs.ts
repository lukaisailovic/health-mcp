export const STATUS_VARIANT = {
  optimal: 'ok',
  in_ref: 'muted',
  out_of_ref: 'bad',
  unknown: 'outline',
} as const;

export const STATUS_LABEL = {
  optimal: 'optimal',
  in_ref: 'in range',
  out_of_ref: 'out of range',
  unknown: 'unknown',
} as const;

export type BiomarkerStatus = keyof typeof STATUS_VARIANT;

const within = (v: number, low: number | null, high: number | null): boolean =>
  (low == null || v >= low) && (high == null || v <= high);

const outside = (v: number, low: number | null, high: number | null): boolean =>
  (low != null && v < low) || (high != null && v > high);

export const classifyValue = (
  v: number,
  refLow: number | null,
  refHigh: number | null,
  optLow: number | null,
  optHigh: number | null,
): BiomarkerStatus => {
  const hasOpt = optLow != null || optHigh != null;
  const hasRef = refLow != null || refHigh != null;
  if (hasOpt && within(v, optLow, optHigh)) return 'optimal';
  if (hasRef) return outside(v, refLow, refHigh) ? 'out_of_ref' : 'in_ref';
  return hasOpt ? 'out_of_ref' : 'unknown';
};
