import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Key,
  Plug,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
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

type Probe = NonNullable<ReturnType<typeof useHealthProbe>['data']>;

const useHealthProbe = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 60_000,
  });

const TokenSection = () => {
  const initial = getToken() ?? '';
  const [value, setValue] = useState(initial);
  const [reveal, setReveal] = useState(false);
  const dirty = value !== initial;
  const hasSaved = initial.length > 0;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" /> Bearer token
          </CardTitle>
          <Badge variant={hasSaved ? 'ok' : 'outline'} className="capitalize">
            {hasSaved ? 'saved' : 'not set'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="token">Token</Label>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Input
                  id="token"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={hasSaved ? '••••••••' : 'paste your HEALTH_MCP_TOKEN'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full pr-9"
                />
                <button
                  type="button"
                  aria-label={reveal ? 'Hide token' : 'Show token'}
                  onClick={() => setReveal((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-kumo-subtle transition-colors hover:text-kumo-default"
                >
                  {reveal ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <Button type="submit" disabled={!dirty}>
                Save & reload
              </Button>
              {hasSaved ? (
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Clear token"
                  onClick={() => {
                    clearToken();
                    window.location.reload();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only">Clear</span>
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-kumo-subtle">
            Stored in your browser&apos;s localStorage only. Sent as{' '}
            <code className="rounded bg-kumo-fill px-1.5 py-0.5">Authorization: Bearer</code>{' '}
            on every <code className="rounded bg-kumo-fill px-1.5 py-0.5">/api/*</code> call.
          </p>
        </form>
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

const StatusDot = ({ ok }: { ok: boolean }) => (
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
);

const ServerSection = ({ probe }: { probe: ReturnType<typeof useHealthProbe> }) => {
  const ok = !probe.isError && !!probe.data && probe.data.ok;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Connection
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={ok ? 'ok' : 'bad'} className="capitalize">
              <StatusDot ok={ok} />
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

const PathRow = ({
  icon: Icon,
  label,
  path,
}: {
  icon: typeof Database;
  label: string;
  path: string;
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-kumo-subtle">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border border-kumo-line bg-kumo-fill px-2.5 py-1.5 text-xs">
          {path}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Copy ${label} path`}
          onClick={copy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-kumo-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
    </div>
  );
};

const StorageSection = ({ probe }: { probe: Probe }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <HardDrive className="h-4 w-4" /> Storage
      </CardTitle>
      <p className="text-xs text-kumo-subtle">
        Everything stays local — pass{' '}
        <code className="rounded bg-kumo-fill px-1 py-0.5">--db</code> or{' '}
        <code className="rounded bg-kumo-fill px-1 py-0.5">HEALTH_MCP_DB</code> to move them.
      </p>
    </CardHeader>
    <CardContent className="space-y-4">
      <PathRow icon={Database} label="Database" path={probe.db_path} />
      <PathRow icon={Key} label="Auth file" path={probe.auth_path} />
    </CardContent>
  </Card>
);

const RuntimeSection = ({ probe }: { probe: Probe }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Server className="h-4 w-4" /> Runtime
      </CardTitle>
      <p className="text-xs text-kumo-subtle">
        Set via CLI flags, <code className="rounded bg-kumo-fill px-1 py-0.5">HEALTH_MCP_*</code>{' '}
        env vars, or the JSON config file.
      </p>
    </CardHeader>
    <CardContent>
      <ul className="space-y-0">
        <ProbeRow
          label="bind"
          value={
            <span className="font-mono">
              {probe.host}:{probe.port}
            </span>
          }
        />
        <ProbeRow
          label="dashboard"
          value={
            <Badge variant={probe.dashboard ? 'ok' : 'muted'} className="capitalize">
              {probe.dashboard ? 'on' : 'off'}
            </Badge>
          }
        />
        <ProbeRow
          label="log level"
          value={<span className="font-mono uppercase">{probe.log_level}</span>}
        />
        <ProbeRow
          label="auto migrate"
          value={
            <Badge variant={probe.auto_migrate ? 'ok' : 'muted'} className="capitalize">
              {probe.auto_migrate ? 'enabled' : 'disabled'}
            </Badge>
          }
        />
        <ProbeRow
          label="whoop cron"
          value={<span className="font-mono text-xs">{probe.whoop_sync_cron}</span>}
        />
        <ProbeRow
          label="wearable redirect"
          value={
            probe.wearable_redirect_base ? (
              <span className="truncate font-mono text-xs">{probe.wearable_redirect_base}</span>
            ) : (
              <span className="text-kumo-subtle">—</span>
            )
          }
        />
      </ul>
    </CardContent>
  </Card>
);

const PROVIDER_ENV: Record<keyof Probe['providers'], string[]> = {
  usda: ['HEALTH_MCP_USDA_API_KEY'],
  whoop: ['HEALTH_MCP_WHOOP_CLIENT_ID', 'HEALTH_MCP_WHOOP_CLIENT_SECRET'],
  oura: ['HEALTH_MCP_OURA_CLIENT_ID', 'HEALTH_MCP_OURA_CLIENT_SECRET'],
};

const PROVIDER_LABEL: Record<keyof Probe['providers'], string> = {
  usda: 'USDA FoodData Central',
  whoop: 'Whoop',
  oura: 'Oura',
};

const ProvidersSection = ({ probe }: { probe: Probe }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Plug className="h-4 w-4" /> Providers
      </CardTitle>
      <p className="text-xs text-kumo-subtle">
        Credential presence only — secrets never leave the server.
      </p>
    </CardHeader>
    <CardContent>
      <ul className="space-y-0">
        {(Object.keys(PROVIDER_LABEL) as Array<keyof Probe['providers']>).map((key) => {
          const configured = probe.providers[key];
          return (
            <li
              key={key}
              className="flex items-start justify-between gap-3 border-t border-kumo-line py-3 first:border-t-0"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium text-kumo-default">
                  {PROVIDER_LABEL[key]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDER_ENV[key].map((envName) => (
                    <code
                      key={envName}
                      className="rounded bg-kumo-fill px-1.5 py-0.5 text-[10px] text-kumo-subtle"
                    >
                      {envName}
                    </code>
                  ))}
                </div>
              </div>
              <Badge variant={configured ? 'ok' : 'outline'} className="shrink-0 capitalize">
                {configured ? 'configured' : 'not set'}
              </Badge>
            </li>
          );
        })}
      </ul>
    </CardContent>
  </Card>
);

const Settings = () => {
  const probe = useHealthProbe();
  return (
    <>
      <PageHeader title="Settings" description="Local-only configuration." />
      <div className="grid gap-4 lg:grid-cols-2">
        <TokenSection />
        <ServerSection probe={probe} />
        {probe.data ? <StorageSection probe={probe.data} /> : null}
        {probe.data ? <RuntimeSection probe={probe.data} /> : null}
        {probe.data ? <ProvidersSection probe={probe.data} /> : null}
      </div>
    </>
  );
};

export const Route = createFileRoute('/settings')({ component: Settings });
