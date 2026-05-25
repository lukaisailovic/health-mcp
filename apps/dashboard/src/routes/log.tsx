import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { useState } from 'react';
import { IntakeRow } from '@/components/intake-row';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtDate, todayIso } from '@/lib/format';

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
          {intake.isLoading ? (
            <Spinner />
          ) : !intake.data?.length ? (
            <Empty icon={History} title="No entries" description="Nothing logged on this date." />
          ) : (
            <ul className="-mx-2 divide-y divide-kumo-line">
              {intake.data.map((e) => (
                <IntakeRow
                  key={e.id}
                  entry={e}
                  onDelete={(id) => remove.mutate(id)}
                  deleting={remove.isPending}
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
