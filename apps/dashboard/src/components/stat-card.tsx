import { AnimatedNumber } from '@/components/animated-number';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'default' | 'ok' | 'warn' | 'bad' | 'primary';

const toneIconBg: Record<Tone, string> = {
  default: 'bg-kumo-fill text-kumo-default',
  primary: 'bg-kumo-info-tint text-kumo-info',
  ok: 'bg-kumo-success-tint text-kumo-success',
  warn: 'bg-kumo-warning-tint text-kumo-warning',
  bad: 'bg-kumo-danger-tint text-kumo-danger',
};

const toneValueColor: Record<Tone, string> = {
  default: 'text-kumo-strong',
  primary: 'text-kumo-strong',
  ok: 'text-kumo-success',
  warn: 'text-kumo-warning',
  bad: 'text-kumo-danger',
};

export const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) => {
  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  return (
    <Card className={cn('transition-colors hover:bg-kumo-elevated', className)}>
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-kumo-subtle">
            {label}
          </div>
          <div
            className={cn(
              'mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums',
              toneValueColor[tone],
            )}
          >
            {stringValue !== null ? <AnimatedNumber value={stringValue} /> : value}
          </div>
          {hint ? <div className="mt-1.5 text-xs text-kumo-subtle">{hint}</div> : null}
        </div>
        {Icon ? (
          <div
            className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', toneIconBg[tone])}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </Card>
  );
};
