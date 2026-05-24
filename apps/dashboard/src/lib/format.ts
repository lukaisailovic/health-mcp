import { format, formatRelative, parseISO } from 'date-fns';

export const fmtNum = (n: number | null | undefined, digits = 0): string => {
  if (n === null || n === undefined) return '—';
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const fmtDate = (iso: string, pattern = 'MMM d, yyyy'): string => {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
};

export const fmtTime = (iso: string): string => {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
};

export const fmtRelative = (iso: string, base = new Date()): string => {
  try {
    return formatRelative(parseISO(iso), base);
  } catch {
    return iso;
  }
};

export const todayIso = (): string => format(new Date(), 'yyyy-MM-dd');

export const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d, 'yyyy-MM-dd');
};

export const pct = (numerator: number, denominator: number | null): number => {
  if (denominator === null || denominator <= 0) return 0;
  return Math.min(1, Math.max(0, numerator / denominator));
};
