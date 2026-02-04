import { AlertRule, AlertSeverity } from './AlertService';

export function createDefaultRules(): AlertRule[] {
  return [
    {
      id: 'oracle-stale',
      name: 'Oracle Staleness',
      enabled: true,
      condition: (event) => event.type === 'BackingUpdated' && event.isStale,
      severity: 'critical',
      message: (event) =>
        `Oracle data is stale. Last update: ${event.lastUpdate}, Threshold: ${event.threshold}`,
    },
    {
      id: 'health-factor-critical',
      name: 'Health Factor Critical',
      enabled: true,
      condition: (event) => event.type === 'HealthFactorUpdate' && event.healthFactor < 100,
      severity: 'critical',
      message: (event) =>
        `Health factor dropped below 100%: ${event.healthFactor.toFixed(2)}%`,
    },
    {
      id: 'health-factor-warning',
      name: 'Health Factor Warning',
      enabled: true,
      condition: (event) =>
        event.type === 'HealthFactorUpdate' &&
        event.healthFactor >= 100 &&
        event.healthFactor < 105,
      severity: 'warning',
      message: (event) =>
        `Health factor is low: ${event.healthFactor.toFixed(2)}%`,
    },
    {
      id: 'alert-level-high',
      name: 'High Alert Level',
      enabled: true,
      condition: (event) =>
        event.type === 'AlertLevelChanged' && event.newLevel >= 3,
      severity: 'critical',
      message: (event) =>
        `System entered ${['NORMAL', 'ELEVATED', 'RESTRICTED', 'EMERGENCY', 'SHUTDOWN'][event.newLevel]} mode`,
    },
    {
      id: 'large-mint',
      name: 'Large Mint',
      enabled: true,
      condition: (event) =>
        event.type === 'SecureMintExecuted' &&
        BigInt(event.amount) > BigInt(10 ** 24), // > 1M tokens
      severity: 'warning',
      message: (event) =>
        `Large mint detected: ${Number(BigInt(event.amount)) / 10 ** 18} tokens to ${event.to}`,
    },
    {
      id: 'large-redemption',
      name: 'Large Redemption',
      enabled: true,
      condition: (event) =>
        event.type === 'RedemptionRequested' &&
        BigInt(event.amount) > BigInt(10 ** 24), // > 1M tokens
      severity: 'warning',
      message: (event) =>
        `Large redemption requested: ${Number(BigInt(event.amount)) / 10 ** 18} tokens by ${event.user}`,
    },
    {
      id: 'emergency-withdrawal',
      name: 'Emergency Withdrawal',
      enabled: true,
      condition: (event) => event.type === 'EmergencyWithdrawal',
      severity: 'critical',
      message: (event) =>
        `Emergency withdrawal: ${Number(BigInt(event.amount)) / 10 ** 6} USDC to ${event.to}. Reason: ${event.reason}`,
    },
    {
      id: 'proposal-veto',
      name: 'Proposal Vetoed',
      enabled: true,
      condition: (event) => event.type === 'ProposalVetoed',
      severity: 'warning',
      message: (event) =>
        `Proposal #${event.proposalId} was vetoed by guardian ${event.vetoer}`,
    },
    {
      id: 'system-paused',
      name: 'System Paused',
      enabled: true,
      condition: (event) => event.type === 'Paused',
      severity: 'critical',
      message: (event) => `System paused by ${event.account}`,
    },
    {
      id: 'epoch-capacity-low',
      name: 'Epoch Capacity Low',
      enabled: true,
      condition: (event) =>
        event.type === 'EpochCapacityUpdate' && event.remainingPercent < 10,
      severity: 'warning',
      message: (event) =>
        `Epoch capacity running low: ${event.remainingPercent.toFixed(1)}% remaining`,
    },
  ];
}
