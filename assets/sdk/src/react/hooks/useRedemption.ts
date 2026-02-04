import { useState, useEffect, useCallback } from 'react';
import { Contract, BigNumberish } from 'ethers';
import { useSecureMintContext } from '../context/SecureMintProvider';
import { HookState, MutationState, RedemptionStatus, RedemptionParams, RedemptionResult } from '../types';

// ABI fragments for RedemptionEngine
const REDEMPTION_ABI = [
  'function requestRedemption(uint256 amount) external',
  'function executeRedemption() external',
  'function cancelRedemption() external',
  'function pendingRedemption(address user) external view returns (uint256 amount, uint256 unlockTime)',
  'function dailyLimit() external view returns (uint256)',
  'function dailyRedemptionAmount() external view returns (uint256)',
  'function cooldownPeriod() external view returns (uint256)',
  'event RedemptionRequested(address indexed user, uint256 amount, uint256 unlockTime)',
  'event RedemptionExecuted(address indexed user, uint256 tokenAmount, uint256 reserveAmount)',
  'event RedemptionCancelled(address indexed user, uint256 amount)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// REDEMPTION STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useRedemptionStatus(): HookState<RedemptionStatus> {
  const { provider, signer, address, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<RedemptionStatus>>({
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
      const redemptionContract = new Contract(config.contracts.redemption, REDEMPTION_ABI, provider);

      const [dailyLimit, dailyUsed, cooldownPeriod] = await Promise.all([
        redemptionContract.dailyLimit(),
        redemptionContract.dailyRedemptionAmount(),
        redemptionContract.cooldownPeriod(),
      ]);

      // Get user's pending redemption if connected
      let pendingRequest = null;
      if (address) {
        const [amount, unlockTime] = await redemptionContract.pendingRedemption(address);
        if (amount > 0n) {
          const now = Math.floor(Date.now() / 1000);
          pendingRequest = {
            amount,
            unlockTime: new Date(Number(unlockTime) * 1000),
            canExecute: Number(unlockTime) <= now,
          };
        }
      }

      const status: RedemptionStatus = {
        pendingRequest,
        dailyLimit,
        dailyUsed,
        dailyRemaining: dailyLimit - dailyUsed,
        cooldownPeriod: Number(cooldownPeriod),
      };

      setState({ data: status, isLoading: false, error: null, refetch: fetchStatus });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch redemption status'),
        refetch: fetchStatus,
      }));
    }
  }, [provider, address, config, isCorrectChain]);

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(fetchStatus, config.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, config.refreshInterval]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST REDEMPTION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useRequestRedemption(): {
  request: (params: RedemptionParams) => Promise<string>;
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

  const request = async (params: RedemptionParams): Promise<string> => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    if (!isCorrectChain) {
      throw new Error('Connected to wrong chain');
    }

    setState({ data: null, isLoading: true, error: null, isSuccess: false });

    try {
      const redemptionContract = new Contract(config.contracts.redemption, REDEMPTION_ABI, signer);

      const tx = await redemptionContract.requestRedemption(params.amount);
      const receipt = await tx.wait();

      setState({ data: receipt.hash, isLoading: false, error: null, isSuccess: true });
      return receipt.hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Request failed');
      setState({ data: null, isLoading: false, error: err, isSuccess: false });
      throw err;
    }
  };

  const reset = () => {
    setState({ data: null, isLoading: false, error: null, isSuccess: false });
  };

  return { request, state, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTE REDEMPTION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useExecuteRedemption(): {
  execute: () => Promise<RedemptionResult>;
  state: MutationState<RedemptionResult>;
  reset: () => void;
} {
  const { signer, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<MutationState<RedemptionResult>>({
    data: null,
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const execute = async (): Promise<RedemptionResult> => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    if (!isCorrectChain) {
      throw new Error('Connected to wrong chain');
    }

    setState({ data: null, isLoading: true, error: null, isSuccess: false });

    try {
      const redemptionContract = new Contract(config.contracts.redemption, REDEMPTION_ABI, signer);

      const tx = await redemptionContract.executeRedemption();
      const receipt = await tx.wait();

      // Parse the RedemptionExecuted event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = redemptionContract.interface.parseLog(log);
          return parsed?.name === 'RedemptionExecuted';
        } catch {
          return false;
        }
      });

      let tokenAmount = 0n;
      let reserveAmount = 0n;

      if (event) {
        const parsed = redemptionContract.interface.parseLog(event);
        if (parsed) {
          tokenAmount = parsed.args.tokenAmount;
          reserveAmount = parsed.args.reserveAmount;
        }
      }

      const result: RedemptionResult = {
        txHash: receipt.hash,
        tokenAmount,
        reserveAmount,
        fee: tokenAmount - (reserveAmount * BigInt(10 ** 12)), // Adjust for decimals
      };

      setState({ data: result, isLoading: false, error: null, isSuccess: true });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Execution failed');
      setState({ data: null, isLoading: false, error: err, isSuccess: false });
      throw err;
    }
  };

  const reset = () => {
    setState({ data: null, isLoading: false, error: null, isSuccess: false });
  };

  return { execute, state, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANCEL REDEMPTION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCancelRedemption(): {
  cancel: () => Promise<string>;
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

  const cancel = async (): Promise<string> => {
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    if (!isCorrectChain) {
      throw new Error('Connected to wrong chain');
    }

    setState({ data: null, isLoading: true, error: null, isSuccess: false });

    try {
      const redemptionContract = new Contract(config.contracts.redemption, REDEMPTION_ABI, signer);

      const tx = await redemptionContract.cancelRedemption();
      const receipt = await tx.wait();

      setState({ data: receipt.hash, isLoading: false, error: null, isSuccess: true });
      return receipt.hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Cancel failed');
      setState({ data: null, isLoading: false, error: err, isSuccess: false });
      throw err;
    }
  };

  const reset = () => {
    setState({ data: null, isLoading: false, error: null, isSuccess: false });
  };

  return { cancel, state, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useRedemption() {
  const status = useRedemptionStatus();
  const requestMutation = useRequestRedemption();
  const executeMutation = useExecuteRedemption();
  const cancelMutation = useCancelRedemption();

  return {
    ...status,
    request: requestMutation.request,
    requestState: requestMutation.state,
    execute: executeMutation.execute,
    executeState: executeMutation.state,
    cancel: cancelMutation.cancel,
    cancelState: cancelMutation.state,
    hasPending: !!status.data?.pendingRequest,
    canExecute: status.data?.pendingRequest?.canExecute ?? false,
  };
}
