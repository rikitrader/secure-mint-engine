import { Contract, JsonRpcProvider, WebSocketProvider } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  data?: Record<string, any>;
  source: string;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: (event: any) => boolean;
  severity: AlertSeverity;
  message: (event: any) => string;
}

export interface WebhookConfig {
  type: 'discord' | 'slack' | 'pagerduty' | 'telegram' | 'webhook';
  url: string;
  enabled: boolean;
  severityFilter: AlertSeverity[];
  headers?: Record<string, string>;
}

export interface AlertServiceConfig {
  rpcUrl: string;
  wsUrl?: string;
  contracts: {
    token: string;
    policy: string;
    oracle: string;
    treasury: string;
    redemption: string;
    governor: string;
    emergencyPause: string;
  };
  webhooks: WebhookConfig[];
  rules: AlertRule[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class AlertService {
  private provider: JsonRpcProvider | WebSocketProvider;
  private config: AlertServiceConfig;
  private contracts: Map<string, Contract> = new Map();
  private alertHistory: Alert[] = [];
  private isRunning = false;

  constructor(config: AlertServiceConfig) {
    this.config = config;
    this.provider = config.wsUrl
      ? new WebSocketProvider(config.wsUrl)
      : new JsonRpcProvider(config.rpcUrl);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[AlertService] Starting alert monitoring...');

    // Initialize contracts
    await this.initializeContracts();

    // Set up event listeners
    this.setupEventListeners();

    console.log('[AlertService] Monitoring active');
  }

  stop(): void {
    this.isRunning = false;
    this.contracts.forEach((contract) => {
      contract.removeAllListeners();
    });
    console.log('[AlertService] Stopped');
  }

  private async initializeContracts(): Promise<void> {
    const ABI_MAP: Record<string, string[]> = {
      emergencyPause: [
        'event AlertLevelChanged(uint8 previousLevel, uint8 newLevel, address changedBy, string reason)',
      ],
      policy: [
        'event SecureMintExecuted(address indexed to, uint256 amount, uint256 backing, uint256 newSupply, uint256 oracleTimestamp)',
        'event Paused(address account)',
        'event Unpaused(address account)',
      ],
      oracle: [
        'event BackingUpdated(uint256 backing, uint256 timestamp)',
        'event StaleDataDetected(uint256 lastUpdate, uint256 threshold)',
      ],
      treasury: [
        'event EmergencyWithdrawal(address indexed to, uint256 amount, string reason)',
        'event Rebalanced(uint256[4] oldBalances, uint256[4] newBalances)',
      ],
      redemption: [
        'event RedemptionRequested(address indexed user, uint256 amount, uint256 unlockTime)',
        'event RedemptionExecuted(address indexed user, uint256 tokenAmount, uint256 reserveAmount)',
      ],
      governor: [
        'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
        'event ProposalExecuted(uint256 proposalId)',
        'event ProposalVetoed(uint256 proposalId, address vetoer)',
      ],
    };

    for (const [name, address] of Object.entries(this.config.contracts)) {
      const abi = ABI_MAP[name];
      if (abi) {
        const contract = new Contract(address, abi, this.provider);
        this.contracts.set(name, contract);
      }
    }
  }

  private setupEventListeners(): void {
    // Emergency Pause events
    const emergencyContract = this.contracts.get('emergencyPause');
    if (emergencyContract) {
      emergencyContract.on('AlertLevelChanged', (prev, next, changedBy, reason) => {
        const LEVELS = ['NORMAL', 'ELEVATED', 'RESTRICTED', 'EMERGENCY', 'SHUTDOWN'];
        const severity = next >= 3 ? 'critical' : next >= 1 ? 'warning' : 'info';

        this.emit({
          type: 'ALERT_LEVEL_CHANGED',
          title: `System Alert Level Changed`,
          message: `Alert level changed from ${LEVELS[prev]} to ${LEVELS[next]}. Reason: ${reason}`,
          severity,
          data: { previousLevel: prev, newLevel: next, changedBy, reason },
        });
      });
    }

    // Policy events
    const policyContract = this.contracts.get('policy');
    if (policyContract) {
      policyContract.on('Paused', (account) => {
        this.emit({
          type: 'SYSTEM_PAUSED',
          title: 'System Paused',
          message: `SecureMint system has been paused by ${account}`,
          severity: 'critical',
          data: { pausedBy: account },
        });
      });

      policyContract.on('SecureMintExecuted', (to, amount, backing, newSupply) => {
        // Check for large mints (>1M tokens)
        if (amount > BigInt(10 ** 24)) {
          this.emit({
            type: 'LARGE_MINT',
            title: 'Large Mint Detected',
            message: `Large mint of ${Number(amount) / 10 ** 18} tokens to ${to}`,
            severity: 'warning',
            data: { to, amount: amount.toString(), backing: backing.toString() },
          });
        }

        // Check health factor
        const backingNorm = backing * BigInt(10 ** 12);
        const healthFactor = newSupply > 0n ? Number((backingNorm * 10000n) / newSupply) / 100 : 100;

        if (healthFactor < 100) {
          this.emit({
            type: 'UNDERCOLLATERALIZED',
            title: 'System Undercollateralized',
            message: `Health factor dropped to ${healthFactor.toFixed(2)}%`,
            severity: 'critical',
            data: { healthFactor, backing: backing.toString(), supply: newSupply.toString() },
          });
        } else if (healthFactor < 105) {
          this.emit({
            type: 'LOW_COLLATERALIZATION',
            title: 'Low Collateralization Warning',
            message: `Health factor at ${healthFactor.toFixed(2)}%`,
            severity: 'warning',
            data: { healthFactor },
          });
        }
      });
    }

    // Treasury events
    const treasuryContract = this.contracts.get('treasury');
    if (treasuryContract) {
      treasuryContract.on('EmergencyWithdrawal', (to, amount, reason) => {
        this.emit({
          type: 'EMERGENCY_WITHDRAWAL',
          title: 'Emergency Treasury Withdrawal',
          message: `Emergency withdrawal of ${Number(amount) / 10 ** 6} USDC to ${to}. Reason: ${reason}`,
          severity: 'critical',
          data: { to, amount: amount.toString(), reason },
        });
      });
    }

    // Governor events
    const governorContract = this.contracts.get('governor');
    if (governorContract) {
      governorContract.on('ProposalCreated', (proposalId, proposer, _, __, ___, ____, _____, description) => {
        this.emit({
          type: 'PROPOSAL_CREATED',
          title: 'New Governance Proposal',
          message: `Proposal #${proposalId} created by ${proposer}: ${description.slice(0, 100)}...`,
          severity: 'info',
          data: { proposalId: proposalId.toString(), proposer, description },
        });
      });

      governorContract.on('ProposalVetoed', (proposalId, vetoer) => {
        this.emit({
          type: 'PROPOSAL_VETOED',
          title: 'Proposal Vetoed',
          message: `Proposal #${proposalId} has been vetoed by guardian ${vetoer}`,
          severity: 'warning',
          data: { proposalId: proposalId.toString(), vetoer },
        });
      });
    }
  }

  private async emit(alert: Omit<Alert, 'id' | 'timestamp' | 'source'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      source: 'SecureMint',
    };

    // Store in history
    this.alertHistory.push(fullAlert);
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    console.log(`[Alert] ${fullAlert.severity.toUpperCase()}: ${fullAlert.title}`);

    // Send to webhooks
    await this.sendToWebhooks(fullAlert);
  }

  private async sendToWebhooks(alert: Alert): Promise<void> {
    const enabledWebhooks = this.config.webhooks.filter(
      (w) => w.enabled && w.severityFilter.includes(alert.severity)
    );

    await Promise.allSettled(
      enabledWebhooks.map((webhook) => this.sendToWebhook(webhook, alert))
    );
  }

  private async sendToWebhook(webhook: WebhookConfig, alert: Alert): Promise<void> {
    const payload = this.formatPayload(webhook.type, alert);

    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error(`[AlertService] Failed to send to ${webhook.type}:`, error);
    }
  }

  private formatPayload(type: WebhookConfig['type'], alert: Alert): any {
    switch (type) {
      case 'discord':
        return this.formatDiscordPayload(alert);
      case 'slack':
        return this.formatSlackPayload(alert);
      case 'pagerduty':
        return this.formatPagerDutyPayload(alert);
      case 'telegram':
        return this.formatTelegramPayload(alert);
      default:
        return alert;
    }
  }

  private formatDiscordPayload(alert: Alert): any {
    const colorMap: Record<AlertSeverity, number> = {
      info: 0x3498db,
      warning: 0xf1c40f,
      error: 0xe74c3c,
      critical: 0x992d22,
    };

    return {
      embeds: [
        {
          title: `${this.getSeverityEmoji(alert.severity)} ${alert.title}`,
          description: alert.message,
          color: colorMap[alert.severity],
          fields: alert.data
            ? Object.entries(alert.data).map(([key, value]) => ({
                name: key,
                value: String(value).slice(0, 1024),
                inline: true,
              }))
            : [],
          timestamp: alert.timestamp.toISOString(),
          footer: {
            text: `SecureMint Alert System`,
          },
        },
      ],
    };
  }

  private formatSlackPayload(alert: Alert): any {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${this.getSeverityEmoji(alert.severity)} ${alert.title}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: alert.message,
          },
        },
        ...(alert.data
          ? [
              {
                type: 'section',
                fields: Object.entries(alert.data).map(([key, value]) => ({
                  type: 'mrkdwn',
                  text: `*${key}:* ${String(value).slice(0, 100)}`,
                })),
              },
            ]
          : []),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `SecureMint Alert | ${alert.timestamp.toISOString()}`,
            },
          ],
        },
      ],
    };
  }

  private formatPagerDutyPayload(alert: Alert): any {
    const severityMap: Record<AlertSeverity, string> = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'critical',
    };

    return {
      routing_key: '', // Set by integration
      event_action: 'trigger',
      dedup_key: `securemint-${alert.type}-${Date.now()}`,
      payload: {
        summary: `${alert.title}: ${alert.message}`,
        severity: severityMap[alert.severity],
        source: 'SecureMint',
        custom_details: alert.data,
      },
    };
  }

  private formatTelegramPayload(alert: Alert): any {
    const emoji = this.getSeverityEmoji(alert.severity);
    let text = `${emoji} *${alert.title}*\n\n${alert.message}`;

    if (alert.data) {
      text += '\n\n*Details:*';
      for (const [key, value] of Object.entries(alert.data)) {
        text += `\n• ${key}: \`${String(value).slice(0, 100)}\``;
      }
    }

    return {
      text,
      parse_mode: 'Markdown',
    };
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  async testWebhooks(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    const testAlert: Alert = {
      id: 'test',
      type: 'TEST',
      title: 'Test Alert',
      message: 'This is a test alert from SecureMint Alert Service',
      severity: 'info',
      timestamp: new Date(),
      source: 'SecureMint',
      data: { test: true },
    };

    for (const webhook of this.config.webhooks) {
      if (!webhook.enabled) {
        results[webhook.type] = false;
        continue;
      }

      try {
        await this.sendToWebhook(webhook, testAlert);
        results[webhook.type] = true;
      } catch {
        results[webhook.type] = false;
      }
    }

    return results;
  }
}
