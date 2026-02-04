import { useQuery } from '@tanstack/react-query';
import { config } from '@/config';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  acknowledged: boolean;
  details?: Record<string, any>;
}

async function fetchAlertsData(): Promise<Alert[]> {
  // In production, this would fetch from a backend API that monitors the system
  // For now, we generate alerts based on system state

  if (!config.subgraphUrl) {
    return [];
  }

  const query = `
    query RecentEvents {
      alertLevelChanges(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        previousLevel
        newLevel
        changedBy
        reason
        timestamp
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

    return data.alertLevelChanges.map((change: any) => {
      const severity = getSeverityFromLevel(change.newLevel);

      return {
        id: change.id,
        type: 'Alert Level Changed',
        message: `System alert level changed from ${getLevelName(change.previousLevel)} to ${getLevelName(change.newLevel)}`,
        severity,
        timestamp: new Date(Number(change.timestamp) * 1000),
        acknowledged: false,
        details: {
          previousLevel: change.previousLevel,
          newLevel: change.newLevel,
          changedBy: change.changedBy,
          reason: change.reason,
        },
      };
    });
  } catch {
    return [];
  }
}

function getLevelName(level: number): string {
  const names = ['NORMAL', 'ELEVATED', 'RESTRICTED', 'EMERGENCY', 'SHUTDOWN'];
  return names[level] || 'UNKNOWN';
}

function getSeverityFromLevel(level: number): AlertSeverity {
  if (level >= 4) return 'critical';
  if (level >= 3) return 'error';
  if (level >= 1) return 'warning';
  return 'info';
}

export function useAlertsData() {
  return useQuery({
    queryKey: ['alertsData'],
    queryFn: fetchAlertsData,
    refetchInterval: 30000,
  });
}
