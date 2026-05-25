import { Dialog } from '@cloudflare/kumo';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  Activity,
  BarChart3,
  Beaker,
  CalendarCheck,
  ChefHat,
  CookingPot,
  History,
  Menu,
  Salad,
  Settings,
  Sparkles,
  Target,
  Watch,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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

const NAV_SETTINGS: NavItem = { to: '/settings', label: 'Settings', icon: Settings };

const ALL_NAV: NavItem[] = [...NAV_PRIMARY, ...NAV_LIBRARY, ...NAV_SIGNALS, NAV_SETTINGS];

const isActivePath = (path: string, to: string): boolean =>
  path === to || (to !== '/today' && path.startsWith(to));

const NavLink = ({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) => (
  <Link
    to={item.to}
    onClick={onNavigate}
    className={cn(
      'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-kumo-fill text-kumo-strong'
        : 'text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default',
    )}
  >
    <item.icon
      className={cn(
        'h-4 w-4 shrink-0 transition-colors',
        active ? 'text-kumo-brand' : 'text-kumo-subtle group-hover:text-kumo-default',
      )}
    />
    <span>{item.label}</span>
  </Link>
);

const NavGroup = ({
  label,
  items,
  path,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  path: string;
  onNavigate?: () => void;
}) => (
  <div className="flex flex-col gap-0.5">
    <div className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle">
      {label}
    </div>
    {items.map((item) => (
      <NavLink
        key={item.to}
        item={item}
        active={isActivePath(path, item.to)}
        onNavigate={onNavigate}
      />
    ))}
  </div>
);

const Brand = ({ onNavigate }: { onNavigate?: () => void }) => (
  <Link
    to="/today"
    onClick={onNavigate}
    className="flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors hover:bg-kumo-tint"
  >
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-kumo-brand">
      <Activity className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
    </div>
    <div className="flex flex-col leading-none">
      <span className="text-sm font-semibold tracking-tight text-kumo-strong">health-mcp</span>
      <span className="mt-0.5 text-[10px] text-kumo-subtle">your data, your model</span>
    </div>
  </Link>
);

const NavSections = ({ path, onNavigate }: { path: string; onNavigate?: () => void }) => (
  <>
    <NavGroup label="Daily" items={NAV_PRIMARY} path={path} onNavigate={onNavigate} />
    <NavGroup label="Library" items={NAV_LIBRARY} path={path} onNavigate={onNavigate} />
    <NavGroup label="Signals" items={NAV_SIGNALS} path={path} onNavigate={onNavigate} />
  </>
);

const SettingsLink = ({ path, onNavigate }: { path: string; onNavigate?: () => void }) => (
  <NavLink
    item={NAV_SETTINGS}
    active={isActivePath(path, NAV_SETTINGS.to)}
    onNavigate={onNavigate}
  />
);

const currentSectionLabel = (path: string): string =>
  ALL_NAV.find((n) => isActivePath(path, n.to))?.label ?? 'health-mcp';

const MobileNav = ({ path }: { path: string }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={(p) => (
          <Button
            {...p}
            variant="ghost"
            shape="square"
            size="sm"
            icon={<Menu className="h-5 w-5" />}
            aria-label="Open navigation"
          />
        )}
      />
      <Dialog className="left-0 top-0 h-full w-[82%] max-w-[300px] translate-x-0 translate-y-0 rounded-none p-3">
        <div className="flex items-center justify-between">
          <Brand onNavigate={() => setOpen(false)} />
          <Dialog.Close
            aria-label="Close navigation"
            render={(p) => (
              <Button
                {...p}
                variant="ghost"
                shape="square"
                size="sm"
                icon={<X className="h-4 w-4" />}
                aria-label="Close"
              />
            )}
          />
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavSections path={path} onNavigate={() => setOpen(false)} />
        </nav>
        <SettingsLink path={path} onNavigate={() => setOpen(false)} />
      </Dialog>
    </Dialog.Root>
  );
};

export const AppShell = () => {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const sectionLabel = currentSectionLabel(path);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-kumo-line bg-kumo-canvas px-3 py-4 lg:flex">
        <Brand />
        <nav className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavSections path={path} />
        </nav>
        <SettingsLink path={path} />
      </aside>
      <main className="flex min-h-screen flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-kumo-line bg-kumo-canvas/85 px-3 py-2 backdrop-blur lg:hidden">
          <MobileNav path={path} />
          <span className="truncate text-sm font-semibold tracking-tight text-kumo-strong">
            {sectionLabel}
          </span>
          <Link
            to="/today"
            aria-label="Home"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md bg-kumo-brand"
          >
            <Activity className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </Link>
        </header>
        <div
          key={path}
          className="route-enter mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};
