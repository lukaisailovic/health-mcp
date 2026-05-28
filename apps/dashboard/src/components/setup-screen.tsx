import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setToken } from '@/lib/auth';
import { Key, ShieldCheck } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';

const CODE_CLASS = 'rounded bg-kumo-fill px-1 py-0.5 font-mono text-[0.85em] text-kumo-default';

export const SetupScreen = ({ reason }: { reason: 'missing' | '401' }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rejected = reason === '401';

  const handleSubmit = (e: FormEvent) => {
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
    <main className="relative grid min-h-screen place-items-center overflow-x-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[60vh] max-h-[540px] w-full max-w-3xl"
        style={{
          background:
            'radial-gradient(50% 60% at 50% 0%, color-mix(in oklab, var(--color-kumo-brand) 20%, transparent), transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm">
        <div className="t-panel-reveal flex flex-col items-center text-center">
          <img
            src="/logo.webp"
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl object-cover shadow-xl shadow-black/5 ring-1 ring-kumo-line"
          />
          <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-kumo-strong">
            <span translate="no">health-mcp</span>
          </h1>
          <p className="mt-1.5 text-sm text-kumo-subtle">your data, your model</p>
        </div>

        <Card className="t-panel-reveal mt-8" style={{ animationDelay: '90ms' }}>
          <CardContent className="px-6 pb-6 pt-6">
            <div className="text-center">
              <h2 className="text-base font-semibold tracking-tight text-kumo-strong">
                Enter Access Token
              </h2>
              <p
                role={rejected ? 'alert' : undefined}
                className="mt-1.5 text-balance text-sm text-kumo-subtle"
              >
                {rejected ? (
                  <>
                    That token was rejected. Paste a valid{' '}
                    <code translate="no" className={CODE_CLASS}>
                      HEALTH_MCP_TOKEN
                    </code>{' '}
                    to continue.
                  </>
                ) : (
                  <>
                    This dashboard is protected. Paste the{' '}
                    <code translate="no" className={CODE_CLASS}>
                      HEALTH_MCP_TOKEN
                    </code>{' '}
                    you started the server with.
                  </>
                )}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-2">
              <Label htmlFor="token">
                <span className="inline-flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" aria-hidden="true" /> Bearer token
                </span>
              </Label>
              <Input
                id="token"
                name="token"
                ref={inputRef}
                type="password"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste your token…"
              />
              <Button type="submit" className="mt-2 w-full">
                Unlock Dashboard
              </Button>
            </form>

            <p className="mt-5 text-balance border-t border-kumo-line pt-4 text-center text-xs text-kumo-subtle">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />
              Kept in your browser’s{' '}
              <code translate="no" className="font-mono text-kumo-default">
                localStorage
              </code>
              . No server session.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
