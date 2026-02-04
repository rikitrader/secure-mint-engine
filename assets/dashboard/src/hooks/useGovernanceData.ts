import { useQuery } from '@tanstack/react-query';
import { Contract, JsonRpcProvider } from 'ethers';
import { config } from '@/config';

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
  eta?: bigint;
}

interface GovernanceData {
  activeProposals: Proposal[];
  recentProposals: Proposal[];
  queuedProposals: Proposal[];
  totalProposals: number;
  quorum: bigint;
  timelockDelay: number;
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: bigint;
}

const GOVERNOR_ABI = [
  'function quorum(uint256 blockNumber) external view returns (uint256)',
  'function votingDelay() external view returns (uint256)',
  'function votingPeriod() external view returns (uint256)',
  'function proposalThreshold() external view returns (uint256)',
];

const TIMELOCK_ABI = [
  'function getMinDelay() external view returns (uint256)',
];

async function fetchGovernanceData(): Promise<GovernanceData> {
  const provider = new JsonRpcProvider(config.rpcUrl);
  const governorContract = new Contract(config.contracts.governor, GOVERNOR_ABI, provider);

  const currentBlock = await provider.getBlockNumber();

  const [quorum, votingDelay, votingPeriod, proposalThreshold] = await Promise.all([
    governorContract.quorum(currentBlock - 1).catch(() => 0n),
    governorContract.votingDelay().catch(() => 1n),
    governorContract.votingPeriod().catch(() => 50400n),
    governorContract.proposalThreshold().catch(() => 0n),
  ]);

  // Fetch proposals from subgraph
  let proposals: Proposal[] = [];
  if (config.subgraphUrl) {
    const query = `
      query Proposals {
        governanceProposals(first: 20, orderBy: proposedAt, orderDirection: desc) {
          id
          proposer
          description
          status
          forVotes
          againstVotes
          abstainVotes
          votingStartBlock
          votingEndBlock
          proposedAt
        }
      }
    `;

    try {
      const response = await fetch(config.subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const { data } = await response.json();

      proposals = data.governanceProposals.map((p: any) => ({
        id: BigInt(p.id),
        proposer: p.proposer,
        description: p.description,
        status: p.status as ProposalStatus,
        forVotes: BigInt(p.forVotes),
        againstVotes: BigInt(p.againstVotes),
        abstainVotes: BigInt(p.abstainVotes),
        startBlock: BigInt(p.votingStartBlock),
        endBlock: BigInt(p.votingEndBlock),
        createdAt: new Date(Number(p.proposedAt) * 1000),
      }));
    } catch {
      // Use mock data if subgraph fails
    }
  }

  const activeProposals = proposals.filter((p) => p.status === 'ACTIVE');
  const queuedProposals = proposals.filter((p) => p.status === 'QUEUED');

  return {
    activeProposals,
    recentProposals: proposals,
    queuedProposals,
    totalProposals: proposals.length,
    quorum,
    timelockDelay: 86400, // 1 day default
    votingDelay: Number(votingDelay),
    votingPeriod: Number(votingPeriod),
    proposalThreshold,
  };
}

export function useGovernanceData() {
  return useQuery({
    queryKey: ['governanceData'],
    queryFn: fetchGovernanceData,
    refetchInterval: 60000,
  });
}
