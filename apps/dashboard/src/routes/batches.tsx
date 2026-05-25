import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Archive, CookingPot, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';

const TONE_COLOR = {
  ok: 'var(--color-kumo-success)',
  warn: 'var(--color-kumo-warning)',
  bad: 'var(--color-kumo-danger)',
} as const;

const Batches = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const list = useQuery({
    queryKey: ['batches', tab],
    queryFn: () => api.batches.list({ active_only: tab === 'active' }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api.batches.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.batches.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
  return (
    <>
      <PageHeader
        title="Batches"
        description="Cooked instances depleted as you log intake."
        actions={
          <Tabs
            size="sm"
            value={tab}
            onValueChange={(v) => setTab(v as 'active' | 'all')}
            tabs={[
              { value: 'active', label: 'Active' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      {list.isLoading ? (
        <Spinner />
      ) : !list.data?.length ? (
        <Empty icon={CookingPot} title="No batches" description="Cook a recipe via MCP to start tracking depletion." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((b) => {
            const ratio = b.total_grams > 0 ? b.remaining_grams / b.total_grams : 0;
            const tone = ratio > 0.5 ? 'ok' : ratio > 0.15 ? 'warn' : 'bad';
            return (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.name ?? 'Batch'}</div>
                      <div className="text-xs text-kumo-subtle">
                        cooked {fmtDate(b.cooked_at)}
                      </div>
                    </div>
                    {b.archived ? <Badge variant="muted">archived</Badge> : <Badge variant={tone}>{Math.round(ratio * 100)}%</Badge>}
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-kumo-fill">
                      <div
                        className="h-full transition-[width] duration-300"
                        style={{
                          width: `${ratio * 100}%`,
                          background: TONE_COLOR[tone],
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs tabular-nums text-kumo-subtle">
                      <span>{fmtNum(b.remaining_grams, 0)} g left</span>
                      <span>of {fmtNum(b.total_grams, 0)} g</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs tabular-nums text-kumo-subtle">
                    <span>{fmtNum(b.kcal_total, 0)} kcal</span>
                    <span>P {fmtNum(b.protein_g_total, 0)}</span>
                    <span>C {fmtNum(b.carb_g_total, 0)}</span>
                    <span>F {fmtNum(b.fat_g_total, 0)}</span>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    {!b.archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={archive.isPending}
                        onClick={() => archive.mutate(b.id)}
                      >
                        <Archive className="h-3.5 w-3.5" /> archive
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete batch"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(b.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
};

export const Route = createFileRoute('/batches')({ component: Batches });
