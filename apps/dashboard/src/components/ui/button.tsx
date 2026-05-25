import { Button as KumoButton } from '@cloudflare/kumo';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type LegacyVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';
type LegacySize = 'default' | 'xs' | 'sm' | 'lg' | 'icon';
type Shape = 'base' | 'square' | 'circle';
type KumoSize = 'xs' | 'sm' | 'base' | 'lg';
type KumoVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'secondary-destructive'
  | 'outline';

const VARIANT_MAP: Record<LegacyVariant, KumoVariant> = {
  default: 'primary',
  primary: 'primary',
  secondary: 'secondary',
  destructive: 'destructive',
  outline: 'outline',
  ghost: 'ghost',
  link: 'ghost',
};

const SIZE_MAP: Record<LegacySize, KumoSize> = {
  default: 'base',
  xs: 'xs',
  sm: 'sm',
  lg: 'lg',
  icon: 'base',
};

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> & {
  variant?: LegacyVariant;
  size?: LegacySize;
  icon?: ReactNode;
  loading?: boolean;
  shape?: Shape;
};

export const Button = ({
  variant = 'default',
  size = 'default',
  shape,
  ...props
}: ButtonProps) => {
  const resolvedShape: Shape = shape ?? (size === 'icon' ? 'square' : 'base');
  return (
    // @ts-expect-error — Kumo Button's discriminated union doesn't model both shape:base + icon-only;
    // we pass through and trust callers to supply aria-label for icon buttons.
    <KumoButton
      variant={VARIANT_MAP[variant]}
      size={SIZE_MAP[size]}
      shape={resolvedShape}
      {...props}
    />
  );
};
Button.displayName = 'Button';
