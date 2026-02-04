import { BigNumberish } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK STATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface HookState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface MutationState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OracleStatus {
  currentBacking: bigint;
  lastUpdate: Date;
  isStale: boolean;
  staleDuration: number;
  healthFactor: number;
  attestationValid: boolean;
}

export interface OracleConfig {
  stalenessThreshold: number;
  minimumBacking: bigint;
  oracleAddress: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MintStatus {
  canMint: boolean;
  maxMintable: bigint;
  epochRemaining: bigint;
  epochEndsAt: Date;
  isPaused: boolean;
  alertLevel: number;
  reasons: string[];
}

export interface MintParams {
  recipient: string;
  amount: BigNumberish;
}

export interface MintResult {
  txHash: string;
  amount: bigint;
  recipient: string;
  blockNumber: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREASURY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TreasuryStatus {
  totalReserves: bigint;
  tierBalances: {
    tier0: bigint;
    tier1: bigint;
    tier2: bigint;
    tier3: bigint;
  };
  tierAllocations: {
    tier0: number;
    tier1: number;
    tier2: number;
    tier3: number;
  };
  lastRebalance: Date | null;
  pendingAllocation: {
    allocations: number[];
    effectiveTime: Date;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDEMPTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RedemptionStatus {
  pendingRequest: {
    amount: bigint;
    unlockTime: Date;
    canExecute: boolean;
  } | null;
  dailyLimit: bigint;
  dailyUsed: bigint;
  dailyRemaining: bigint;
  cooldownPeriod: number;
}

export interface RedemptionParams {
  amount: BigNumberish;
}

export interface RedemptionResult {
  txHash: string;
  tokenAmount: bigint;
  reserveAmount: bigint;
  fee: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GovernanceStatus {
  activeProposals: ProposalSummary[];
  votingPower: bigint;
  delegatedTo: string | null;
  timelockDelay: number;
  quorum: bigint;
}

export interface ProposalSummary {
  id: bigint;
  proposer: string;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'SUCCEEDED' | 'DEFEATED' | 'QUEUED' | 'EXECUTED' | 'CANCELLED' | 'VETOED';
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  startBlock: bigint;
  endBlock: bigint;
}

export interface VoteParams {
  proposalId: BigNumberish;
  support: 0 | 1 | 2; // Against, For, Abstain
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AlertLevel = 'NORMAL' | 'ELEVATED' | 'RESTRICTED' | 'EMERGENCY' | 'SHUTDOWN';

export interface EmergencyStatus {
  currentLevel: AlertLevel;
  levelNumber: number;
  isPaused: boolean;
  lastChange: Date | null;
  changedBy: string | null;
  reason: string | null;
  restrictions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecureMintConfig {
  rpcUrl: string;
  chainId: number;
  contracts: {
    token: string;
    policy: string;
    oracle: string;
    treasury: string;
    redemption: string;
    governor: string;
    emergencyPause: string;
  };
  subgraphUrl?: string;
  refreshInterval?: number;
}
