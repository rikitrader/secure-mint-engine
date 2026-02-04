'use client';

import { useTreasuryData } from '@/hooks/useTreasuryData';
import { StatCard } from '@/components/ui/StatCard';
import { TierAllocationChart } from '@/components/charts/TierAllocationChart';
import { format } from 'date-fns';
import {
  Vault,
  TrendingUp,
  Clock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const TIER_LABELS = ['HOT (Instant)', 'WARM (24h)', 'COLD (7d)', 'RWA (30d)'];
const TIER_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b'];

export function TreasuryTab() {
  const { data: treasury, isLoading } = useTreasuryData();

  const formatNumber = (value: bigint | number, decimals: number = 6): string => {
    const num = typeof value === 'bigint' ? Number(value) / 10 ** decimals : value;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      notation: num > 1_000_000 ? 'compact' : 'standard',
    }).format(num);
  };

  const tierBalances = treasury
    ? [
        treasury.tier0Balance,
        treasury.tier1Balance,
        treasury.tier2Balance,
        treasury.tier3Balance,
      ]
    : [0n, 0n, 0n, 0n];

  const tierAllocations = treasury
    ? [
        treasury.tier0Allocation,
        treasury.tier1Allocation,
        treasury.tier2Allocation,
        treasury.tier3Allocation,
      ]
    : [10, 20, 50, 20];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Treasury Vault</h2>
        <p className="text-muted-foreground">
          Multi-tier reserve management with risk-adjusted allocations
        </p>
      </div>

      {/* Total Reserves */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Reserves"
          value={formatNumber(treasury?.totalReserves || 0n, 6)}
          suffix="USDC"
          icon={<Vault className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Last Rebalance"
          value={
            treasury?.lastRebalance
              ? format(treasury.lastRebalance, 'MMM d, HH:mm')
              : 'Never'
          }
          icon={<Clock className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Pending Changes"
          value={treasury?.pendingAllocation ? 'Yes' : 'None'}
          icon={<TrendingUp className="w-5 h-5" />}
          loading={isLoading}
        />
      </div>

      {/* Allocation Chart & Tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie Chart */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Tier Allocation</h3>
          <TierAllocationChart
            balances={tierBalances}
            allocations={tierAllocations}
            labels={TIER_LABELS}
            colors={TIER_COLORS}
          />
        </div>

        {/* Tier Details */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Tier Details</h3>
          <div className="space-y-4">
            {TIER_LABELS.map((label, index) => {
              const balance = tierBalances[index];
              const allocation = tierAllocations[index];
              const total = treasury?.totalReserves || 1n;
              const actualPercent =
                total > 0n
                  ? Number((balance * 10000n) / total) / 100
                  : 0;
              const deviation = actualPercent - allocation;

              return (
                <div key={index} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TIER_COLORS[index] }}
                      />
                      <span className="font-medium">{label}</span>
                    </div>
                    <span className="text-lg font-bold">
                      {formatNumber(balance, 6)} USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Target: {allocation}%
                    </span>
                    <span
                      className={`${
                        Math.abs(deviation) > 5
                          ? 'text-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Actual: {actualPercent.toFixed(1)}%
                      {Math.abs(deviation) > 5 && (
                        <span className="ml-1">
                          ({deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(actualPercent, 100)}%`,
                        backgroundColor: TIER_COLORS[index],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending Allocation Change */}
      {treasury?.pendingAllocation && (
        <div className="bg-card rounded-lg border border-yellow-500/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">Pending Allocation Change</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {TIER_LABELS.map((label, index) => (
              <div key={index} className="text-center">
                <p className="text-sm text-muted-foreground mb-1">{label}</p>
                <div className="flex items-center justify-center gap-2">
                  <span>{tierAllocations[index]}%</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <span className="text-yellow-500 font-bold">
                    {treasury.pendingAllocation.allocations[index]}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Effective: {format(treasury.pendingAllocation.effectiveTime, 'PPpp')}
          </p>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Treasury Activity</h3>
        <div className="space-y-3">
          {treasury?.recentActivity?.map((activity, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    activity.type === 'deposit'
                      ? 'bg-green-500'
                      : activity.type === 'withdrawal'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                  }`}
                />
                <span className="text-sm capitalize">{activity.type}</span>
                <span className="text-sm text-muted-foreground">
                  Tier {activity.tier}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">
                  {formatNumber(activity.amount, 6)} USDC
                </span>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          )) || (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
