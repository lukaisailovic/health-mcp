import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';

type Field = {
  key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g' | 'hydration_ml' | 'weight_kg_target';
  label: string;
  unit: string;
};

const FIELDS: Field[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal/day' },
  { key: 'protein_g', label: 'Protein', unit: 'g/day' },
  { key: 'carb_g', label: 'Carbs', unit: 'g/day' },
  { key: 'fat_g', label: 'Fat', unit: 'g/day' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g/day' },
  { key: 'hydration_ml', label: 'Hydration', unit: 'ml/day' },
  { key: 'weight_kg_target', label: 'Weight Target', unit: 'kg' },
];

type FormState = Record<Field['key'], string>;

const Goals = () => {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api.goals.get() });
  const [form, setForm] = useState<FormState>({} as FormState);

  useEffect(() => {
    if (!goals.data) return;
    const next = {} as FormState;
    for (const f of FIELDS) {
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
    const body: Partial<Record<Field['key'], number | null>> = {};
    for (const f of FIELDS) {
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
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <FormField
                key={f.key}
                label={f.label}
                htmlFor={f.key}
                suffix={f.unit}
              >
                <Input
                  id={f.key}
                  type="number"
                  inputMode="decimal"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              </FormField>
            ))}
            <div className="col-span-full flex items-center justify-end gap-3 pt-2">
              {save.isSuccess ? (
                <span className="text-xs text-kumo-subtle" aria-live="polite">
                  Saved
                </span>
              ) : null}
              <Button type="submit" disabled={save.isPending}>
                Save goals
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

export const Route = createFileRoute('/goals')({ component: Goals });
