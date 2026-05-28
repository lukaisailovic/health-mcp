import { fmtNum } from '@/lib/format';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type SeriesPoint = { date: string; value: number | null };

const tooltipStyle = {
  background: 'var(--color-kumo-base)',
  border: '1px solid var(--color-kumo-line)',
  borderRadius: 8,
  fontSize: 12,
  padding: '8px 10px',
};
const tooltipLabelStyle = {
  color: 'var(--text-color-kumo-default)',
  fontWeight: 500,
  marginBottom: 2,
};
const tooltipItemStyle = { color: 'var(--text-color-kumo-subtle)' };

export const formatTooltipDate = (v: string): string => {
  if (typeof v !== 'string' || v.length < 7) return v;
  return v.slice(5);
};

const compactY = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return v.toFixed(0);
};

export const TrendArea = ({
  id,
  data,
  color,
  unit,
  title,
  height = 200,
}: {
  id: string;
  data: SeriesPoint[];
  color: string;
  unit?: string;
  title: string;
  height?: number;
}) => {
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const hasData = values.length > 0;
  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--color-kumo-line)"
            strokeDasharray="2 4"
            vertical={false}
            opacity={0.6}
          />
          <XAxis
            dataKey="date"
            fontSize={10}
            axisLine={false}
            tickLine={false}
            stroke="var(--text-color-kumo-subtle)"
            tickMargin={6}
            tickFormatter={formatTooltipDate}
            minTickGap={28}
          />
          <YAxis
            fontSize={10}
            axisLine={false}
            tickLine={false}
            stroke="var(--text-color-kumo-subtle)"
            width={40}
            tickMargin={4}
            tickFormatter={compactY}
            allowDecimals={false}
          />
          {avg !== null ? (
            <ReferenceLine
              y={avg}
              stroke="var(--text-color-kumo-subtle)"
              strokeDasharray="3 3"
              opacity={0.4}
            />
          ) : null}
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={{
              stroke: 'var(--color-kumo-line)',
              strokeDasharray: '3 3',
            }}
            formatter={(v: number) => [`${fmtNum(v, 1)}${unit ? ` ${unit}` : ''}`, title]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#g-${id})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: color,
              stroke: 'var(--color-kumo-base)',
              strokeWidth: 2,
            }}
            isAnimationActive={hasData}
            animationDuration={420}
          />
        </AreaChart>
      </ResponsiveContainer>
      {hasData ? null : (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-xs text-kumo-subtle">No data in this range</span>
        </div>
      )}
    </div>
  );
};
