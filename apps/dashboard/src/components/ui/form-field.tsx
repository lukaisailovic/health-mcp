import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';

type FormFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export const FormField = ({
  label,
  htmlFor,
  description,
  error,
  className,
  children,
  ...rest
}: FormFieldProps) => (
  <div className={cn('flex flex-col gap-2', className)} {...rest}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
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
}) => <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>{children}</div>;
