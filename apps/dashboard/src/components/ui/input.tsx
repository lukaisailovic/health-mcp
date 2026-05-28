import { cn } from '@/lib/cn';
import { Input as KumoInput } from '@cloudflare/kumo';
import type { ComponentProps, ForwardedRef } from 'react';
import { forwardRef } from 'react';

type KumoInputProps = ComponentProps<typeof KumoInput>;

export type InputProps = KumoInputProps;

const InputBase = (
  { className, size = 'base', ...props }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) => <KumoInput ref={ref as never} size={size} className={cn('t-input', className)} {...props} />;

export const Input: ReturnType<typeof forwardRef<HTMLInputElement, InputProps>> =
  forwardRef(InputBase);
Input.displayName = 'Input';
