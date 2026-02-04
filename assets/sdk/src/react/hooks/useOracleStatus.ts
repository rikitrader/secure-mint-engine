import { useState, useEffect, useCallback } from 'react';
import { Contract } from 'ethers';
import { useSecureMintContext } from '../context/SecureMintProvider';
import { HookState, OracleStatus, OracleConfig } from '../types';

// ABI fragments for BackingOracle
const ORACLE_ABI = [
  'function latestBacking() external view returns (uint256 backing, uint256 timestamp)',
  'function stalenessThreshold() external view returns (uint256)',
  'function minimumBacking() external view returns (uint256)',
  'function isAttestationValid() external view returns (bool)',
  'function PROOF_OF_RESERVE_FEED() external view returns (address)',
];

const TOKEN_ABI = [
  'function totalSupply() external view returns (uint256)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useOracleStatus(): HookState<OracleStatus> {
  const { provider, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<OracleStatus>>({
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
      const oracleContract = new Contract(config.contracts.oracle, ORACLE_ABI, provider);
      const tokenContract = new Contract(config.contracts.token, TOKEN_ABI, provider);

      const [
        [backing, timestamp],
        stalenessThreshold,
        attestationValid,
        totalSupply,
      ] = await Promise.all([
        oracleContract.latestBacking(),
        oracleContract.stalenessThreshold(),
        oracleContract.isAttestationValid().catch(() => true), // Fallback if not implemented
        tokenContract.totalSupply(),
      ]);

      const now = Math.floor(Date.now() / 1000);
      const age = now - Number(timestamp);
      const isStale = age > Number(stalenessThreshold);

      // Calculate health factor: (backing * 10000) / supply
      // Backing is 6 decimals, supply is 18 decimals
      // Normalize: backing * 10^12 to match supply decimals
      const backingNormalized = backing * BigInt(10 ** 12);
      const healthFactor = totalSupply > 0n
        ? Number((backingNormalized * 10000n) / totalSupply) / 100
        : 100;

      const status: OracleStatus = {
        currentBacking: backing,
        lastUpdate: new Date(Number(timestamp) * 1000),
        isStale,
        staleDuration: isStale ? age - Number(stalenessThreshold) : 0,
        healthFactor,
        attestationValid,
      };

      setState({ data: status, isLoading: false, error: null, refetch: fetchStatus });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch oracle status'),
        refetch: fetchStatus,
      }));
    }
  }, [provider, config, isCorrectChain]);

  useEffect(() => {
    fetchStatus();

    // More frequent updates for oracle status
    const interval = setInterval(fetchStatus, config.refreshInterval || 15000);
    return () => clearInterval(interval);
  }, [fetchStatus, config.refreshInterval]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CONFIG HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useOracleConfig(): HookState<OracleConfig> {
  const { provider, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<OracleConfig>>({
    data: null,
    isLoading: true,
    error: null,
    refetch: async () => {},
  });

  const fetchConfig = useCallback(async () => {
    if (!provider || !isCorrectChain) {
      setState(prev => ({ ...prev, isLoading: false, error: new Error('Not connected to correct chain') }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const oracleContract = new Contract(config.contracts.oracle, ORACLE_ABI, provider);

      const [stalenessThreshold, minimumBacking, feedAddress] = await Promise.all([
        oracleContract.stalenessThreshold(),
        oracleContract.minimumBacking(),
        oracleContract.PROOF_OF_RESERVE_FEED(),
      ]);

      const oracleConfig: OracleConfig = {
        stalenessThreshold: Number(stalenessThreshold),
        minimumBacking,
        oracleAddress: feedAddress,
      };

      setState({ data: oracleConfig, isLoading: false, error: null, refetch: fetchConfig });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch oracle config'),
        refetch: fetchConfig,
      }));
    }
  }, [provider, config, isCorrectChain]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE HEALTH CHECK HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useOracleHealthCheck(): {
  isHealthy: boolean;
  warnings: string[];
  errors: string[];
} {
  const status = useOracleStatus();

  const warnings: string[] = [];
  const errors: string[] = [];

  if (status.data) {
    // Check staleness
    if (status.data.isStale) {
      errors.push(`Oracle data is stale by ${status.data.staleDuration} seconds`);
    }

    // Check health factor
    if (status.data.healthFactor < 100) {
      errors.push(`Undercollateralized: health factor is ${status.data.healthFactor.toFixed(2)}%`);
    } else if (status.data.healthFactor < 105) {
      warnings.push(`Low collateralization: health factor is ${status.data.healthFactor.toFixed(2)}%`);
    }

    // Check attestation
    if (!status.data.attestationValid) {
      errors.push('Oracle attestation is invalid');
    }

    // Check last update age (warning if > 1 hour)
    const hourAgo = Date.now() - 3600000;
    if (status.data.lastUpdate.getTime() < hourAgo) {
      warnings.push('Oracle hasn\'t been updated in over an hour');
    }
  }

  return {
    isHealthy: errors.length === 0 && !status.error,
    warnings,
    errors,
  };
}
