import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnimatedNumber } from '@/components/animated-number';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'ok' | 'warn' | 'bad' | 'primary';

const toneIconBg: Record<Tone, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
};

const toneValueColor: Record<Tone, string> = {
  default: 'text-foreground',
  primary: 'text-foreground',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
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
    <Card
      className={cn(
        'group transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-lift',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
          {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {Icon ? (
          <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', toneIconBg[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </Card>
  );
};
