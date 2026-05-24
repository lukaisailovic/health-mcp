import { Activity, Key, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setToken } from '@/lib/auth';

export const SetupScreen = ({ reason }: { reason: 'missing' | '401' }) => {
  const [value, setValue] = useState('');
  const handle = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setToken(value.trim());
    window.location.reload();
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>health-mcp</CardTitle>
          </div>
          <CardDescription>
            {reason === '401'
              ? 'Your token was rejected. Paste a new one to continue.'
              : 'This server requires a bearer token. Paste yours to sign in.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handle} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="token" className="flex items-center gap-1.5">
                <Key className="h-3 w-3" /> bearer token
              </Label>
              <Input
                id="token"
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
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Stored only in your browser&apos;s localStorage. No server-side session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
