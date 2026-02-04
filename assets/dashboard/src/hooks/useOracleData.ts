import { useQuery } from '@tanstack/react-query';
import { Contract, JsonRpcProvider } from 'ethers';
import { config } from '@/config';

interface OracleData {
  currentBacking: bigint;
  lastUpdate: Date;
  isStale: boolean;
  staleDuration: number;
  healthFactor: number;
  attestationValid: boolean;
  stalenessThreshold: number;
  minimumBacking: bigint;
  feedAddress: string;
}

const ORACLE_ABI = [
  'function latestBacking() external view returns (uint256 backing, uint256 timestamp)',
  'function stalenessThreshold() external view returns (uint256)',
  'function minimumBacking() external view returns (uint256)',
  'function PROOF_OF_RESERVE_FEED() external view returns (address)',
];

const TOKEN_ABI = [
  'function totalSupply() external view returns (uint256)',
];

async function fetchOracleData(): Promise<OracleData> {
  const provider = new JsonRpcProvider(config.rpcUrl);

  const oracleContract = new Contract(config.contracts.oracle, ORACLE_ABI, provider);
  const tokenContract = new Contract(config.contracts.token, TOKEN_ABI, provider);

  const [
    [backing, timestamp],
    stalenessThreshold,
    minimumBacking,
    feedAddress,
    totalSupply,
  ] = await Promise.all([
    oracleContract.latestBacking(),
    oracleContract.stalenessThreshold(),
    oracleContract.minimumBacking(),
    oracleContract.PROOF_OF_RESERVE_FEED().catch(() => '0x0'),
    tokenContract.totalSupply(),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const age = now - Number(timestamp);
  const isStale = age > Number(stalenessThreshold);

  // Calculate health factor
  const backingNormalized = backing * BigInt(10 ** 12);
  const healthFactor = totalSupply > 0n
    ? Number((backingNormalized * 10000n) / totalSupply) / 100
    : 100;

  return {
    currentBacking: backing,
    lastUpdate: new Date(Number(timestamp) * 1000),
    isStale,
    staleDuration: isStale ? age - Number(stalenessThreshold) : 0,
    healthFactor,
    attestationValid: !isStale, // Simplified
    stalenessThreshold: Number(stalenessThreshold),
    minimumBacking,
    feedAddress,
  };
}

export function useOracleData() {
  return useQuery({
    queryKey: ['oracleData'],
    queryFn: fetchOracleData,
    refetchInterval: 15000,
  });
}
