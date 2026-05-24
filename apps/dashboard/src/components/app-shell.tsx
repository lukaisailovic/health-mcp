import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  Activity,
  BarChart3,
  Beaker,
  CalendarCheck,
  ChefHat,
  CookingPot,
  History,
  Salad,
  Settings,
  Sparkles,
  Target,
  Watch,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV_PRIMARY: NavItem[] = [
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/log', label: 'Log', icon: History },
  { to: '/trends', label: 'Trends', icon: BarChart3 },
  { to: '/insights', label: 'Insights', icon: Sparkles },
];

const NAV_LIBRARY: NavItem[] = [
  { to: '/foods', label: 'Foods', icon: Salad },
  { to: '/recipes', label: 'Recipes', icon: ChefHat },
  { to: '/batches', label: 'Batches', icon: CookingPot },
];

const NAV_SIGNALS: NavItem[] = [
  { to: '/labs', label: 'Labs', icon: Beaker },
  { to: '/wearables', label: 'Wearables', icon: Watch },
  { to: '/goals', label: 'Goals', icon: Target },
];

const NavGroup = ({
  label,
  items,
  path,
}: {
  label: string;
  items: NavItem[];
  path: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <div className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
      {label}
    </div>
    {items.map(({ to, label: l, icon: Icon }) => {
      const active = path === to || (to !== '/today' && path.startsWith(to));
      return (
        <Link
          key={to}
          to={to}
          data-active={active}
          className={cn(
            'nav-item flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
            active && 'text-foreground',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <span>{l}</span>
        </Link>
      );
    })}
  </div>
);

const ServerStatus = () => {
  const probe = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const ok = !probe.isError && !!probe.data;
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-xs">
      <span className="relative inline-flex h-2 w-2">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-60',
            ok ? 'bg-ok animate-ping' : 'bg-bad',
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            ok ? 'bg-ok' : 'bg-bad',
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">
          {ok ? 'Connected' : 'Offline'}
        </div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">
          {probe.data?.version ?? 'health-mcp'} · {probe.data?.tz ?? '—'}
        </div>
      </div>
    </div>
  );
};

export const AppShell = () => {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="grid min-h-screen grid-cols-[244px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col gap-1 px-3 py-4 backdrop-blur-sm">
        <Link
          to="/today"
          className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface/60"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-ok shadow-soft">
            <Activity className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">health-mcp</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">
              your data, your model
            </span>
          </div>
        </Link>

        <nav className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavGroup label="Daily" items={NAV_PRIMARY} path={path} />
          <NavGroup label="Library" items={NAV_LIBRARY} path={path} />
          <NavGroup label="Signals" items={NAV_SIGNALS} path={path} />
        </nav>

        <div className="flex flex-col gap-2">
          <Link
            to="/settings"
            data-active={path.startsWith('/settings')}
            className={cn(
              'nav-item flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
              path.startsWith('/settings') && 'text-foreground',
            )}
          >
            <Settings
              className={cn(
                'h-4 w-4 shrink-0',
                path.startsWith('/settings') ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span>Settings</span>
          </Link>
          <ServerStatus />
        </div>
      </aside>
      <main className="overflow-auto">
        <div
          key={path}
          className="route-enter mx-auto w-full max-w-6xl px-6 py-8 sm:px-8"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};
