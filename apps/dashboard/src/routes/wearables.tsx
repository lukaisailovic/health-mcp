import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Link2, RefreshCw, Unplug, Watch } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { fmtRelative } from '@/lib/format';

const Wearables = () => {
  const qc = useQueryClient();
  const providers = useQuery({
    queryKey: ['wearables', 'providers'],
    queryFn: () => api.wearables.providers(),
  });
  const status = useQuery({
    queryKey: ['wearables', 'status'],
    queryFn: () => api.wearables.status(),
  });

  const connect = useMutation({
    mutationFn: (provider: string) => api.wearables.connect(provider),
    onSuccess: ({ url }) => {
      window.open(url, '_blank', 'noopener');
    },
  });
  const disconnect = useMutation({
    mutationFn: (provider: string) => api.wearables.disconnect(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wearables'] }),
  });
  const sync = useMutation({
    mutationFn: (provider?: string) =>
      api.wearables.sync(provider ? { providers: [provider] } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wearables'] }),
  });

  return (
    <>
      <PageHeader
        title="Wearables"
        description="Connect a provider, then sync sleep, recovery, and activity into the local DB."
        actions={
          <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate(undefined)}>
            <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? 'animate-spin' : ''}`} /> sync all
          </Button>
        }
      />
      {providers.isLoading ? (
        <Spinner />
      ) : !providers.data?.length ? (
        <Empty icon={Watch} title="No providers available" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providers.data.map((p) => {
            const st = status.data?.find((s) => s.provider === p.id);
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{p.display_name}</span>
                    <Badge variant={p.status === 'linked' ? 'ok' : 'outline'} className="capitalize">
                      {p.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    auth: {p.auth_strategy} · scopes: {p.scopes.length ? p.scopes.join(' ') : '—'}
                  </div>
                  {st?.resources?.length ? (
                    <ul className="space-y-1 text-xs">
                      {st.resources.map((r) => (
                        <li key={r.resource} className="flex items-center justify-between">
                          <span className="capitalize text-muted-foreground">{r.resource}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {r.last_synced_at ? fmtRelative(r.last_synced_at) : 'never'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {p.status === 'linked' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sync.mutate(p.id)}
                          disabled={sync.isPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> sync
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnect.mutate(p.id)}
                          disabled={disconnect.isPending}
                        >
                          <Unplug className="h-3.5 w-3.5" /> disconnect
                        </Button>
                      </>
                    ) : p.auth_strategy === 'oauth2' ? (
                      <Button
                        size="sm"
                        onClick={() => connect.mutate(p.id)}
                        disabled={connect.isPending}
                      >
                        <Link2 className="h-3.5 w-3.5" /> connect
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not yet supported in dashboard.
                      </span>
                    )}
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

export const Route = createFileRoute('/wearables')({ component: Wearables });
