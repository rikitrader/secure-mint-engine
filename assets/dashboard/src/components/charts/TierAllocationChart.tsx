'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface TierAllocationChartProps {
  balances: bigint[];
  allocations: number[];
  labels: string[];
  colors: string[];
}

export function TierAllocationChart({
  balances,
  allocations,
  labels,
  colors,
}: TierAllocationChartProps) {
  const total = balances.reduce((sum, b) => sum + b, 0n);

  const data = balances.map((balance, index) => ({
    name: labels[index],
    value: Number(balance) / 10 ** 6,
    target: allocations[index],
    actual: total > 0n ? Number((balance * 10000n) / total) / 100 : 0,
    color: colors[index],
  }));

  const formatValue = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          formatter={(value: number, name: string) => [
            formatValue(value),
            name,
          ]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value, entry: any) => {
            const item = data.find((d) => d.name === value);
            return (
              <span className="text-sm">
                {value} ({item?.actual.toFixed(1)}%)
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
