import { fmtNum, pct } from '@/lib/format';

type Macro = { label: string; current: number; goal: number | null; color: string; unit?: string };

const Ring = ({ macro }: { macro: Macro }) => {
  const ratio = pct(macro.current, macro.goal);
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
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
            style={{ stroke: macro.color, transition: 'stroke-dashoffset 320ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-semibold tabular-nums">
            {fmtNum(macro.current, macro.label === 'kcal' ? 0 : 1)}
          </span>
          {macro.goal !== null ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              / {fmtNum(macro.goal, 0)}
              {macro.unit}
            </span>
          ) : null}
        </div>
      </div>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{macro.label}</span>
    </div>
  );
};

export const MacroRings = ({ macros }: { macros: Macro[] }) => (
  <div className="flex flex-wrap gap-6">
    {macros.map((m) => (
      <Ring key={m.label} macro={m} />
    ))}
  </div>
);
