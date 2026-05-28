import { cn } from '@/lib/cn';
import { Loader } from '@cloudflare/kumo';

type SpinnerSize = 'sm' | 'base' | 'lg';

const pickSize = (className?: string): SpinnerSize => {
  if (!className) return 'base';
  if (className.includes('h-3') || className.includes('h-4')) return 'sm';
  if (className.includes('h-6') || className.includes('h-7') || className.includes('h-8'))
    return 'lg';
  return 'base';
};

export const Spinner = ({ className }: { className?: string }) => (
  <Loader size={pickSize(className)} className={cn('text-kumo-subtle', className)} />
);
