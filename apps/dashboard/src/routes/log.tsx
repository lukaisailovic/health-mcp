import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { History, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtDate, fmtNum, fmtTime, todayIso } from '@/lib/format';

const Log = () => {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const intake = useQuery({
    queryKey: ['intake', date],
    queryFn: () => api.intake.list({ date }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.intake.delete(id),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <>
      <PageHeader
        title="Log"
        description="Review and edit intake entries by date."
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-full sm:w-44"
          />
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{fmtDate(`${date}T12:00:00Z`)}</CardTitle>
        </CardHeader>
        <CardContent>
          {intake.isLoading ? (
            <Spinner />
          ) : !intake.data?.length ? (
            <Empty icon={History} title="No entries" description="Nothing logged on this date." />
          ) : (
            <ul className="divide-y divide-kumo-line">
              {intake.data.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 w-14 shrink-0 font-mono text-xs tabular-nums text-kumo-subtle">
                    {fmtTime(e.ts)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="muted" className="font-normal capitalize">
                        {e.meal_type}
                      </Badge>
                      <span className="truncate text-sm">
                        {e.custom_name ?? `${e.ref_kind} · ${fmtNum(e.grams ?? e.servings, 1)}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-kumo-subtle">
                      <span>{fmtNum(e.kcal, 0)} kcal</span>
                      <span>P {fmtNum(e.protein_g, 1)} g</span>
                      <span>C {fmtNum(e.carb_g, 1)} g</span>
                      <span>F {fmtNum(e.fat_g, 1)} g</span>
                      <span>conf {fmtNum(e.confidence, 2)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete entry"
                    className="-mr-1 h-7 w-7 shrink-0"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(e.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export const Route = createFileRoute('/log')({ component: Log });
