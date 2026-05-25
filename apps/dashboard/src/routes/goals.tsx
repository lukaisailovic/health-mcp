import { InputGroup } from '@cloudflare/kumo';
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

type FieldKey =
  | 'kcal'
  | 'protein_g'
  | 'carb_g'
  | 'fat_g'
  | 'fiber_g'
  | 'hydration_ml'
  | 'weight_kg_target';

type Field = {
  key: FieldKey;
  label: string;
  unit: string;
  step?: string;
};

type Section = {
  title: string;
  fields: Field[];
};

const SECTIONS: Section[] = [
  {
    title: 'Nutrition',
    fields: [
      { key: 'kcal', label: 'Calories', unit: 'kcal / day' },
      { key: 'protein_g', label: 'Protein', unit: 'g / day' },
      { key: 'carb_g', label: 'Carbs', unit: 'g / day' },
      { key: 'fat_g', label: 'Fat', unit: 'g / day' },
      { key: 'fiber_g', label: 'Fiber', unit: 'g / day' },
    ],
  },
  {
    title: 'Hydration & body',
    fields: [
      { key: 'hydration_ml', label: 'Hydration', unit: 'ml / day' },
      { key: 'weight_kg_target', label: 'Weight target', unit: 'kg', step: '0.1' },
    ],
  },
];

const ALL_FIELDS: Field[] = SECTIONS.flatMap((s) => s.fields);

type FormState = Record<FieldKey, string>;

const Goals = () => {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api.goals.get() });
  const [form, setForm] = useState<FormState>({} as FormState);

  useEffect(() => {
    if (!goals.data) return;
    const next = {} as FormState;
    for (const f of ALL_FIELDS) {
      const v = goals.data[f.key];
      next[f.key] = v == null ? '' : String(v);
    }
    setForm(next);
  }, [goals.data]);

  const save = useMutation({
    mutationFn: api.goals.set,
    onSuccess: () => qc.invalidateQueries(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: Partial<Record<FieldKey, number | null>> = {};
    for (const f of ALL_FIELDS) {
      const raw = form[f.key];
      if (raw === '') {
        body[f.key] = null;
        continue;
      }
      const n = Number(raw);
      body[f.key] = Number.isFinite(n) ? n : null;
    }
    save.mutate(body);
  };

  if (goals.isLoading) return <Spinner />;
  return (
    <>
      <PageHeader title="Goals" description="Daily macro and hydration targets used everywhere." />
      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>
            Leave any field empty to clear that goal. Values update everywhere immediately after
            saving.
          </CardDescription>
        </CardHeader>
        <form id="goals-form" onSubmit={submit}>
          <CardContent className="flex flex-col gap-8">
            {SECTIONS.map((section) => (
              <section key={section.title} className="flex flex-col gap-4">
                <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
                  {section.title}
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map((f) => (
                    <FormField key={f.key} label={f.label} htmlFor={f.key}>
                      <InputGroup>
                        <InputGroup.Input
                          id={f.key}
                          type="number"
                          inputMode="decimal"
                          step={f.step}
                          min={0}
                          placeholder="—"
                          value={form[f.key] ?? ''}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                        />
                        <InputGroup.Addon align="end">{f.unit}</InputGroup.Addon>
                      </InputGroup>
                    </FormField>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
          <CardFooter className="justify-between gap-3 border-t border-kumo-line pt-4">
            <span
              className="text-xs text-kumo-subtle"
              aria-live="polite"
              role="status"
            >
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
