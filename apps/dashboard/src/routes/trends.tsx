import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type SeriesPoint, TrendArea } from '@/components/ui/chart';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { daysAgoIso, fmtNum, todayIso } from '@/lib/format';

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

const summarize = (data: SeriesPoint[]): { latest: number | null; avg: number | null } => {
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return { latest: null, avg: null };
  return {
    latest: vals[vals.length - 1] ?? null,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
};

const ChartCard = ({
  id,
  title,
  data,
  color,
  unit,
  height = 200,
}: {
  id: string;
  title: string;
  data: SeriesPoint[];
  color: string;
  unit?: string;
  height?: number;
}) => {
  const { latest, avg } = useMemo(() => summarize(data), [data]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-0.5">
          <CardTitle className="capitalize">{title}</CardTitle>
          <p className="text-xs text-kumo-subtle">
            avg{' '}
            <span className="font-medium text-kumo-default tabular-nums">
              {avg !== null ? `${fmtNum(avg, 1)}${unit ? ` ${unit}` : ''}` : '—'}
            </span>
          </p>
        </div>
        <div className="min-w-[4.5rem] shrink-0 text-right">
          <div
            className="text-xl font-semibold leading-none tabular-nums tracking-tight"
            style={{ color }}
          >
            {latest !== null ? fmtNum(latest, 1) : '—'}
          </div>
          {unit ? (
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-kumo-subtle">
              {unit}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <TrendArea
          id={id}
          data={data}
          color={color}
          unit={unit}
          title={title}
          height={height}
        />
      </CardContent>
    </Card>
  );
};

const RangeToggle = ({
  days,
  onChange,
}: {
  days: number;
  onChange: (n: number) => void;
}) => (
  <div className="inline-flex rounded-md bg-kumo-fill p-0.5">
    {RANGES.map((r) => {
      const active = days === r.days;
      return (
        <button
          key={r.label}
          type="button"
          onClick={() => onChange(r.days)}
          className={cn(
            'inline-flex h-7 items-center justify-center rounded px-3 text-xs font-medium transition-colors',
            active
              ? 'bg-kumo-base text-kumo-default'
              : 'text-kumo-subtle hover:text-kumo-default',
          )}
        >
          {r.label}
        </button>
      );
    })}
  </div>
);

const Trends = () => {
  const [days, setDays] = useState(30);
  const start = daysAgoIso(days);
  const end = todayIso();

  const range = useQuery({
    queryKey: ['summary', 'range', start, end, 'day'],
    queryFn: () => api.summary.range({ start, end, bucket: 'day' }),
    placeholderData: keepPreviousData,
  });
  const weight = useQuery({
    queryKey: ['weight', 'range', start, end],
    queryFn: () =>
      api.weight.list({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z`, limit: 365 }),
    placeholderData: keepPreviousData,
  });
  const readiness = useQuery({
    queryKey: ['readiness', start, end],
    queryFn: () => api.wearables.readiness({ start, end }),
    placeholderData: keepPreviousData,
  });
  const sleep = useQuery({
    queryKey: ['sleep', start, end],
    queryFn: () =>
      api.wearables.sleep({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z` }),
    placeholderData: keepPreviousData,
  });

  const daysData = range.data?.days ?? [];
  const kcal = daysData.map((d) => ({ date: d.date, value: d.kcal }));
  const protein = daysData.map((d) => ({ date: d.date, value: d.protein_g }));
  const carbs = daysData.map((d) => ({ date: d.date, value: d.carb_g }));
  const fat = daysData.map((d) => ({ date: d.date, value: d.fat_g }));
  const weights = (weight.data ?? [])
    .slice()
    .reverse()
    .map((w) => ({ date: w.date, value: w.kg }));
  const recoveries = (readiness.data ?? [])
    .slice()
    .reverse()
    .map((r) => ({ date: r.date, value: r.score }));
  const sleeps = (sleep.data ?? [])
    .slice()
    .reverse()
    .map((s) => ({ date: s.start.slice(0, 10), value: s.score }));

  return (
    <>
      <PageHeader
        title="Trends"
        description={
          <span>
            Last <span className="font-medium text-kumo-default">{days}</span> days ·{' '}
            <span className="font-mono text-xs">{start}</span> →{' '}
            <span className="font-mono text-xs">{end}</span>
          </span>
        }
        actions={<RangeToggle days={days} onChange={setDays} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard id="kcal" title="kcal" data={kcal} color="var(--color-kumo-brand)" />
        <ChartCard id="protein" title="protein" data={protein} color="var(--color-kumo-success)" unit="g" />
        <ChartCard id="carbs" title="carbs" data={carbs} color="var(--color-kumo-warning)" unit="g" />
        <ChartCard id="fat" title="fat" data={fat} color="var(--color-kumo-danger)" unit="g" />
        <ChartCard id="weight" title="weight" data={weights} color="var(--color-kumo-brand)" unit="kg" />
        <ChartCard id="recovery" title="recovery" data={recoveries} color="var(--color-kumo-success)" />
        <ChartCard
          id="sleep"
          title="sleep score"
          data={sleeps}
          color="var(--color-kumo-brand)"
        />
      </div>
    </>
  );
};

export const Route = createFileRoute('/trends')({ component: Trends });
