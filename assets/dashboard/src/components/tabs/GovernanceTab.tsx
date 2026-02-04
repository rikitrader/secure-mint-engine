'use client';

import { useGovernanceData } from '@/hooks/useGovernanceData';
import { StatCard } from '@/components/ui/StatCard';
import { ProposalCard } from '@/components/ui/ProposalCard';
import { format } from 'date-fns';
import {
  Vote,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

type ProposalStatus = 'PENDING' | 'ACTIVE' | 'SUCCEEDED' | 'DEFEATED' | 'QUEUED' | 'EXECUTED' | 'CANCELLED' | 'VETOED';

export function GovernanceTab() {
  const { data: governance, isLoading } = useGovernanceData();

  const formatNumber = (value: bigint | number): string => {
    const num = typeof value === 'bigint' ? Number(value) / 10 ** 18 : value;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      notation: num > 1_000_000 ? 'compact' : 'standard',
    }).format(num);
  };

  const getStatusColor = (status: ProposalStatus): string => {
    switch (status) {
      case 'ACTIVE':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'SUCCEEDED':
      case 'QUEUED':
        return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'EXECUTED':
        return 'text-green-600 bg-green-600/10 border-green-600/30';
      case 'DEFEATED':
      case 'CANCELLED':
        return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'VETOED':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Governance</h2>
        <p className="text-muted-foreground">
          Protocol governance with timelocked execution and guardian veto
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Proposals"
          value={governance?.activeProposals?.length || 0}
          icon={<Vote className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Total Proposals"
          value={governance?.totalProposals || 0}
          icon={<CheckCircle className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Quorum"
          value={formatNumber(governance?.quorum || 0n)}
          suffix="votes"
          icon={<Users className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Timelock Delay"
          value={
            governance?.timelockDelay
              ? `${Math.floor(governance.timelockDelay / 3600)}h`
              : '--'
          }
          icon={<Clock className="w-5 h-5" />}
          loading={isLoading}
        />
      </div>

      {/* Active Proposals */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Active Proposals</h3>
        {governance?.activeProposals && governance.activeProposals.length > 0 ? (
          <div className="space-y-4">
            {governance.activeProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id.toString()}
                proposal={proposal}
                getStatusColor={getStatusColor}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No active proposals
          </p>
        )}
      </div>

      {/* Recent Proposals */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Proposals</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">For</th>
                <th className="pb-3 font-medium">Against</th>
                <th className="pb-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {governance?.recentProposals?.map((proposal) => (
                <tr
                  key={proposal.id.toString()}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 text-sm font-mono">
                    #{proposal.id.toString().slice(-4)}
                  </td>
                  <td className="py-3 text-sm max-w-xs truncate">
                    {proposal.description}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(
                        proposal.status
                      )}`}
                    >
                      {proposal.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-green-500">
                    {formatNumber(proposal.forVotes)}
                  </td>
                  <td className="py-3 text-sm text-red-500">
                    {formatNumber(proposal.againstVotes)}
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">
                    {proposal.createdAt
                      ? format(proposal.createdAt, 'MMM d')
                      : '--'}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No proposals found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Governance Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Governance Parameters</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Voting Delay</span>
              <span>{governance?.votingDelay || 1} block(s)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Voting Period</span>
              <span>{governance?.votingPeriod || 50400} blocks (~7 days)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Proposal Threshold</span>
              <span>{formatNumber(governance?.proposalThreshold || 0n)} votes</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Guardian Veto</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Enabled
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Timelock Queue</h3>
          {governance?.queuedProposals && governance.queuedProposals.length > 0 ? (
            <div className="space-y-3">
              {governance.queuedProposals.map((proposal) => (
                <div
                  key={proposal.id.toString()}
                  className="p-3 rounded-lg bg-muted/50 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Proposal #{proposal.id.toString().slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proposal.description.slice(0, 50)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Executes at</p>
                    <p className="text-sm font-medium">
                      {proposal.eta
                        ? format(new Date(Number(proposal.eta) * 1000), 'MMM d, HH:mm')
                        : '--'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No proposals in timelock queue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
