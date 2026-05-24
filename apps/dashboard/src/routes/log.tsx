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
            className="h-9 w-44"
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
            <ul className="divide-y">
              {intake.data.map((e) => (
                <li key={e.id} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 py-3">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtTime(e.ts)}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="muted" className="font-normal capitalize">
                        {e.meal_type}
                      </Badge>
                      <span className="truncate text-sm">
                        {e.custom_name ?? `${e.ref_kind} · ${fmtNum(e.grams ?? e.servings, 1)}`}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs tabular-nums text-muted-foreground">
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
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(e.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
