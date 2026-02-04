#!/usr/bin/env npx ts-node
/**
 * SecureMint Engine - Intake CLI
 * Interactive questionnaire for production deployment configuration
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface IntakeQuestion {
  id: string;
  section: string;
  question: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'array';
  required: boolean;
  default?: any;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
  };
  sensitive?: boolean;
  skipIf?: string;
  warningIfFalse?: string;
}

interface IntakeConfig {
  version: string;
  generatedAt: string;
  project: {
    name: string;
    token: {
      name: string;
      symbol: string;
      decimals: number;
    };
    backing: {
      type: string;
      initialAmount: number;
    };
  };
  deployment: {
    environment: string;
    rpcUrl: string;
    explorerType: string;
    explorerApiKey: string;
    useProxy: boolean;
  };
  permissions: {
    admin: string;
    adminIsSafe: boolean;
    safeThreshold: number;
    guardians: string[];
    minters: string[];
  };
  storage: {
    postgresql: string;
    redis: string;
    subgraphUrl: string;
    useIpfs: boolean;
    backupRetentionDays: number;
  };
  integrations: {
    chainlink: {
      oracleAddress: string;
      stalenessThreshold: number;
    };
    tenderly: {
      enabled: boolean;
      apiKey: string;
    };
    bridge: {
      enabled: boolean;
      chains: string[];
    };
  };
  parameters: {
    epochDuration: number;
    epochCapacity: number;
    minMintAmount: number;
    maxMintAmount: number;
    autoAdjustCapacity: boolean;
  };
  compliance: {
    kycRequired: boolean;
    kycProvider: string;
    blockedJurisdictions: string[];
    monitoringThreshold: number;
    regulatoryReporting: boolean;
    frameworks: string[];
  };
  observability: {
    monitoring: string;
    alerting: string[];
    slackWebhook: string;
    pagerdutyKey: string;
    logRetentionDays: number;
    tracing: boolean;
    errorTracking: boolean;
    sentryDsn: string;
  };
  acceptanceCriteria: {
    minBackingRatio: number;
    maxOracleLatency: number;
    targetApiResponseTime: number;
    targetUptime: number;
    requiredTestCoverage: number;
    auditCompleted: boolean;
    auditReportUrl: string;
  };
}

// ============================================================================
// QUESTIONS
// ============================================================================

const INTAKE_QUESTIONS: IntakeQuestion[] = [
  // Section A: Project Setup
  {
    id: 'A1',
    section: 'Project Setup',
    question: 'What is the project name?',
    type: 'string',
    required: true,
    validation: { pattern: '^[a-z][a-z0-9-]{2,30}$' },
  },
  {
    id: 'A2',
    section: 'Project Setup',
    question: 'What is the token name?',
    type: 'string',
    required: true,
    validation: { minLength: 3, maxLength: 50 },
  },
  {
    id: 'A3',
    section: 'Project Setup',
    question: 'What is the token symbol?',
    type: 'string',
    required: true,
    validation: { pattern: '^[A-Z]{3,5}$' },
  },
  {
    id: 'A4',
    section: 'Project Setup',
    question: 'What are the token decimals?',
    type: 'number',
    required: true,
    default: 18,
    validation: { min: 0, max: 18 },
  },
  {
    id: 'A5',
    section: 'Project Setup',
    question: 'What is the backing asset type?',
    type: 'select',
    required: true,
    options: ['FIAT_USD', 'FIAT_EUR', 'CRYPTO_USDC', 'CRYPTO_USDT', 'REAL_ESTATE', 'COMMODITIES', 'MIXED'],
    default: 'FIAT_USD',
  },
  {
    id: 'A6',
    section: 'Project Setup',
    question: 'What is the initial backing amount?',
    type: 'number',
    required: true,
    validation: { min: 1000 },
  },

  // Section B: Environment/Deployment
  {
    id: 'B1',
    section: 'Environment/Deployment',
    question: 'What is the target deployment environment?',
    type: 'select',
    required: true,
    options: ['LOCAL', 'TESTNET_SEPOLIA', 'TESTNET_GOERLI', 'MAINNET_ETHEREUM', 'MAINNET_POLYGON', 'MAINNET_ARBITRUM', 'MAINNET_OPTIMISM', 'MAINNET_BASE'],
    default: 'LOCAL',
  },
  {
    id: 'B2',
    section: 'Environment/Deployment',
    question: 'What RPC endpoint will be used?',
    type: 'string',
    required: true,
    sensitive: true,
    validation: { pattern: '^https?://.+' },
  },
  {
    id: 'B3',
    section: 'Environment/Deployment',
    question: 'What block explorer will be used?',
    type: 'select',
    required: true,
    options: ['ETHERSCAN', 'POLYGONSCAN', 'ARBISCAN', 'OPTIMISTIC_ETHERSCAN', 'BASESCAN', 'NONE'],
    default: 'ETHERSCAN',
  },
  {
    id: 'B4',
    section: 'Environment/Deployment',
    question: 'Block explorer API key:',
    type: 'string',
    required: false,
    sensitive: true,
    skipIf: "B3 === 'NONE'",
  },
  {
    id: 'B5',
    section: 'Environment/Deployment',
    question: 'Use UUPS proxy pattern?',
    type: 'boolean',
    required: true,
    default: true,
  },

  // Section C: Permissions/Users
  {
    id: 'C1',
    section: 'Permissions/Users',
    question: 'What is the admin address (should be Gnosis Safe)?',
    type: 'string',
    required: true,
    validation: { pattern: '^0x[a-fA-F0-9]{40}$' },
  },
  {
    id: 'C2',
    section: 'Permissions/Users',
    question: 'Is the admin address a Gnosis Safe?',
    type: 'boolean',
    required: true,
    default: true,
    warningIfFalse: 'SECURITY: Using EOA as admin is not recommended for production',
  },
  {
    id: 'C3',
    section: 'Permissions/Users',
    question: 'Gnosis Safe threshold (if applicable):',
    type: 'number',
    required: false,
    default: 3,
    validation: { min: 2, max: 10 },
    skipIf: 'C2 === false',
  },
  {
    id: 'C4',
    section: 'Permissions/Users',
    question: 'Guardian addresses (comma-separated):',
    type: 'array',
    required: true,
    validation: { minItems: 1, maxItems: 5 },
  },
  {
    id: 'C5',
    section: 'Permissions/Users',
    question: 'Initial minter addresses (comma-separated):',
    type: 'array',
    required: true,
    validation: { minItems: 1, maxItems: 10 },
  },

  // Section D: Data/Storage
  {
    id: 'D1',
    section: 'Data/Storage',
    question: 'PostgreSQL connection string:',
    type: 'string',
    required: true,
    sensitive: true,
    default: 'postgresql://localhost:5432/securemint',
  },
  {
    id: 'D2',
    section: 'Data/Storage',
    question: 'Redis connection string:',
    type: 'string',
    required: true,
    sensitive: true,
    default: 'redis://localhost:6379',
  },
  {
    id: 'D3',
    section: 'Data/Storage',
    question: 'The Graph subgraph URL:',
    type: 'string',
    required: false,
  },
  {
    id: 'D4',
    section: 'Data/Storage',
    question: 'Use IPFS for metadata?',
    type: 'boolean',
    required: true,
    default: false,
  },
  {
    id: 'D5',
    section: 'Data/Storage',
    question: 'Backup retention period (days):',
    type: 'number',
    required: true,
    default: 30,
    validation: { min: 7, max: 365 },
  },

  // Section E: Integrations
  {
    id: 'E1',
    section: 'Integrations',
    question: 'Chainlink oracle feed address:',
    type: 'string',
    required: true,
    validation: { pattern: '^0x[a-fA-F0-9]{40}$' },
  },
  {
    id: 'E2',
    section: 'Integrations',
    question: 'Oracle staleness threshold (seconds):',
    type: 'number',
    required: true,
    default: 3600,
    validation: { min: 60, max: 86400 },
  },
  {
    id: 'E3',
    section: 'Integrations',
    question: 'Enable Tenderly simulation?',
    type: 'boolean',
    required: true,
    default: true,
  },
  {
    id: 'E4',
    section: 'Integrations',
    question: 'Tenderly API key (if enabled):',
    type: 'string',
    required: false,
    sensitive: true,
    skipIf: 'E3 === false',
  },
  {
    id: 'E5',
    section: 'Integrations',
    question: 'Enable cross-chain bridging?',
    type: 'boolean',
    required: true,
    default: false,
  },

  // Section F: Task Parameters
  {
    id: 'F1',
    section: 'Task Parameters',
    question: 'Epoch duration (seconds):',
    type: 'number',
    required: true,
    default: 3600,
    validation: { min: 300, max: 86400 },
  },
  {
    id: 'F2',
    section: 'Task Parameters',
    question: 'Epoch mint capacity (token units):',
    type: 'number',
    required: true,
    default: 1000000,
    validation: { min: 1000 },
  },
  {
    id: 'F3',
    section: 'Task Parameters',
    question: 'Minimum mint amount:',
    type: 'number',
    required: true,
    default: 100,
    validation: { min: 1 },
  },
  {
    id: 'F4',
    section: 'Task Parameters',
    question: 'Maximum single mint amount:',
    type: 'number',
    required: true,
    default: 10000000,
    validation: { min: 1000 },
  },

  // Section G: Compliance
  {
    id: 'G1',
    section: 'Compliance',
    question: 'Is KYC/AML integration required?',
    type: 'boolean',
    required: true,
    default: false,
  },
  {
    id: 'G2',
    section: 'Compliance',
    question: 'KYC provider (if required):',
    type: 'select',
    required: false,
    options: ['CHAINALYSIS', 'ELLIPTIC', 'TRM', 'CUSTOM'],
    skipIf: 'G1 === false',
  },
  {
    id: 'G3',
    section: 'Compliance',
    question: 'Transaction monitoring threshold (USD):',
    type: 'number',
    required: true,
    default: 10000,
    validation: { min: 0 },
  },

  // Section H: Observability
  {
    id: 'H1',
    section: 'Observability',
    question: 'Monitoring system:',
    type: 'select',
    required: true,
    options: ['PROMETHEUS_GRAFANA', 'DATADOG', 'NEW_RELIC', 'CLOUDWATCH', 'NONE'],
    default: 'PROMETHEUS_GRAFANA',
  },
  {
    id: 'H2',
    section: 'Observability',
    question: 'Alerting channels (comma-separated):',
    type: 'array',
    required: true,
    default: ['SLACK'],
  },
  {
    id: 'H3',
    section: 'Observability',
    question: 'Slack webhook URL:',
    type: 'string',
    required: false,
    sensitive: true,
  },
  {
    id: 'H4',
    section: 'Observability',
    question: 'Enable distributed tracing (OpenTelemetry)?',
    type: 'boolean',
    required: true,
    default: true,
  },
  {
    id: 'H5',
    section: 'Observability',
    question: 'Enable error tracking (Sentry)?',
    type: 'boolean',
    required: true,
    default: true,
  },

  // Section I: Acceptance Criteria
  {
    id: 'I1',
    section: 'Acceptance Criteria',
    question: 'Minimum backing ratio (%):',
    type: 'number',
    required: true,
    default: 100,
    validation: { min: 100, max: 200 },
  },
  {
    id: 'I2',
    section: 'Acceptance Criteria',
    question: 'Maximum oracle latency (seconds):',
    type: 'number',
    required: true,
    default: 3600,
    validation: { min: 60, max: 3600 },
  },
  {
    id: 'I3',
    section: 'Acceptance Criteria',
    question: 'Target API response time p95 (ms):',
    type: 'number',
    required: true,
    default: 500,
    validation: { min: 100, max: 5000 },
  },
  {
    id: 'I4',
    section: 'Acceptance Criteria',
    question: 'Required test coverage (%):',
    type: 'number',
    required: true,
    default: 95,
    validation: { min: 80, max: 100 },
  },
  {
    id: 'I5',
    section: 'Acceptance Criteria',
    question: 'Has security audit been completed?',
    type: 'boolean',
    required: true,
    default: false,
    warningIfFalse: 'SECURITY: Production deployment without audit is not recommended',
  },
];

// ============================================================================
// CLI IMPLEMENTATION
// ============================================================================

class IntakeCLI {
  private rl: readline.Interface;
  private answers: Map<string, any> = new Map();
  private warnings: string[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private printHeader(): void {
    console.log('\n' + '═'.repeat(70));
    console.log('  SecureMint Engine - Production Intake Questionnaire');
    console.log('═'.repeat(70));
    console.log('\nThis questionnaire will configure your deployment.');
    console.log('Press Enter to use default values shown in [brackets].\n');
  }

  private printSection(section: string): void {
    console.log('\n' + '─'.repeat(50));
    console.log(`  Section: ${section}`);
    console.log('─'.repeat(50) + '\n');
  }

  private validateAnswer(question: IntakeQuestion, answer: any): { valid: boolean; error?: string } {
    if (question.required && (answer === '' || answer === undefined || answer === null)) {
      return { valid: false, error: 'This field is required' };
    }

    if (!answer && !question.required) {
      return { valid: true };
    }

    const v = question.validation;
    if (!v) return { valid: true };

    if (v.pattern && typeof answer === 'string') {
      const regex = new RegExp(v.pattern);
      if (!regex.test(answer)) {
        return { valid: false, error: `Must match pattern: ${v.pattern}` };
      }
    }

    if (v.min !== undefined && typeof answer === 'number') {
      if (answer < v.min) {
        return { valid: false, error: `Must be at least ${v.min}` };
      }
    }

    if (v.max !== undefined && typeof answer === 'number') {
      if (answer > v.max) {
        return { valid: false, error: `Must be at most ${v.max}` };
      }
    }

    if (v.minLength !== undefined && typeof answer === 'string') {
      if (answer.length < v.minLength) {
        return { valid: false, error: `Must be at least ${v.minLength} characters` };
      }
    }

    if (v.maxLength !== undefined && typeof answer === 'string') {
      if (answer.length > v.maxLength) {
        return { valid: false, error: `Must be at most ${v.maxLength} characters` };
      }
    }

    if (v.minItems !== undefined && Array.isArray(answer)) {
      if (answer.length < v.minItems) {
        return { valid: false, error: `Must have at least ${v.minItems} items` };
      }
    }

    return { valid: true };
  }

  private shouldSkip(question: IntakeQuestion): boolean {
    if (!question.skipIf) return false;

    // Simple evaluation of skip conditions
    const condition = question.skipIf;
    const match = condition.match(/(\w+)\s*===\s*(.+)/);
    if (match) {
      const [, questionId, expectedValue] = match;
      const actualValue = this.answers.get(questionId);
      const expected = expectedValue.replace(/'/g, '').replace(/"/g, '');

      if (expected === 'false') return actualValue === false;
      if (expected === 'true') return actualValue === true;
      return actualValue === expected;
    }
    return false;
  }

  private formatDefault(question: IntakeQuestion): string {
    if (question.default === undefined) return '';
    if (question.type === 'boolean') return question.default ? 'yes' : 'no';
    if (question.type === 'array') return question.default.join(', ');
    return String(question.default);
  }

  private parseAnswer(question: IntakeQuestion, input: string): any {
    if (input === '' && question.default !== undefined) {
      return question.default;
    }

    switch (question.type) {
      case 'number':
        return parseInt(input, 10);
      case 'boolean':
        return ['yes', 'y', 'true', '1'].includes(input.toLowerCase());
      case 'array':
        return input.split(',').map((s) => s.trim()).filter((s) => s);
      case 'select':
        return input || question.default;
      default:
        return input;
    }
  }

  private async askQuestion(question: IntakeQuestion): Promise<void> {
    if (this.shouldSkip(question)) {
      return;
    }

    let valid = false;
    while (!valid) {
      let promptText = `[${question.id}] ${question.question}`;

      if (question.type === 'select' && question.options) {
        promptText += `\n    Options: ${question.options.join(', ')}`;
      }

      const defaultStr = this.formatDefault(question);
      if (defaultStr) {
        promptText += ` [${defaultStr}]`;
      }

      promptText += ': ';

      const input = await this.prompt(promptText);
      const answer = this.parseAnswer(question, input);

      const validation = this.validateAnswer(question, answer);
      if (validation.valid) {
        this.answers.set(question.id, answer);
        valid = true;

        // Check for warnings
        if (question.warningIfFalse && answer === false) {
          console.log(`    ⚠️  WARNING: ${question.warningIfFalse}`);
          this.warnings.push(question.warningIfFalse);
        }
      } else {
        console.log(`    ❌ Error: ${validation.error}`);
      }
    }
  }

  private buildConfig(): IntakeConfig {
    const get = (id: string) => this.answers.get(id);

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      project: {
        name: get('A1'),
        token: {
          name: get('A2'),
          symbol: get('A3'),
          decimals: get('A4'),
        },
        backing: {
          type: get('A5'),
          initialAmount: get('A6'),
        },
      },
      deployment: {
        environment: get('B1'),
        rpcUrl: get('B2'),
        explorerType: get('B3'),
        explorerApiKey: get('B4') || '',
        useProxy: get('B5'),
      },
      permissions: {
        admin: get('C1'),
        adminIsSafe: get('C2'),
        safeThreshold: get('C3') || 3,
        guardians: get('C4'),
        minters: get('C5'),
      },
      storage: {
        postgresql: get('D1'),
        redis: get('D2'),
        subgraphUrl: get('D3') || '',
        useIpfs: get('D4'),
        backupRetentionDays: get('D5'),
      },
      integrations: {
        chainlink: {
          oracleAddress: get('E1'),
          stalenessThreshold: get('E2'),
        },
        tenderly: {
          enabled: get('E3'),
          apiKey: get('E4') || '',
        },
        bridge: {
          enabled: get('E5'),
          chains: [],
        },
      },
      parameters: {
        epochDuration: get('F1'),
        epochCapacity: get('F2'),
        minMintAmount: get('F3'),
        maxMintAmount: get('F4'),
        autoAdjustCapacity: false,
      },
      compliance: {
        kycRequired: get('G1'),
        kycProvider: get('G2') || '',
        blockedJurisdictions: ['KP', 'IR', 'CU', 'SY'],
        monitoringThreshold: get('G3'),
        regulatoryReporting: false,
        frameworks: [],
      },
      observability: {
        monitoring: get('H1'),
        alerting: get('H2'),
        slackWebhook: get('H3') || '',
        pagerdutyKey: '',
        logRetentionDays: 90,
        tracing: get('H4'),
        errorTracking: get('H5'),
        sentryDsn: '',
      },
      acceptanceCriteria: {
        minBackingRatio: get('I1'),
        maxOracleLatency: get('I2'),
        targetApiResponseTime: get('I3'),
        targetUptime: 99.9,
        requiredTestCoverage: get('I4'),
        auditCompleted: get('I5'),
        auditReportUrl: '',
      },
    };
  }

  private generateRunPlan(config: IntakeConfig): string {
    return `# SecureMint Engine - Run Plan
Generated: ${config.generatedAt}
Project: ${config.project.name}

## Overview
- Token: ${config.project.token.name} (${config.project.token.symbol})
- Network: ${config.deployment.environment}
- Admin: ${config.permissions.admin} ${config.permissions.adminIsSafe ? '(Gnosis Safe)' : '(EOA)'}

## Phase 1: Pre-Deployment Validation
| Step | Action | Gate | Expected |
|------|--------|------|----------|
| 1.1 | Verify RPC connectivity | HARD | Response < 1s |
| 1.2 | Check deployer balance | HARD | >= 0.5 ETH |
| 1.3 | Verify Safe configuration | HARD | Threshold >= 3 |
| 1.4 | Test oracle feed | HARD | Fresh data |

**GATE: If ANY HARD check fails → STOP deployment**

## Phase 2: Contract Deployment
| Step | Contract | Estimated Gas |
|------|----------|---------------|
| 2.1 | SecureMintToken | ~1.5M |
| 2.2 | SecureMintPolicy | ~2.0M |
| 2.3 | BackingOracle | ~1.0M |
| 2.4 | TreasuryVault | ~1.5M |
| 2.5 | RedemptionEngine | ~1.5M |
| 2.6 | EmergencyPause | ~0.5M |

## Phase 3: Configuration
| Step | Action | Parameter |
|------|--------|-----------|
| 3.1 | Set oracle source | ${config.integrations.chainlink.oracleAddress} |
| 3.2 | Set staleness threshold | ${config.integrations.chainlink.stalenessThreshold}s |
| 3.3 | Set epoch duration | ${config.parameters.epochDuration}s |
| 3.4 | Set epoch capacity | ${config.parameters.epochCapacity.toLocaleString()} |
| 3.5 | Grant MINTER_ROLE | ${config.permissions.minters.join(', ')} |
| 3.6 | Grant GUARDIAN_ROLE | ${config.permissions.guardians.join(', ')} |
| 3.7 | Transfer admin to Safe | ${config.permissions.admin} |

## Phase 4: Verification
| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Verify on explorer | All contracts verified |
| 4.2 | Deploy subgraph | Syncing |
| 4.3 | Test mint (small amount) | Success |
| 4.4 | Verify monitoring | Metrics flowing |

## Warnings
${this.warnings.length > 0 ? this.warnings.map(w => `- ⚠️ ${w}`).join('\n') : '- None'}
`;
  }

  private generateChecklist(config: IntakeConfig): string {
    return `# Deployment Checklist
Project: ${config.project.name}
Date: ${new Date().toISOString().split('T')[0]}

## Preflight Checks

### Infrastructure
- [ ] RPC endpoint responding
- [ ] PostgreSQL accessible
- [ ] Redis accessible
- [ ] Monitoring system running

### Security
- [ ] Admin is Gnosis Safe: ${config.permissions.adminIsSafe ? '✓' : '✗ WARNING'}
- [ ] Safe threshold >= 3: ${config.permissions.safeThreshold >= 3 ? '✓' : '✗ WARNING'}
- [ ] Private keys secured
- [ ] No secrets in git

### Configuration
- [ ] .env file created
- [ ] All required env vars set
- [ ] Oracle feed verified
- [ ] Guardian addresses verified
- [ ] Minter addresses verified

### Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Test coverage >= ${config.acceptanceCriteria.requiredTestCoverage}%

## Postflight Checks

### Contracts
- [ ] All contracts deployed
- [ ] All contracts verified
- [ ] Roles assigned correctly
- [ ] Admin transferred to Safe

### Functional
- [ ] Test mint succeeded
- [ ] Oracle data flowing
- [ ] Events indexed

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tech Lead | | |
| Security | | |
| Operations | | |
`;
  }

  private generateTestPlan(config: IntakeConfig): string {
    return `# Smoke Test Plan
Project: ${config.project.name}
Environment: ${config.deployment.environment}

## Immediate Tests

### Test 1: Oracle Connectivity
\`\`\`bash
cast call ${config.integrations.chainlink.oracleAddress} "latestRoundData()" --rpc-url $RPC_URL
\`\`\`
**Expected:** Returns non-zero value with recent timestamp

### Test 2: Token Metadata
\`\`\`bash
cast call $TOKEN_ADDRESS "name()" --rpc-url $RPC_URL
cast call $TOKEN_ADDRESS "symbol()" --rpc-url $RPC_URL
\`\`\`
**Expected:** "${config.project.token.name}", "${config.project.token.symbol}"

### Test 3: Policy Configuration
\`\`\`bash
cast call $POLICY_ADDRESS "epochDuration()" --rpc-url $RPC_URL
cast call $POLICY_ADDRESS "epochCapacity()" --rpc-url $RPC_URL
\`\`\`
**Expected:** ${config.parameters.epochDuration}, ${config.parameters.epochCapacity}

### Test 4: Role Verification
\`\`\`bash
cast call $POLICY_ADDRESS "hasRole(bytes32,address)" $MINTER_ROLE $MINTER_ADDRESS
\`\`\`
**Expected:** true

### Test 5: Small Mint Test
\`\`\`bash
npx ts-node scripts/smoke-test.ts --amount 100 --recipient $TEST_RECIPIENT
\`\`\`
**Expected:** Transaction succeeds

### Test 6: Pause Level Check
\`\`\`bash
cast call $EMERGENCY_ADDRESS "pauseLevel()" --rpc-url $RPC_URL
\`\`\`
**Expected:** 0 (Normal)

### Test 7: API Health Check
\`\`\`bash
curl http://localhost:3000/health
\`\`\`
**Expected:** {"status": "healthy"}

## Results

| Test | Status | Notes |
|------|--------|-------|
| 1 | [ ] | |
| 2 | [ ] | |
| 3 | [ ] | |
| 4 | [ ] | |
| 5 | [ ] | |
| 6 | [ ] | |
| 7 | [ ] | |

**Overall:** [ ] PASS / [ ] FAIL
`;
  }

  async run(): Promise<void> {
    this.printHeader();

    let currentSection = '';
    for (const question of INTAKE_QUESTIONS) {
      if (question.section !== currentSection) {
        currentSection = question.section;
        this.printSection(currentSection);
      }
      await this.askQuestion(question);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  Generating Configuration Files...');
    console.log('═'.repeat(70) + '\n');

    const config = this.buildConfig();
    const outputDir = process.cwd();

    // Write config.json
    const configPath = path.join(outputDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✓ Created: ${configPath}`);

    // Write RUN_PLAN.md
    const runPlanPath = path.join(outputDir, 'RUN_PLAN.md');
    fs.writeFileSync(runPlanPath, this.generateRunPlan(config));
    console.log(`✓ Created: ${runPlanPath}`);

    // Write CHECKLIST.md
    const checklistPath = path.join(outputDir, 'CHECKLIST.md');
    fs.writeFileSync(checklistPath, this.generateChecklist(config));
    console.log(`✓ Created: ${checklistPath}`);

    // Write TEST_PLAN.md
    const testPlanPath = path.join(outputDir, 'TEST_PLAN.md');
    fs.writeFileSync(testPlanPath, this.generateTestPlan(config));
    console.log(`✓ Created: ${testPlanPath}`);

    console.log('\n' + '═'.repeat(70));
    console.log('  Intake Complete!');
    console.log('═'.repeat(70));
    console.log('\nNext steps:');
    console.log('  1. Review generated files');
    console.log('  2. Run: make preflight');
    console.log('  3. Run: make deploy NETWORK=' + config.deployment.environment.toLowerCase());
    console.log('');

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings to address:');
      this.warnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }

    this.rl.close();
  }
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
SecureMint Engine - Intake CLI

Usage:
  npx ts-node intake-cli.ts [options]

Options:
  --help, -h      Show this help message
  --config FILE   Load answers from JSON file
  --dry-run       Validate only, don't generate files

Examples:
  npx ts-node intake-cli.ts
  npx ts-node intake-cli.ts --config answers.json
`);
  process.exit(0);
}

const cli = new IntakeCLI();
cli.run().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
