import { useQuery } from '@tanstack/react-query';
import { config } from '@/config';

interface OracleHistoryEntry {
  timestamp: Date;
  backing: bigint;
  healthFactor: number;
}

async function fetchOracleHistory(): Promise<OracleHistoryEntry[]> {
  if (!config.subgraphUrl) {
    // Return mock data if no subgraph configured
    return generateMockHistory();
  }

  const query = `
    query OracleHistory {
      dailyStats(first: 7, orderBy: date, orderDirection: desc) {
        date
        verifiedBacking
        healthFactor
        totalSupply
      }
    }
  `;

  const response = await fetch(config.subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const { data } = await response.json();

  return data.dailyStats.map((stat: any) => ({
    timestamp: new Date(Number(stat.date) * 1000),
    backing: BigInt(stat.verifiedBacking),
    healthFactor: Number(stat.healthFactor) / 100,
  })).reverse();
}

function generateMockHistory(): OracleHistoryEntry[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return Array.from({ length: 7 }, (_, i) => ({
    timestamp: new Date(now - (6 - i) * dayMs),
    backing: BigInt(100_000_000 + Math.random() * 10_000_000) * BigInt(10 ** 6),
    healthFactor: 100 + Math.random() * 5,
  }));
}

export function useOracleHistory() {
  return useQuery({
    queryKey: ['oracleHistory'],
    queryFn: fetchOracleHistory,
    refetchInterval: 60000,
  });
}
