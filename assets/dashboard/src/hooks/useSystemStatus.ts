import { useQuery } from '@tanstack/react-query';
import { Contract, JsonRpcProvider } from 'ethers';
import { config } from '@/config';

type AlertLevel = 'NORMAL' | 'ELEVATED' | 'RESTRICTED' | 'EMERGENCY' | 'SHUTDOWN';

interface SystemStatus {
  alertLevel: AlertLevel;
  alertReason?: string;
  healthFactor: number;
  totalSupply: bigint;
  totalBacking: bigint;
  epochRemaining: bigint;
  isPaused: boolean;
  network: string;
  recentEvents?: { type: string; time: string }[];
}

const ALERT_LEVELS: AlertLevel[] = ['NORMAL', 'ELEVATED', 'RESTRICTED', 'EMERGENCY', 'SHUTDOWN'];

const POLICY_ABI = [
  'function maxMintable() external view returns (uint256)',
  'function epochMintedAmount() external view returns (uint256)',
  'function epochCapacity() external view returns (uint256)',
  'function paused() external view returns (bool)',
];

const EMERGENCY_ABI = [
  'function currentAlertLevel() external view returns (uint8)',
];

const TOKEN_ABI = [
  'function totalSupply() external view returns (uint256)',
];

const ORACLE_ABI = [
  'function latestBacking() external view returns (uint256 backing, uint256 timestamp)',
];

async function fetchSystemStatus(): Promise<SystemStatus> {
  const provider = new JsonRpcProvider(config.rpcUrl);

  const policyContract = new Contract(config.contracts.policy, POLICY_ABI, provider);
  const emergencyContract = new Contract(config.contracts.emergencyPause, EMERGENCY_ABI, provider);
  const tokenContract = new Contract(config.contracts.token, TOKEN_ABI, provider);
  const oracleContract = new Contract(config.contracts.oracle, ORACLE_ABI, provider);

  const [
    epochMinted,
    epochCapacity,
    isPaused,
    alertLevelNum,
    totalSupply,
    [backing],
  ] = await Promise.all([
    policyContract.epochMintedAmount(),
    policyContract.epochCapacity(),
    policyContract.paused(),
    emergencyContract.currentAlertLevel(),
    tokenContract.totalSupply(),
    oracleContract.latestBacking(),
  ]);

  const alertLevel = ALERT_LEVELS[Number(alertLevelNum)] || 'NORMAL';
  const epochRemaining = epochCapacity - epochMinted;

  // Calculate health factor: (backing * 10^12 * 10000) / supply
  const backingNormalized = backing * BigInt(10 ** 12);
  const healthFactor = totalSupply > 0n
    ? Number((backingNormalized * 10000n) / totalSupply) / 100
    : 100;

  return {
    alertLevel,
    healthFactor,
    totalSupply,
    totalBacking: backing,
    epochRemaining,
    isPaused,
    network: config.networkName,
    recentEvents: [], // Would fetch from subgraph
  };
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 15000,
  });
}
