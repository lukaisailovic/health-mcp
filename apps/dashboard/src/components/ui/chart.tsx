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
import { fmtNum } from '@/lib/format';

export type SeriesPoint = { date: string; value: number | null };

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  boxShadow: 'var(--shadow-lift)',
  fontSize: 12,
  padding: '8px 10px',
};
const tooltipLabelStyle = { color: 'hsl(var(--foreground))', fontWeight: 500, marginBottom: 2 };
const tooltipItemStyle = { color: 'hsl(var(--muted-foreground))' };

export const formatTooltipDate = (v: string): string => {
  if (typeof v !== 'string' || v.length < 7) return v;
  return v.slice(5);
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
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="hsl(var(--border))"
            strokeDasharray="2 4"
            vertical={false}
            opacity={0.6}
          />
          <XAxis
            dataKey="date"
            fontSize={10}
            axisLine={false}
            tickLine={false}
            stroke="hsl(var(--muted-foreground))"
            tickMargin={6}
            tickFormatter={formatTooltipDate}
            minTickGap={28}
          />
          <YAxis
            fontSize={10}
            axisLine={false}
            tickLine={false}
            stroke="hsl(var(--muted-foreground))"
            width={36}
            tickMargin={4}
          />
          {avg !== null ? (
            <ReferenceLine
              y={avg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              opacity={0.45}
            />
          ) : null}
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={{
              stroke: 'hsl(var(--border-strong))',
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
            activeDot={{ r: 4, fill: color, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={420}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
