import { InputGroup } from '@cloudflare/kumo';
import type { GoalBound, GoalsDto } from '@health-mcp/shared/dto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';

type MacroKey =
  | 'kcal'
  | 'protein_g'
  | 'carb_g'
  | 'fat_g'
  | 'fiber_g'
  | 'sat_fat_g'
  | 'hydration_ml';

type MacroField = {
  key: MacroKey;
  label: string;
  unit: string;
  shape: 'min-max' | 'min-only' | 'max-only';
  hint: string;
};

type Section = {
  title: string;
  fields: MacroField[];
};

const SECTIONS: Section[] = [
  {
    title: 'Energy',
    fields: [
      {
        key: 'kcal',
        label: 'Calories',
        unit: 'kcal / day',
        shape: 'min-max',
        hint: 'Target band — leave both blank for no goal, fill one for a floor/cap.',
      },
    ],
  },
  {
    title: 'Macros',
    fields: [
      {
        key: 'protein_g',
        label: 'Protein',
        unit: 'g / day',
        shape: 'min-only',
        hint: 'Floor — eat at least this much.',
      },
      {
        key: 'carb_g',
        label: 'Carbs',
        unit: 'g / day',
        shape: 'min-max',
        hint: 'Target band, leave open-ended if you don\'t care.',
      },
      {
        key: 'fat_g',
        label: 'Fat',
        unit: 'g / day',
        shape: 'min-max',
        hint: 'Target band.',
      },
      {
        key: 'sat_fat_g',
        label: 'Saturated fat',
        unit: 'g / day',
        shape: 'max-only',
        hint: 'Ceiling — AHA recommends ≤13g/day for a 2000 kcal diet.',
      },
      {
        key: 'fiber_g',
        label: 'Fiber',
        unit: 'g / day',
        shape: 'min-only',
        hint: 'Floor — eat at least this much.',
      },
    ],
  },
  {
    title: 'Hydration',
    fields: [
      {
        key: 'hydration_ml',
        label: 'Hydration',
        unit: 'ml / day',
        shape: 'min-only',
        hint: 'Floor — drink at least this much.',
      },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

type CellKey = `${MacroKey}_min` | `${MacroKey}_max` | 'weight_kg_target';
type FormState = Record<CellKey, string>;

const initialState = (): FormState => {
  const next = {} as FormState;
  for (const f of ALL_FIELDS) {
    next[`${f.key}_min`] = '';
    next[`${f.key}_max`] = '';
  }
  next.weight_kg_target = '';
  return next;
};

const fromGoals = (g: GoalsDto): FormState => {
  const next = initialState();
  for (const f of ALL_FIELDS) {
    const bound = g[f.key];
    next[`${f.key}_min`] = bound.min == null ? '' : String(bound.min);
    next[`${f.key}_max`] = bound.max == null ? '' : String(bound.max);
  }
  next.weight_kg_target = g.weight_kg_target == null ? '' : String(g.weight_kg_target);
  return next;
};

const parseCell = (s: string): number | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const Goals = () => {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api.goals.get() });
  const [form, setForm] = useState<FormState>(initialState);

  useEffect(() => {
    if (goals.data) setForm(fromGoals(goals.data));
  }, [goals.data]);

  const save = useMutation({
    mutationFn: api.goals.set,
    onSuccess: () => qc.invalidateQueries(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, GoalBound | number | null> = {};
    for (const f of ALL_FIELDS) {
      const min = parseCell(form[`${f.key}_min`]);
      const max = parseCell(form[`${f.key}_max`]);
      body[f.key] = min === null && max === null ? null : { min, max };
    }
    const weight = parseCell(form.weight_kg_target);
    body.weight_kg_target = weight;
    save.mutate(body as Parameters<typeof api.goals.set>[0]);
  };

  if (goals.isLoading) return <Spinner />;

  const setCell = (key: CellKey, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  return (
    <>
      <PageHeader
        title="Goals"
        description="Daily targets — set a min, a max, or both per macro."
      />
      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>
            Min = floor (eat at least), max = ceiling (stay below), both = target band.
            Leave both blank to clear that macro.
          </CardDescription>
        </CardHeader>
        <form id="goals-form" onSubmit={submit}>
          <CardContent className="flex flex-col gap-8">
            {SECTIONS.map((section) => (
              <section key={section.title} className="flex flex-col gap-4">
                <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
                  {section.title}
                </h4>
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <FormField key={f.key} label={f.label} description={f.hint}>
                      <div className="grid grid-cols-2 gap-2">
                        {f.shape !== 'max-only' ? (
                          <InputGroup>
                            <InputGroup.Addon>min</InputGroup.Addon>
                            <InputGroup.Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              placeholder="—"
                              value={form[`${f.key}_min`]}
                              onChange={(e) => setCell(`${f.key}_min`, e.target.value)}
                            />
                          </InputGroup>
                        ) : (
                          <div />
                        )}
                        {f.shape !== 'min-only' ? (
                          <InputGroup>
                            <InputGroup.Addon>max</InputGroup.Addon>
                            <InputGroup.Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              placeholder="—"
                              value={form[`${f.key}_max`]}
                              onChange={(e) => setCell(`${f.key}_max`, e.target.value)}
                            />
                          </InputGroup>
                        ) : (
                          <div />
                        )}
                      </div>
                    </FormField>
                  ))}
                </div>
              </section>
            ))}
            <section className="flex flex-col gap-4">
              <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
                Body
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Weight target" htmlFor="weight_kg_target">
                  <InputGroup>
                    <InputGroup.Input
                      id="weight_kg_target"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={0}
                      placeholder="—"
                      value={form.weight_kg_target}
                      onChange={(e) => setCell('weight_kg_target', e.target.value)}
                    />
                    <InputGroup.Addon align="end">kg</InputGroup.Addon>
                  </InputGroup>
                </FormField>
              </div>
            </section>
          </CardContent>
          <CardFooter className="justify-between gap-3 border-t border-kumo-line pt-4">
            <span className="text-xs text-kumo-subtle" aria-live="polite" role="status">
              {save.isSuccess ? 'Saved' : ''}
            </span>
            <Button type="submit" form="goals-form" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save goals'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
};

export const Route = createFileRoute('/goals')({ component: Goals });
