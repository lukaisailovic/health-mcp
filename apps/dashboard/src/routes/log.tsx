import { MealCard } from '@/components/meal-card';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtDate, todayIso } from '@/lib/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { useState } from 'react';

const Log = () => {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const meals = useQuery({
    queryKey: ['meals', date],
    queryFn: () => api.meals.list({ date }),
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
  return (
    <>
      <PageHeader
        title="Log"
        description="Review and edit meals by date."
        actions={
          <Input
            type="date"
            aria-label="Filter date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-44"
          />
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{fmtDate(`${date}T12:00:00Z`)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {meals.isLoading ? (
            <Spinner />
          ) : !meals.data?.length ? (
            <Empty icon={History} title="No meals" description="Nothing logged on this date." />
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
                  showConfidence
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export const Route = createFileRoute('/log')({ component: Log });
