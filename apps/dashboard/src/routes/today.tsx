import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Activity, Droplets, Heart, Moon, Scale, Trash2, Undo2 } from 'lucide-react';
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

const MealBadge = ({ meal_type }: { meal_type: string }) => (
  <Badge variant="muted" className="font-normal capitalize">
    {meal_type}
  </Badge>
);

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
    { label: 'kcal', current: s.totals.kcal, goal: s.goals.kcal, color: 'hsl(var(--primary))' },
    {
      label: 'protein',
      current: s.totals.protein_g,
      goal: s.goals.protein_g,
      color: 'hsl(var(--ok))',
      unit: 'g',
    },
    {
      label: 'carbs',
      current: s.totals.carb_g,
      goal: s.goals.carb_g,
      color: 'hsl(var(--warn))',
      unit: 'g',
    },
    {
      label: 'fat',
      current: s.totals.fat_g,
      goal: s.goals.fat_g,
      color: 'hsl(var(--bad))',
      unit: 'g',
    },
  ];
  const r = recovery.data?.[0];
  const sl = sleep.data?.[0];
  const w = weight.data?.[0];

  return (
    <>
      <PageHeader
        title="Today"
        description={s.date}
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Macros vs goals</CardTitle>
          </CardHeader>
          <CardContent>
            <MacroRings macros={macros} />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Droplets}
            label="hydration"
            value={`${fmtNum(s.totals.hydration_ml)} ml`}
            hint={s.goals.hydration_ml ? `goal ${fmtNum(s.goals.hydration_ml)} ml` : null}
          />
          <StatCard
            icon={Moon}
            label="sleep score"
            value={sl?.score ?? '—'}
            hint={sl ? `${fmtNum((sl.duration_s ?? 0) / 3600, 1)} h` : 'no data'}
          />
          <StatCard
            icon={Heart}
            label="recovery"
            value={r?.score ?? '—'}
            hint={r?.hrv_rmssd ? `HRV ${fmtNum(r.hrv_rmssd, 0)} ms` : 'no data'}
            tone={r?.score ? (r.score >= 67 ? 'ok' : r.score >= 34 ? 'warn' : 'bad') : 'default'}
          />
          <StatCard
            icon={Scale}
            label="weight"
            value={w ? `${fmtNum(w.kg, 1)} kg` : '—'}
            hint={w?.body_fat_pct != null ? `${fmtNum(w.body_fat_pct, 1)}% body fat` : null}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Hydration</span>
              <HydrationQuickAdd />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Meals</span>
              <span className="text-xs font-normal text-muted-foreground">
                {fmtNum(s.totals.entry_count, 0)} entries · avg confidence{' '}
                {s.totals.avg_confidence === null ? '—' : fmtNum(s.totals.avg_confidence, 2)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {intake.isLoading ? (
              <Spinner />
            ) : !intake.data?.length ? (
              <Empty
                icon={Activity}
                title="No meals logged today"
                description="Ask your agent to log via MCP, or use Foods / Recipes to add manually."
              />
            ) : (
              <ul className="divide-y">
                {intake.data.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {fmtTime(e.ts)}
                      </span>
                      <MealBadge meal_type={e.meal_type} />
                      <span className="truncate">
                        {e.custom_name ??
                          (e.ref_kind === 'food'
                            ? `food · ${fmtNum(e.grams, 0)} g`
                            : e.ref_kind === 'batch'
                              ? `batch · ${fmtNum(e.grams, 0)} g`
                              : `recipe · ${fmtNum(e.servings, 1)} svg`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
                      <span>{fmtNum(e.kcal, 0)} kcal</span>
                      <span>P {fmtNum(e.protein_g, 1)}</span>
                      <span>C {fmtNum(e.carb_g, 1)}</span>
                      <span>F {fmtNum(e.fat_g, 1)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={removeIntake.isPending}
                        onClick={() => removeIntake.mutate(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
