import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChefHat } from 'lucide-react';
import { useState } from 'react';
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
            <li key={i.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">
                {i.free_text_name ?? <code className="text-xs">{i.food_id}</code>}
              </span>
              <span className="text-xs tabular-nums text-kumo-subtle">{fmtNum(i.grams, 0)} g</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const Recipes = () => {
  const [query, setQuery] = useState('');
  const list = useQuery({
    queryKey: ['recipes', 'list', query],
    queryFn: () => api.recipes.list({ query: query || undefined, limit: 100 }),
  });
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Recipes"
        description="Reusable templates with scaled per-serving macros. Create via MCP for now."
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Input
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {list.isLoading ? (
            <Spinner />
          ) : !list.data?.length ? (
            <Empty icon={ChefHat} title="No recipes yet" />
          ) : (
            <Card>
              <CardContent className="p-1.5">
                <ul className="space-y-0.5">
                  {list.data.map((r) => (
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
