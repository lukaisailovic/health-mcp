import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  Droplets,
  Flame,
  Heart,
  Moon,
  Plus,
  Scale,
  Trash2,
  Undo2,
} from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { MealCard } from '@/components/meal-card';
import { MacroRings } from '@/components/macro-rings';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

type TriggerProps = Record<string, unknown>;

type HydrationDialogProps = {
  renderTrigger: (props: TriggerProps) => ReactElement;
  date: string;
};

const HydrationDialog = ({ renderTrigger, date }: HydrationDialogProps) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const entries = useQuery({
    queryKey: ['hydration', date],
    queryFn: () => api.hydration.list({ date }),
    enabled: open,
  });
  const log = useMutation({
    mutationFn: (ml: number) => api.hydration.log({ ml }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.hydration.delete(id),
    onSuccess: () => qc.invalidateQueries(),
  });
  const submitCustom = () => {
    const ml = Number(custom);
    if (!Number.isFinite(ml) || ml <= 0) return;
    log.mutate(ml);
    setCustom('');
  };
  const today = entries.data ?? [];
  const total = today.reduce((sum, e) => sum + e.ml, 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(p) => renderTrigger(p as TriggerProps)} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-kumo-brand" />
            Hydration
          </DialogTitle>
          <p className="text-xs text-kumo-subtle">
            {fmtNum(total)} ml logged today.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
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
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="custom ml"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitCustom();
                }
              }}
              className="flex-1"
            />
            <Button
              size="sm"
              disabled={!custom || log.isPending}
              onClick={submitCustom}
            >
              Add
            </Button>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
              Today's pours
            </div>
            {entries.isLoading ? (
              <Spinner />
            ) : today.length === 0 ? (
              <p className="text-xs text-kumo-subtle">Nothing yet — tap a button above.</p>
            ) : (
              <ul className="max-h-48 divide-y divide-kumo-line overflow-y-auto">
                {today.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="font-mono text-xs tabular-nums text-kumo-subtle">
                      {fmtTime(e.ts)}
                    </span>
                    <span className="tabular-nums">{fmtNum(e.ml)} ml</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete entry"
                      className="h-7 w-7"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const meals = useQuery({
    queryKey: ['meals', date],
    queryFn: () => api.meals.list({ date }),
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
    mutationFn: () => api.meals.undo(),
    onSuccess: () => qc.invalidateQueries(),
  });
  const deleteMeal = useMutation({
    mutationFn: (id: string) => api.meals.delete(id),
    onSuccess: () => qc.invalidateQueries(),
  });
  const removeComponent = useMutation({
    mutationFn: ({ mealId, componentId }: { mealId: string; componentId: string }) =>
      api.meals.removeComponent(mealId, componentId),
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
              {fmtNum(s.totals.meal_count, 0)} {s.totals.meal_count === 1 ? 'meal' : 'meals'}
              {s.totals.component_count > s.totals.meal_count ? (
                <span className="text-kumo-subtle"> · {fmtNum(s.totals.component_count, 0)} items</span>
              ) : null}
            </Badge>
          </CardHeader>
          <CardContent className="pt-3">
            <MacroRings macros={macros} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Card className="transition-colors hover:bg-kumo-elevated">
            <div className="flex items-stretch justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-kumo-subtle">
                  hydration
                </div>
                <div className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-kumo-strong">
                  {fmtNum(s.totals.hydration_ml)} ml
                </div>
                {s.goals.hydration_ml ? (
                  <div className="mt-1.5 flex flex-col gap-1 text-xs text-kumo-subtle">
                    <span>goal {fmtNum(s.goals.hydration_ml)} ml</span>
                    <ProgressBar
                      value={s.totals.hydration_ml}
                      goal={s.goals.hydration_ml}
                      color="var(--color-kumo-brand)"
                    />
                  </div>
                ) : (
                  <div className="mt-1.5 text-xs text-kumo-subtle">tap + to log a pour</div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-kumo-info-tint text-kumo-info">
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                </div>
                <HydrationDialog
                  date={date}
                  renderTrigger={(p) => (
                    <button
                      {...p}
                      type="button"
                      aria-label="Log hydration"
                      className="grid h-8 w-8 place-items-center rounded-md bg-kumo-brand text-white shadow-sm shadow-kumo-brand/20 transition-[transform,box-shadow] hover:scale-105 hover:shadow-kumo-brand/40 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                />
              </div>
            </div>
          </Card>
        </div>

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
            {meals.isLoading ? (
              <Spinner />
            ) : !meals.data?.length ? (
              <Empty
                icon={Activity}
                title="No meals logged today"
                description="Ask your agent to log via MCP, or use Foods / Recipes to add manually."
              />
            ) : (
              <ul className="-mx-2 divide-y divide-kumo-line">
                {meals.data.map((m) => (
                  <MealCard
                    key={m.id}
                    meal={m}
                    onDeleteMeal={(id) => deleteMeal.mutate(id)}
                    onRemoveComponent={(mealId, componentId) =>
                      removeComponent.mutate({ mealId, componentId })
                    }
                    busy={deleteMeal.isPending || removeComponent.isPending}
                  />
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
