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
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

const correlationTone = (r: number | null): 'ok' | 'warn' | 'bad' | 'default' => {
  if (r === null) return 'default';
  const abs = Math.abs(r);
  if (abs >= 0.5) return 'ok';
  if (abs >= 0.3) return 'warn';
  return 'bad';
};

const correlationLabel = (r: number | null): string => {
  if (r === null) return 'not enough data';
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
  <div className="rounded-lg border border-kumo-line bg-kumo-elevated px-4 py-3">
    <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-kumo-subtle">
      {label}
    </div>
    <div
      className={cn(
        'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
        tone === 'ok' && 'text-kumo-success',
        tone === 'warn' && 'text-kumo-warning',
        tone === 'bad' && 'text-kumo-danger',
      )}
    >
      {value}
    </div>
    {sub ? <div className="mt-0.5 text-[11px] text-kumo-subtle">{sub}</div> : null}
  </div>
);

const ChipToggle = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex h-9 w-full rounded-lg border border-kumo-line bg-kumo-elevated p-1"
  >
    {options.map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 rounded-md px-2.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus',
            active
              ? 'bg-kumo-base text-kumo-default ring-1 ring-kumo-line'
              : 'text-kumo-subtle hover:text-kumo-default',
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
  <div className="space-y-3 rounded-lg border border-kumo-line bg-kumo-tint p-4">
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'grid h-5 w-5 place-items-center rounded-md text-[10px] font-semibold',
          badgeColor === 'primary'
            ? 'bg-kumo-info-tint text-kumo-brand'
            : 'bg-kumo-success-tint text-kumo-success',
        )}
        aria-hidden="true"
      >
        {label}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-kumo-subtle">
        Series {label}
      </span>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Source" htmlFor={`spec-${label}-source`}>
        <Select
          id={`spec-${label}-source`}
          value={spec.source}
          onChange={(e) =>
            onChange({ ...spec, source: e.target.value, field: fieldsFor(e.target.value)[0] ?? '' })
          }
        >
          {sources.map((s) => (
            <option key={s.source} value={s.source}>
              {s.source}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Field" htmlFor={`spec-${label}-field`}>
        <Select
          id={`spec-${label}-field`}
          value={spec.field}
          onChange={(e) => onChange({ ...spec, field: e.target.value })}
        >
          {fieldsFor(spec.source).map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Aggregation" htmlFor={`spec-${label}-agg`}>
        <Select
          id={`spec-${label}-agg`}
          value={spec.agg}
          onChange={(e) => onChange({ ...spec, agg: e.target.value })}
        >
          {AGGS.map((agg) => (
            <option key={agg} value={agg}>
              {agg}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Filter" htmlFor={`spec-${label}-filter`}>
        <Input
          id={`spec-${label}-filter`}
          placeholder="e.g. biomarker=Glucose"
          value={spec.filter}
          onChange={(e) => onChange({ ...spec, filter: e.target.value })}
        />
      </FormField>
    </div>
  </div>
);

const Explainer = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-kumo-brand" aria-hidden="true" />
        How Insights works
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 text-sm text-kumo-subtle">
      <p>
        Pick any two time series — calories, sleep score, HRV, hydration, labs — and we compute
        the{' '}
        <span className="font-medium text-kumo-default">correlation</span> over a date range. The
        result is a number{' '}
        <span className="font-mono text-kumo-default">r ∈ [−1, 1]</span> telling you how tightly
        the two move together.
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        <li className="rounded-md border border-kumo-line bg-kumo-elevated px-3 py-2 text-xs">
          <span className="font-semibold text-kumo-success">|r| ≥ 0.5</span> · moves together a lot
        </li>
        <li className="rounded-md border border-kumo-line bg-kumo-elevated px-3 py-2 text-xs">
          <span className="font-semibold text-kumo-warning">0.3 – 0.5</span> · weak link
        </li>
        <li className="rounded-md border border-kumo-line bg-kumo-elevated px-3 py-2 text-xs">
          <span className="font-semibold text-kumo-danger">&lt; 0.3</span> · essentially unrelated
        </li>
      </ul>
      <p className="text-xs">
        Use <span className="font-medium text-kumo-default">lag</span> when one signal should
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
  const sources = metrics.data ?? [];

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
                <Lightbulb className="h-4 w-4 text-kumo-warning" aria-hidden="true" /> Quick
                examples
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {visibleExamples.map((ex) => (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => applyExample(ex)}
                    className="group flex flex-col items-start gap-1 rounded-lg border border-kumo-line bg-kumo-elevated p-3 text-left transition-[transform,border-color] hover:-translate-y-px hover:border-kumo-strong focus-visible:-translate-y-px focus-visible:border-kumo-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-kumo-default">
                      {ex.title}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3 w-3 -translate-x-1 opacity-0 transition-[transform,opacity] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                      />
                    </span>
                    <span className="text-xs text-kumo-subtle">{ex.question}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[480px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-kumo-brand" aria-hidden="true" /> Configure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <SpecPicker
                  label="A"
                  badgeColor="primary"
                  spec={a}
                  onChange={setA}
                  sources={sources}
                  fieldsFor={fieldsFor}
                />
                <SpecPicker
                  label="B"
                  badgeColor="ok"
                  spec={b}
                  onChange={setB}
                  sources={sources}
                  fieldsFor={fieldsFor}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Start" htmlFor="i-start">
                    <Input
                      id="i-start"
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </FormField>
                  <FormField label="End" htmlFor="i-end">
                    <Input
                      id="i-end"
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </FormField>
                </div>
                <FormField label="Bucket size">
                  <ChipToggle
                    value={bucket}
                    options={BUCKETS}
                    onChange={setBucket}
                    label="Bucket size"
                  />
                </FormField>
                <FormField
                  label="Method"
                  description="Pearson assumes linear; Spearman is rank-based and robust to outliers."
                >
                  <ChipToggle
                    value={method}
                    options={METHODS}
                    onChange={setMethod}
                    label="Correlation method"
                  />
                </FormField>
                <FormField
                  label={`Lag (in ${bucket}s)`}
                  htmlFor="i-lag"
                  description="Positive lag shifts A back, so it tests whether A leads B."
                >
                  <Input
                    id="i-lag"
                    type="number"
                    inputMode="numeric"
                    value={lag}
                    onChange={(e) => setLag(Number(e.target.value) || 0)}
                  />
                </FormField>
                <Button type="submit" className="w-full" disabled={run.isPending}>
                  {run.isPending ? <Spinner /> : 'Compute correlation'}
                </Button>
                {run.isError ? (
                  <p className="text-xs text-kumo-danger" role="alert">
                    {(run.error as Error).message}
                  </p>
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
                <div className="t-panel-reveal space-y-5" key={run.submittedAt}>
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
                    <div className="rounded-lg border border-kumo-line bg-kumo-elevated p-2 sm:p-3">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid
                            stroke="var(--color-kumo-line)"
                            strokeDasharray="2 4"
                            vertical={false}
                            opacity={0.6}
                          />
                          <XAxis
                            dataKey="bucket"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            stroke="var(--text-color-kumo-subtle)"
                            tickMargin={6}
                          />
                          <YAxis
                            yAxisId="a"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            stroke="var(--color-kumo-brand)"
                            width={36}
                          />
                          <YAxis
                            yAxisId="b"
                            orientation="right"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            stroke="var(--color-kumo-success)"
                            width={36}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--color-kumo-base)',
                              border: '1px solid var(--color-kumo-line)',
                              borderRadius: 10,
                              fontSize: 12,
                            }}
                            labelStyle={{
                              color: 'var(--text-color-kumo-default)',
                              fontWeight: 500,
                            }}
                            itemStyle={{ color: 'var(--text-color-kumo-subtle)' }}
                            cursor={{
                              stroke: 'var(--color-kumo-line)',
                              strokeDasharray: '3 3',
                            }}
                          />
                          <Line
                            yAxisId="a"
                            type="monotone"
                            dataKey="a"
                            name={`${a.source}.${a.field}`}
                            stroke="var(--color-kumo-brand)"
                            dot={false}
                            strokeWidth={2}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            yAxisId="b"
                            type="monotone"
                            dataKey="b"
                            name={`${b.source}.${b.field}`}
                            stroke="var(--color-kumo-success)"
                            dot={false}
                            strokeWidth={2}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-kumo-subtle">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-kumo-brand"
                          />{' '}
                          {a.source}.{a.field}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-kumo-success"
                          />{' '}
                          {b.source}.{b.field}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {run.data.r !== null && run.data.n >= 7 ? (
                    <p className="text-xs text-kumo-subtle">
                      Reading: {a.source}.{a.field} shows a{' '}
                      <span className="font-medium text-kumo-default">
                        {correlationLabel(run.data.r)}
                      </span>{' '}
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
