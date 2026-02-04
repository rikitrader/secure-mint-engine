'use client';

import { useSystemStatus } from '@/hooks/useSystemStatus';
import { useOracleData } from '@/hooks/useOracleData';
import { useTreasuryData } from '@/hooks/useTreasuryData';
import { StatCard } from '@/components/ui/StatCard';
import { HealthGauge } from '@/components/ui/HealthGauge';
import { SupplyChart } from '@/components/charts/SupplyChart';
import { MintActivityChart } from '@/components/charts/MintActivityChart';
import {
  Coins,
  Shield,
  Clock,
  Activity,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

export function OverviewTab() {
  const { data: status, isLoading: statusLoading } = useSystemStatus();
  const { data: oracle, isLoading: oracleLoading } = useOracleData();
  const { data: treasury, isLoading: treasuryLoading } = useTreasuryData();

  const formatNumber = (value: bigint | number, decimals: number = 6): string => {
    const num = typeof value === 'bigint' ? Number(value) / 10 ** decimals : value;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      notation: num > 1_000_000 ? 'compact' : 'standard',
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {status?.alertLevel && status.alertLevel !== 'NORMAL' && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            status.alertLevel === 'ELEVATED'
              ? 'bg-yellow-500/10 border border-yellow-500/30'
              : status.alertLevel === 'RESTRICTED'
              ? 'bg-orange-500/10 border border-orange-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 ${
              status.alertLevel === 'ELEVATED'
                ? 'text-yellow-500'
                : status.alertLevel === 'RESTRICTED'
                ? 'text-orange-500'
                : 'text-red-500'
            }`}
          />
          <span className="font-medium">
            System Alert: {status.alertLevel} - {status.alertReason || 'Monitoring active'}
          </span>
        </div>
      )}

      {/* Health Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <HealthGauge
            healthFactor={status?.healthFactor || 100}
            backing={oracle?.currentBacking || 0n}
            supply={status?.totalSupply || 0n}
          />
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard
            title="Total Supply"
            value={formatNumber(status?.totalSupply || 0n, 18)}
            suffix="USDB"
            icon={<Coins className="w-5 h-5" />}
            loading={statusLoading}
          />
          <StatCard
            title="Total Backing"
            value={formatNumber(oracle?.currentBacking || 0n, 6)}
            suffix="USDC"
            icon={<Shield className="w-5 h-5" />}
            loading={oracleLoading}
          />
          <StatCard
            title="Treasury Reserves"
            value={formatNumber(treasury?.totalReserves || 0n, 6)}
            suffix="USDC"
            icon={<TrendingUp className="w-5 h-5" />}
            loading={treasuryLoading}
          />
          <StatCard
            title="Epoch Remaining"
            value={formatNumber(status?.epochRemaining || 0n, 18)}
            suffix="USDB"
            icon={<Clock className="w-5 h-5" />}
            loading={statusLoading}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Supply vs Backing</h3>
          <SupplyChart />
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Mint Activity (24h)</h3>
          <MintActivityChart />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Events</h3>
        <div className="space-y-3">
          {status?.recentEvents?.map((event, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{event.type}</span>
              </div>
              <span className="text-xs text-muted-foreground">{event.time}</span>
            </div>
          )) || (
            <p className="text-sm text-muted-foreground">No recent events</p>
          )}
        </div>
      </div>
    </div>
  );
}
