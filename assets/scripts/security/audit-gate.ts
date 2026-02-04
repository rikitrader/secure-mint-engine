#!/usr/bin/env npx ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SecureMint Engine - Security Audit Gate
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * MANDATORY GATE: Ensures security audit process is properly managed
 *
 * This tool manages the entire security audit lifecycle:
 * - Audit firm selection and comparison
 * - Audit scope document generation
 * - Finding severity classification
 * - Remediation tracking
 * - Final audit report verification
 *
 * Usage: npx ts-node scripts/security/audit-gate.ts
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
 * Safely parses integer with NaN protection
 */
function safeParseInt(value: string, defaultValue: number = 0): number {
  const cleaned = value.replace(/,/g, '').trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validates string is non-empty
 */
function isValidString(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Complexity multiplier for cost estimation
 */
const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  LOW: 1.0,
  MEDIUM: 1.25,
  HIGH: 1.5,
  CRITICAL: 2.0
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT FIRM DATABASE (2024 Market Data)
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditFirm {
  name: string;
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  specialties: string[];
  avgCostPerLine: { min: number; max: number };
  typicalDuration: string;
  reputation: number; // 1-10
  notableClients: string[];
  website: string;
  methodology: string[];
  certifications: string[];
  insuranceCoverage: string;
}

const AUDIT_FIRMS: Record<string, AuditFirm> = {
  TRAIL_OF_BITS: {
    name: 'Trail of Bits',
    tier: 'TIER_1',
    specialties: ['Smart Contracts', 'Cryptography', 'Protocol Security', 'Formal Verification'],
    avgCostPerLine: { min: 50, max: 100 },
    typicalDuration: '4-8 weeks',
    reputation: 10,
    notableClients: ['Ethereum Foundation', 'Compound', 'MakerDAO', 'Uniswap'],
    website: 'https://www.trailofbits.com',
    methodology: ['Manual review', 'Automated analysis', 'Fuzzing', 'Formal verification'],
    certifications: ['SOC 2 Type II'],
    insuranceCoverage: '$10M+'
  },
  OPENZEPPELIN: {
    name: 'OpenZeppelin',
    tier: 'TIER_1',
    specialties: ['Smart Contracts', 'DeFi', 'Governance', 'Upgradability'],
    avgCostPerLine: { min: 40, max: 80 },
    typicalDuration: '3-6 weeks',
    reputation: 10,
    notableClients: ['Coinbase', 'Aave', 'Compound', 'The Graph'],
    website: 'https://www.openzeppelin.com',
    methodology: ['Manual review', 'Static analysis', 'Dynamic testing', 'Formal verification'],
    certifications: ['SOC 2 Type II'],
    insuranceCoverage: '$10M+'
  },
  CONSENSYS_DILIGENCE: {
    name: 'ConsenSys Diligence',
    tier: 'TIER_1',
    specialties: ['Smart Contracts', 'DeFi', 'Layer 2', 'Cross-chain'],
    avgCostPerLine: { min: 45, max: 90 },
    typicalDuration: '4-8 weeks',
    reputation: 9,
    notableClients: ['Gnosis', 'Balancer', '0x', 'Aragon'],
    website: 'https://consensys.net/diligence',
    methodology: ['Manual review', 'MythX', 'Symbolic execution', 'Fuzzing'],
    certifications: ['ISO 27001'],
    insuranceCoverage: '$5M+'
  },
  CERTIK: {
    name: 'CertiK',
    tier: 'TIER_1',
    specialties: ['Smart Contracts', 'Formal Verification', 'Blockchain Security'],
    avgCostPerLine: { min: 30, max: 60 },
    typicalDuration: '2-4 weeks',
    reputation: 8,
    notableClients: ['Binance', 'OKX', 'Polygon', 'Aptos'],
    website: 'https://www.certik.com',
    methodology: ['Formal verification', 'Manual review', 'Automated scanning'],
    certifications: ['SOC 2 Type II'],
    insuranceCoverage: '$5M+'
  },
  QUANTSTAMP: {
    name: 'Quantstamp',
    tier: 'TIER_1',
    specialties: ['Smart Contracts', 'DeFi', 'NFT', 'Enterprise'],
    avgCostPerLine: { min: 35, max: 70 },
    typicalDuration: '3-6 weeks',
    reputation: 8,
    notableClients: ['Toyota', 'Maker', 'Chainlink', 'Solana'],
    website: 'https://quantstamp.com',
    methodology: ['Manual review', 'Automated analysis', 'Economic modeling'],
    certifications: ['SOC 2 Type II'],
    insuranceCoverage: '$5M+'
  },
  HALBORN: {
    name: 'Halborn',
    tier: 'TIER_2',
    specialties: ['Smart Contracts', 'Penetration Testing', 'Cloud Security'],
    avgCostPerLine: { min: 25, max: 50 },
    typicalDuration: '2-4 weeks',
    reputation: 7,
    notableClients: ['BlockFi', 'Ava Labs', 'Thorchain'],
    website: 'https://halborn.com',
    methodology: ['Manual review', 'Penetration testing', 'Automated scanning'],
    certifications: ['OSCP', 'CREST'],
    insuranceCoverage: '$2M+'
  },
  SLOWMIST: {
    name: 'SlowMist',
    tier: 'TIER_2',
    specialties: ['Smart Contracts', 'Exchange Security', 'Incident Response'],
    avgCostPerLine: { min: 20, max: 45 },
    typicalDuration: '2-4 weeks',
    reputation: 7,
    notableClients: ['Huobi', 'OKX', 'Pancakeswap'],
    website: 'https://www.slowmist.com',
    methodology: ['Manual review', 'Automated analysis', 'Threat intelligence'],
    certifications: ['ISO 27001'],
    insuranceCoverage: '$2M+'
  },
  PECKSHIELD: {
    name: 'PeckShield',
    tier: 'TIER_2',
    specialties: ['Smart Contracts', 'DeFi', 'Incident Analysis'],
    avgCostPerLine: { min: 20, max: 40 },
    typicalDuration: '2-3 weeks',
    reputation: 7,
    notableClients: ['Binance', 'Bancor', 'EOS'],
    website: 'https://peckshield.com',
    methodology: ['Manual review', 'Automated analysis', 'On-chain monitoring'],
    certifications: [],
    insuranceCoverage: '$1M+'
  },
  SOLIDIFIED: {
    name: 'Solidified',
    tier: 'TIER_3',
    specialties: ['Smart Contracts', 'Bug Bounty'],
    avgCostPerLine: { min: 15, max: 35 },
    typicalDuration: '1-3 weeks',
    reputation: 6,
    notableClients: ['Various DeFi projects'],
    website: 'https://solidified.io',
    methodology: ['Crowdsourced review', 'Expert panel'],
    certifications: [],
    insuranceCoverage: 'Varies'
  },
  CODE4RENA: {
    name: 'Code4rena',
    tier: 'TIER_2',
    specialties: ['Smart Contracts', 'Competitive Audits', 'Bug Bounty'],
    avgCostPerLine: { min: 10, max: 30 },
    typicalDuration: '1-2 weeks',
    reputation: 8,
    notableClients: ['ENS', 'Optimism', 'Arbitrum'],
    website: 'https://code4rena.com',
    methodology: ['Competitive audit', 'Community review'],
    certifications: [],
    insuranceCoverage: 'N/A'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VULNERABILITY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

interface VulnerabilityClass {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  impact: string;
  likelihood: string;
  requiredAction: string;
  maxRemediationTime: string;
  examples: string[];
}

const VULNERABILITY_CLASSES: Record<string, VulnerabilityClass> = {
  CRITICAL: {
    severity: 'CRITICAL',
    impact: 'Direct loss of funds, complete protocol compromise',
    likelihood: 'Exploitable with minimal effort',
    requiredAction: 'MUST fix before mainnet deployment',
    maxRemediationTime: 'Immediate (24-48 hours)',
    examples: [
      'Reentrancy allowing fund drain',
      'Access control bypass for admin functions',
      'Oracle manipulation for unbacked minting',
      'Integer overflow causing incorrect calculations',
      'Unprotected selfdestruct'
    ]
  },
  HIGH: {
    severity: 'HIGH',
    impact: 'Significant fund loss or protocol disruption',
    likelihood: 'Exploitable with some effort',
    requiredAction: 'MUST fix before mainnet deployment',
    maxRemediationTime: '1 week',
    examples: [
      'Front-running vulnerabilities',
      'Privilege escalation',
      'Denial of service on critical functions',
      'Incorrect fee calculations',
      'Flash loan attack vectors'
    ]
  },
  MEDIUM: {
    severity: 'MEDIUM',
    impact: 'Limited fund loss or degraded functionality',
    likelihood: 'Exploitable under specific conditions',
    requiredAction: 'Should fix before mainnet, may deploy with documented risk',
    maxRemediationTime: '2 weeks',
    examples: [
      'Suboptimal gas usage',
      'Centralization risks',
      'Griefing attacks',
      'Incorrect event emissions',
      'Missing input validation'
    ]
  },
  LOW: {
    severity: 'LOW',
    impact: 'Minimal impact, unlikely exploitation',
    likelihood: 'Difficult to exploit',
    requiredAction: 'Should fix, can deploy with acceptance',
    maxRemediationTime: '1 month',
    examples: [
      'Code quality issues',
      'Missing NatSpec documentation',
      'Suboptimal patterns',
      'Unused variables',
      'Style inconsistencies'
    ]
  },
  INFORMATIONAL: {
    severity: 'INFORMATIONAL',
    impact: 'No direct security impact',
    likelihood: 'N/A',
    requiredAction: 'Consider for code quality',
    maxRemediationTime: 'No deadline',
    examples: [
      'Suggestions for improvement',
      'Best practice recommendations',
      'Documentation improvements',
      'Test coverage suggestions'
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT SCOPE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditScope {
  projectName: string;
  projectDescription: string;
  contracts: {
    name: string;
    path: string;
    linesOfCode: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dependencies: string[];
  }[];
  totalLinesOfCode: number;
  chainTargets: string[];
  auditObjectives: string[];
  outOfScope: string[];
  assumptions: string[];
  knownIssues: string[];
  priorAudits: { firm: string; date: string; reportUrl: string }[];
  timeline: {
    kickoff: string;
    initialReview: string;
    draftReport: string;
    remediation: string;
    finalReport: string;
  };
  contacts: {
    role: string;
    name: string;
    email: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINDING TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

interface Finding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'DISPUTED';
  contract: string;
  function: string;
  lineNumbers: string;
  description: string;
  recommendation: string;
  teamResponse: string;
  fixCommit: string;
  verifiedBy: string;
  verifiedDate: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY AUDIT GATE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditConfig {
  projectName: string;
  description: string;
  contracts: {
    name: string;
    path: string;
    linesOfCode: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
  totalLOC: number;
  budget: number;
  targetChains: string[];
  preferredFirms: string[];
  requiredTier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'ANY';
  desiredStartDate: string;
  mainnetDeadline: string;
  priorAudits: boolean;
  bugBountyPlanned: boolean;
  formalVerification: boolean;
}

// Safe default config to avoid {} as Type antipattern
const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  projectName: '',
  description: '',
  contracts: [],
  totalLOC: 0,
  budget: 0,
  targetChains: [],
  preferredFirms: [],
  requiredTier: 'ANY',
  desiredStartDate: '',
  mainnetDeadline: '',
  priorAudits: false,
  bugBountyPlanned: false,
  formalVerification: false
};

class SecurityAuditGate {
  private config: AuditConfig;
  private rl: readline.Interface;
  private findings: Finding[] = [];
  private isShuttingDown: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_AUDIT_CONFIG };
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
    const index = safeParseInt(answer, 1) - 1;
    return options[index] || options[0];
  }

  private async selectMultiple(prompt: string, options: string[]): Promise<string[]> {
    console.log(`\n${prompt}`);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
    const answer = await this.question('Select (comma-separated numbers): ');
    const indices = answer.split(',').map(s => safeParseInt(s.trim(), 0) - 1);
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

  private async yesNo(prompt: string): Promise<boolean> {
    const answer = await this.question(`${prompt} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  async collectInput(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              SECUREMINT ENGINE - SECURITY AUDIT GATE                          ║');
    console.log('║                   Professional Audit Management System                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    // Section 1: Project Information
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 1: PROJECT INFORMATION                                 │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.projectName = await this.question('Project Name: ');
    this.config.description = await this.question('Brief Description: ');

    // Section 2: Contract Information
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 2: CONTRACTS TO AUDIT                                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.contracts = [];
    let addMore = true;
    while (addMore) {
      const name = await this.question('\nContract Name (or "done" to finish): ');
      if (name.toLowerCase() === 'done') {
        addMore = false;
        continue;
      }
      const path = await this.question('Contract Path: ');
      const loc = safeParseInt(await this.question('Lines of Code: '), 0);
      const complexity = await this.selectOne('Complexity:', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

      this.config.contracts.push({ name, path, linesOfCode: loc, complexity });
    }

    this.config.totalLOC = this.config.contracts.reduce((sum, c) => sum + c.linesOfCode, 0);
    console.log(`\nTotal Lines of Code: ${this.config.totalLOC}`);

    // Section 3: Audit Requirements
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 3: AUDIT REQUIREMENTS                                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const budgetStr = await this.question('Audit Budget (USD): $');
    this.config.budget = safeParseInt(budgetStr, 0);

    this.config.targetChains = await this.selectMultiple(
      'Target Chains:',
      ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche', 'BSC', 'Solana']
    );

    this.config.requiredTier = await this.selectOne(
      'Required Audit Firm Tier:',
      ['TIER_1', 'TIER_2', 'TIER_3', 'ANY']
    ) as AuditConfig['requiredTier'];

    this.config.preferredFirms = await this.selectMultiple(
      'Preferred Audit Firms:',
      Object.keys(AUDIT_FIRMS)
    );

    // Section 4: Timeline
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 4: TIMELINE                                            │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.desiredStartDate = await this.question('Desired Start Date (YYYY-MM-DD): ');
    this.config.mainnetDeadline = await this.question('Mainnet Launch Deadline (YYYY-MM-DD): ');

    // Section 5: Additional Options
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 5: ADDITIONAL OPTIONS                                  │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.priorAudits = await this.yesNo('Have there been prior audits?');
    this.config.bugBountyPlanned = await this.yesNo('Is a bug bounty program planned?');
    this.config.formalVerification = await this.yesNo('Do you require formal verification?');
  }

  calculateEstimates(): { firm: string; minCost: number; maxCost: number; duration: string; score: number; complexityAdjusted: boolean }[] {
    const estimates: { firm: string; minCost: number; maxCost: number; duration: string; score: number; complexityAdjusted: boolean }[] = [];

    for (const [key, firm] of Object.entries(AUDIT_FIRMS)) {
      // Filter by tier
      if (this.config.requiredTier !== 'ANY') {
        const tierOrder = ['TIER_1', 'TIER_2', 'TIER_3'];
        const requiredIndex = tierOrder.indexOf(this.config.requiredTier);
        const firmIndex = tierOrder.indexOf(firm.tier);
        if (firmIndex > requiredIndex) continue;
      }

      // Calculate weighted average complexity multiplier based on LOC per contract
      let weightedComplexity = 1.0;
      if (this.config.contracts.length > 0 && this.config.totalLOC > 0) {
        weightedComplexity = this.config.contracts.reduce((sum, c) => {
          const multiplier = COMPLEXITY_MULTIPLIERS[c.complexity] || 1.0;
          const weight = c.linesOfCode / this.config.totalLOC;
          return sum + (multiplier * weight);
        }, 0);
      }

      // Apply complexity multiplier to cost estimates
      const baseCostMin = this.config.totalLOC * firm.avgCostPerLine.min;
      const baseCostMax = this.config.totalLOC * firm.avgCostPerLine.max;
      const minCost = Math.round(baseCostMin * weightedComplexity);
      const maxCost = Math.round(baseCostMax * weightedComplexity);

      // Calculate score
      let score = firm.reputation * 10;

      // Bonus for preferred firms
      if (this.config.preferredFirms.includes(key)) score += 20;

      // Bonus for formal verification capability if required
      if (this.config.formalVerification && firm.methodology.includes('Formal verification')) {
        score += 15;
      }

      // Penalty if over budget
      if (minCost > this.config.budget) score -= 30;
      else if (maxCost > this.config.budget) score -= 15;

      estimates.push({
        firm: firm.name,
        minCost,
        maxCost,
        duration: firm.typicalDuration,
        score,
        complexityAdjusted: weightedComplexity !== 1.0
      });
    }

    // Sort by score
    estimates.sort((a, b) => b.score - a.score);

    return estimates;
  }

  generateScopeDocument(): string {
    const timestamp = new Date().toISOString();

    return `# Security Audit Scope Document

**Project:** ${this.config.projectName}
**Prepared By:** SecureMint Engine
**Date:** ${timestamp}
**Version:** 1.0

---

## 1. Executive Summary

This document defines the scope, objectives, and requirements for the security audit of ${this.config.projectName}. The audit will cover smart contract security, protocol logic, and economic attack vectors.

**Total Lines of Code:** ${this.config.totalLOC.toLocaleString()}
**Target Chains:** ${this.config.targetChains.join(', ')}
**Budget:** $${this.config.budget.toLocaleString()}

---

## 2. Contracts in Scope

| # | Contract Name | Path | LOC | Complexity |
|---|---------------|------|-----|------------|
${this.config.contracts.map((c, i) => `| ${i + 1} | ${c.name} | ${c.path} | ${c.linesOfCode} | ${c.complexity} |`).join('\n')}
| | **TOTAL** | | **${this.config.totalLOC}** | |

---

## 3. Audit Objectives

### Primary Objectives

1. **Security Vulnerabilities**: Identify all potential security vulnerabilities including but not limited to:
   - Reentrancy attacks
   - Integer overflow/underflow
   - Access control issues
   - Front-running vulnerabilities
   - Oracle manipulation
   - Flash loan attacks

2. **Logic Errors**: Verify that all contract logic is correct and matches the intended behavior

3. **Best Practices**: Review code against established best practices and patterns

4. **Gas Optimization**: Identify opportunities for gas optimization

### Secondary Objectives

- Verify compliance with relevant standards (ERC-20, ERC-721, etc.)
- Review upgrade mechanisms and proxy patterns
- Assess economic attack vectors
- Evaluate centralization risks

---

## 4. Audit Methodology

### Required Testing

- [ ] Manual code review
- [ ] Static analysis (Slither, Mythril)
- [ ] Dynamic testing
- [ ] Fuzzing (Echidna, Foundry)
${this.config.formalVerification ? '- [ ] Formal verification (Certora, K Framework)' : ''}

### Severity Classification

| Severity | Description |
|----------|-------------|
| CRITICAL | Direct loss of funds, complete protocol compromise |
| HIGH | Significant fund loss or protocol disruption |
| MEDIUM | Limited fund loss or degraded functionality |
| LOW | Minimal impact, unlikely exploitation |
| INFORMATIONAL | No direct security impact |

---

## 5. Out of Scope

The following are explicitly OUT OF SCOPE for this audit:

- Third-party contracts (OpenZeppelin, Chainlink, etc.)
- Frontend/UI code
- Off-chain infrastructure
- Previous audit findings that have been addressed
- Deployment scripts and migrations
- Test files

---

## 6. Assumptions

1. The Solidity compiler version used is as specified in the contracts
2. All external dependencies are correctly implemented
3. The EVM behaves as documented
4. Network congestion and gas price fluctuations are normal conditions

---

## 7. Timeline

| Phase | Target Date |
|-------|-------------|
| Audit Kickoff | ${this.config.desiredStartDate} |
| Initial Review Complete | TBD (based on auditor) |
| Draft Report Delivered | TBD |
| Remediation Period | TBD |
| Final Report Delivered | TBD |
| Mainnet Deadline | ${this.config.mainnetDeadline} |

---

## 8. Deliverables

1. **Draft Audit Report**: Initial findings with severity classifications
2. **Remediation Review**: Verification of fixes
3. **Final Audit Report**: Public-ready report with all findings and resolutions
4. **Executive Summary**: One-page summary suitable for public disclosure

---

## 9. Communication

### Points of Contact

| Role | Responsibility |
|------|----------------|
| Project Lead | Final decisions, scope changes |
| Technical Lead | Code questions, fix implementation |
| Security Lead | Finding discussions, remediation approval |

### Communication Channels

- Primary: Secure messaging platform (Signal/Telegram)
- Secondary: Email (encrypted)
- Meetings: Weekly sync calls during audit

---

## 10. Confidentiality

This audit and all related materials are confidential until:
1. Final report is delivered, AND
2. Written consent is given for public disclosure

---

## 11. Acceptance

By signing below, both parties agree to the scope and terms outlined in this document.

| Party | Name | Signature | Date |
|-------|------|-----------|------|
| Client | _________________ | _________________ | ________ |
| Auditor | _________________ | _________________ | ________ |

---

*Generated by SecureMint Engine Security Audit Gate v1.0*
`;
  }

  generateFindingTracker(): string {
    return `# Security Audit Finding Tracker

**Project:** ${this.config.projectName}
**Created:** ${new Date().toISOString()}

---

## Summary

| Severity | Count | Open | Fixed | Won't Fix |
|----------|-------|------|-------|-----------|
| CRITICAL | 0 | 0 | 0 | 0 |
| HIGH | 0 | 0 | 0 | 0 |
| MEDIUM | 0 | 0 | 0 | 0 |
| LOW | 0 | 0 | 0 | 0 |
| INFORMATIONAL | 0 | 0 | 0 | 0 |
| **TOTAL** | **0** | **0** | **0** | **0** |

---

## Findings

### Template for Adding Findings

\`\`\`
### [SEVERITY]-001: Finding Title

**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL
**Status:** OPEN | ACKNOWLEDGED | IN_PROGRESS | FIXED | WONT_FIX | DISPUTED
**Contract:** ContractName.sol
**Function:** functionName()
**Lines:** L123-L145

#### Description
[Detailed description of the finding]

#### Impact
[Potential impact if exploited]

#### Proof of Concept
[Code or steps to reproduce]

#### Recommendation
[Suggested fix]

#### Team Response
[Your team's response]

#### Fix Commit
[Git commit hash of the fix]

#### Verification
- [ ] Fix reviewed by auditor
- [ ] Verified on: [date]
- [ ] Verified by: [auditor name]
\`\`\`

---

## Severity Definitions

${Object.entries(VULNERABILITY_CLASSES).map(([key, vc]) => `
### ${key}

- **Impact:** ${vc.impact}
- **Likelihood:** ${vc.likelihood}
- **Required Action:** ${vc.requiredAction}
- **Max Remediation Time:** ${vc.maxRemediationTime}

**Examples:**
${vc.examples.map(e => `- ${e}`).join('\n')}
`).join('\n')}

---

## Remediation Checklist

### Before Submitting Fixes

- [ ] All CRITICAL findings addressed
- [ ] All HIGH findings addressed
- [ ] MEDIUM findings addressed or accepted
- [ ] LOW findings reviewed
- [ ] All fixes include tests
- [ ] No new issues introduced
- [ ] Code is formatted and documented

### Before Final Report

- [ ] All fixes verified by auditor
- [ ] Re-audit of changed code complete
- [ ] No open CRITICAL or HIGH findings
- [ ] All accepted risks documented
- [ ] Executive summary approved

---

*Track your findings here during the audit process*
`;
  }

  generateReport(): string {
    const estimates = this.calculateEstimates();
    const timestamp = new Date().toISOString();

    let report = `# Security Audit Management Report

**Project:** ${this.config.projectName}
**Generated:** ${timestamp}

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| Project Name | ${this.config.projectName} |
| Description | ${this.config.description} |
| Total Contracts | ${this.config.contracts.length} |
| Total Lines of Code | ${this.config.totalLOC.toLocaleString()} |
| Target Chains | ${this.config.targetChains.join(', ')} |
| Budget | $${this.config.budget.toLocaleString()} |
| Desired Start | ${this.config.desiredStartDate} |
| Mainnet Deadline | ${this.config.mainnetDeadline} |

---

## 2. Contract Complexity Analysis

| Contract | LOC | Complexity | Risk Score |
|----------|-----|------------|------------|
${this.config.contracts.map(c => {
  const riskScore = c.complexity === 'CRITICAL' ? '🔴 Critical' :
                    c.complexity === 'HIGH' ? '🟠 High' :
                    c.complexity === 'MEDIUM' ? '🟡 Medium' : '🟢 Low';
  return `| ${c.name} | ${c.linesOfCode} | ${c.complexity} | ${riskScore} |`;
}).join('\n')}

---

## 3. Audit Firm Recommendations

Based on your requirements, here are the recommended audit firms:

| Rank | Firm | Tier | Min Cost | Max Cost | Duration | Score |
|------|------|------|----------|----------|----------|-------|
${estimates.slice(0, 5).map((e, i) => {
  const inBudget = e.maxCost <= this.config.budget ? '✅' : e.minCost <= this.config.budget ? '⚠️' : '❌';
  return `| ${i + 1} | ${e.firm} | ${AUDIT_FIRMS[Object.keys(AUDIT_FIRMS).find(k => AUDIT_FIRMS[k].name === e.firm) || '']?.tier || 'N/A'} | $${e.minCost.toLocaleString()} | $${e.maxCost.toLocaleString()} | ${e.duration} | ${e.score} ${inBudget} |`;
}).join('\n')}

### Budget Analysis

| Metric | Value |
|--------|-------|
| Your Budget | $${this.config.budget.toLocaleString()} |
| Minimum Required (Tier 1) | $${estimates.filter(e => e.score > 80)[0]?.minCost?.toLocaleString() || 'N/A'} |
| Average Market Rate | $${Math.round(estimates.reduce((sum, e) => sum + (e.minCost + e.maxCost) / 2, 0) / estimates.length).toLocaleString()} |
| Budget Status | ${estimates[0]?.maxCost <= this.config.budget ? '✅ Adequate' : estimates[0]?.minCost <= this.config.budget ? '⚠️ Tight' : '❌ Insufficient'} |

---

## 4. Audit Firm Details

`;

    // Add detailed firm information for top recommendations
    for (const estimate of estimates.slice(0, 3)) {
      const firmKey = Object.keys(AUDIT_FIRMS).find(k => AUDIT_FIRMS[k].name === estimate.firm);
      if (firmKey) {
        const firm = AUDIT_FIRMS[firmKey];
        report += `
### ${firm.name}

| Attribute | Value |
|-----------|-------|
| Tier | ${firm.tier} |
| Reputation | ${'⭐'.repeat(Math.round(firm.reputation))} (${firm.reputation}/10) |
| Website | ${firm.website} |
| Insurance | ${firm.insuranceCoverage} |

**Specialties:** ${firm.specialties.join(', ')}

**Methodology:** ${firm.methodology.join(', ')}

**Notable Clients:** ${firm.notableClients.join(', ')}

**Certifications:** ${firm.certifications.length > 0 ? firm.certifications.join(', ') : 'None listed'}

---
`;
      }
    }

    report += `
## 5. Pre-Audit Checklist

### Code Preparation

- [ ] All contracts compile without errors
- [ ] Unit tests pass with >95% coverage
- [ ] Slither runs with no high/critical findings
- [ ] Code is well-documented (NatSpec)
- [ ] README with architecture overview
- [ ] Deployment scripts tested

### Documentation

- [ ] System architecture diagram
- [ ] Data flow diagrams
- [ ] Access control matrix
- [ ] Economic model description
- [ ] Known limitations documented

### Repository

- [ ] Clean git history
- [ ] Specific commit/tag for audit
- [ ] Dependencies locked
- [ ] .env.example provided
- [ ] CI/CD passing

---

## 6. Recommended Timeline

Based on ${this.config.totalLOC} LOC and complexity:

| Phase | Duration | Target Date |
|-------|----------|-------------|
| Firm Selection & Contracting | 1-2 weeks | Week 1-2 |
| Audit Preparation | 1 week | Week 3 |
| Initial Audit | 3-4 weeks | Week 4-7 |
| Draft Report Review | 1 week | Week 8 |
| Remediation | 1-2 weeks | Week 9-10 |
| Remediation Review | 1 week | Week 11 |
| Final Report | 1 week | Week 12 |

**Total Estimated Time:** 10-12 weeks

**Warning:** ${new Date(this.config.mainnetDeadline) < new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000) ? '⚠️ Timeline may be tight for mainnet deadline' : '✅ Timeline allows for mainnet deadline'}

---

## 7. Risk Mitigation

### Before Audit

1. **Internal Security Review**
   - Run Slither static analysis
   - Run Mythril symbolic execution
   - Perform internal code review
   - Fix obvious issues before audit

2. **Test Coverage**
   - Achieve 95%+ line coverage
   - Include edge cases
   - Fuzz testing with Echidna/Foundry

3. **Documentation**
   - Complete architecture docs
   - Document all assumptions
   - List known issues

### During Audit

1. **Communication**
   - Respond to questions promptly
   - Be available for sync calls
   - Document all decisions

2. **Remediation**
   - Fix critical/high issues immediately
   - Track all changes
   - Re-test after fixes

### After Audit

1. **Bug Bounty**
   - ${this.config.bugBountyPlanned ? '✅ Launch bug bounty program' : '⚠️ Consider launching bug bounty'}
   - Recommend: 10-20% of audit cost for bounty pool

2. **Monitoring**
   - Deploy monitoring for mainnet
   - Set up alerts for anomalies
   - Prepare incident response plan

---

## 8. Required Actions

### Immediate Actions

1. [ ] Finalize contracts for audit
2. [ ] Contact top 3 recommended firms
3. [ ] Request quotes and availability
4. [ ] Review and sign engagement letter
5. [ ] Prepare audit documentation

### Pre-Audit Actions

1. [ ] Complete pre-audit checklist
2. [ ] Run internal security tools
3. [ ] Fix any obvious issues
4. [ ] Tag specific commit for audit
5. [ ] Schedule kickoff call

---

## 9. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Lead | _________________ | _________________ | ________ |
| Technical Lead | _________________ | _________________ | ________ |
| Security Lead | _________________ | _________________ | ________ |

**Audit Gate Status:** ☐ NOT STARTED  ☐ IN PROGRESS  ☐ COMPLETE

---

*Generated by SecureMint Engine Security Audit Gate v1.0*
`;

    return report;
  }

  async run(): Promise<void> {
    try {
      await this.collectInput();

      console.log('\n\n⏳ Generating Security Audit Documents...\n');

      const report = this.generateReport();
      const scopeDoc = this.generateScopeDocument();
      const findingTracker = this.generateFindingTracker();

      // Save files with overwrite confirmation
      const reportPath = path.resolve(process.cwd(), 'SECURITY_AUDIT_REPORT.md');
      const scopePath = path.resolve(process.cwd(), 'AUDIT_SCOPE_DOCUMENT.md');
      const trackerPath = path.resolve(process.cwd(), 'AUDIT_FINDING_TRACKER.md');
      const configPath = path.resolve(process.cwd(), 'audit-config.json');

      const filesToSave = [
        { path: reportPath, content: report },
        { path: scopePath, content: scopeDoc },
        { path: trackerPath, content: findingTracker },
        { path: configPath, content: JSON.stringify(this.config, null, 2) }
      ];

      for (const file of filesToSave) {
        if (await this.confirmOverwrite(file.path)) {
          fs.writeFileSync(file.path, file.content);
        } else {
          console.log(`⏭️  Skipped ${path.basename(file.path)}`);
        }
      }

      console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║              SECURITY AUDIT DOCUMENTS GENERATED                              ║');
      console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
      console.log('║                                                                               ║');
      console.log('║  📄 Report: SECURITY_AUDIT_REPORT.md                                          ║');
      console.log('║  📋 Scope:  AUDIT_SCOPE_DOCUMENT.md                                           ║');
      console.log('║  🔍 Tracker: AUDIT_FINDING_TRACKER.md                                         ║');
      console.log('║  ⚙️  Config: audit-config.json                                                ║');
      console.log('║                                                                               ║');
      console.log('║  Next Steps:                                                                  ║');
      console.log('║  1. Review audit firm recommendations                                         ║');
      console.log('║  2. Contact top firms for quotes                                              ║');
      console.log('║  3. Complete pre-audit checklist                                              ║');
      console.log('║  4. Share scope document with selected firm                                   ║');
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
  const gate = new SecurityAuditGate();
  gate.run();
}

export { SecurityAuditGate, AUDIT_FIRMS, VULNERABILITY_CLASSES };
