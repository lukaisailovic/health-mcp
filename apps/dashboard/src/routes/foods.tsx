import { PageHeader } from '@/components/page-header';
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
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtNum } from '@/lib/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Salad, Search, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

type FormState = {
  name: string;
  brand: string;
  serving_grams: string;
  kcal_per_100g: string;
  protein_g_per_100g: string;
  carb_g_per_100g: string;
  fat_g_per_100g: string;
  sat_fat_g_per_100g: string;
  fiber_g_per_100g: string;
  sugar_g_per_100g: string;
  sodium_mg_per_100g: string;
};

const empty: FormState = {
  name: '',
  brand: '',
  serving_grams: '',
  kcal_per_100g: '',
  protein_g_per_100g: '',
  carb_g_per_100g: '',
  fat_g_per_100g: '',
  sat_fat_g_per_100g: '',
  fiber_g_per_100g: '',
  sugar_g_per_100g: '',
  sodium_mg_per_100g: '',
};

const numOrUndef = (s: string): number | undefined => {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const CreateCustomFood = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const create = useMutation({
    mutationFn: api.foods.createCustom,
    onSuccess: () => {
      setOpen(false);
      setForm(empty);
      onCreated();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kcal = numOrUndef(form.kcal_per_100g);
    const protein = numOrUndef(form.protein_g_per_100g);
    const carb = numOrUndef(form.carb_g_per_100g);
    const fat = numOrUndef(form.fat_g_per_100g);
    if (!form.name || kcal == null || protein == null || carb == null || fat == null) return;
    create.mutate({
      name: form.name,
      brand: form.brand || undefined,
      serving_grams: numOrUndef(form.serving_grams),
      nutrients_per_100g: {
        kcal_per_100g: kcal,
        protein_g_per_100g: protein,
        carb_g_per_100g: carb,
        fat_g_per_100g: fat,
        sat_fat_g_per_100g: numOrUndef(form.sat_fat_g_per_100g),
        fiber_g_per_100g: numOrUndef(form.fiber_g_per_100g),
        sugar_g_per_100g: numOrUndef(form.sugar_g_per_100g),
        sodium_mg_per_100g: numOrUndef(form.sodium_mg_per_100g),
      },
    });
  };
  const renderField = (key: keyof FormState, label: string, type: 'text' | 'number' = 'number') => (
    <FormField label={label} htmlFor={key}>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
      />
    </FormField>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(p) => (
          <Button {...p} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            New custom food
          </Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create custom food</DialogTitle>
        </DialogHeader>
        <form id="food-form" onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">{renderField('name', 'Name', 'text')}</div>
          <div className="col-span-2 sm:col-span-1">{renderField('brand', 'Brand', 'text')}</div>
          <div className="col-span-2 sm:col-span-1">
            {renderField('serving_grams', 'Serving (g)')}
          </div>
          <div className="col-span-2 mt-1 border-t border-kumo-line pt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
            Per 100 g
          </div>
          {renderField('kcal_per_100g', 'Calories')}
          {renderField('protein_g_per_100g', 'Protein (g)')}
          {renderField('carb_g_per_100g', 'Carbs (g)')}
          {renderField('fat_g_per_100g', 'Fat (g)')}
          {renderField('sat_fat_g_per_100g', 'Saturated fat (g)')}
          {renderField('fiber_g_per_100g', 'Fiber (g)')}
          {renderField('sugar_g_per_100g', 'Sugar (g)')}
          {renderField('sodium_mg_per_100g', 'Sodium (mg)')}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="food-form" disabled={create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Foods = () => {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const search = useQuery({
    queryKey: ['foods', 'search', active],
    queryFn: () => api.foods.search({ query: active, limit: 50 }),
    enabled: active.length > 1,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.foods.deleteCustom(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foods'] }),
  });

  return (
    <>
      <PageHeader
        title="Foods"
        description="Search local cache, USDA, and Open Food Facts; create custom foods."
        actions={
          <CreateCustomFood onCreated={() => qc.invalidateQueries({ queryKey: ['foods'] })} />
        }
      />
      <Card className="mb-4">
        <CardContent className="p-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setActive(query.trim());
            }}
          >
            <div className="relative flex-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-kumo-subtle"
              >
                <Search className="h-4 w-4" />
              </span>
              <Input
                aria-label="Search foods"
                placeholder="Search foods…"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9"
              />
            </div>
            <Button type="submit" className="shrink-0">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{active ? `Results for "${active}"` : 'Search to see results'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!active ? (
            <Empty icon={Salad} title="Start typing to search foods" />
          ) : search.isLoading ? (
            <Spinner />
          ) : !search.data?.length ? (
            <Empty
              icon={Salad}
              title="No matches"
              description="Try a different query or create a custom food."
            />
          ) : (
            <ul className="divide-y divide-kumo-line">
              {search.data.map((f) => (
                <li key={f.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {f.source}
                      </Badge>
                      <span className="truncate text-sm font-medium">{f.name}</span>
                      {f.brand ? (
                        <span className="truncate text-xs text-kumo-subtle">{f.brand}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex gap-3 text-xs tabular-nums text-kumo-subtle">
                      <span>{fmtNum(f.kcal_per_100g, 0)} kcal/100g</span>
                      <span>P {fmtNum(f.protein_g, 1)}</span>
                      <span>C {fmtNum(f.carb_g, 1)}</span>
                      <span>F {fmtNum(f.fat_g, 1)}</span>
                    </div>
                  </div>
                  {f.source === 'manual' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete custom food"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export const Route = createFileRoute('/foods')({ component: Foods });
