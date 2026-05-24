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
import { cn } from '@/lib/cn';

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/log', label: 'Log', icon: History },
  { to: '/trends', label: 'Trends', icon: BarChart3 },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/foods', label: 'Foods', icon: Salad },
  { to: '/recipes', label: 'Recipes', icon: ChefHat },
  { to: '/batches', label: 'Batches', icon: CookingPot },
  { to: '/labs', label: 'Labs', icon: Beaker },
  { to: '/wearables', label: 'Wearables', icon: Watch },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const AppShell = () => {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-card">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">health-mcp</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = path === to || (to !== '/today' && path.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  active && 'bg-accent text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
