import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';

type Field = {
  key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g' | 'hydration_ml' | 'weight_kg_target';
  label: string;
  unit: string;
};

const FIELDS: Field[] = [
  { key: 'kcal', label: 'kcal', unit: 'kcal/day' },
  { key: 'protein_g', label: 'protein', unit: 'g/day' },
  { key: 'carb_g', label: 'carbs', unit: 'g/day' },
  { key: 'fat_g', label: 'fat', unit: 'g/day' },
  { key: 'fiber_g', label: 'fiber', unit: 'g/day' },
  { key: 'hydration_ml', label: 'hydration', unit: 'ml/day' },
  { key: 'weight_kg_target', label: 'weight target', unit: 'kg' },
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
      <PageHeader title="Goals" description="Daily macro + hydration targets used everywhere." />
      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={f.key}
                    type="number"
                    inputMode="decimal"
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                  <span className="shrink-0 text-xs text-kumo-subtle">{f.unit}</span>
                </div>
              </div>
            ))}
            <div className="col-span-full flex items-center justify-end gap-2">
              {save.isSuccess ? (
                <span className="text-xs text-kumo-subtle">saved</span>
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
