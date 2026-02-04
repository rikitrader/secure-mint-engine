'use client';

import { useOracleData } from '@/hooks/useOracleData';
import { useOracleHistory } from '@/hooks/useOracleHistory';
import { StatCard } from '@/components/ui/StatCard';
import { OracleHealthChart } from '@/components/charts/OracleHealthChart';
import { format } from 'date-fns';
import {
  Database,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export function OracleTab() {
  const { data: oracle, isLoading, refetch } = useOracleData();
  const { data: history } = useOracleHistory();

  const formatNumber = (value: bigint | number, decimals: number = 6): string => {
    const num = typeof value === 'bigint' ? Number(value) / 10 ** decimals : value;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Oracle Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Oracle Status</h2>
          <p className="text-muted-foreground">
            Real-time Proof-of-Reserve data from Chainlink oracles
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Staleness Alert */}
      {oracle?.isStale && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div>
            <span className="font-medium text-red-500">Oracle Data Stale</span>
            <p className="text-sm text-muted-foreground">
              Last update: {oracle.lastUpdate ? format(oracle.lastUpdate, 'PPpp') : 'Unknown'}
              {' '}- Data is {oracle.staleDuration} seconds past threshold
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Backing"
          value={formatNumber(oracle?.currentBacking || 0n, 6)}
          suffix="USDC"
          icon={<Database className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Last Update"
          value={oracle?.lastUpdate ? format(oracle.lastUpdate, 'HH:mm:ss') : '--'}
          icon={<Clock className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Health Factor"
          value={oracle?.healthFactor?.toFixed(2) || '0'}
          suffix="%"
          icon={
            (oracle?.healthFactor || 0) >= 100 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )
          }
          loading={isLoading}
          trend={
            oracle?.healthFactor && oracle.healthFactor >= 100
              ? 'up'
              : oracle?.healthFactor && oracle.healthFactor < 100
              ? 'down'
              : undefined
          }
        />
        <StatCard
          title="Attestation"
          value={oracle?.attestationValid ? 'Valid' : 'Invalid'}
          icon={
            oracle?.attestationValid ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )
          }
          loading={isLoading}
        />
      </div>

      {/* Oracle Health Chart */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Health Factor History (7d)</h3>
        <OracleHealthChart data={history} />
      </div>

      {/* Oracle Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Oracle Configuration</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Feed Address</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {oracle?.feedAddress || '0x...'}
              </code>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Staleness Threshold</span>
              <span>{oracle?.stalenessThreshold || 3600} seconds</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Minimum Backing</span>
              <span>{formatNumber(oracle?.minimumBacking || 0n, 6)} USDC</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Update Frequency</span>
              <span>~1 hour</span>
            </div>
          </div>
        </div>

        {/* Recent Updates */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Updates</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {history?.slice(0, 10).map((update, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <span className="text-sm font-medium">
                    {formatNumber(update.backing, 6)} USDC
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Health: {update.healthFactor.toFixed(2)}%
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(update.timestamp, 'MMM d, HH:mm')}
                </span>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground">No update history</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
