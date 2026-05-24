import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight, HelpCircle, Lightbulb, Sparkles } from 'lucide-react';
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
const BUCKETS = ['day', 'week', 'month'] as const;
const METHODS = ['pearson', 'spearman'] as const;

type Bucket = (typeof BUCKETS)[number];
type Method = (typeof METHODS)[number];
type SpecState = { source: string; field: string; agg: string; filter: string };

const DEFAULT_A: SpecState = { source: 'intake', field: 'kcal', agg: 'sum', filter: '' };
const DEFAULT_B: SpecState = { source: 'wearable_readiness', field: 'score', agg: 'avg', filter: '' };

type Example = {
  title: string;
  question: string;
  a: { source: string; field: string; agg: string };
  b: { source: string; field: string; agg: string };
  lag: number;
  bucket?: Bucket;
};

const EXAMPLES: Example[] = [
  {
    title: 'Calories → sleep',
    question: 'Do heavier days disturb sleep that night?',
    a: { source: 'intake', field: 'kcal', agg: 'sum' },
    b: { source: 'wearable_sleep', field: 'score', agg: 'avg' },
    lag: 0,
  },
  {
    title: 'Protein → recovery',
    question: 'Does protein intake track with next-day recovery?',
    a: { source: 'intake', field: 'protein_g', agg: 'sum' },
    b: { source: 'wearable_readiness', field: 'score', agg: 'avg' },
    lag: 1,
  },
  {
    title: 'Hydration → HRV',
    question: 'Does drinking more water move HRV?',
    a: { source: 'hydration', field: 'ml', agg: 'sum' },
    b: { source: 'wearable_readiness', field: 'hrv_rmssd', agg: 'avg' },
    lag: 0,
  },
  {
    title: 'Carbs → weight (weekly)',
    question: 'Do weekly carbs trend with weight?',
    a: { source: 'intake', field: 'carb_g', agg: 'sum' },
    b: { source: 'weight', field: 'kg', agg: 'avg' },
    lag: 0,
    bucket: 'week',
  },
];

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

const correlationLabel = (r: number | null): string => {
  if (r === null) return 'Not enough data';
  const abs = Math.abs(r);
  const direction = r >= 0 ? 'positive' : 'negative';
  if (abs >= 0.7) return `strong ${direction}`;
  if (abs >= 0.5) return `moderate ${direction}`;
  if (abs >= 0.3) return `weak ${direction}`;
  return 'negligible';
};

const Stat = ({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad' | 'default';
  sub?: string;
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
    {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
  </div>
);

const ChipToggle = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) => (
  <div className="inline-flex w-full rounded-md border bg-surface p-0.5 shadow-soft">
    {options.map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 rounded-[5px] px-2.5 py-1 text-xs font-medium capitalize transition-colors',
            active
              ? 'bg-card text-foreground shadow-soft ring-1 ring-foreground/5 dark:ring-white/5'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

const SpecPicker = ({
  label,
  badgeColor,
  spec,
  onChange,
  sources,
  fieldsFor,
}: {
  label: string;
  badgeColor: 'primary' | 'ok';
  spec: SpecState;
  onChange: (s: SpecState) => void;
  sources: Array<{ source: string; fields: string[] }>;
  fieldsFor: (source: string) => string[];
}) => (
  <div className="space-y-2 rounded-lg border bg-surface-2 p-3">
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'grid h-5 w-5 place-items-center rounded-md text-[10px] font-semibold',
          badgeColor === 'primary' ? 'bg-primary/15 text-primary' : 'bg-ok-bg text-ok',
        )}
      >
        {label}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Series {label}
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

const Explainer = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        How Insights works
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm text-muted-foreground">
      <p>
        Pick any two time series — calories, sleep score, HRV, hydration, labs — and we compute the{' '}
        <span className="font-medium text-foreground">correlation</span> over a date range.
        The result is a number{' '}
        <span className="font-mono text-foreground">r ∈ [−1, 1]</span> telling you how tightly the two
        move together.
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        <li className="rounded-md border bg-surface px-3 py-2 text-xs">
          <span className="font-semibold text-ok">|r| ≥ 0.5</span> · moves together a lot
        </li>
        <li className="rounded-md border bg-surface px-3 py-2 text-xs">
          <span className="font-semibold text-warn">0.3 – 0.5</span> · weak link
        </li>
        <li className="rounded-md border bg-surface px-3 py-2 text-xs">
          <span className="font-semibold text-bad">&lt; 0.3</span> · essentially unrelated
        </li>
      </ul>
      <p className="text-xs">
        Use <span className="font-medium text-foreground">lag</span> when one signal should
        precede the other — e.g. yesterday&apos;s calories vs. today&apos;s sleep is lag 1 (day).
        Correlation is not causation; treat this as a hint, not a verdict.
      </p>
    </CardContent>
  </Card>
);

const Insights = () => {
  const metrics = useQuery({
    queryKey: ['correlate', 'metrics'],
    queryFn: () => api.correlate.metrics(),
  });

  const [a, setA] = useState(DEFAULT_A);
  const [b, setB] = useState(DEFAULT_B);
  const [start, setStart] = useState(daysAgoIso(30));
  const [end, setEnd] = useState(todayIso());
  const [bucket, setBucket] = useState<Bucket>('day');
  const [method, setMethod] = useState<Method>('pearson');
  const [lag, setLag] = useState(0);

  const run = useMutation({
    mutationFn: api.correlate.run,
  });

  const fieldsFor = (source: string): string[] =>
    metrics.data?.find((m) => m.source === source)?.fields ?? [];

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

  const applyExample = (ex: Example) => {
    setA({ ...ex.a, filter: '' });
    setB({ ...ex.b, filter: '' });
    setLag(ex.lag);
    if (ex.bucket) setBucket(ex.bucket);
    run.mutate({
      a: { ...ex.a },
      b: { ...ex.b },
      range: { start, end },
      bucket: ex.bucket ?? bucket,
      lag_buckets: ex.lag,
      method,
    });
  };

  const visibleExamples = useMemo(() => {
    if (!metrics.data) return EXAMPLES;
    const hasField = (source: string, field: string): boolean =>
      metrics.data.find((m) => m.source === source)?.fields.includes(field) ?? false;
    return EXAMPLES.filter(
      (ex) => hasField(ex.a.source, ex.a.field) && hasField(ex.b.source, ex.b.field),
    );
  }, [metrics.data]);

  const chartData = run.data?.pairs ?? [];
  const rTone = correlationTone(run.data?.r ?? null);

  return (
    <>
      <PageHeader
        title="Insights"
        description="Correlate any two time series — intake, wearables, labs — over a date range."
      />
      <div className="grid gap-4">
        <Explainer />

        {visibleExamples.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warn" /> Quick examples
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {visibleExamples.map((ex) => (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => applyExample(ex)}
                    className="group flex flex-col items-start gap-1 rounded-lg border bg-surface p-3 text-left transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-lift"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {ex.title}
                      <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                    <span className="text-xs text-muted-foreground">{ex.question}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[440px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Configure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <SpecPicker
                  label="A"
                  badgeColor="primary"
                  spec={a}
                  onChange={setA}
                  sources={metrics.data ?? []}
                  fieldsFor={fieldsFor}
                />
                <SpecPicker
                  label="B"
                  badgeColor="ok"
                  spec={b}
                  onChange={setB}
                  sources={metrics.data ?? []}
                  fieldsFor={fieldsFor}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="i-start">Start</Label>
                    <Input
                      id="i-start"
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="i-end">End</Label>
                    <Input
                      id="i-end"
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Bucket size</Label>
                    <ChipToggle value={bucket} options={BUCKETS} onChange={setBucket} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Method</Label>
                    <ChipToggle value={method} options={METHODS} onChange={setMethod} />
                    <p className="text-[11px] text-muted-foreground">
                      Pearson assumes linear; Spearman is rank-based and robust to outliers.
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="i-lag">Lag (in {bucket}s)</Label>
                    <Input
                      id="i-lag"
                      type="number"
                      inputMode="numeric"
                      value={lag}
                      onChange={(e) => setLag(Number(e.target.value) || 0)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Positive lag shifts A back, so it tests whether A leads B.
                    </p>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={run.isPending}>
                  {run.isPending ? <Spinner /> : 'Compute correlation'}
                </Button>
                {run.isError ? (
                  <p className="text-xs text-bad">{(run.error as Error).message}</p>
                ) : null}
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
                  description="Pick an example above, or configure two series and hit compute."
                />
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat
                      label={`r (${run.data.method})`}
                      value={run.data.r === null ? '—' : fmtNum(run.data.r, 3)}
                      tone={rTone}
                      sub={correlationLabel(run.data.r)}
                    />
                    <Stat
                      label="n pairs"
                      value={String(run.data.n)}
                      sub={run.data.n < 7 ? 'low confidence' : `${bucket} buckets`}
                    />
                    <Stat
                      label="lag"
                      value={`${run.data.lag_buckets} ${run.data.bucket}`}
                      sub={run.data.lag_buckets === 0 ? 'same period' : 'A leads B'}
                    />
                  </div>
                  {chartData.length > 0 ? (
                    <div className="rounded-lg border bg-surface p-2 sm:p-3">
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
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary" /> {a.source}.{a.field}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-ok" /> {b.source}.{b.field}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {run.data.r !== null && run.data.n >= 7 ? (
                    <p className="text-xs text-muted-foreground">
                      Reading: {a.source}.{a.field} shows a{' '}
                      <span className="font-medium text-foreground">{correlationLabel(run.data.r)}</span>{' '}
                      relationship with {b.source}.{b.field}
                      {run.data.lag_buckets > 0
                        ? ` at lag ${run.data.lag_buckets} ${run.data.bucket}`
                        : ''}
                      .
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute('/insights')({ component: Insights });
