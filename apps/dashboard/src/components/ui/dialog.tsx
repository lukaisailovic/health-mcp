import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { Dialog as KumoDialog } from '@cloudflare/kumo';
import { X } from 'lucide-react';
import type { ComponentProps, ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';

export const Dialog = KumoDialog.Root;
export const DialogTrigger = KumoDialog.Trigger;
export const DialogClose = KumoDialog.Close;

type KumoDialogProps = ComponentProps<typeof KumoDialog>;

type DialogContentProps = KumoDialogProps & {
  hideClose?: boolean;
  children?: ReactNode;
};

export const DialogContent = ({ className, children, hideClose, ...props }: DialogContentProps) => (
  <KumoDialog className={cn('p-6', className)} {...props}>
    {children}
    {hideClose ? null : (
      <KumoDialog.Close
        aria-label="Close"
        render={(closeProps) => (
          <Button
            {...(closeProps as ComponentPropsWithoutRef<typeof Button>)}
            variant="ghost"
            shape="square"
            size="sm"
            className="absolute right-3 top-3"
            icon={<X className="h-4 w-4" />}
            aria-label="Close"
          />
        )}
      />
    )}
  </KumoDialog>
);

export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
);

export const DialogTitle = ({ className, ...props }: ComponentProps<typeof KumoDialog.Title>) => (
  <KumoDialog.Title
    className={cn('text-lg font-semibold leading-none tracking-tight text-kumo-strong', className)}
    {...props}
  />
);

export const DialogDescription = ({
  className,
  ...props
}: ComponentProps<typeof KumoDialog.Description>) => (
  <KumoDialog.Description className={cn('text-sm text-kumo-subtle', className)} {...props} />
);
