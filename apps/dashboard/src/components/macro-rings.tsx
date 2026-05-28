import { AnimatedNumber } from '@/components/animated-number';
import { fmtNum } from '@/lib/format';
import type { GoalBound, GoalStatus } from '@health-mcp/shared/dto';

type Macro = {
  label: string;
  current: number;
  bound: GoalBound;
  status: GoalStatus;
  color: string;
  unit?: string;
};

const STATUS_COLOR: Record<GoalStatus, string | null> = {
  no_goal: null,
  under: null,
  in_range: 'var(--color-kumo-success)',
  over: 'var(--color-kumo-danger)',
};

const STATUS_LABEL: Record<GoalStatus, string> = {
  no_goal: '',
  under: 'low',
  in_range: 'on track',
  over: 'over',
};

const primaryTarget = (b: GoalBound): number | null => b.max ?? b.min;

const formatBound = (b: GoalBound): string | null => {
  if (b.min !== null && b.max !== null && b.min !== b.max) {
    return `${fmtNum(b.min, 0)}–${fmtNum(b.max, 0)}`;
  }
  if (b.max !== null) return `≤ ${fmtNum(b.max, 0)}`;
  if (b.min !== null) return `≥ ${fmtNum(b.min, 0)}`;
  return null;
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
  const target = primaryTarget(macro.bound);
  const ratio = target && target > 0 ? Math.min(1, Math.max(0, macro.current / target)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const valueDigits = macro.label === 'kcal' ? 0 : 1;
  const ringColor = STATUS_COLOR[macro.status] ?? macro.color;
  const boundLabel = formatBound(macro.bound);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden="true">
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
            stroke={ringColor}
            style={{ transition: 'stroke-dashoffset 480ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={valueClass}>
            <AnimatedNumber value={fmtNum(macro.current, valueDigits)} />
          </span>
          {boundLabel ? (
            <span className="mt-1 text-[10px] font-medium tabular-nums text-kumo-subtle">
              {boundLabel}
              {macro.unit ?? ''}
            </span>
          ) : null}
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-kumo-subtle">
        {macro.label}
        {macro.status !== 'no_goal' ? (
          <span className="ml-1 text-[10px] normal-case" style={{ color: ringColor }}>
            · {STATUS_LABEL[macro.status]}
          </span>
        ) : null}
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
      <div className="grid w-full flex-1 grid-cols-4 gap-2 sm:gap-6">
        {rest.map((m) => (
          <div key={m.label} className="flex justify-center">
            <Ring macro={m} size={84} stroke={7} valueClass={SMALL_VALUE_CLASS} />
          </div>
        ))}
      </div>
    </div>
  );
};
