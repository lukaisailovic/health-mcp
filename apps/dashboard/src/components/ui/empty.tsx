import { Empty as KumoEmpty } from '@cloudflare/kumo';
import type { LucideIcon } from 'lucide-react';
import { createElement, isValidElement, type ReactNode } from 'react';

export type EmptyProps = {
  icon?: LucideIcon | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

const renderIcon = (icon: EmptyProps['icon']): ReactNode => {
  if (icon == null) return undefined;
  if (isValidElement(icon)) return icon;
  return createElement(icon as LucideIcon, { className: 'h-6 w-6' });
};

export const Empty = ({ icon, title, description, action, className }: EmptyProps) => (
  <KumoEmpty
    icon={renderIcon(icon)}
    title={title}
    description={description}
    contents={action}
    className={className}
  />
);
