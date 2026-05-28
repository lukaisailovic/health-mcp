import { cn } from '@/lib/cn';
import { ChevronDown } from 'lucide-react';
import { type SelectHTMLAttributes, forwardRef } from 'react';

type Size = 'xs' | 'sm' | 'base' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  xs: 'h-5 rounded-sm px-1.5 pr-6 text-xs',
  sm: 'h-6.5 rounded-md px-2 pr-7 text-xs',
  base: 'h-9 rounded-lg px-3 pr-9 text-base',
  lg: 'h-10 rounded-lg px-4 pr-10 text-base',
};

const ICON_SIZE: Record<Size, string> = {
  xs: 'h-3 w-3 right-1.5',
  sm: 'h-3 w-3 right-2',
  base: 'h-4 w-4 right-3',
  lg: 'h-4 w-4 right-4',
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: Size;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = 'base', children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          't-input w-full appearance-none border border-kumo-line bg-kumo-control text-kumo-default ring-kumo-line/0 transition-[border-color,box-shadow] hover:border-kumo-strong focus-visible:border-kumo-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus disabled:cursor-not-allowed disabled:opacity-50',
          SIZE_CLASS[size],
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-kumo-subtle',
          ICON_SIZE[size],
        )}
      />
    </div>
  ),
);
Select.displayName = 'Select';
