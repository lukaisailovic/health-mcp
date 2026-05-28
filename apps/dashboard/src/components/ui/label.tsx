import { cn } from '@/lib/cn';
import { Label as KumoLabel } from '@cloudflare/kumo';
import type { ComponentPropsWithoutRef } from 'react';

export type LabelProps = ComponentPropsWithoutRef<typeof KumoLabel>;

export const Label = ({ className, ...props }: LabelProps) => (
  <KumoLabel className={cn('text-sm font-medium text-kumo-default', className)} {...props} />
);
