import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export const SectionLabel = ({
  children,
  icon: Icon,
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) => (
  <div
    className={cn(
      'flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-kumo-subtle',
      className,
    )}
  >
    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
    <span>{children}</span>
  </div>
);
