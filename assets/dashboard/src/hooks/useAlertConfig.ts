import { useQuery } from '@tanstack/react-query';

interface WebhookConfig {
  enabled: boolean;
  url?: string;
  channel?: string;
}

interface AlertConfig {
  discord?: WebhookConfig;
  slack?: WebhookConfig;
  pagerduty?: WebhookConfig;
  email?: {
    enabled: boolean;
    addresses: string[];
  };
}

async function fetchAlertConfig(): Promise<AlertConfig> {
  // In production, this would fetch from a backend configuration API
  // For now, return a mock configuration

  return {
    discord: {
      enabled: false,
    },
    slack: {
      enabled: false,
    },
    pagerduty: {
      enabled: false,
    },
    email: {
      enabled: false,
      addresses: [],
    },
  };
}

export function useAlertConfig() {
  return useQuery({
    queryKey: ['alertConfig'],
    queryFn: fetchAlertConfig,
    staleTime: 300000, // 5 minutes
  });
}
