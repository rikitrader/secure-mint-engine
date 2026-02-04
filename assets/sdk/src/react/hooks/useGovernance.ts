import { useState, useEffect, useCallback } from 'react';
import { Contract, BigNumberish } from 'ethers';
import { useSecureMintContext } from '../context/SecureMintProvider';
import { HookState, MutationState, GovernanceStatus, ProposalSummary, VoteParams } from '../types';

// ABI fragments for SecureMintGovernor
const GOVERNOR_ABI = [
  'function proposalCount() external view returns (uint256)',
  'function proposals(uint256 proposalId) external view returns (uint256 id, address proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool cancelled, bool executed)',
  'function state(uint256 proposalId) external view returns (uint8)',
  'function getVotes(address account, uint256 blockNumber) external view returns (uint256)',
  'function quorum(uint256 blockNumber) external view returns (uint256)',
  'function votingDelay() external view returns (uint256)',
  'function votingPeriod() external view returns (uint256)',
  'function proposalThreshold() external view returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) external returns (uint256)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external returns (uint256)',
  'function delegates(address account) external view returns (address)',
  'function delegate(address delegatee) external',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
];

const TIMELOCK_ABI = [
  'function getMinDelay() external view returns (uint256)',
];

// Proposal states mapping
const PROPOSAL_STATES = [
  'PENDING',
  'ACTIVE',
  'CANCELLED',
  'DEFEATED',
  'SUCCEEDED',
  'QUEUED',
  'EXPIRED',
  'EXECUTED',
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useGovernanceStatus(): HookState<GovernanceStatus> {
  const { provider, address, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<GovernanceStatus>>({
    data: null,
    isLoading: true,
    error: null,
    refetch: async () => {},
  });

  const fetchStatus = useCallback(async () => {
    if (!provider || !isCorrectChain) {
      setState(prev => ({ ...prev, isLoading: false, error: new Error('Not connected to correct chain') }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const governorContract = new Contract(config.contracts.governor, GOVERNOR_ABI, provider);

      const currentBlock = await provider.getBlockNumber();

      // Get basic governance parameters
      const [quorum] = await Promise.all([
        governorContract.quorum(currentBlock - 1).catch(() => 0n),
      ]);

      // Get user-specific data if connected
      let votingPower = 0n;
      let delegatedTo: string | null = null;

      if (address) {
        [votingPower, delegatedTo] = await Promise.all([
          governorContract.getVotes(address, currentBlock - 1).catch(() => 0n),
          governorContract.delegates(address).catch(() => null),
        ]);
      }

      // For now, we'll return empty proposals - fetching all requires subgraph
      const activeProposals: ProposalSummary[] = [];

      const status: GovernanceStatus = {
        activeProposals,
        votingPower,
        delegatedTo: delegatedTo !== address ? delegatedTo : null,
        timelockDelay: 86400, // Default 1 day, should fetch from timelock
        quorum,
      };

      setState({ data: status, isLoading: false, error: null, refetch: fetchStatus });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch governance status'),
        refetch: fetchStatus,
      }));
    }
  }, [provider, address, config, isCorrectChain]);

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(fetchStatus, config.refreshInterval || 60000);
    return () => clearInterval(interval);
  }, [fetchStatus, config.refreshInterval]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPOSAL DETAILS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useProposal(proposalId: BigNumberish): HookState<ProposalSummary> {
  const { provider, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<ProposalSummary>>({
    data: null,
    isLoading: true,
    error: null,
    refetch: async () => {},
  });

  const fetchProposal = useCallback(async () => {
    if (!provider || !isCorrectChain) {
      setState(prev => ({ ...prev, isLoading: false, error: new Error('Not connected to correct chain') }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const governorContract = new Contract(config.contracts.governor, GOVERNOR_ABI, provider);

      const [proposalData, proposalState] = await Promise.all([
        governorContract.proposals(proposalId),
        governorContract.state(proposalId),
      ]);

      const statusIndex = Number(proposalState);
      const status = statusIndex < PROPOSAL_STATES.length
        ? PROPOSAL_STATES[statusIndex]
        : 'PENDING';

      const proposal: ProposalSummary = {
        id: proposalData.id,
        proposer: proposalData.proposer,
        description: '', // Would need to fetch from events or subgraph
        status: status as ProposalSummary['status'],
        forVotes: proposalData.forVotes,
        againstVotes: proposalData.againstVotes,
        abstainVotes: proposalData.abstainVotes,
        startBlock: proposalData.startBlock,
        endBlock: proposalData.endBlock,
      };

      setState({ data: proposal, isLoading: false, error: null, refetch: fetchProposal });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch proposal'),
        refetch: fetchProposal,
      }));
    }
  }, [provider, config, proposalId, isCorrectChain]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAST VOTE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCastVote(): {
  vote: (params: VoteParams) => Promise<string>;
  state: MutationState<string>;
  reset: () => void;
} {
  const { signer, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<MutationState<string>>({
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const vote = async (params: VoteParams): Promise<string> => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    if (!isCorrectChain) {
      throw new Error('Connected to wrong chain');
    }

    setState({ data: null, isLoading: true, error: null, isSuccess: false });

    try {
      const governorContract = new Contract(config.contracts.governor, GOVERNOR_ABI, signer);

      let tx;
      if (params.reason) {
        tx = await governorContract.castVoteWithReason(params.proposalId, params.support, params.reason);
      } else {
        tx = await governorContract.castVote(params.proposalId, params.support);
      }

      const receipt = await tx.wait();

      setState({ data: receipt.hash, isLoading: false, error: null, isSuccess: true });
      return receipt.hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Vote failed');
      setState({ data: null, isLoading: false, error: err, isSuccess: false });
      throw err;
    }
  };

  const reset = () => {
    setState({ data: null, isLoading: false, error: null, isSuccess: false });
  };

  return { vote, state, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELEGATE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useDelegate(): {
  delegate: (delegatee: string) => Promise<string>;
  state: MutationState<string>;
  reset: () => void;
} {
  const { signer, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<MutationState<string>>({
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const delegate = async (delegatee: string): Promise<string> => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    if (!isCorrectChain) {
      throw new Error('Connected to wrong chain');
    }

    setState({ data: null, isLoading: true, error: null, isSuccess: false });

    try {
      const governorContract = new Contract(config.contracts.governor, GOVERNOR_ABI, signer);

      const tx = await governorContract.delegate(delegatee);
      const receipt = await tx.wait();

      setState({ data: receipt.hash, isLoading: false, error: null, isSuccess: true });
      return receipt.hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Delegation failed');
      setState({ data: null, isLoading: false, error: err, isSuccess: false });
      throw err;
    }
  };

  const reset = () => {
    setState({ data: null, isLoading: false, error: null, isSuccess: false });
  };

  return { delegate, state, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useGovernance() {
  const status = useGovernanceStatus();
  const voteMutation = useCastVote();
  const delegateMutation = useDelegate();

  return {
    ...status,
    vote: voteMutation.vote,
    voteState: voteMutation.state,
    delegate: delegateMutation.delegate,
    delegateState: delegateMutation.state,
    hasVotingPower: (status.data?.votingPower ?? 0n) > 0n,
  };
}
