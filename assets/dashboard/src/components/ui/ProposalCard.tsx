'use client';

import { format } from 'date-fns';

type ProposalStatus = 'PENDING' | 'ACTIVE' | 'SUCCEEDED' | 'DEFEATED' | 'QUEUED' | 'EXECUTED' | 'CANCELLED' | 'VETOED';

interface Proposal {
  id: bigint;
  proposer: string;
  description: string;
  status: ProposalStatus;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  startBlock: bigint;
  endBlock: bigint;
  createdAt?: Date;
}

interface ProposalCardProps {
  proposal: Proposal;
  getStatusColor: (status: ProposalStatus) => string;
}

export function ProposalCard({ proposal, getStatusColor }: ProposalCardProps) {
  const formatVotes = (votes: bigint): string => {
    const num = Number(votes) / 10 ** 18;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      notation: num > 1_000_000 ? 'compact' : 'standard',
    }).format(num);
  };

  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const forPercent = totalVotes > 0n
    ? Number((proposal.forVotes * 100n) / totalVotes)
    : 0;
  const againstPercent = totalVotes > 0n
    ? Number((proposal.againstVotes * 100n) / totalVotes)
    : 0;

  return (
    <div className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              #{proposal.id.toString().slice(-6)}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(
                proposal.status
              )}`}
            >
              {proposal.status}
            </span>
          </div>
          <p className="font-medium line-clamp-2">{proposal.description}</p>
        </div>
      </div>

      {/* Vote Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-green-500">For: {formatVotes(proposal.forVotes)}</span>
          <span className="text-red-500">Against: {formatVotes(proposal.againstVotes)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 h-full transition-all"
            style={{ width: `${forPercent}%` }}
          />
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${againstPercent}%` }}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Proposer: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
        </span>
        <span>
          Blocks: {proposal.startBlock.toString()} - {proposal.endBlock.toString()}
        </span>
      </div>
    </div>
  );
}
