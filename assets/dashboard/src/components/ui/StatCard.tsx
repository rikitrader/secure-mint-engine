'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: ReactNode;
  loading?: boolean;
  trend?: 'up' | 'down';
  trendValue?: string;
}

export function StatCard({
  title,
  value,
  suffix,
  icon,
  loading,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      {loading ? (
        <div className="h-8 bg-muted rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
          {trend && (
            <span
              className={`flex items-center gap-1 text-xs ${
                trend === 'up' ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
