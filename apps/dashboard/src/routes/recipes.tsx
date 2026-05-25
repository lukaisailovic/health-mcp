import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChefHat, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtNum } from '@/lib/format';

const RecipeDetail = ({ id }: { id: string }) => {
  const detail = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  });
  if (detail.isLoading) return <Spinner />;
  if (!detail.data) return null;
  const { recipe, ingredients, total, per_serving } = detail.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{recipe.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-md bg-kumo-fill p-4 text-xs">
          <div>
            <div className="uppercase tracking-wide text-kumo-subtle">Total</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {fmtNum(total.kcal, 0)} kcal · P {fmtNum(total.protein_g, 1)} · C{' '}
              {fmtNum(total.carb_g, 1)} · F {fmtNum(total.fat_g, 1)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-kumo-subtle">
              Per serving ({recipe.servings})
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {fmtNum(per_serving.kcal, 0)} kcal · P {fmtNum(per_serving.protein_g, 1)} · C{' '}
              {fmtNum(per_serving.carb_g, 1)} · F {fmtNum(per_serving.fat_g, 1)}
            </div>
          </div>
        </div>
        <ul className="divide-y divide-kumo-line">
          {ingredients.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">
                {i.food_name ?? i.free_text_name ?? (
                  <span className="text-kumo-subtle italic">unnamed ingredient</span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-kumo-subtle">
                {fmtNum(i.grams, 0)} g
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const Recipes = () => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const list = useQuery({
    queryKey: ['recipes', 'list'],
    queryFn: () => api.recipes.list({ limit: 100 }),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q));
  }, [list.data, deferredQuery]);
  const isStale = query !== deferredQuery;
  return (
    <>
      <PageHeader
        title="Recipes"
        description="Reusable templates with scaled per-serving macros. Create via MCP for now."
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-kumo-subtle">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <Input
              aria-label="Filter recipes"
              placeholder="Filter recipes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9"
            />
          </div>
          {list.isLoading ? (
            <Spinner />
          ) : !filtered.length ? (
            <Empty
              icon={ChefHat}
              title={query.trim() ? 'No matches' : 'No recipes yet'}
              description={query.trim() ? 'Try a different filter.' : undefined}
            />
          ) : (
            <Card>
              <CardContent
                className={`p-1.5 transition-opacity duration-150 ${isStale ? 'opacity-70' : 'opacity-100'}`}
              >
                <ul className="space-y-0.5">
                  {filtered.map((r) => (
                    <li key={r.id}>
                      <Button
                        variant={selected === r.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-between font-normal"
                        onClick={() => setSelected(r.id)}
                      >
                        <span className="truncate">{r.name}</span>
                        <span className="ml-2 shrink-0 text-xs text-kumo-subtle">
                          {r.servings} svg
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <div>
          {selected ? (
            <RecipeDetail id={selected} />
          ) : (
            <Empty
              icon={ChefHat}
              title="Pick a recipe"
              description="Click any recipe on the left to see its ingredients and macros."
            />
          )}
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute('/recipes')({ component: Recipes });
