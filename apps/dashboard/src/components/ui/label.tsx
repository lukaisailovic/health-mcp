import { Label as KumoLabel } from '@cloudflare/kumo';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';

export type LabelProps = ComponentPropsWithoutRef<typeof KumoLabel>;

export const Label = ({ className, ...props }: LabelProps) => (
  <KumoLabel className={cn('text-sm font-medium text-kumo-default', className)} {...props} />
);
