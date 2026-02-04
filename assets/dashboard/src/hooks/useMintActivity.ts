import { useQuery } from '@tanstack/react-query';
import { config } from '@/config';

interface MintActivityEntry {
  hour: number;
  minted: number;
  redeemed: number;
}

async function fetchMintActivity(): Promise<MintActivityEntry[]> {
  if (!config.subgraphUrl) {
    return generateMockData();
  }

  // Get mints and redemptions from last 24 hours
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const query = `
    query MintActivity {
      mints(first: 1000, where: { timestamp_gte: ${oneDayAgo} }) {
        amount
        timestamp
      }
      redemptionRequests(first: 1000, where: { requestTimestamp_gte: ${oneDayAgo}, status: "EXECUTED" }) {
        executedAmount
        executionTimestamp
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

    // Aggregate by hour
    const hourlyData: Record<number, { minted: number; redeemed: number }> = {};

    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { minted: 0, redeemed: 0 };
    }

    data.mints.forEach((mint: any) => {
      const hour = new Date(Number(mint.timestamp) * 1000).getHours();
      hourlyData[hour].minted += Number(BigInt(mint.amount)) / 10 ** 18;
    });

    data.redemptionRequests.forEach((redemption: any) => {
      const hour = new Date(Number(redemption.executionTimestamp) * 1000).getHours();
      hourlyData[hour].redeemed += Number(BigInt(redemption.executedAmount)) / 10 ** 18;
    });

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      minted: data.minted,
      redeemed: data.redeemed,
    }));
  } catch {
    return generateMockData();
  }
}

function generateMockData(): MintActivityEntry[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    minted: Math.random() * 500_000,
    redeemed: Math.random() * 300_000,
  }));
}

export function useMintActivity() {
  return useQuery({
    queryKey: ['mintActivity'],
    queryFn: fetchMintActivity,
    refetchInterval: 60000,
  });
}
