import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type SeriesPoint, TrendArea } from '@/components/ui/chart';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
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
    <Card className="transition-shadow hover:shadow-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-0.5">
          <CardTitle className="capitalize">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">
            avg{' '}
            <span className="font-medium text-foreground tabular-nums">
              {avg !== null ? `${fmtNum(avg, 1)}${unit ? ` ${unit}` : ''}` : '—'}
            </span>
          </p>
        </div>
        <div className="text-right">
          <div
            className="text-xl font-semibold leading-none tabular-nums tracking-tight"
            style={{ color }}
          >
            {latest !== null ? fmtNum(latest, 1) : '—'}
          </div>
          {unit ? (
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {unit}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <Empty title="No data" description="Nothing logged in this range." />
        ) : (
          <TrendArea id={id} data={data} color={color} unit={unit} title={title} height={height} />
        )}
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
  <div className="inline-flex rounded-lg border bg-surface p-0.5 shadow-soft">
    {RANGES.map((r) => {
      const active = days === r.days;
      return (
        <button
          key={r.label}
          type="button"
          onClick={() => onChange(r.days)}
          className={cn(
            'inline-flex h-7 items-center justify-center rounded-md px-3 text-xs font-medium transition-all',
            active
              ? 'bg-card text-foreground shadow-soft ring-1 ring-foreground/5 dark:ring-white/5'
              : 'text-muted-foreground hover:text-foreground',
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
  });
  const weight = useQuery({
    queryKey: ['weight', 'range', start, end],
    queryFn: () =>
      api.weight.list({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z`, limit: 365 }),
  });
  const readiness = useQuery({
    queryKey: ['readiness', start, end],
    queryFn: () => api.wearables.readiness({ start, end }),
  });
  const sleep = useQuery({
    queryKey: ['sleep', start, end],
    queryFn: () =>
      api.wearables.sleep({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z` }),
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
            Last <span className="font-medium text-foreground">{days}</span> days ·{' '}
            <span className="font-mono text-xs">{start}</span> →{' '}
            <span className="font-mono text-xs">{end}</span>
          </span>
        }
        actions={<RangeToggle days={days} onChange={setDays} />}
      />
      {range.isLoading ? (
        <div className="grid place-items-center py-20">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard id="kcal" title="kcal" data={kcal} color="hsl(var(--primary))" />
          <ChartCard id="protein" title="protein" data={protein} color="hsl(var(--ok))" unit="g" />
          <ChartCard id="carbs" title="carbs" data={carbs} color="hsl(var(--warn))" unit="g" />
          <ChartCard id="fat" title="fat" data={fat} color="hsl(var(--bad))" unit="g" />
          <ChartCard id="weight" title="weight" data={weights} color="hsl(var(--primary))" unit="kg" />
          <ChartCard id="recovery" title="recovery" data={recoveries} color="hsl(var(--ok))" />
          <ChartCard
            id="sleep"
            title="sleep score"
            data={sleeps}
            color="hsl(var(--primary))"
          />
        </div>
      )}
    </>
  );
};

export const Route = createFileRoute('/trends')({ component: Trends });
