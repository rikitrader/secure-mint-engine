/**
 * SecureMint Engine - React Native Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { getSDK, TokenBalance, WalletInfo } from '../SecureMintMobile';

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useWallet() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const sdk = getSDK();
      const walletInfo = await sdk.loadWallet();
      setWallet(walletInfo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const sdk = getSDK();
      const walletInfo = await sdk.createWallet();
      setWallet(walletInfo);
      return walletInfo;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const importWallet = async (mnemonic: string) => {
    try {
      setLoading(true);
      setError(null);
      const sdk = getSDK();
      const walletInfo = await sdk.importWallet(mnemonic);
      setWallet(walletInfo);
      return walletInfo;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      const sdk = getSDK();
      await sdk.disconnect();
      setWallet(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return {
    wallet,
    loading,
    error,
    createWallet,
    importWallet,
    disconnect,
    refresh: loadWallet,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useBalance(address?: string) {
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sdk = getSDK();
      const balanceData = await sdk.getBalance(address);
      setBalance(balanceData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return {
    balance,
    loading,
    error,
    refresh: fetchBalance,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSFER HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useTransfer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const transfer = async (to: string, amount: string) => {
    try {
      setLoading(true);
      setError(null);
      setTxHash(null);

      const sdk = getSDK();
      const hash = await sdk.transfer(to, amount);
      setTxHash(hash);
      return hash;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setTxHash(null);
  };

  return {
    transfer,
    loading,
    error,
    txHash,
    reset,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINT CAPACITY HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useMintCapacity() {
  const [capacity, setCapacity] = useState<{
    epochCapacity: string;
    epochMinted: string;
    remainingCapacity: string;
    utilizationPercent: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCapacity = useCallback(async () => {
    try {
      setLoading(true);
      const sdk = getSDK();
      const data = await sdk.getMintCapacity();
      setCapacity(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCapacity();
    const interval = setInterval(fetchCapacity, 60000);
    return () => clearInterval(interval);
  }, [fetchCapacity]);

  return {
    capacity,
    loading,
    error,
    refresh: fetchCapacity,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useSystemStatus() {
  const [status, setStatus] = useState<{
    totalSupply: string;
    backingRatio: number;
    emergencyLevel: number;
    isOracleStale: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const sdk = getSDK();
      const data = await sdk.getSystemStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVARIANTS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useInvariants() {
  const [invariants, setInvariants] = useState<Array<{
    id: string;
    name: string;
    passed: boolean;
    details: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInvariants = useCallback(async () => {
    try {
      setLoading(true);
      const sdk = getSDK();
      const data = await sdk.checkInvariants();
      setInvariants(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkInvariants();
  }, [checkInvariants]);

  const allPassed = invariants.every((inv) => inv.passed);

  return {
    invariants,
    allPassed,
    loading,
    error,
    refresh: checkInvariants,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIOMETRICS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useBiometrics() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const { SecureMintMobileSDK } = await import('../SecureMintMobile');
      const isAvailable = await SecureMintMobileSDK.isBiometricsAvailable();
      setAvailable(isAvailable);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    try {
      const sdk = getSDK();
      return await sdk.authenticateWithBiometrics();
    } catch {
      return false;
    }
  };

  return {
    available,
    loading,
    authenticate,
  };
}
