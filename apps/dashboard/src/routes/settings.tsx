import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Activity, Key, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';
import { cn } from '@/lib/cn';

const TokenSection = () => {
  const [value, setValue] = useState(getToken() ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      clearToken();
    } else {
      setToken(value.trim());
    }
    window.location.reload();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-4 w-4" /> Bearer token
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="token">token</Label>
            <Input
              id="token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 sm:flex-none">
              Save & reload
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearToken();
                window.location.reload();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-kumo-subtle">
          Stored in your browser&apos;s localStorage only. Sent as
          <code className="mx-1 rounded bg-kumo-fill px-1.5 py-0.5">Authorization: Bearer</code>
          on every /api/* call.
        </p>
      </CardContent>
    </Card>
  );
};

const ProbeRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <li className="flex items-center justify-between gap-3 border-t border-kumo-line py-2 first:border-t-0">
    <span className="text-xs uppercase tracking-wide text-kumo-subtle">{label}</span>
    <span className="truncate text-right text-sm tabular-nums">{value}</span>
  </li>
);

const ServerSection = () => {
  const probe = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 60_000,
  });
  const ok = !probe.isError && !!probe.data && probe.data.ok;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Server probe
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={ok ? 'ok' : 'bad'} className="capitalize">
              <span className="relative mr-1 inline-flex h-1.5 w-1.5">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full rounded-full opacity-70',
                    ok ? 'bg-kumo-success animate-ping' : 'bg-kumo-danger',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex h-1.5 w-1.5 rounded-full',
                    ok ? 'bg-kumo-success' : 'bg-kumo-danger',
                  )}
                />
              </span>
              {probe.isLoading ? 'checking' : ok ? 'connected' : 'offline'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={probe.isFetching}
              onClick={() => probe.refetch()}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', probe.isFetching && 'animate-spin')} />
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {probe.isLoading ? (
          <Spinner />
        ) : probe.isError ? (
          <p className="text-sm text-kumo-subtle">
            Unreachable. Is health-mcp running on{' '}
            <code className="rounded bg-kumo-fill px-1 py-0.5">localhost:7777</code>?
          </p>
        ) : probe.data ? (
          <ul className="space-y-0">
            <ProbeRow label="version" value={<span className="font-mono">{probe.data.version}</span>} />
            <ProbeRow
              label="database"
              value={
                <span className={cn('capitalize', probe.data.db === 'up' ? 'text-kumo-success' : 'text-kumo-danger')}>
                  {probe.data.db}
                </span>
              }
            />
            <ProbeRow label="timezone" value={probe.data.tz} />
            <ProbeRow
              label="auth required"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {probe.data.auth_required ? <ShieldCheck className="h-3.5 w-3.5 text-kumo-success" /> : null}
                  {probe.data.auth_required ? 'yes' : 'no'}
                </span>
              }
            />
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
};

const Settings = () => (
  <>
    <PageHeader title="Settings" description="Local-only configuration." />
    <div className="grid gap-4 lg:grid-cols-2">
      <TokenSection />
      <ServerSection />
    </div>
  </>
);

export const Route = createFileRoute('/settings')({ component: Settings });
