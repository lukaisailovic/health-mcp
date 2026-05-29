import { DailyTotals } from '@/components/daily-totals';
import { DateNav } from '@/components/date-nav';
import { MealCard } from '@/components/meal-card';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { todayIso } from '@/lib/format';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { useState } from 'react';

const Log = () => {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());

  const summary = useQuery({
    queryKey: ['summary', 'daily', date],
    queryFn: () => api.summary.daily({ date }),
    placeholderData: keepPreviousData,
  });
  const meals = useQuery({
    queryKey: ['meals', date],
    queryFn: () => api.meals.list({ date }),
    placeholderData: keepPreviousData,
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

  const busy = deleteMeal.isPending || removeComponent.isPending;
  const stale = summary.isPlaceholderData || meals.isPlaceholderData;

  return (
    <>
      <PageHeader
        title="Log"
        description="Review daily totals and meals for any date."
        actions={<DateNav date={date} onChange={setDate} />}
      />

      <div
        aria-busy={stale}
        className={cn(
          'grid gap-5 transition-opacity duration-200 motion-reduce:transition-none',
          stale && 'pointer-events-none opacity-60',
        )}
      >
        {summary.data ? (
          <DailyTotals summary={summary.data} />
        ) : summary.isError ? (
          <Card>
            <CardContent className="py-8">
              <Empty
                title="Couldn't load totals"
                description={(summary.error as Error)?.message ?? 'unknown error'}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid place-items-center py-12">
              <Spinner className="h-5 w-5" />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Meals</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {meals.isLoading ? (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            ) : meals.isError ? (
              <Empty
                icon={History}
                title="Couldn't load meals"
                description={(meals.error as Error)?.message ?? 'unknown error'}
              />
            ) : !meals.data?.length ? (
              <Empty icon={History} title="No meals" description="Nothing logged on this day." />
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
                    busy={busy}
                    showConfidence
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

export const Route = createFileRoute('/log')({ component: Log });
