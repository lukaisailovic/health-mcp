import type { HTMLAttributes, ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  error?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export const FormField = ({
  label,
  htmlFor,
  description,
  error,
  suffix,
  className,
  children,
  ...rest
}: FormFieldProps) => (
  <div className={cn('flex flex-col gap-2', className)} {...rest}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {suffix ? (
      <div className="flex items-center gap-2">
        <div className="flex-1">{children}</div>
        <span className="shrink-0 text-xs text-kumo-subtle">{suffix}</span>
      </div>
    ) : (
      children
    )}
    {error ? (
      <p className="text-xs text-kumo-danger" role="alert">
        {error}
      </p>
    ) : description ? (
      <p className="text-xs text-kumo-subtle">{description}</p>
    ) : null}
  </div>
);

export const FormGrid = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>{children}</div>
);
