import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Key, RefreshCw, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';

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
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
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
          <Button type="submit">Save & reload</Button>
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
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Stored in your browser&apos;s localStorage only. Sent as
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5">Authorization: Bearer</code>
          on every /api/* call.
        </p>
      </CardContent>
    </Card>
  );
};

const ServerSection = () => {
  const probe = useQuery({ queryKey: ['health'], queryFn: () => api.health() });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Server
        </CardTitle>
      </CardHeader>
      <CardContent>
        {probe.isLoading ? (
          <Spinner />
        ) : probe.data ? (
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">version</span>
              <span className="font-mono">{probe.data.version}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">db</span>
              <span>{probe.data.db}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">tz</span>
              <span>{probe.data.tz}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">auth required</span>
              <span>{probe.data.auth_required ? 'yes' : 'no'}</span>
            </li>
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">unreachable</span>
        )}
      </CardContent>
    </Card>
  );
};

const Settings = () => (
  <>
    <PageHeader title="Settings" description="Local-only configuration." />
    <div className="grid gap-4 md:grid-cols-2">
      <TokenSection />
      <ServerSection />
    </div>
  </>
);

export const Route = createFileRoute('/settings')({ component: Settings });
