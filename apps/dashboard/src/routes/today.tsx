import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Activity, Droplets, Flame, Heart, Moon, Scale, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { MacroRings } from '@/components/macro-rings';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtNum, fmtTime, todayIso } from '@/lib/format';

const HYDRATION_STEPS = [250, 500, 750];

const scoreTone = (
  score: number | null | undefined,
  good: number,
  ok: number,
): 'ok' | 'warn' | 'bad' | 'default' => {
  if (score == null) return 'default';
  if (score >= good) return 'ok';
  if (score >= ok) return 'warn';
  return 'bad';
};

const HydrationQuickAdd = () => {
  const qc = useQueryClient();
  const [custom, setCustom] = useState('');
  const log = useMutation({
    mutationFn: (ml: number) => api.hydration.log({ ml }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {HYDRATION_STEPS.map((ml) => (
        <Button
          key={ml}
          variant="outline"
          size="sm"
          disabled={log.isPending}
          onClick={() => log.mutate(ml)}
        >
          +{ml} ml
        </Button>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          placeholder="ml"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="h-8 w-24"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!custom || log.isPending}
          onClick={() => {
            const ml = Number(custom);
            if (Number.isFinite(ml) && ml > 0) {
              log.mutate(ml);
              setCustom('');
            }
          }}
        >
          add
        </Button>
      </div>
    </div>
  );
};

const ProgressBar = ({
  value,
  goal,
  color,
}: {
  value: number;
  goal: number | null;
  color: string;
}) => {
  const ratio = goal && goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-kumo-fill">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${ratio * 100}%`, background: color }}
      />
    </div>
  );
};

const formatDateLong = (iso: string): string =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const Today = () => {
  const qc = useQueryClient();
  const date = todayIso();
  const summary = useQuery({
    queryKey: ['summary', 'daily', date, '7d_avg'],
    queryFn: () => api.summary.daily({ date, compare_to: '7d_avg' }),
  });
  const intake = useQuery({
    queryKey: ['intake', date],
    queryFn: () => api.intake.list({ date }),
  });
  const recovery = useQuery({
    queryKey: ['wearables', 'readiness', date],
    queryFn: () => api.wearables.readiness({ date }),
  });
  const sleep = useQuery({
    queryKey: ['wearables', 'sleep', date],
    queryFn: () => api.wearables.sleep({ date }),
  });
  const weight = useQuery({
    queryKey: ['weight', date],
    queryFn: () => api.weight.list({ date, limit: 1 }),
  });

  const undo = useMutation({
    mutationFn: () => api.intake.undo(),
    onSuccess: () => qc.invalidateQueries(),
  });
  const removeIntake = useMutation({
    mutationFn: (id: string) => api.intake.delete(id),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (summary.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (summary.isError || !summary.data) {
    return <Empty title="No data" description={(summary.error as Error)?.message ?? 'unknown'} />;
  }

  const s = summary.data;
  const macros = [
    { label: 'kcal', current: s.totals.kcal, goal: s.goals.kcal, color: 'var(--color-kumo-brand)' },
    {
      label: 'protein',
      current: s.totals.protein_g,
      goal: s.goals.protein_g,
      color: 'var(--color-kumo-success)',
      unit: 'g',
    },
    {
      label: 'carbs',
      current: s.totals.carb_g,
      goal: s.goals.carb_g,
      color: 'var(--color-kumo-warning)',
      unit: 'g',
    },
    {
      label: 'fat',
      current: s.totals.fat_g,
      goal: s.goals.fat_g,
      color: 'var(--color-kumo-danger)',
      unit: 'g',
    },
  ];
  const r = recovery.data?.[0];
  const sl = sleep.data?.[0];
  const w = weight.data?.[0];
  const recoveryTone = scoreTone(r?.score, 67, 34);
  const sleepTone = scoreTone(sl?.score, 70, 50);

  return (
    <>
      <PageHeader
        title="Today"
        description={
          <span className="flex items-center gap-2">
            <span>{formatDateLong(s.date)}</span>
            <span className="text-kumo-subtle">·</span>
            <span className="font-mono text-xs">{s.date}</span>
          </span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={undo.isPending}
            onClick={() => undo.mutate()}
          >
            <Undo2 className="h-3.5 w-3.5" /> undo last
          </Button>
        }
      />

      <div className="grid gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-kumo-brand" />
                Macros vs goals
              </CardTitle>
              <p className="text-xs text-kumo-subtle">
                Live totals from today's intake — tap a ring to break it down.
              </p>
            </div>
            <Badge variant="muted">
              {fmtNum(s.totals.entry_count, 0)} {s.totals.entry_count === 1 ? 'entry' : 'entries'}
            </Badge>
          </CardHeader>
          <CardContent className="pt-3">
            <MacroRings macros={macros} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Droplets}
            tone="primary"
            label="hydration"
            value={`${fmtNum(s.totals.hydration_ml)} ml`}
            hint={
              s.goals.hydration_ml ? (
                <span className="flex flex-col gap-1">
                  <span>goal {fmtNum(s.goals.hydration_ml)} ml</span>
                  <ProgressBar
                    value={s.totals.hydration_ml}
                    goal={s.goals.hydration_ml}
                    color="var(--color-kumo-brand)"
                  />
                </span>
              ) : null
            }
          />
          <StatCard
            icon={Moon}
            tone={sleepTone}
            label="sleep score"
            value={sl?.score != null ? String(sl.score) : '—'}
            hint={sl ? `${fmtNum((sl.duration_s ?? 0) / 3600, 1)} h asleep` : 'no data'}
          />
          <StatCard
            icon={Heart}
            tone={recoveryTone}
            label="recovery"
            value={r?.score != null ? String(r.score) : '—'}
            hint={r?.hrv_rmssd ? `HRV ${fmtNum(r.hrv_rmssd, 0)} ms` : 'no data'}
          />
          <StatCard
            icon={Scale}
            label="weight"
            value={w ? `${fmtNum(w.kg, 1)} kg` : '—'}
            hint={w?.body_fat_pct != null ? `${fmtNum(w.body_fat_pct, 1)}% body fat` : 'no entry'}
          />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-kumo-brand" />
              Hydration
            </CardTitle>
            <p className="text-xs text-kumo-subtle">
              Quick add — common pours or a custom amount.
            </p>
          </CardHeader>
          <CardContent>
            <HydrationQuickAdd />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Meals</CardTitle>
              <span className="text-xs text-kumo-subtle">
                avg confidence{' '}
                <span className="font-medium text-kumo-default">
                  {s.totals.avg_confidence === null
                    ? '—'
                    : fmtNum(s.totals.avg_confidence, 2)}
                </span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {intake.isLoading ? (
              <Spinner />
            ) : !intake.data?.length ? (
              <Empty
                icon={Activity}
                title="No meals logged today"
                description="Ask your agent to log via MCP, or use Foods / Recipes to add manually."
              />
            ) : (
              <ul className="-mx-2 divide-y divide-kumo-line">
                {intake.data.map((e) => (
                  <li
                    key={e.id}
                    className="group rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-kumo-tint"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-kumo-subtle shrink-0">
                          {fmtTime(e.ts)}
                        </span>
                        <Badge variant="muted" className="font-normal capitalize">
                          {e.meal_type}
                        </Badge>
                        <span className="truncate text-kumo-default">
                          {e.custom_name ??
                            (e.ref_kind === 'food'
                              ? `food · ${fmtNum(e.grams, 0)} g`
                              : e.ref_kind === 'batch'
                                ? `batch · ${fmtNum(e.grams, 0)} g`
                                : `recipe · ${fmtNum(e.servings, 1)} svg`)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete entry"
                        className="-mr-1 h-7 w-7 shrink-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                        disabled={removeIntake.isPending}
                        onClick={() => removeIntake.mutate(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-[3.25rem] text-xs tabular-nums text-kumo-subtle">
                      <span className="font-medium text-kumo-default">
                        {fmtNum(e.kcal, 0)} kcal
                      </span>
                      <span>P {fmtNum(e.protein_g, 1)}</span>
                      <span>C {fmtNum(e.carb_g, 1)}</span>
                      <span>F {fmtNum(e.fat_g, 1)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export const Route = createFileRoute('/today')({
  component: Today,
});
