import React, { createContext, useContext, useMemo, useEffect, useState, ReactNode } from 'react';
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers';
import { SecureMintConfig } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SecureMintContextValue {
  config: SecureMintConfig;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
}

const SecureMintContext = createContext<SecureMintContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SecureMintProviderProps {
  config: SecureMintConfig;
  children: ReactNode;
}

export function SecureMintProvider({ config, children }: SecureMintProviderProps): JSX.Element {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // Initialize provider from window.ethereum
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const browserProvider = new BrowserProvider((window as any).ethereum);
      setProvider(browserProvider);

      // Listen for account changes
      (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          setSigner(null);
          setAddress(null);
        } else {
          setAddress(accounts[0]);
          browserProvider.getSigner().then(setSigner);
        }
      });

      // Listen for chain changes
      (window as any).ethereum.on('chainChanged', (chainIdHex: string) => {
        setChainId(parseInt(chainIdHex, 16));
      });

      // Get initial chain
      browserProvider.getNetwork().then(network => {
        setChainId(Number(network.chainId));
      });
    }

    return () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        (window as any).ethereum.removeAllListeners('accountsChanged');
        (window as any).ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const connect = async (): Promise<void> => {
    if (!provider) {
      throw new Error('No wallet provider found');
    }

    try {
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const signerInstance = await provider.getSigner();
      const signerAddress = await signerInstance.getAddress();

      setSigner(signerInstance);
      setAddress(signerAddress);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  const disconnect = (): void => {
    setSigner(null);
    setAddress(null);
  };

  const switchChain = async (): Promise<void> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('No wallet provider found');
    }

    const chainIdHex = `0x${config.chainId.toString(16)}`;

    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        throw new Error('Please add this network to your wallet');
      }
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      config,
      provider,
      signer,
      address,
      chainId,
      isConnected: !!address,
      isCorrectChain: chainId === config.chainId,
      connect,
      disconnect,
      switchChain,
    }),
    [config, provider, signer, address, chainId]
  );

  return (
    <SecureMintContext.Provider value={value}>
      {children}
    </SecureMintContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useSecureMintContext(): SecureMintContextValue {
  const context = useContext(SecureMintContext);
  if (!context) {
    throw new Error('useSecureMintContext must be used within a SecureMintProvider');
  }
  return context;
}
