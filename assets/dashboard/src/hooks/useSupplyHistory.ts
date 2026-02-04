import { useQuery } from '@tanstack/react-query';
import { config } from '@/config';

interface SupplyHistoryEntry {
  date: string;
  supply: number;
  backing: number;
}

async function fetchSupplyHistory(): Promise<SupplyHistoryEntry[]> {
  if (!config.subgraphUrl) {
    return generateMockData();
  }

  const query = `
    query SupplyHistory {
      dailyStats(first: 30, orderBy: date, orderDirection: desc) {
        date
        totalSupply
        verifiedBacking
      }
    }
  `;

  try {
    const response = await fetch(config.subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const { data } = await response.json();

    return data.dailyStats
      .map((stat: any) => ({
        date: new Date(Number(stat.date) * 1000).toISOString(),
        supply: Number(BigInt(stat.totalSupply)) / 10 ** 18,
        backing: Number(BigInt(stat.verifiedBacking)) / 10 ** 6,
      }))
      .reverse();
  } catch {
    return generateMockData();
  }
}

function generateMockData(): SupplyHistoryEntry[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let supply = 100_000_000;
  let backing = 101_000_000;

  return Array.from({ length: 30 }, (_, i) => {
    supply += (Math.random() - 0.4) * 1_000_000;
    backing = supply * (1 + Math.random() * 0.05);

    return {
      date: new Date(now - (29 - i) * dayMs).toISOString(),
      supply: Math.max(supply, 0),
      backing: Math.max(backing, 0),
    };
  });
}

export function useSupplyHistory() {
  return useQuery({
    queryKey: ['supplyHistory'],
    queryFn: fetchSupplyHistory,
    refetchInterval: 60000,
  });
}
