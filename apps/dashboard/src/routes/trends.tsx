import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { daysAgoIso, fmtNum, todayIso } from '@/lib/format';

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const ChartCard = ({
  title,
  data,
  field,
  color,
  unit,
}: {
  title: string;
  data: Array<{ date: string; value: number | null }>;
  field?: string;
  color: string;
  unit?: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>
        {title}
        {field ? <span className="ml-1 text-xs font-normal text-muted-foreground">{field}</span> : null}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {data.length === 0 ? (
        <Empty title="No data" />
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              fontSize={10}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" width={36} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v: number) => [`${fmtNum(v, 1)}${unit ? ` ${unit}` : ''}`, title]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
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
    queryFn: () => api.weight.list({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z`, limit: 365 }),
  });
  const readiness = useQuery({
    queryKey: ['readiness', start, end],
    queryFn: () => api.wearables.readiness({ start, end }),
  });
  const sleep = useQuery({
    queryKey: ['sleep', start, end],
    queryFn: () => api.wearables.sleep({ start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z` }),
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
        description={`Last ${days} days · ${start} → ${end}`}
        actions={
          <div className="inline-flex rounded-md border bg-card p-0.5">
            {RANGES.map((r) => (
              <Button
                key={r.label}
                size="sm"
                variant={days === r.days ? 'default' : 'ghost'}
                className={cn('h-7 px-3 text-xs', days === r.days && 'shadow-sm')}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />
      {range.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="kcal" data={kcal} color="hsl(var(--primary))" />
          <ChartCard title="protein" data={protein} color="hsl(var(--ok))" unit="g" />
          <ChartCard title="carbs" data={carbs} color="hsl(var(--warn))" unit="g" />
          <ChartCard title="fat" data={fat} color="hsl(var(--bad))" unit="g" />
          <ChartCard title="weight" data={weights} color="hsl(var(--primary))" unit="kg" />
          <ChartCard title="recovery" data={recoveries} color="hsl(var(--ok))" />
          <ChartCard title="sleep score" data={sleeps} color="hsl(var(--primary))" />
        </div>
      )}
    </>
  );
};

export const Route = createFileRoute('/trends')({ component: Trends });
