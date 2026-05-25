import { Activity, Key, ShieldCheck } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setToken } from '@/lib/auth';

export const SetupScreen = ({ reason }: { reason: 'missing' | '401' }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handle = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      const el = inputRef.current;
      if (el) {
        el.classList.remove('is-shaking');
        void el.offsetWidth;
        el.classList.add('is-shaking');
      }
      return;
    }
    setToken(value.trim());
    window.location.reload();
  };
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-kumo-brand">
              <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <CardTitle className="text-base">health-mcp</CardTitle>
          </div>
          <CardDescription className="pt-1">
            {reason === '401'
              ? 'Your token was rejected. Paste a new one to continue.'
              : 'This server requires a bearer token. Paste yours to sign in.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handle} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="token">
                <span className="inline-flex items-center gap-1.5">
                  <Key className="h-3 w-3" /> bearer token
                </span>
              </Label>
              <Input
                id="token"
                ref={inputRef}
                type="password"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="The HEALTH_MCP_TOKEN you started the server with"
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
          <p className="mt-4 flex items-center gap-2 text-xs text-kumo-subtle">
            <ShieldCheck className="h-3 w-3" />
            Stored only in your browser&apos;s localStorage. No server-side session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
