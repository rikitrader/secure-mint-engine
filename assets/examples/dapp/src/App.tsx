/**
 * SecureMint Engine - Example DApp
 * React application demonstrating SDK integration
 */

import React, { useState, useEffect } from 'react';
import { SecureMintSDK } from '@securemint/sdk';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
  tokenAddress: import.meta.env.VITE_TOKEN_ADDRESS || '',
  policyAddress: import.meta.env.VITE_POLICY_ADDRESS || '',
  oracleAddress: import.meta.env.VITE_ORACLE_ADDRESS || '',
  treasuryAddress: import.meta.env.VITE_TREASURY_ADDRESS || '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

interface SystemStatus {
  backingRatio: number;
  isOracleStale: boolean;
  emergencyLevel: number;
  invariantsPassed: boolean;
}

interface InvariantResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded text-sm ${
        status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {status ? 'Passed' : 'Failed'}
    </span>
  );
}

function InvariantCard({ invariant }: { invariant: InvariantResult }) {
  return (
    <div className="border rounded-lg p-4 mb-2">
      <div className="flex justify-between items-center">
        <div>
          <span className="font-mono text-sm text-gray-500">{invariant.id}</span>
          <h3 className="font-semibold">{invariant.name}</h3>
        </div>
        <StatusBadge status={invariant.passed} />
      </div>
      <p className="text-sm text-gray-600 mt-2">{invariant.details}</p>
    </div>
  );
}

function MintForm({
  sdk,
  onSuccess,
}: {
  sdk: SecureMintSDK;
  onSuccess: () => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const simulation = await sdk.simulateMint(recipient, amount);
      setResult(simulation);
      if (simulation.success) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Mint Tokens</h2>

      <form onSubmit={handleSimulate}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Recipient Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="0x..."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="1000000"
          />
          <p className="text-xs text-gray-500 mt-1">Amount in smallest unit (e.g., 1000000 = 1 USDC)</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Simulating...' : 'Simulate Mint'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className={`mt-4 p-3 rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className="font-semibold">Simulation Result</h3>
          <p>Status: {result.success ? 'Success' : 'Failed'}</p>
          <p>Reason: {result.reason}</p>
          {result.estimatedGas && <p>Estimated Gas: {result.estimatedGas}</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  const [sdk, setSdk] = useState<SecureMintSDK | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [invariants, setInvariants] = useState<InvariantResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeSDK();
  }, []);

  const initializeSDK = async () => {
    try {
      const newSdk = new SecureMintSDK(CONFIG);
      setSdk(newSdk);
      await loadData(newSdk);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (sdkInstance: SecureMintSDK) => {
    try {
      // Load token info
      const info = await sdkInstance.getTokenInfo();
      setTokenInfo(info);

      // Load system status
      const backingRatio = await sdkInstance.getBackingRatio();
      const isOracleStale = await sdkInstance.isOracleStale();
      const emergencyLevel = await sdkInstance.getEmergencyLevel();
      const invResults = await sdkInstance.checkInvariants();

      setStatus({
        backingRatio,
        isOracleStale,
        emergencyLevel,
        invariantsPassed: invResults.every((i) => i.passed),
      });

      setInvariants(invResults);
    } catch (err: any) {
      console.error('Failed to load data:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading SecureMint...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">SecureMint DApp</h1>
          <p className="text-gray-600">Oracle-gated secure minting example</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Token Info */}
        {tokenInfo && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Token Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold">{tokenInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Symbol</p>
                <p className="font-semibold">{tokenInfo.symbol}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Decimals</p>
                <p className="font-semibold">{tokenInfo.decimals}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Supply</p>
                <p className="font-semibold">
                  {ethers.formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Status */}
        {status && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">System Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Backing Ratio</p>
                <p className={`font-semibold ${status.backingRatio >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                  {(status.backingRatio * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Oracle Status</p>
                <StatusBadge status={!status.isOracleStale} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Emergency Level</p>
                <p className="font-semibold">{status.emergencyLevel}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Invariants</p>
                <StatusBadge status={status.invariantsPassed} />
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Mint Form */}
          {sdk && <MintForm sdk={sdk} onSuccess={() => loadData(sdk)} />}

          {/* Invariants */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Invariants</h2>
            {invariants.map((inv) => (
              <InvariantCard key={inv.id} invariant={inv} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
