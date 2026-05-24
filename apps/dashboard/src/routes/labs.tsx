import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Beaker } from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';

const STATUS_VARIANT = {
  optimal: 'ok',
  in_ref: 'muted',
  out_of_ref: 'bad',
  unknown: 'outline',
} as const;

const BiomarkerTrendChart = ({ id }: { id: string }) => {
  const trend = useQuery({
    queryKey: ['biomarker-trend', id],
    queryFn: () => api.biomarkers.trend(id),
  });
  const biomarker = useQuery({
    queryKey: ['biomarker', id],
    queryFn: () => api.biomarkers.get(id),
  });
  if (trend.isLoading || biomarker.isLoading) return <Spinner />;
  if (!trend.data?.length) return <Empty title="No data" />;
  const b = biomarker.data;
  const data = trend.data.map((p) => ({ ts: p.ts.slice(0, 10), value: p.value }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="ts" fontSize={10} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" width={36} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${fmtNum(v, 2)} ${b?.default_unit_ucum ?? ''}`, b?.name ?? '']}
        />
        {b?.optimal_low != null ? (
          <ReferenceLine y={b.optimal_low} stroke="hsl(var(--ok))" strokeDasharray="3 3" />
        ) : null}
        {b?.optimal_high != null ? (
          <ReferenceLine y={b.optimal_high} stroke="hsl(var(--ok))" strokeDasharray="3 3" />
        ) : null}
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const Labs = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [outOnly, setOutOnly] = useState(false);
  const latest = useQuery({
    queryKey: ['biomarkers', 'latest', outOnly],
    queryFn: () => api.biomarkers.latest({ out_of_range_only: outOnly }),
  });
  const panels = useQuery({
    queryKey: ['lab-panels'],
    queryFn: () => api.labs.panels({ limit: 25 }),
  });
  return (
    <>
      <PageHeader
        title="Labs"
        description="Latest biomarker values + per-marker trends."
        actions={
          <Button
            size="sm"
            variant={outOnly ? 'default' : 'outline'}
            onClick={() => setOutOnly((v) => !v)}
          >
            out of range only
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle>Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <BiomarkerTrendChart id={selected} />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Latest biomarkers</CardTitle>
            </CardHeader>
            <CardContent>
              {latest.isLoading ? (
                <Spinner />
              ) : !latest.data?.length ? (
                <Empty
                  icon={Beaker}
                  title={outOnly ? 'Nothing out of range' : 'No lab results yet'}
                  description="Log a lab panel via MCP or REST to populate this."
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {latest.data.map((row) => (
                    <button
                      type="button"
                      key={row.biomarker.id}
                      onClick={() => setSelected(row.biomarker.id)}
                      className="flex items-center justify-between gap-2 rounded-md border p-3 text-left text-sm hover:bg-accent"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="truncate font-medium">{row.biomarker.name}</div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {row.result.value_numeric != null
                            ? `${fmtNum(row.result.value_numeric, 2)} ${row.result.unit_ucum}`
                            : (row.result.value_text ?? '—')}
                          <span className="ml-2">{fmtDate(row.result.taken_at)}</span>
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[row.status]} className="capitalize">
                        {row.status.replace('_', ' ')}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Panels</CardTitle>
          </CardHeader>
          <CardContent>
            {panels.isLoading ? (
              <Spinner />
            ) : !panels.data?.length ? (
              <Empty title="No panels logged" />
            ) : (
              <ul className="divide-y">
                {panels.data.map((p) => (
                  <li key={p.id} className="py-2 text-sm">
                    <div className="font-medium">{p.name ?? p.lab_name ?? 'Panel'}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.drawn_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export const Route = createFileRoute('/labs')({ component: Labs });
