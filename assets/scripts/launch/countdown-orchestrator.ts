#!/usr/bin/env npx ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SecureMint Engine - Launch Countdown Orchestrator
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * MANDATORY GATE: Coordinates the entire launch sequence from T-30 to T-0
 *
 * This tool manages:
 * - Pre-launch checklist (T-30 to T-7)
 * - Final preparation (T-7 to T-1)
 * - Launch day protocol (T-0)
 * - Post-launch monitoring
 * - Go/No-Go decision framework
 *
 * Usage: npx ts-node scripts/launch/countdown-orchestrator.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escapes markdown special characters for safe table rendering
 */
function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`');
}

/**
 * Timezone offset mapping (hours from UTC)
 */
const TIMEZONE_OFFSETS: Record<string, number> = {
  UTC: 0,
  EST: -5,
  PST: -8,
  CET: 1,
  JST: 9,
  SGT: 8
};

/**
 * Converts a date/time with timezone to UTC
 */
function toUTCDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const offset = TIMEZONE_OFFSETS[timezone] || 0;

  // Create date in local timezone then adjust to UTC
  const date = new Date(Date.UTC(year, month - 1, day, hours - offset, minutes));
  return date;
}

/**
 * PII warning notice
 */
const PII_WARNING = `
⚠️  WARNING: This configuration contains Personally Identifiable Information (PII)
   including names, emails, and phone numbers. Store securely and do not commit
   to public repositories. Consider using environment variables for sensitive data.
`;

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCH CHECKLIST DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

interface ChecklistItem {
  id: string;
  phase: 'T-30' | 'T-14' | 'T-7' | 'T-3' | 'T-1' | 'T-0' | 'POST';
  category: string;
  item: string;
  description: string;
  owner: string;
  blocking: boolean; // If true, cannot proceed without completion
  verificationMethod: string;
}

const LAUNCH_CHECKLIST: ChecklistItem[] = [
  // T-30: Strategic Preparation
  { id: 'T30-01', phase: 'T-30', category: 'Legal', item: 'Legal Review Complete', description: 'All legal opinions and compliance documents finalized', owner: 'Legal Counsel', blocking: true, verificationMethod: 'Signed legal opinion letter' },
  { id: 'T30-02', phase: 'T-30', category: 'Legal', item: 'Terms of Service Published', description: 'ToS published on website and in dApp', owner: 'Legal Counsel', blocking: true, verificationMethod: 'URL verification' },
  { id: 'T30-03', phase: 'T-30', category: 'Legal', item: 'Privacy Policy Published', description: 'Privacy policy published and accessible', owner: 'Legal Counsel', blocking: true, verificationMethod: 'URL verification' },
  { id: 'T30-04', phase: 'T-30', category: 'Security', item: 'Audit Complete', description: 'Security audit completed with no critical/high findings', owner: 'Security Lead', blocking: true, verificationMethod: 'Final audit report' },
  { id: 'T30-05', phase: 'T-30', category: 'Security', item: 'Bug Bounty Program Ready', description: 'Bug bounty program configured and funded', owner: 'Security Lead', blocking: false, verificationMethod: 'Immunefi/HackerOne listing' },
  { id: 'T30-06', phase: 'T-30', category: 'Technical', item: 'Contracts Verified', description: 'All contracts verified on block explorer', owner: 'Tech Lead', blocking: true, verificationMethod: 'Etherscan verification' },
  { id: 'T30-07', phase: 'T-30', category: 'Technical', item: 'Multi-sig Configured', description: 'Gnosis Safe configured with all signers', owner: 'Tech Lead', blocking: true, verificationMethod: 'Safe transaction test' },
  { id: 'T30-08', phase: 'T-30', category: 'Marketing', item: 'PR Plan Finalized', description: 'Press release and media outreach plan ready', owner: 'Marketing Lead', blocking: false, verificationMethod: 'PR calendar' },

  // T-14: Operational Readiness
  { id: 'T14-01', phase: 'T-14', category: 'Technical', item: 'Mainnet Contracts Deployed', description: 'All contracts deployed to mainnet (paused)', owner: 'Tech Lead', blocking: true, verificationMethod: 'Contract addresses' },
  { id: 'T14-02', phase: 'T-14', category: 'Technical', item: 'Oracle Integration Live', description: 'Oracle feeds connected and responding', owner: 'Tech Lead', blocking: true, verificationMethod: 'Oracle health check' },
  { id: 'T14-03', phase: 'T-14', category: 'Technical', item: 'Subgraph Deployed', description: 'The Graph subgraph deployed and syncing', owner: 'Tech Lead', blocking: true, verificationMethod: 'GraphQL query test' },
  { id: 'T14-04', phase: 'T-14', category: 'Technical', item: 'API Gateway Live', description: 'API gateway deployed and accessible', owner: 'Tech Lead', blocking: true, verificationMethod: 'Health endpoint' },
  { id: 'T14-05', phase: 'T-14', category: 'Infrastructure', item: 'Monitoring Configured', description: 'Grafana dashboards and alerts configured', owner: 'DevOps Lead', blocking: true, verificationMethod: 'Alert test' },
  { id: 'T14-06', phase: 'T-14', category: 'Infrastructure', item: 'Incident Response Plan', description: 'Incident response playbook distributed', owner: 'Security Lead', blocking: true, verificationMethod: 'Team acknowledgment' },
  { id: 'T14-07', phase: 'T-14', category: 'Operations', item: 'Support Team Trained', description: 'Customer support team briefed and ready', owner: 'Support Lead', blocking: false, verificationMethod: 'Training completion' },
  { id: 'T14-08', phase: 'T-14', category: 'Operations', item: 'On-Call Schedule Set', description: '24/7 on-call rotation established', owner: 'DevOps Lead', blocking: true, verificationMethod: 'PagerDuty/Opsgenie' },

  // T-7: Final Verification
  { id: 'T07-01', phase: 'T-7', category: 'Technical', item: 'Smoke Tests Passed', description: 'All smoke tests passing on mainnet', owner: 'QA Lead', blocking: true, verificationMethod: 'Test report' },
  { id: 'T07-02', phase: 'T-7', category: 'Technical', item: 'Frontend Deployed', description: 'Production frontend deployed and accessible', owner: 'Frontend Lead', blocking: true, verificationMethod: 'URL verification' },
  { id: 'T07-03', phase: 'T-7', category: 'Technical', item: 'DNS/CDN Configured', description: 'DNS and CDN properly configured', owner: 'DevOps Lead', blocking: true, verificationMethod: 'DNS lookup' },
  { id: 'T07-04', phase: 'T-7', category: 'Liquidity', item: 'Initial Liquidity Ready', description: 'Liquidity funds in designated wallet', owner: 'Treasury Lead', blocking: true, verificationMethod: 'Wallet balance' },
  { id: 'T07-05', phase: 'T-7', category: 'Liquidity', item: 'DEX Pool Strategy Confirmed', description: 'Liquidity pool parameters finalized', owner: 'Treasury Lead', blocking: true, verificationMethod: 'Strategy document' },
  { id: 'T07-06', phase: 'T-7', category: 'Marketing', item: 'Social Announcements Scheduled', description: 'Launch announcements queued in social tools', owner: 'Marketing Lead', blocking: false, verificationMethod: 'Scheduled posts' },
  { id: 'T07-07', phase: 'T-7', category: 'Marketing', item: 'Community Briefed', description: 'Discord/Telegram community informed of launch', owner: 'Community Lead', blocking: false, verificationMethod: 'Community post' },
  { id: 'T07-08', phase: 'T-7', category: 'Security', item: 'War Room Scheduled', description: 'Launch war room calendar invite sent', owner: 'Project Lead', blocking: true, verificationMethod: 'Calendar invite' },

  // T-3: Pre-Launch
  { id: 'T03-01', phase: 'T-3', category: 'Technical', item: 'Load Test Complete', description: 'System load tested for expected traffic', owner: 'DevOps Lead', blocking: true, verificationMethod: 'Load test report' },
  { id: 'T03-02', phase: 'T-3', category: 'Technical', item: 'Database Backup Verified', description: 'Backup and recovery procedures tested', owner: 'DevOps Lead', blocking: true, verificationMethod: 'Restore test' },
  { id: 'T03-03', phase: 'T-3', category: 'Security', item: 'Final Security Scan', description: 'Final vulnerability scan of all systems', owner: 'Security Lead', blocking: true, verificationMethod: 'Scan report' },
  { id: 'T03-04', phase: 'T-3', category: 'Operations', item: 'Runbook Distributed', description: 'Launch day runbook sent to all participants', owner: 'Project Lead', blocking: true, verificationMethod: 'Team acknowledgment' },
  { id: 'T03-05', phase: 'T-3', category: 'Communications', item: 'Status Page Ready', description: 'Status page configured and tested', owner: 'DevOps Lead', blocking: false, verificationMethod: 'Status page URL' },
  { id: 'T03-06', phase: 'T-3', category: 'Legal', item: 'Regulatory Notifications', description: 'Required regulatory notifications sent', owner: 'Legal Counsel', blocking: true, verificationMethod: 'Notification receipts' },

  // T-1: Final Preparation
  { id: 'T01-01', phase: 'T-1', category: 'Technical', item: 'System Health Check', description: 'All systems green on monitoring', owner: 'DevOps Lead', blocking: true, verificationMethod: 'Grafana dashboard' },
  { id: 'T01-02', phase: 'T-1', category: 'Technical', item: 'Multi-sig Signers Available', description: 'All required signers confirmed available', owner: 'Project Lead', blocking: true, verificationMethod: 'Signer confirmation' },
  { id: 'T01-03', phase: 'T-1', category: 'Liquidity', item: 'Liquidity Wallet Funded', description: 'Launch liquidity in hot wallet', owner: 'Treasury Lead', blocking: true, verificationMethod: 'Wallet balance' },
  { id: 'T01-04', phase: 'T-1', category: 'Operations', item: 'War Room Confirmed', description: 'All war room participants confirmed', owner: 'Project Lead', blocking: true, verificationMethod: 'Attendance list' },
  { id: 'T01-05', phase: 'T-1', category: 'Communications', item: 'Comms Channels Tested', description: 'Backup communication channels tested', owner: 'Project Lead', blocking: true, verificationMethod: 'Test messages' },
  { id: 'T01-06', phase: 'T-1', category: 'Security', item: 'Emergency Contacts Updated', description: 'Emergency contact list current', owner: 'Security Lead', blocking: true, verificationMethod: 'Contact list' },

  // T-0: Launch Day
  { id: 'T00-01', phase: 'T-0', category: 'Operations', item: 'War Room Active', description: 'War room opened with all participants', owner: 'Project Lead', blocking: true, verificationMethod: 'War room attendance' },
  { id: 'T00-02', phase: 'T-0', category: 'Technical', item: 'Final System Check', description: 'Pre-launch system health verification', owner: 'DevOps Lead', blocking: true, verificationMethod: 'Health check script' },
  { id: 'T00-03', phase: 'T-0', category: 'Technical', item: 'Unpause Contracts', description: 'Execute unpause transaction via multi-sig', owner: 'Tech Lead', blocking: true, verificationMethod: 'Transaction hash' },
  { id: 'T00-04', phase: 'T-0', category: 'Liquidity', item: 'Add Initial Liquidity', description: 'Add liquidity to DEX pools', owner: 'Treasury Lead', blocking: true, verificationMethod: 'Pool creation tx' },
  { id: 'T00-05', phase: 'T-0', category: 'Communications', item: 'Launch Announcement', description: 'Publish launch announcement', owner: 'Marketing Lead', blocking: false, verificationMethod: 'Social posts' },
  { id: 'T00-06', phase: 'T-0', category: 'Monitoring', item: 'Active Monitoring', description: 'Confirm active monitoring of all metrics', owner: 'DevOps Lead', blocking: true, verificationMethod: 'Dashboard confirmation' },
  { id: 'T00-07', phase: 'T-0', category: 'Security', item: 'Incident Response Ready', description: 'IR team on standby with playbook', owner: 'Security Lead', blocking: true, verificationMethod: 'Team confirmation' },

  // POST: Post-Launch
  { id: 'POST-01', phase: 'POST', category: 'Monitoring', item: 'First Hour Check', description: 'System stability verified after 1 hour', owner: 'DevOps Lead', blocking: false, verificationMethod: 'Metrics review' },
  { id: 'POST-02', phase: 'POST', category: 'Monitoring', item: 'First Day Review', description: '24-hour operational review complete', owner: 'Project Lead', blocking: false, verificationMethod: 'Review meeting' },
  { id: 'POST-03', phase: 'POST', category: 'Security', item: 'Security Review', description: 'Post-launch security review', owner: 'Security Lead', blocking: false, verificationMethod: 'Security report' },
  { id: 'POST-04', phase: 'POST', category: 'Operations', item: 'Bug Bounty Activated', description: 'Bug bounty program made public', owner: 'Security Lead', blocking: false, verificationMethod: 'Public listing' },
  { id: 'POST-05', phase: 'POST', category: 'Communications', item: 'Community Update', description: 'Post-launch community update', owner: 'Community Lead', blocking: false, verificationMethod: 'Community post' },
  { id: 'POST-06', phase: 'POST', category: 'Operations', item: 'Retrospective Scheduled', description: 'Launch retrospective meeting scheduled', owner: 'Project Lead', blocking: false, verificationMethod: 'Calendar invite' }
];

// ═══════════════════════════════════════════════════════════════════════════════
// GO/NO-GO CRITERIA
// ═══════════════════════════════════════════════════════════════════════════════

interface GoNoGoCriteria {
  category: string;
  criterion: string;
  required: boolean;
  currentStatus: 'GO' | 'NO-GO' | 'UNKNOWN';
  notes: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCH ORCHESTRATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

interface LaunchConfig {
  projectName: string;
  tokenSymbol: string;
  launchDate: string;
  launchTime: string;
  timezone: string;
  chain: string;

  // Team
  projectLead: { name: string; email: string; phone: string };
  techLead: { name: string; email: string; phone: string };
  securityLead: { name: string; email: string; phone: string };
  marketingLead: { name: string; email: string; phone: string };
  treasuryLead: { name: string; email: string; phone: string };

  // Technical
  contractAddresses: Record<string, string>;
  multisigAddress: string;
  multisigThreshold: string;

  // Liquidity
  initialLiquidity: number;
  liquidityToken: string;
  targetDEX: string;

  // Communications
  discordUrl: string;
  telegramUrl: string;
  twitterHandle: string;
  statusPageUrl: string;

  // Emergency
  emergencyPauseProcess: string;
  incidentChannels: string[];
  escalationPath: string;
}

// Safe default config to avoid {} as Type antipattern
const DEFAULT_LAUNCH_CONFIG: LaunchConfig = {
  projectName: '',
  tokenSymbol: '',
  launchDate: '',
  launchTime: '',
  timezone: 'UTC',
  chain: '',
  projectLead: { name: '', email: '', phone: '' },
  techLead: { name: '', email: '', phone: '' },
  securityLead: { name: '', email: '', phone: '' },
  marketingLead: { name: '', email: '', phone: '' },
  treasuryLead: { name: '', email: '', phone: '' },
  contractAddresses: {},
  multisigAddress: '',
  multisigThreshold: '',
  initialLiquidity: 0,
  liquidityToken: '',
  targetDEX: '',
  discordUrl: '',
  telegramUrl: '',
  twitterHandle: '',
  statusPageUrl: '',
  emergencyPauseProcess: '',
  incidentChannels: [],
  escalationPath: ''
};

class LaunchCountdownOrchestrator {
  private config: LaunchConfig;
  private rl: readline.Interface;
  private checklistStatus: Record<string, boolean> = {};
  private isShuttingDown: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_LAUNCH_CONFIG };
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.setupGracefulShutdown();
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`\n\n⚠️  Received ${signal}. Saving progress and shutting down...`);
      this.rl.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  private async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async selectOne(prompt: string, options: string[]): Promise<string> {
    console.log(`\n${prompt}`);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
    const answer = await this.question('Select (number): ');
    const parsed = parseInt(answer.trim(), 10);
    const index = isNaN(parsed) ? 0 : parsed - 1;
    return options[index] || options[0];
  }

  private async selectMultiple(prompt: string, options: string[]): Promise<string[]> {
    console.log(`\n${prompt}`);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
    const answer = await this.question('Select (comma-separated numbers): ');
    const indices = answer.split(',').map(s => {
      const parsed = parseInt(s.trim(), 10);
      return isNaN(parsed) ? -1 : parsed - 1;
    });
    return indices.filter(i => i >= 0 && i < options.length).map(i => options[i]);
  }

  /**
   * Check if file exists and confirm overwrite
   */
  private async confirmOverwrite(filePath: string): Promise<boolean> {
    if (fs.existsSync(filePath)) {
      const answer = await this.question(`⚠️  File ${path.basename(filePath)} exists. Overwrite? (y/n): `);
      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    }
    return true;
  }

  async collectInput(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              SECUREMINT ENGINE - LAUNCH COUNTDOWN ORCHESTRATOR                ║');
    console.log('║                   Professional Token Launch Coordination                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    // Section 1: Basic Info
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 1: LAUNCH DETAILS                                      │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.projectName = await this.question('Project Name: ');
    this.config.tokenSymbol = await this.question('Token Symbol: ');
    this.config.launchDate = await this.question('Launch Date (YYYY-MM-DD): ');
    this.config.launchTime = await this.question('Launch Time (HH:MM): ');
    this.config.timezone = await this.selectOne('Timezone:', ['UTC', 'EST', 'PST', 'CET', 'JST', 'SGT']);
    this.config.chain = await this.selectOne('Launch Chain:', ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche', 'BSC']);

    // Section 2: Team Contacts
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 2: KEY CONTACTS                                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    console.log('\nProject Lead:');
    this.config.projectLead = {
      name: await this.question('  Name: '),
      email: await this.question('  Email: '),
      phone: await this.question('  Phone: ')
    };

    console.log('\nTechnical Lead:');
    this.config.techLead = {
      name: await this.question('  Name: '),
      email: await this.question('  Email: '),
      phone: await this.question('  Phone: ')
    };

    console.log('\nSecurity Lead:');
    this.config.securityLead = {
      name: await this.question('  Name: '),
      email: await this.question('  Email: '),
      phone: await this.question('  Phone: ')
    };

    console.log('\nMarketing Lead:');
    this.config.marketingLead = {
      name: await this.question('  Name: '),
      email: await this.question('  Email: '),
      phone: await this.question('  Phone: ')
    };

    console.log('\nTreasury Lead:');
    this.config.treasuryLead = {
      name: await this.question('  Name: '),
      email: await this.question('  Email: '),
      phone: await this.question('  Phone: ')
    };

    // Section 3: Technical Details
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 3: TECHNICAL CONFIGURATION                             │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.contractAddresses = {};
    console.log('\nContract Addresses (enter "done" to finish):');
    let addMore = true;
    while (addMore) {
      const name = await this.question('Contract name (or "done"): ');
      if (name.toLowerCase() === 'done') {
        addMore = false;
        continue;
      }
      const address = await this.question('Address: ');
      this.config.contractAddresses[name] = address;
    }

    this.config.multisigAddress = await this.question('Multi-sig Address: ');
    this.config.multisigThreshold = await this.question('Multi-sig Threshold (e.g., 3/5): ');

    // Section 4: Liquidity
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 4: LIQUIDITY DETAILS                                   │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.initialLiquidity = parseFloat((await this.question('Initial Liquidity ($): ')).replace(/,/g, ''));
    this.config.liquidityToken = await this.question('Paired Token (e.g., ETH, USDC): ');
    this.config.targetDEX = await this.selectOne('Target DEX:', ['Uniswap V3', 'Uniswap V2', 'SushiSwap', 'Curve', 'Balancer', 'PancakeSwap']);

    // Section 5: Communications
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 5: COMMUNICATION CHANNELS                              │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.discordUrl = await this.question('Discord URL: ');
    this.config.telegramUrl = await this.question('Telegram URL: ');
    this.config.twitterHandle = await this.question('Twitter Handle: ');
    this.config.statusPageUrl = await this.question('Status Page URL: ');

    // Section 6: Emergency
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 6: EMERGENCY PROCEDURES                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.emergencyPauseProcess = await this.question('Emergency Pause Process (brief): ');
    this.config.incidentChannels = await this.selectMultiple('Incident Communication Channels:', ['Slack', 'Discord (Private)', 'Telegram (Private)', 'Signal', 'Phone Bridge']);
    this.config.escalationPath = await this.question('Escalation Path: ');

    // Checklist Status
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  CHECKLIST STATUS (mark completed items)                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    console.log('\nWould you like to mark completed checklist items? (This helps generate accurate status)');
    const markItems = await this.question('Mark items? (y/n): ');

    if (markItems.toLowerCase() === 'y') {
      const phases = ['T-30', 'T-14', 'T-7', 'T-3', 'T-1', 'T-0', 'POST'] as const;
      for (const phase of phases) {
        const phaseItems = LAUNCH_CHECKLIST.filter(item => item.phase === phase);
        console.log(`\n${phase} Items:`);
        for (const item of phaseItems) {
          const status = await this.question(`  ${item.id}: ${item.item} (y/n/skip): `);
          if (status.toLowerCase() === 'y') {
            this.checklistStatus[item.id] = true;
          } else if (status.toLowerCase() === 'n') {
            this.checklistStatus[item.id] = false;
          }
          // skip leaves it undefined
        }
      }
    }
  }

  calculateDaysUntilLaunch(): number {
    // FIXED: Use timezone-aware date calculation
    if (!this.config.launchDate || !this.config.launchTime) {
      return 0;
    }
    const launchDateTime = toUTCDate(
      this.config.launchDate,
      this.config.launchTime,
      this.config.timezone || 'UTC'
    );
    const now = new Date();
    const diffTime = launchDateTime.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getCurrentPhase(): string {
    const days = this.calculateDaysUntilLaunch();
    if (days > 30) return 'PRE-PLANNING';
    if (days > 14) return 'T-30';
    if (days > 7) return 'T-14';
    if (days > 3) return 'T-7';
    if (days > 1) return 'T-3';
    if (days > 0) return 'T-1';
    if (days === 0) return 'T-0';
    return 'POST';
  }

  generateGoNoGoAssessment(): GoNoGoCriteria[] {
    const criteria: GoNoGoCriteria[] = [];

    // Check blocking items completion
    const blockingItems = LAUNCH_CHECKLIST.filter(item => item.blocking);

    const categories = [...new Set(blockingItems.map(item => item.category))];

    for (const category of categories) {
      const categoryItems = blockingItems.filter(item => item.category === category);
      const completedItems = categoryItems.filter(item => this.checklistStatus[item.id] === true);
      const incompleteItems = categoryItems.filter(item => this.checklistStatus[item.id] === false);
      const unknownItems = categoryItems.filter(item => this.checklistStatus[item.id] === undefined);

      let status: 'GO' | 'NO-GO' | 'UNKNOWN' = 'GO';
      let notes = '';

      if (incompleteItems.length > 0) {
        status = 'NO-GO';
        notes = `Incomplete: ${incompleteItems.map(i => i.id).join(', ')}`;
      } else if (unknownItems.length > 0) {
        status = 'UNKNOWN';
        notes = `Not verified: ${unknownItems.map(i => i.id).join(', ')}`;
      } else {
        notes = 'All items complete';
      }

      criteria.push({
        category,
        criterion: `All ${category} blocking items complete`,
        required: true,
        currentStatus: status,
        notes
      });
    }

    return criteria;
  }

  generateReport(): string {
    const daysUntilLaunch = this.calculateDaysUntilLaunch();
    const currentPhase = this.getCurrentPhase();
    const goNoGo = this.generateGoNoGoAssessment();
    const timestamp = new Date().toISOString();

    // Calculate overall status
    const hasNoGo = goNoGo.some(g => g.currentStatus === 'NO-GO');
    const hasUnknown = goNoGo.some(g => g.currentStatus === 'UNKNOWN');
    const overallStatus = hasNoGo ? 'NO-GO' : hasUnknown ? 'CONDITIONAL' : 'GO';

    // Count checklist items
    const totalItems = LAUNCH_CHECKLIST.length;
    const completedItems = Object.values(this.checklistStatus).filter(s => s === true).length;
    const incompleteItems = Object.values(this.checklistStatus).filter(s => s === false).length;

    let report = `# Launch Countdown Report

**Project:** ${this.config.projectName} (${this.config.tokenSymbol})
**Generated:** ${timestamp}

---

## Launch Status Dashboard

\`\`\`
╔═══════════════════════════════════════════════════════════════════════════╗
║                        LAUNCH COUNTDOWN STATUS                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  🚀 LAUNCH DATE: ${this.config.launchDate} ${this.config.launchTime} ${this.config.timezone}                       ║
║                                                                           ║
║  ⏱️  COUNTDOWN: ${daysUntilLaunch > 0 ? `T-${daysUntilLaunch} DAYS` : daysUntilLaunch === 0 ? 'T-0 (LAUNCH DAY!)' : `T+${Math.abs(daysUntilLaunch)} (POST-LAUNCH)`}                                      ║
║                                                                           ║
║  📊 CURRENT PHASE: ${currentPhase}                                              ║
║                                                                           ║
║  🎯 GO/NO-GO STATUS: ${overallStatus === 'GO' ? '✅ GO' : overallStatus === 'NO-GO' ? '❌ NO-GO' : '⚠️ CONDITIONAL'}                                       ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
\`\`\`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Project | ${this.config.projectName} |
| Token | ${this.config.tokenSymbol} |
| Chain | ${this.config.chain} |
| Launch Date | ${this.config.launchDate} ${this.config.launchTime} ${this.config.timezone} |
| Days Until Launch | ${daysUntilLaunch} |
| Current Phase | ${currentPhase} |
| Overall Status | ${overallStatus === 'GO' ? '✅ GO' : overallStatus === 'NO-GO' ? '❌ NO-GO' : '⚠️ CONDITIONAL'} |
| Checklist Progress | ${completedItems}/${totalItems} (${Math.round(completedItems/totalItems*100)}%) |

---

## Go/No-Go Assessment

| Category | Status | Notes |
|----------|--------|-------|
${goNoGo.map(g => `| ${g.category} | ${g.currentStatus === 'GO' ? '✅ GO' : g.currentStatus === 'NO-GO' ? '❌ NO-GO' : '⚠️ UNKNOWN'} | ${g.notes} |`).join('\n')}

### Overall Decision

${overallStatus === 'GO' ? `
**✅ GO FOR LAUNCH**

All blocking criteria have been satisfied. The project is cleared for launch on the scheduled date.
` : overallStatus === 'NO-GO' ? `
**❌ NO-GO**

Critical blocking items are incomplete. **DO NOT PROCEED** with launch until all issues are resolved.

**Blocking Issues:**
${goNoGo.filter(g => g.currentStatus === 'NO-GO').map(g => `- ${g.category}: ${g.notes}`).join('\n')}
` : `
**⚠️ CONDITIONAL**

Some items have not been verified. Review and confirm status before making final Go/No-Go decision.

**Items Requiring Verification:**
${goNoGo.filter(g => g.currentStatus === 'UNKNOWN').map(g => `- ${g.category}: ${g.notes}`).join('\n')}
`}

---

## Key Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Project Lead | ${this.config.projectLead.name} | ${this.config.projectLead.email} | ${this.config.projectLead.phone} |
| Tech Lead | ${this.config.techLead.name} | ${this.config.techLead.email} | ${this.config.techLead.phone} |
| Security Lead | ${this.config.securityLead.name} | ${this.config.securityLead.email} | ${this.config.securityLead.phone} |
| Marketing Lead | ${this.config.marketingLead.name} | ${this.config.marketingLead.email} | ${this.config.marketingLead.phone} |
| Treasury Lead | ${this.config.treasuryLead.name} | ${this.config.treasuryLead.email} | ${this.config.treasuryLead.phone} |

---

## Technical Configuration

### Contract Addresses

| Contract | Address |
|----------|---------|
${Object.entries(this.config.contractAddresses).map(([name, addr]) => `| ${name} | \`${addr}\` |`).join('\n')}

### Multi-sig Configuration

| Parameter | Value |
|-----------|-------|
| Address | \`${this.config.multisigAddress}\` |
| Threshold | ${this.config.multisigThreshold} |

---

## Liquidity Plan

| Parameter | Value |
|-----------|-------|
| Initial Liquidity | $${this.config.initialLiquidity.toLocaleString()} |
| Paired Token | ${this.config.liquidityToken} |
| Target DEX | ${this.config.targetDEX} |

---

## Communication Channels

| Channel | URL/Handle |
|---------|------------|
| Discord | ${this.config.discordUrl} |
| Telegram | ${this.config.telegramUrl} |
| Twitter | ${this.config.twitterHandle} |
| Status Page | ${this.config.statusPageUrl} |

### Incident Channels
${this.config.incidentChannels.map(c => `- ${c}`).join('\n')}

---

## Launch Day Checklist

`;

    // Add checklist by phase
    const phases = ['T-30', 'T-14', 'T-7', 'T-3', 'T-1', 'T-0', 'POST'] as const;

    for (const phase of phases) {
      const phaseItems = LAUNCH_CHECKLIST.filter(item => item.phase === phase);

      report += `
### ${phase} ${phase === 'T-0' ? '(LAUNCH DAY)' : phase === 'POST' ? '(POST-LAUNCH)' : ''}

| ID | Item | Owner | Blocking | Status |
|----|------|-------|----------|--------|
${phaseItems.map(item => {
  const status = this.checklistStatus[item.id] === true ? '✅ Complete' :
                 this.checklistStatus[item.id] === false ? '❌ Incomplete' : '⬜ Not Verified';
  return `| ${item.id} | ${item.item} | ${item.owner} | ${item.blocking ? '🔴 Yes' : '⚪ No'} | ${status} |`;
}).join('\n')}
`;
    }

    report += `
---

## Launch Day Runbook

### T-0 Sequence (Launch Day)

\`\`\`
╔═══════════════════════════════════════════════════════════════════════════╗
║                          LAUNCH DAY TIMELINE                               ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  T-2:00  │ War room opens, all hands on deck                             ║
║  T-1:00  │ Final system health checks                                     ║
║  T-0:30  │ Multi-sig signers confirm availability                         ║
║  T-0:15  │ Final Go/No-Go decision                                        ║
║  T-0:05  │ Prepare unpause transaction                                    ║
║  T-0:00  │ EXECUTE: Unpause contracts via multi-sig                       ║
║  T+0:05  │ Add initial liquidity to DEX                                   ║
║  T+0:10  │ Verify liquidity and trading                                   ║
║  T+0:15  │ Publish launch announcement                                    ║
║  T+0:30  │ First monitoring checkpoint                                    ║
║  T+1:00  │ First hour review                                              ║
║  T+4:00  │ Extended monitoring review                                     ║
║  T+24:00 │ First day retrospective                                        ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
\`\`\`

### Emergency Procedures

**Emergency Pause Process:**
${this.config.emergencyPauseProcess}

**Escalation Path:**
${this.config.escalationPath}

### Emergency Decision Tree

\`\`\`
INCIDENT DETECTED
       │
       ▼
Is it security-related?
       │
   YES ─┼─ NO
   │       │
   ▼       ▼
PAUSE    Assess
IMMEDIATELY  │
   │       │
   ▼       ▼
Notify   Can it wait?
Security    │
Lead    YES ─┼─ NO
   │    │       │
   ▼    ▼       ▼
Full   Schedule Escalate to
IR     fix     Tech Lead
Process
\`\`\`

---

## Post-Launch Monitoring

### Key Metrics to Monitor

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Price Deviation | >2% | >5% | Review market making |
| Liquidity Depth | <80% initial | <50% initial | Add liquidity |
| API Latency | >500ms | >2s | Scale infrastructure |
| Error Rate | >1% | >5% | Investigate errors |
| Oracle Health | Delayed | Stale | Manual intervention |

### Monitoring Dashboard Links

- Grafana: [Dashboard URL]
- API Health: ${this.config.statusPageUrl}
- Contract Explorer: [Etherscan/etc.]
- Subgraph: [Subgraph URL]

---

## Approval Signatures

### Final Go/No-Go Sign-off

| Role | Name | Decision | Signature | Date/Time |
|------|------|----------|-----------|-----------|
| Project Lead | ${this.config.projectLead.name} | ☐ GO / ☐ NO-GO | _________________ | ________ |
| Tech Lead | ${this.config.techLead.name} | ☐ GO / ☐ NO-GO | _________________ | ________ |
| Security Lead | ${this.config.securityLead.name} | ☐ GO / ☐ NO-GO | _________________ | ________ |

**Final Decision:** ☐ PROCEED WITH LAUNCH / ☐ ABORT

---

*Generated by SecureMint Engine Launch Countdown Orchestrator v1.0*
`;

    return report;
  }

  async run(): Promise<void> {
    try {
      await this.collectInput();

      console.log('\n\n⏳ Generating Launch Countdown Report...\n');

      const report = this.generateReport();

      // Save files
      const reportPath = path.resolve(process.cwd(), 'LAUNCH_COUNTDOWN_REPORT.md');
      const configPath = path.resolve(process.cwd(), 'launch-config.json');
      const checklistPath = path.resolve(process.cwd(), 'launch-checklist.json');

      // Save files with overwrite confirmation
      if (await this.confirmOverwrite(reportPath)) {
        fs.writeFileSync(reportPath, report);
      }

      // Add PII warning to config file
      const configWithWarning = {
        _PII_WARNING: 'This file contains PII. Do not commit to public repos.',
        ...this.config
      };
      if (await this.confirmOverwrite(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(configWithWarning, null, 2));
      }
      if (await this.confirmOverwrite(checklistPath)) {
        fs.writeFileSync(checklistPath, JSON.stringify({
          checklist: LAUNCH_CHECKLIST,
          status: this.checklistStatus
        }, null, 2));
      }

      // Show PII warning
      console.log(PII_WARNING);

      const daysUntilLaunch = this.calculateDaysUntilLaunch();
      const goNoGo = this.generateGoNoGoAssessment();
      const hasNoGo = goNoGo.some(g => g.currentStatus === 'NO-GO');

      console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║              LAUNCH COUNTDOWN ORCHESTRATOR COMPLETE                           ║');
      console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
      console.log('║                                                                               ║');
      console.log(`║  🚀 Launch in ${daysUntilLaunch} days                                                        ║`);
      console.log(`║  📊 Status: ${hasNoGo ? '❌ NO-GO - Issues to resolve' : '✅ On track'}                               ║`);
      console.log('║                                                                               ║');
      console.log('║  📄 Report: LAUNCH_COUNTDOWN_REPORT.md                                        ║');
      console.log('║  ⚙️  Config: launch-config.json                                               ║');
      console.log('║  ✅ Checklist: launch-checklist.json                                          ║');
      console.log('║                                                                               ║');
      console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

      this.rl.close();
    } catch (error) {
      console.error('Error:', error);
      this.rl.close();
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const orchestrator = new LaunchCountdownOrchestrator();
  orchestrator.run();
}

export { LaunchCountdownOrchestrator, LAUNCH_CHECKLIST };
