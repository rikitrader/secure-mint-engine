'use client';

interface HealthGaugeProps {
  healthFactor: number;
  backing: bigint;
  supply: bigint;
}

export function HealthGauge({ healthFactor, backing, supply }: HealthGaugeProps) {
  const getColor = (value: number) => {
    if (value >= 105) return '#22c55e'; // Green
    if (value >= 100) return '#84cc16'; // Lime
    if (value >= 95) return '#eab308'; // Yellow
    if (value >= 90) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const getStatusText = (value: number) => {
    if (value >= 105) return 'Healthy';
    if (value >= 100) return 'Adequate';
    if (value >= 95) return 'Warning';
    if (value >= 90) return 'Critical';
    return 'Undercollateralized';
  };

  // Calculate angle for gauge (0-180 degrees)
  const clampedValue = Math.min(Math.max(healthFactor, 80), 120);
  const angle = ((clampedValue - 80) / 40) * 180;
  const color = getColor(healthFactor);
  const statusText = getStatusText(healthFactor);

  const formatNumber = (value: bigint, decimals: number): string => {
    const num = Number(value) / 10 ** decimals;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      notation: num > 1_000_000 ? 'compact' : 'standard',
    }).format(num);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold mb-4 text-center">System Health</h3>

      {/* Gauge */}
      <div className="relative w-48 h-24 mx-auto mb-4">
        {/* Background arc */}
        <svg className="w-full h-full" viewBox="0 0 200 100">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="25%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="75%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          {/* Background track */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 251.2} 251.2`}
          />
          {/* Needle */}
          <g transform={`rotate(${angle - 90}, 100, 90)`}>
            <line
              x1="100"
              y1="90"
              x2="100"
              y2="30"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="90" r="6" fill={color} />
          </g>
        </svg>

        {/* Value display */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {healthFactor.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="text-center mb-4">
        <span
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {statusText}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Backing</span>
          <span className="font-medium">{formatNumber(backing, 6)} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Supply</span>
          <span className="font-medium">{formatNumber(supply, 18)} USDB</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-border">
          <span className="text-muted-foreground">Ratio</span>
          <span className="font-medium" style={{ color }}>
            {healthFactor >= 100 ? '1:' : '0.'}{healthFactor >= 100 ? (healthFactor / 100).toFixed(2) : healthFactor.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}
