import { useQuery } from '@tanstack/react-query';
import { Contract, JsonRpcProvider } from 'ethers';
import { config } from '@/config';

interface TreasuryData {
  totalReserves: bigint;
  tier0Balance: bigint;
  tier1Balance: bigint;
  tier2Balance: bigint;
  tier3Balance: bigint;
  tier0Allocation: number;
  tier1Allocation: number;
  tier2Allocation: number;
  tier3Allocation: number;
  lastRebalance: Date | null;
  pendingAllocation: {
    allocations: number[];
    effectiveTime: Date;
  } | null;
  recentActivity?: {
    type: 'deposit' | 'withdrawal' | 'rebalance';
    tier: number;
    amount: bigint;
    time: string;
  }[];
}

const TREASURY_ABI = [
  'function totalReserves() external view returns (uint256)',
  'function tierBalance(uint8 tier) external view returns (uint256)',
  'function tierAllocation(uint8 tier) external view returns (uint256)',
  'function lastRebalanceTime() external view returns (uint256)',
];

async function fetchTreasuryData(): Promise<TreasuryData> {
  const provider = new JsonRpcProvider(config.rpcUrl);
  const treasuryContract = new Contract(config.contracts.treasury, TREASURY_ABI, provider);

  const [
    totalReserves,
    tier0Balance,
    tier1Balance,
    tier2Balance,
    tier3Balance,
    tier0Alloc,
    tier1Alloc,
    tier2Alloc,
    tier3Alloc,
    lastRebalance,
  ] = await Promise.all([
    treasuryContract.totalReserves(),
    treasuryContract.tierBalance(0),
    treasuryContract.tierBalance(1),
    treasuryContract.tierBalance(2),
    treasuryContract.tierBalance(3),
    treasuryContract.tierAllocation(0),
    treasuryContract.tierAllocation(1),
    treasuryContract.tierAllocation(2),
    treasuryContract.tierAllocation(3),
    treasuryContract.lastRebalanceTime().catch(() => 0n),
  ]);

  return {
    totalReserves,
    tier0Balance,
    tier1Balance,
    tier2Balance,
    tier3Balance,
    tier0Allocation: Number(tier0Alloc) / 100,
    tier1Allocation: Number(tier1Alloc) / 100,
    tier2Allocation: Number(tier2Alloc) / 100,
    tier3Allocation: Number(tier3Alloc) / 100,
    lastRebalance: lastRebalance > 0n ? new Date(Number(lastRebalance) * 1000) : null,
    pendingAllocation: null, // Would fetch from contract
    recentActivity: [], // Would fetch from subgraph
  };
}

export function useTreasuryData() {
  return useQuery({
    queryKey: ['treasuryData'],
    queryFn: fetchTreasuryData,
    refetchInterval: 30000,
  });
}
