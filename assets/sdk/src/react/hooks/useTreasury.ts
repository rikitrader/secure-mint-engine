import { useState, useEffect, useCallback } from 'react';
import { Contract } from 'ethers';
import { useSecureMintContext } from '../context/SecureMintProvider';
import { HookState, TreasuryStatus } from '../types';

// ABI fragments for TreasuryVault
const TREASURY_ABI = [
  'function totalReserves() external view returns (uint256)',
  'function tierBalance(uint8 tier) external view returns (uint256)',
  'function tierAllocation(uint8 tier) external view returns (uint256)',
  'function reserveAsset() external view returns (address)',
  'function pendingAllocation() external view returns (uint256[4] allocations, uint256 effectiveTime)',
  'function lastRebalanceTime() external view returns (uint256)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// TREASURY STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useTreasuryStatus(): HookState<TreasuryStatus> {
  const { provider, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<TreasuryStatus>>({
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
      const treasuryContract = new Contract(config.contracts.treasury, TREASURY_ABI, provider);

      // Fetch all tier data in parallel
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

      // Try to get pending allocation
      let pendingAllocation = null;
      try {
        const pending = await treasuryContract.pendingAllocation();
        if (pending.effectiveTime > 0n) {
          pendingAllocation = {
            allocations: pending.allocations.map((a: bigint) => Number(a)),
            effectiveTime: new Date(Number(pending.effectiveTime) * 1000),
          };
        }
      } catch {
        // No pending allocation or function not available
      }

      const status: TreasuryStatus = {
        totalReserves,
        tierBalances: {
          tier0: tier0Balance,
          tier1: tier1Balance,
          tier2: tier2Balance,
          tier3: tier3Balance,
        },
        tierAllocations: {
          tier0: Number(tier0Alloc) / 100, // Convert from basis points
          tier1: Number(tier1Alloc) / 100,
          tier2: Number(tier2Alloc) / 100,
          tier3: Number(tier3Alloc) / 100,
        },
        lastRebalance: lastRebalance > 0n ? new Date(Number(lastRebalance) * 1000) : null,
        pendingAllocation,
      };

      setState({ data: status, isLoading: false, error: null, refetch: fetchStatus });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch treasury status'),
        refetch: fetchStatus,
      }));
    }
  }, [provider, config, isCorrectChain]);

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(fetchStatus, config.refreshInterval || 60000);
    return () => clearInterval(interval);
  }, [fetchStatus, config.refreshInterval]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREASURY ALLOCATION ANALYSIS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface AllocationAnalysis {
  isBalanced: boolean;
  deviations: {
    tier0: number;
    tier1: number;
    tier2: number;
    tier3: number;
  };
  needsRebalance: boolean;
  suggestions: string[];
}

export function useTreasuryAnalysis(): AllocationAnalysis | null {
  const { data: treasury } = useTreasuryStatus();

  if (!treasury || treasury.totalReserves === 0n) {
    return null;
  }

  const total = treasury.totalReserves;

  // Calculate actual percentages
  const actualPercentages = {
    tier0: Number((treasury.tierBalances.tier0 * 10000n) / total) / 100,
    tier1: Number((treasury.tierBalances.tier1 * 10000n) / total) / 100,
    tier2: Number((treasury.tierBalances.tier2 * 10000n) / total) / 100,
    tier3: Number((treasury.tierBalances.tier3 * 10000n) / total) / 100,
  };

  // Calculate deviations from target
  const deviations = {
    tier0: actualPercentages.tier0 - treasury.tierAllocations.tier0,
    tier1: actualPercentages.tier1 - treasury.tierAllocations.tier1,
    tier2: actualPercentages.tier2 - treasury.tierAllocations.tier2,
    tier3: actualPercentages.tier3 - treasury.tierAllocations.tier3,
  };

  // Determine if rebalance is needed (>5% deviation in any tier)
  const threshold = 5;
  const needsRebalance = Object.values(deviations).some(d => Math.abs(d) > threshold);

  const suggestions: string[] = [];
  if (deviations.tier0 < -threshold) {
    suggestions.push(`Tier 0 (HOT) is underfunded by ${Math.abs(deviations.tier0).toFixed(1)}%`);
  }
  if (deviations.tier0 > threshold) {
    suggestions.push(`Tier 0 (HOT) is overfunded by ${deviations.tier0.toFixed(1)}%`);
  }
  if (deviations.tier2 < -threshold) {
    suggestions.push(`Tier 2 (COLD) is underfunded by ${Math.abs(deviations.tier2).toFixed(1)}%`);
  }

  return {
    isBalanced: !needsRebalance,
    deviations,
    needsRebalance,
    suggestions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LABELS
// ═══════════════════════════════════════════════════════════════════════════════

export const TIER_LABELS = {
  tier0: 'HOT (Instant)',
  tier1: 'WARM (24h)',
  tier2: 'COLD (7d)',
  tier3: 'RWA (30d)',
} as const;

export function getTierLabel(tier: 0 | 1 | 2 | 3): string {
  const labels = ['HOT (Instant)', 'WARM (24h)', 'COLD (7d)', 'RWA (30d)'];
  return labels[tier];
}
