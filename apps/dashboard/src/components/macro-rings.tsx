import { AnimatedNumber } from '@/components/animated-number';
import { fmtNum, pct } from '@/lib/format';

type Macro = {
  label: string;
  current: number;
  goal: number | null;
  color: string;
  unit?: string;
};

const Ring = ({
  macro,
  size,
  stroke,
  variant,
}: {
  macro: Macro;
  size: number;
  stroke: number;
  variant: 'hero' | 'small';
}) => {
  const ratio = pct(macro.current, macro.goal);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const valueDigits = macro.label === 'kcal' ? 0 : 1;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 overflow-visible">
          <defs>
            <linearGradient id={`ring-${macro.label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={macro.color} stopOpacity={1} />
              <stop offset="100%" stopColor={macro.color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            stroke={`url(#ring-${macro.label})`}
            style={{
              transition: 'stroke-dashoffset 480ms cubic-bezier(0.22, 1, 0.36, 1)',
              filter: `drop-shadow(0 0 6px ${macro.color}40)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span
            className={
              variant === 'hero'
                ? 'text-2xl font-semibold tabular-nums'
                : 'text-base font-semibold tabular-nums'
            }
          >
            <AnimatedNumber value={fmtNum(macro.current, valueDigits)} />
          </span>
          {macro.goal !== null ? (
            <span className="mt-1 text-[10px] font-medium tabular-nums text-muted-foreground">
              {Math.round(ratio * 100)}% · {fmtNum(macro.goal, 0)}
              {macro.unit ?? ''}
            </span>
          ) : null}
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {macro.label}
      </span>
    </div>
  );
};

export const MacroRings = ({ macros }: { macros: Macro[] }) => {
  if (macros.length === 0) return null;
  const kcal = macros[0]!;
  const rest = macros.slice(1);
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <Ring macro={kcal} size={156} stroke={12} variant="hero" />
      <div className="grid flex-1 grid-cols-3 gap-4 sm:gap-6">
        {rest.map((m) => (
          <Ring key={m.label} macro={m} size={96} stroke={8} variant="small" />
        ))}
      </div>
    </div>
  );
};
