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
