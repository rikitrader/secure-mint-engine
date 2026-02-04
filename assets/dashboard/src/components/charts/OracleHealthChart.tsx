'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface OracleHistoryEntry {
  timestamp: Date;
  backing: bigint;
  healthFactor: number;
}

interface OracleHealthChartProps {
  data?: OracleHistoryEntry[];
}

export function OracleHealthChart({ data }: OracleHealthChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No historical data available
      </div>
    );
  }

  const chartData = data.map((entry) => ({
    timestamp: entry.timestamp.getTime(),
    healthFactor: entry.healthFactor,
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="timestamp"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(value) => format(new Date(value), 'MMM d')}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          domain={[90, 110]}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          labelFormatter={(value) => format(new Date(value), 'PPpp')}
          formatter={(value: number) => [`${value.toFixed(2)}%`, 'Health Factor']}
        />
        <ReferenceLine
          y={100}
          stroke="#eab308"
          strokeDasharray="5 5"
          label={{
            value: '100%',
            fill: '#eab308',
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="healthFactor"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#healthGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
