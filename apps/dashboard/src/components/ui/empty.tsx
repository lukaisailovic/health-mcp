import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type EmptyProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export const Empty = ({ icon: Icon, title, description, action, className }: EmptyProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center',
      className,
    )}
  >
    {Icon ? <Icon className="h-8 w-8 text-muted-foreground" /> : null}
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
    {action}
  </div>
);
