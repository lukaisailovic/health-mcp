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
  valueClass,
}: {
  macro: Macro;
  size: number;
  stroke: number;
  valueClass: string;
}) => {
  const ratio = pct(macro.current, macro.goal);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const valueDigits = macro.label === 'kcal' ? 0 : 1;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 overflow-visible">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            stroke="var(--color-kumo-fill)"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            stroke={macro.color}
            style={{ transition: 'stroke-dashoffset 480ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={valueClass}>
            <AnimatedNumber value={fmtNum(macro.current, valueDigits)} />
          </span>
          {macro.goal !== null ? (
            <span className="mt-1 text-[10px] font-medium tabular-nums text-kumo-subtle">
              {Math.round(ratio * 100)}% · {fmtNum(macro.goal, 0)}
              {macro.unit ?? ''}
            </span>
          ) : null}
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-kumo-subtle">
        {macro.label}
      </span>
    </div>
  );
};

const HERO_VALUE_CLASS = 'text-2xl font-semibold tabular-nums text-kumo-strong';
const SMALL_VALUE_CLASS = 'text-base font-semibold tabular-nums text-kumo-strong';

export const MacroRings = ({ macros }: { macros: Macro[] }) => {
  if (macros.length === 0) return null;
  const [kcal, ...rest] = macros;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <Ring macro={kcal!} size={148} stroke={12} valueClass={HERO_VALUE_CLASS} />
      <div className="grid w-full flex-1 grid-cols-3 gap-2 sm:gap-6">
        {rest.map((m) => (
          <div key={m.label} className="flex justify-center">
            <Ring macro={m} size={84} stroke={7} valueClass={SMALL_VALUE_CLASS} />
          </div>
        ))}
      </div>
    </div>
  );
};
