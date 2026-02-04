import { useState, useEffect, useCallback } from 'react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import { useSecureMintContext } from '../context/SecureMintProvider';
import { HookState, MutationState, MintStatus, MintParams, MintResult } from '../types';

// ABI fragments for SecureMintPolicy
const POLICY_ABI = [
  'function secureMint(address to, uint256 amount) external',
  'function maxMintable() external view returns (uint256)',
  'function epochMintedAmount() external view returns (uint256)',
  'function epochCapacity() external view returns (uint256)',
  'function currentEpoch() external view returns (uint256)',
  'function epochDuration() external view returns (uint256)',
  'function paused() external view returns (bool)',
  'event SecureMintExecuted(address indexed to, uint256 amount, uint256 backing, uint256 newSupply, uint256 oracleTimestamp)',
];

const EMERGENCY_ABI = [
  'function currentAlertLevel() external view returns (uint8)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MINT STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useMintStatus(): HookState<MintStatus> {
  const { provider, config, isConnected, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<MintStatus>>({
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
      const policyContract = new Contract(config.contracts.policy, POLICY_ABI, provider);
      const emergencyContract = new Contract(config.contracts.emergencyPause, EMERGENCY_ABI, provider);

      const [
        maxMintable,
        epochMinted,
        epochCapacity,
        currentEpoch,
        epochDuration,
        isPaused,
        alertLevel,
      ] = await Promise.all([
        policyContract.maxMintable(),
        policyContract.epochMintedAmount(),
        policyContract.epochCapacity(),
        policyContract.currentEpoch(),
        policyContract.epochDuration(),
        policyContract.paused(),
        emergencyContract.currentAlertLevel(),
      ]);

      const epochRemaining = epochCapacity - epochMinted;
      const epochStartTime = Number(currentEpoch) * Number(epochDuration);
      const epochEndsAt = new Date((epochStartTime + Number(epochDuration)) * 1000);

      const reasons: string[] = [];
      if (isPaused) reasons.push('System is paused');
      if (alertLevel >= 3) reasons.push('Emergency alert level active');
      if (maxMintable === 0n) reasons.push('No mintable capacity (backing insufficient)');
      if (epochRemaining <= 0n) reasons.push('Epoch capacity exhausted');

      const status: MintStatus = {
        canMint: !isPaused && alertLevel < 3 && maxMintable > 0n && epochRemaining > 0n,
        maxMintable,
        epochRemaining,
        epochEndsAt,
        isPaused,
        alertLevel: Number(alertLevel),
        reasons,
      };

      setState({ data: status, isLoading: false, error: null, refetch: fetchStatus });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch mint status'),
        refetch: fetchStatus,
      }));
    }
  }, [provider, config, isCorrectChain]);

  useEffect(() => {
    fetchStatus();

    // Set up refresh interval
    const interval = setInterval(fetchStatus, config.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, config.refreshInterval]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINT MUTATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useMint(): {
  mint: (params: MintParams) => Promise<MintResult>;
  state: MutationState<MintResult>;
  reset: () => void;
} {
  const { signer, config, isConnected, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<MutationState<MintResult>>({
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const mint = async (params: MintParams): Promise<MintResult> => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    if (!isCorrectChain) {
      throw new Error('Connected to wrong chain');
    }

    setState({ data: null, isLoading: true, error: null, isSuccess: false });

    try {
      const policyContract = new Contract(config.contracts.policy, POLICY_ABI, signer);

      const tx = await policyContract.secureMint(params.recipient, params.amount);
      const receipt = await tx.wait();

      // Parse the SecureMintExecuted event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = policyContract.interface.parseLog(log);
          return parsed?.name === 'SecureMintExecuted';
        } catch {
          return false;
        }
      });

      const result: MintResult = {
        txHash: receipt.hash,
        amount: BigInt(params.amount.toString()),
        recipient: params.recipient,
        blockNumber: receipt.blockNumber,
      };

      setState({ data: result, isLoading: false, error: null, isSuccess: true });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Mint failed');
      setState({ data: null, isLoading: false, error: err, isSuccess: false });
      throw err;
    }
  };

  const reset = () => {
    setState({ data: null, isLoading: false, error: null, isSuccess: false });
  };

  return { mint, state, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useSecureMint() {
  const status = useMintStatus();
  const mutation = useMint();

  return {
    ...status,
    ...mutation,
    canMint: status.data?.canMint ?? false,
    maxMintable: status.data?.maxMintable ?? 0n,
  };
}
