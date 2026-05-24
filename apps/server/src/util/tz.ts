const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (tz: string): Intl.DateTimeFormat => {
  const cached = FORMATTERS.get(tz);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  FORMATTERS.set(tz, fmt);
  return fmt;
};

export const toLocalDate = (iso: string, tz: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid timestamp: ${iso}`);
  }
  const parts = getFormatter(tz).formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    else if (p.type === 'month') month = p.value;
    else if (p.type === 'day') day = p.value;
  }
  return `${year}-${month}-${day}`;
};

const HOUR_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const getHourFormatter = (tz: string): Intl.DateTimeFormat => {
  const cached = HOUR_FORMATTERS.get(tz);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  });
  HOUR_FORMATTERS.set(tz, fmt);
  return fmt;
};

export const localHour = (iso: string, tz: string): number => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid timestamp: ${iso}`);
  const formatted = getHourFormatter(tz).format(date);
  return Number.parseInt(formatted, 10);
};

export const deriveMealType = (
  iso: string,
  tz: string,
): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
  const hour = localHour(iso, tz);
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
};

export const nowIso = (): string => new Date().toISOString();

export const isoDateRange = (date: string, tz: string): { startIso: string; endIso: string } => {
  const naive = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(naive.getTime())) throw new Error(`invalid date: ${date}`);
  const offsetMs =
    naive.getTime() - new Date(naive.toLocaleString('en-US', { timeZone: tz })).getTime();
  const start = new Date(naive.getTime() + offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};
