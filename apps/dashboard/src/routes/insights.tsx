import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { daysAgoIso, fmtNum, todayIso } from '@/lib/format';

const AGGS = ['sum', 'avg', 'min', 'max', 'latest', 'forward_fill'] as const;

type SpecState = { source: string; field: string; agg: string; filter: string };

const defaultA: SpecState = { source: 'intake', field: 'kcal', agg: 'sum', filter: '' };
const defaultB: SpecState = { source: 'wearable_readiness', field: 'score', agg: 'avg', filter: '' };

const parseFilter = (raw: string): Record<string, string> | undefined => {
  if (!raw.trim()) return undefined;
  const out: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
};

const selectClass =
  't-input h-9 w-full rounded-md border border-input bg-surface px-2 text-sm shadow-soft transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const correlationTone = (r: number | null): 'ok' | 'warn' | 'bad' | 'default' => {
  if (r === null) return 'default';
  const abs = Math.abs(r);
  if (abs >= 0.5) return 'ok';
  if (abs >= 0.3) return 'warn';
  return 'bad';
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad' | 'default';
}) => (
  <div className="rounded-lg border bg-surface px-4 py-3">
    <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
      {label}
    </div>
    <div
      className={cn(
        'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
        tone === 'ok' && 'text-ok',
        tone === 'warn' && 'text-warn',
        tone === 'bad' && 'text-bad',
      )}
    >
      {value}
    </div>
  </div>
);

const Insights = () => {
  const metrics = useQuery({
    queryKey: ['correlate', 'metrics'],
    queryFn: () => api.correlate.metrics(),
  });

  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const [start, setStart] = useState(daysAgoIso(30));
  const [end, setEnd] = useState(todayIso());
  const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day');
  const [method, setMethod] = useState<'pearson' | 'spearman'>('pearson');
  const [lag, setLag] = useState(0);

  const run = useMutation({
    mutationFn: api.correlate.run,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run.mutate({
      a: { source: a.source, field: a.field, agg: a.agg, filter: parseFilter(a.filter) },
      b: { source: b.source, field: b.field, agg: b.agg, filter: parseFilter(b.filter) },
      range: { start, end },
      bucket,
      lag_buckets: lag,
      method,
    });
  };

  const fieldsFor = (source: string): string[] =>
    metrics.data?.find((m) => m.source === source)?.fields ?? [];

  const chartData = useMemo(() => run.data?.pairs ?? [], [run.data]);
  const rTone = correlationTone(run.data?.r ?? null);

  return (
    <>
      <PageHeader
        title="Insights"
        description="Correlate any two time series — intake, wearables, labs — over a range. Pearson or Spearman."
      />
      <div className="grid gap-4 xl:grid-cols-[440px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Configure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <SpecPicker
                label="A"
                spec={a}
                onChange={setA}
                sources={metrics.data ?? []}
                fieldsFor={fieldsFor}
              />
              <SpecPicker
                label="B"
                spec={b}
                onChange={setB}
                sources={metrics.data ?? []}
                fieldsFor={fieldsFor}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>start</Label>
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>end</Label>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>bucket</Label>
                  <select
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value as 'day' | 'week' | 'month')}
                    className={selectClass}
                  >
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>method</Label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as 'pearson' | 'spearman')}
                    className={selectClass}
                  >
                    <option value="pearson">pearson</option>
                    <option value="spearman">spearman</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>lag (buckets)</Label>
                  <Input
                    type="number"
                    value={lag}
                    onChange={(e) => setLag(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={run.isPending}>
                {run.isPending ? <Spinner /> : 'Compute'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!run.data ? (
              <Empty
                icon={Sparkles}
                title="No result yet"
                description="Configure two series on the left and click compute."
              />
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <Stat
                    label={`r (${run.data.method})`}
                    value={run.data.r === null ? '—' : fmtNum(run.data.r, 3)}
                    tone={rTone}
                  />
                  <Stat label="n" value={String(run.data.n)} />
                  <Stat
                    label="lag"
                    value={`${run.data.lag_buckets} ${run.data.bucket}`}
                  />
                </div>
                {chartData.length > 0 ? (
                  <div className="rounded-lg border bg-surface p-3">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid
                          stroke="hsl(var(--border))"
                          strokeDasharray="2 4"
                          vertical={false}
                          opacity={0.6}
                        />
                        <XAxis
                          dataKey="bucket"
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          stroke="hsl(var(--muted-foreground))"
                          tickMargin={6}
                        />
                        <YAxis
                          yAxisId="a"
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          stroke="hsl(var(--primary))"
                          width={36}
                        />
                        <YAxis
                          yAxisId="b"
                          orientation="right"
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          stroke="hsl(var(--ok))"
                          width={36}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 10,
                            boxShadow: 'var(--shadow-lift)',
                            fontSize: 12,
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
                          itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                          cursor={{
                            stroke: 'hsl(var(--border-strong))',
                            strokeDasharray: '3 3',
                          }}
                        />
                        <Line
                          yAxisId="a"
                          type="monotone"
                          dataKey="a"
                          name={`${a.source}.${a.field}`}
                          stroke="hsl(var(--primary))"
                          dot={false}
                          strokeWidth={2}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="b"
                          type="monotone"
                          dataKey="b"
                          name={`${b.source}.${b.field}`}
                          stroke="hsl(var(--ok))"
                          dot={false}
                          strokeWidth={2}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

const SpecPicker = ({
  label,
  spec,
  onChange,
  sources,
  fieldsFor,
}: {
  label: string;
  spec: SpecState;
  onChange: (s: SpecState) => void;
  sources: Array<{ source: string; fields: string[] }>;
  fieldsFor: (source: string) => string[];
}) => (
  <div className="space-y-2 rounded-lg border bg-surface-2 p-3">
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/15 text-[10px] font-semibold text-primary">
        {label}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Series
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <select
        value={spec.source}
        onChange={(e) =>
          onChange({ ...spec, source: e.target.value, field: fieldsFor(e.target.value)[0] ?? '' })
        }
        className={selectClass}
      >
        {sources.map((s) => (
          <option key={s.source} value={s.source}>
            {s.source}
          </option>
        ))}
      </select>
      <select
        value={spec.field}
        onChange={(e) => onChange({ ...spec, field: e.target.value })}
        className={selectClass}
      >
        {fieldsFor(spec.source).map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select
        value={spec.agg}
        onChange={(e) => onChange({ ...spec, agg: e.target.value })}
        className={selectClass}
      >
        {AGGS.map((agg) => (
          <option key={agg} value={agg}>
            {agg}
          </option>
        ))}
      </select>
      <Input
        placeholder="filter (e.g. biomarker=Glucose)"
        value={spec.filter}
        onChange={(e) => onChange({ ...spec, filter: e.target.value })}
      />
    </div>
  </div>
);

export const Route = createFileRoute('/insights')({ component: Insights });
