import { cn } from '@/lib/cn';
import { Badge as KumoBadge } from '@cloudflare/kumo';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type LegacyVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'muted'
  | 'ok'
  | 'warn'
  | 'bad';

type KumoBadgeProps = ComponentPropsWithoutRef<typeof KumoBadge>;
type KumoVariant = NonNullable<KumoBadgeProps['variant']>;

const VARIANT_MAP: Record<LegacyVariant, KumoVariant> = {
  default: 'primary',
  primary: 'primary',
  secondary: 'secondary',
  outline: 'outline',
  muted: 'neutral',
  ok: 'success',
  warn: 'warning',
  bad: 'error',
};

export type BadgeProps = Omit<KumoBadgeProps, 'variant'> & {
  variant?: LegacyVariant;
  children?: ReactNode;
};

export const Badge = ({ className, variant = 'default', children, ...props }: BadgeProps) => (
  <KumoBadge variant={VARIANT_MAP[variant]} className={cn(className)} {...props}>
    {children}
  </KumoBadge>
);
