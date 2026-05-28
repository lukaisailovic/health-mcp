import { cn } from '@/lib/cn';
import { useEffect, useRef, useState } from 'react';

export const AnimatedNumber = ({
  value,
  className,
}: {
  value: string;
  className?: string;
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    setDisplay(value);
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-animating');
    void el.offsetWidth;
    el.classList.add('is-animating');
  }, [value]);

  return (
    <span ref={ref} className={cn('t-number', className)}>
      {display.split('').map((ch, i) => (
        <span key={`${i}-${ch}`} style={{ ['--i' as string]: i }}>
          {ch}
        </span>
      ))}
    </span>
  );
};
