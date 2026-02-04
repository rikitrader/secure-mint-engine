#!/usr/bin/env npx ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SecureMint Engine - Legal/Regulatory Compliance Gate
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * MANDATORY GATE: Must be completed BEFORE any public token launch
 *
 * This tool ensures legal and regulatory compliance across jurisdictions:
 * - Securities law analysis (Howey Test)
 * - Jurisdiction-specific requirements
 * - Required licenses and registrations
 * - Document generation (ToS, Privacy Policy)
 * - Risk assessment and mitigation strategies
 *
 * Usage: npx ts-node scripts/legal/legal-compliance-gate.ts
 *
 * FIXES APPLIED (v1.1):
 * - Fixed Howey Test logic flaw for yield-bearing stablecoins
 * - Added input validation and NaN handling
 * - Added markdown character escaping
 * - Added graceful shutdown handling
 * - Added file overwrite confirmation
 * - Fixed type safety with proper initialization
 * - Added unknown jurisdiction handling
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escape markdown special characters to prevent table/formatting breaks
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
 * Safe parseInt with NaN handling
 */
function safeParseInt(value: string, defaultValue: number = 0): number {
  const parsed = parseInt(value.replace(/,/g, '').trim(), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validate non-empty string
 */
function isValidString(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGAL DATABASE - Jurisdiction Requirements (Updated regularly)
// ═══════════════════════════════════════════════════════════════════════════════

interface JurisdictionRequirement {
  name: string;
  code: string;
  regulatoryBody: string;
  tokenClassification: string[];
  requiredLicenses: string[];
  registrationRequired: boolean;
  kycRequired: boolean;
  amlRequired: boolean;
  taxReporting: boolean;
  restrictions: string[];
  penalties: string;
  timeline: string;
  estimatedCost: { min: number; max: number };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'PROHIBITED';
  lastUpdated: string; // Track data freshness
}

const JURISDICTION_DATABASE: Record<string, JurisdictionRequirement> = {
  US: {
    name: 'United States',
    code: 'US',
    regulatoryBody: 'SEC, FinCEN, CFTC, State Regulators',
    tokenClassification: ['Security Token', 'Utility Token', 'Commodity', 'Currency'],
    requiredLicenses: ['Money Transmitter License (MTL)', 'BitLicense (NY)', 'SEC Registration (if security)'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: true,
    restrictions: [
      'Accredited investor rules for securities',
      'State-by-state MTL requirements',
      'OFAC sanctions compliance',
      'Bank Secrecy Act compliance'
    ],
    penalties: 'Criminal prosecution, fines up to $5M+, imprisonment',
    timeline: '6-18 months for full compliance',
    estimatedCost: { min: 500000, max: 2000000 },
    riskLevel: 'HIGH',
    lastUpdated: '2024-01'
  },
  EU: {
    name: 'European Union (MiCA)',
    code: 'EU',
    regulatoryBody: 'ESMA, National Competent Authorities',
    tokenClassification: ['E-Money Token (EMT)', 'Asset-Referenced Token (ART)', 'Utility Token'],
    requiredLicenses: ['CASP Authorization', 'EMT License', 'ART License'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: true,
    restrictions: [
      'Whitepaper requirements',
      'Reserve requirements for stablecoins',
      'Marketing restrictions',
      'Consumer protection rules'
    ],
    penalties: 'Fines up to EUR5M or 3% of annual turnover',
    timeline: '3-12 months for CASP authorization',
    estimatedCost: { min: 200000, max: 800000 },
    riskLevel: 'MEDIUM',
    lastUpdated: '2024-01'
  },
  UK: {
    name: 'United Kingdom',
    code: 'UK',
    regulatoryBody: 'FCA (Financial Conduct Authority)',
    tokenClassification: ['Security Token', 'E-Money', 'Unregulated Token'],
    requiredLicenses: ['FCA Cryptoasset Registration', 'E-Money License'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: true,
    restrictions: [
      'Financial promotion rules',
      'Consumer duty requirements',
      'Custody requirements'
    ],
    penalties: 'Unlimited fines, criminal prosecution',
    timeline: '6-12 months for registration',
    estimatedCost: { min: 150000, max: 500000 },
    riskLevel: 'MEDIUM',
    lastUpdated: '2024-01'
  },
  SG: {
    name: 'Singapore',
    code: 'SG',
    regulatoryBody: 'MAS (Monetary Authority of Singapore)',
    tokenClassification: ['Digital Payment Token (DPT)', 'Security Token', 'Utility Token'],
    requiredLicenses: ['Payment Services License', 'CMS License (if security)'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: true,
    restrictions: [
      'Travel Rule compliance',
      'Custody requirements',
      'Risk management requirements'
    ],
    penalties: 'Fines up to SGD 1M, imprisonment up to 3 years',
    timeline: '6-12 months',
    estimatedCost: { min: 100000, max: 400000 },
    riskLevel: 'MEDIUM',
    lastUpdated: '2024-01'
  },
  CH: {
    name: 'Switzerland',
    code: 'CH',
    regulatoryBody: 'FINMA',
    tokenClassification: ['Payment Token', 'Utility Token', 'Asset Token'],
    requiredLicenses: ['FINMA License (if applicable)', 'SRO Membership'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: true,
    restrictions: [
      'ICO guidelines compliance',
      'AML compliance',
      'Prospectus requirements for asset tokens'
    ],
    penalties: 'Fines, license revocation',
    timeline: '3-9 months',
    estimatedCost: { min: 80000, max: 300000 },
    riskLevel: 'LOW',
    lastUpdated: '2024-01'
  },
  AE: {
    name: 'United Arab Emirates (ADGM/DIFC)',
    code: 'AE',
    regulatoryBody: 'VARA, ADGM FSRA, DFSA',
    tokenClassification: ['Virtual Asset', 'Security Token'],
    requiredLicenses: ['VASP License', 'FSP License'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: false,
    restrictions: [
      'Substance requirements',
      'Governance requirements',
      'Technology requirements'
    ],
    penalties: 'Fines, license suspension',
    timeline: '3-6 months',
    estimatedCost: { min: 100000, max: 350000 },
    riskLevel: 'LOW',
    lastUpdated: '2024-01'
  },
  CAYMAN: {
    name: 'Cayman Islands',
    code: 'KY',
    regulatoryBody: 'CIMA',
    tokenClassification: ['Virtual Asset'],
    requiredLicenses: ['VASP Registration'],
    registrationRequired: true,
    kycRequired: true,
    amlRequired: true,
    taxReporting: false,
    restrictions: [
      'AML compliance',
      'Substance requirements'
    ],
    penalties: 'Fines, registration revocation',
    timeline: '2-4 months',
    estimatedCost: { min: 50000, max: 150000 },
    riskLevel: 'LOW',
    lastUpdated: '2024-01'
  },
  CN: {
    name: 'China',
    code: 'CN',
    regulatoryBody: 'PBOC, CSRC',
    tokenClassification: ['Prohibited'],
    requiredLicenses: ['N/A - Prohibited'],
    registrationRequired: false,
    kycRequired: false,
    amlRequired: false,
    taxReporting: false,
    restrictions: ['All cryptocurrency activities banned'],
    penalties: 'Criminal prosecution, asset seizure',
    timeline: 'N/A',
    estimatedCost: { min: 0, max: 0 },
    riskLevel: 'PROHIBITED',
    lastUpdated: '2024-01'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOWEY TEST ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

interface HoweyTestResult {
  investmentOfMoney: { answer: boolean; reasoning: string };
  commonEnterprise: { answer: boolean; reasoning: string };
  expectationOfProfits: { answer: boolean; reasoning: string };
  effortsOfOthers: { answer: boolean; reasoning: string };
  isLikelySecurity: boolean;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE CHECKLIST DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

interface ComplianceItem {
  id: string;
  category: string;
  item: string;
  description: string;
  required: boolean;
  jurisdictions: string[];
  documentTemplate: boolean;
}

const COMPLIANCE_CHECKLIST: ComplianceItem[] = [
  // Legal Structure
  { id: 'LS-01', category: 'Legal Structure', item: 'Entity Formation', description: 'Establish legal entity in appropriate jurisdiction', required: true, jurisdictions: ['ALL'], documentTemplate: false },
  { id: 'LS-02', category: 'Legal Structure', item: 'Corporate Governance', description: 'Board of directors, officers, governance documents', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'LS-03', category: 'Legal Structure', item: 'Foundation/DAO Structure', description: 'Decentralized governance structure if applicable', required: false, jurisdictions: ['ALL'], documentTemplate: true },

  // Securities Law
  { id: 'SL-01', category: 'Securities Law', item: 'Howey Test Analysis', description: 'Formal legal opinion on token classification', required: true, jurisdictions: ['US', 'UK', 'EU'], documentTemplate: true },
  { id: 'SL-02', category: 'Securities Law', item: 'Exemption Analysis', description: 'Reg D, Reg S, Reg A+ exemption analysis', required: true, jurisdictions: ['US'], documentTemplate: true },
  { id: 'SL-03', category: 'Securities Law', item: 'Prospectus/Whitepaper', description: 'Compliant offering document', required: true, jurisdictions: ['ALL'], documentTemplate: true },

  // AML/KYC
  { id: 'AML-01', category: 'AML/KYC', item: 'AML Policy', description: 'Anti-money laundering policy and procedures', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'AML-02', category: 'AML/KYC', item: 'KYC Procedures', description: 'Know Your Customer verification procedures', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'AML-03', category: 'AML/KYC', item: 'Sanctions Screening', description: 'OFAC, EU, UN sanctions list screening', required: true, jurisdictions: ['ALL'], documentTemplate: false },
  { id: 'AML-04', category: 'AML/KYC', item: 'Transaction Monitoring', description: 'Ongoing transaction monitoring system', required: true, jurisdictions: ['ALL'], documentTemplate: false },
  { id: 'AML-05', category: 'AML/KYC', item: 'SAR Filing Procedures', description: 'Suspicious Activity Report procedures', required: true, jurisdictions: ['US', 'UK', 'EU'], documentTemplate: true },

  // Consumer Protection
  { id: 'CP-01', category: 'Consumer Protection', item: 'Terms of Service', description: 'User terms and conditions', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'CP-02', category: 'Consumer Protection', item: 'Privacy Policy', description: 'Data collection and privacy notice', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'CP-03', category: 'Consumer Protection', item: 'Risk Disclosures', description: 'Investment risk warnings and disclosures', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'CP-04', category: 'Consumer Protection', item: 'Cookie Policy', description: 'Cookie usage and consent', required: true, jurisdictions: ['EU', 'UK'], documentTemplate: true },

  // Tax
  { id: 'TAX-01', category: 'Tax Compliance', item: 'Tax Classification', description: 'Token tax treatment analysis', required: true, jurisdictions: ['ALL'], documentTemplate: true },
  { id: 'TAX-02', category: 'Tax Compliance', item: 'Reporting Obligations', description: 'Tax reporting requirements by jurisdiction', required: true, jurisdictions: ['US', 'UK', 'EU'], documentTemplate: false },
  { id: 'TAX-03', category: 'Tax Compliance', item: 'Withholding Requirements', description: 'Tax withholding obligations', required: true, jurisdictions: ['US'], documentTemplate: false },

  // Data Protection
  { id: 'DP-01', category: 'Data Protection', item: 'GDPR Compliance', description: 'EU General Data Protection Regulation', required: true, jurisdictions: ['EU', 'UK'], documentTemplate: true },
  { id: 'DP-02', category: 'Data Protection', item: 'Data Processing Agreements', description: 'DPAs with service providers', required: true, jurisdictions: ['EU', 'UK'], documentTemplate: true },
  { id: 'DP-03', category: 'Data Protection', item: 'Data Retention Policy', description: 'Data storage and deletion policies', required: true, jurisdictions: ['ALL'], documentTemplate: true },

  // Licensing
  { id: 'LIC-01', category: 'Licensing', item: 'Money Transmitter License', description: 'State/federal MTL if applicable', required: false, jurisdictions: ['US'], documentTemplate: false },
  { id: 'LIC-02', category: 'Licensing', item: 'VASP Registration', description: 'Virtual Asset Service Provider registration', required: true, jurisdictions: ['EU', 'UK', 'SG', 'AE'], documentTemplate: false },
  { id: 'LIC-03', category: 'Licensing', item: 'Payment Services License', description: 'Payment services authorization', required: false, jurisdictions: ['EU', 'UK', 'SG'], documentTemplate: false }
];

// ═══════════════════════════════════════════════════════════════════════════════
// LEGAL COMPLIANCE GATE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

interface LegalConfig {
  projectName: string;
  tokenName: string;
  tokenSymbol: string;
  tokenType: 'STABLECOIN' | 'UTILITY' | 'SECURITY' | 'GOVERNANCE' | 'NFT';
  backingType: 'FIAT' | 'CRYPTO' | 'RWA' | 'ALGORITHMIC' | 'NONE';
  targetJurisdictions: string[];
  blockedJurisdictions: string[];
  hasICO: boolean;
  hasPreSale: boolean;
  hasAirdrop: boolean;
  publicSale: boolean;
  teamTokens: boolean;
  vestingSchedule: boolean;
  daoGovernance: boolean;
  profitSharing: boolean;
  buybackProgram: boolean;
  yieldGeneration: boolean;
  entityJurisdiction: string;
  legalCounselRetained: boolean;
  existingLegalOpinion: boolean;
}

// Default config with safe initial values
const DEFAULT_LEGAL_CONFIG: LegalConfig = {
  projectName: '',
  tokenName: '',
  tokenSymbol: '',
  tokenType: 'UTILITY',
  backingType: 'NONE',
  targetJurisdictions: [],
  blockedJurisdictions: [],
  hasICO: false,
  hasPreSale: false,
  hasAirdrop: false,
  publicSale: false,
  teamTokens: false,
  vestingSchedule: false,
  daoGovernance: false,
  profitSharing: false,
  buybackProgram: false,
  yieldGeneration: false,
  entityJurisdiction: '',
  legalCounselRetained: false,
  existingLegalOpinion: false
};

class LegalComplianceGate {
  private config: LegalConfig;
  private rl: readline.Interface;
  private isShuttingDown: boolean = false;

  constructor() {
    // Initialize with safe defaults instead of empty object
    this.config = { ...DEFAULT_LEGAL_CONFIG };
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Graceful shutdown handling
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log('\n\n⚠️  Process interrupted. Saving current state...');

      // Save partial config if we have any data
      if (this.config.projectName) {
        const partialPath = path.resolve(process.cwd(), 'legal-compliance-partial.json');
        try {
          fs.writeFileSync(partialPath, JSON.stringify(this.config, null, 2));
          console.log(`📄 Partial config saved to: ${partialPath}`);
        } catch (e) {
          console.error('Could not save partial config:', e);
        }
      }

      this.rl.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async questionRequired(prompt: string, fieldName: string): Promise<string> {
    let answer = '';
    while (!isValidString(answer)) {
      answer = await this.question(prompt);
      if (!isValidString(answer)) {
        console.log(`  ⚠️  ${fieldName} is required. Please enter a value.`);
      }
    }
    return answer;
  }

  private async selectOne(prompt: string, options: string[]): Promise<string> {
    console.log(`\n${prompt}`);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));

    let validSelection = false;
    let selectedOption = options[0];

    while (!validSelection) {
      const answer = await this.question('Select (number): ');
      const index = safeParseInt(answer, -1) - 1;

      if (index >= 0 && index < options.length) {
        selectedOption = options[index];
        validSelection = true;
      } else {
        console.log(`  ⚠️  Please enter a number between 1 and ${options.length}`);
      }
    }

    return selectedOption;
  }

  private async selectMultiple(prompt: string, options: string[]): Promise<string[]> {
    console.log(`\n${prompt}`);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
    const answer = await this.question('Select (comma-separated numbers, or "all"): ');

    if (answer.toLowerCase() === 'all') return [...options];

    const indices = answer.split(',')
      .map(s => safeParseInt(s.trim(), -1) - 1)
      .filter(i => i >= 0 && i < options.length);

    if (indices.length === 0) {
      console.log('  ⚠️  No valid selections. Please try again.');
      return this.selectMultiple(prompt, options);
    }

    return indices.map(i => options[i]);
  }

  private async yesNo(prompt: string): Promise<boolean> {
    const answer = await this.question(`${prompt} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  async collectInput(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║           SECUREMINT ENGINE - LEGAL/REGULATORY COMPLIANCE GATE               ║');
    console.log('║                   MANDATORY GATE BEFORE PUBLIC LAUNCH                        ║');
    console.log('║                              Version 1.1                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('ℹ️  Press Ctrl+C at any time to save progress and exit.\n');

    // Section 1: Project Information
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 1: PROJECT INFORMATION                                 │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.projectName = await this.questionRequired('Project Name: ', 'Project Name');
    this.config.tokenName = await this.questionRequired('Token Name: ', 'Token Name');
    this.config.tokenSymbol = await this.questionRequired('Token Symbol: ', 'Token Symbol');

    this.config.tokenType = await this.selectOne(
      'Token Type:',
      ['STABLECOIN', 'UTILITY', 'SECURITY', 'GOVERNANCE', 'NFT']
    ) as LegalConfig['tokenType'];

    this.config.backingType = await this.selectOne(
      'Backing Type:',
      ['FIAT', 'CRYPTO', 'RWA', 'ALGORITHMIC', 'NONE']
    ) as LegalConfig['backingType'];

    // Section 2: Jurisdictions
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 2: TARGET JURISDICTIONS                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    const jurisdictionOptions = Object.keys(JURISDICTION_DATABASE);
    this.config.targetJurisdictions = await this.selectMultiple(
      'Target Jurisdictions (where you want to operate):',
      jurisdictionOptions
    );

    this.config.blockedJurisdictions = await this.selectMultiple(
      'Blocked Jurisdictions (where you will NOT operate):',
      ['CN', 'KP', 'IR', 'CU', 'SY', 'RU', 'BY', 'VE', 'MM', 'ZW']
    );

    this.config.entityJurisdiction = await this.selectOne(
      'Entity Formation Jurisdiction:',
      ['US_DE', 'US_WY', 'CAYMAN', 'BVI', 'CH', 'SG', 'AE', 'UK', 'EU_IE', 'EU_MT']
    );

    // Section 3: Token Distribution
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 3: TOKEN DISTRIBUTION & SALES                          │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.hasICO = await this.yesNo('Will there be an ICO/Token Sale?');
    this.config.hasPreSale = await this.yesNo('Will there be a pre-sale/private sale?');
    this.config.hasAirdrop = await this.yesNo('Will there be airdrops?');
    this.config.publicSale = await this.yesNo('Will there be a public sale?');
    this.config.teamTokens = await this.yesNo('Will team members receive tokens?');
    this.config.vestingSchedule = await this.yesNo('Will there be vesting schedules?');

    // Section 4: Economic Features (Howey Test Relevant)
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 4: ECONOMIC FEATURES (Securities Analysis)             │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.daoGovernance = await this.yesNo('Will token holders have governance rights?');
    this.config.profitSharing = await this.yesNo('Will there be profit/revenue sharing with holders?');
    this.config.buybackProgram = await this.yesNo('Will there be token buyback programs?');
    this.config.yieldGeneration = await this.yesNo('Will tokens generate yield/interest?');

    // Section 5: Legal Status
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 5: CURRENT LEGAL STATUS                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.legalCounselRetained = await this.yesNo('Have you retained legal counsel?');
    this.config.existingLegalOpinion = await this.yesNo('Do you have an existing legal opinion?');
  }

  analyzeHoweyTest(): HoweyTestResult {
    const result: HoweyTestResult = {
      investmentOfMoney: { answer: false, reasoning: '' },
      commonEnterprise: { answer: false, reasoning: '' },
      expectationOfProfits: { answer: false, reasoning: '' },
      effortsOfOthers: { answer: false, reasoning: '' },
      isLikelySecurity: false,
      confidence: 'MEDIUM',
      recommendation: ''
    };

    // Prong 1: Investment of Money
    if (this.config.hasICO || this.config.hasPreSale || this.config.publicSale) {
      result.investmentOfMoney = {
        answer: true,
        reasoning: 'Token sale involves exchange of money/crypto for tokens'
      };
    } else if (this.config.hasAirdrop && !this.config.hasICO && !this.config.hasPreSale && !this.config.publicSale) {
      result.investmentOfMoney = {
        answer: false,
        reasoning: 'Free distribution (airdrop) without monetary exchange'
      };
    } else {
      result.investmentOfMoney = {
        answer: true,
        reasoning: 'Tokens will be acquired through some form of value exchange'
      };
    }

    // Prong 2: Common Enterprise
    if (this.config.backingType !== 'NONE' || this.config.daoGovernance) {
      result.commonEnterprise = {
        answer: true,
        reasoning: 'Pooled assets and/or shared governance creates common enterprise'
      };
    } else {
      result.commonEnterprise = {
        answer: false,
        reasoning: 'No significant pooling of assets or shared enterprise'
      };
    }

    // Prong 3: Expectation of Profits
    // FIXED: Check profit mechanisms FIRST, regardless of token type
    // This fixes the bug where yield-bearing stablecoins incorrectly passed
    const hasProfitMechanisms = this.config.profitSharing ||
                                 this.config.yieldGeneration ||
                                 this.config.buybackProgram;

    if (hasProfitMechanisms) {
      result.expectationOfProfits = {
        answer: true,
        reasoning: `Direct profit/yield mechanisms: ${[
          this.config.profitSharing ? 'profit sharing' : '',
          this.config.yieldGeneration ? 'yield generation' : '',
          this.config.buybackProgram ? 'buyback program' : ''
        ].filter(Boolean).join(', ')}`
      };
    } else if (this.config.tokenType === 'STABLECOIN') {
      // Only mark as false if NO profit mechanisms exist
      result.expectationOfProfits = {
        answer: false,
        reasoning: 'Stablecoin designed to maintain stable value, not appreciation, with no yield mechanisms'
      };
    } else if (this.config.tokenType === 'UTILITY') {
      result.expectationOfProfits = {
        answer: false,
        reasoning: 'Utility token with consumptive use case, no profit mechanisms'
      };
    } else {
      result.expectationOfProfits = {
        answer: true,
        reasoning: 'Token holders may expect value appreciation (implicit profit expectation)'
      };
    }

    // Prong 4: Efforts of Others
    if (this.config.teamTokens || this.config.vestingSchedule) {
      result.effortsOfOthers = {
        answer: true,
        reasoning: 'Team involvement and vesting suggests reliance on management efforts'
      };
    } else if (this.config.daoGovernance && !this.config.teamTokens) {
      result.effortsOfOthers = {
        answer: false,
        reasoning: 'Fully decentralized governance reduces reliance on specific parties'
      };
    } else {
      result.effortsOfOthers = {
        answer: true,
        reasoning: 'Development team efforts drive token value'
      };
    }

    // Final Analysis
    const positiveCount = [
      result.investmentOfMoney.answer,
      result.commonEnterprise.answer,
      result.expectationOfProfits.answer,
      result.effortsOfOthers.answer
    ].filter(Boolean).length;

    result.isLikelySecurity = positiveCount >= 3;

    if (positiveCount === 4) {
      result.confidence = 'HIGH';
      result.recommendation = 'STRONG indication of security. Seek immediate legal counsel. Consider Reg D/S exemptions or SEC registration.';
    } else if (positiveCount === 3) {
      result.confidence = 'MEDIUM';
      result.recommendation = 'Likely security under Howey. Obtain formal legal opinion before proceeding.';
    } else if (positiveCount === 2) {
      result.confidence = 'LOW';
      result.recommendation = 'May not be a security, but borderline. Document utility features extensively.';
    } else {
      result.confidence = 'LOW';
      result.recommendation = 'Unlikely to be a security, but maintain documentation of utility purpose.';
    }

    return result;
  }

  analyzeJurisdictions(): { jurisdiction: string; requirements: JurisdictionRequirement; applicable: ComplianceItem[] }[] {
    const results: { jurisdiction: string; requirements: JurisdictionRequirement; applicable: ComplianceItem[] }[] = [];

    for (const code of this.config.targetJurisdictions) {
      const req = JURISDICTION_DATABASE[code];
      if (req) {
        const applicableItems = COMPLIANCE_CHECKLIST.filter(item =>
          item.jurisdictions.includes('ALL') || item.jurisdictions.includes(code)
        );
        results.push({
          jurisdiction: code,
          requirements: req,
          applicable: applicableItems
        });
      } else {
        // Handle unknown jurisdiction - create a placeholder with warning
        console.warn(`⚠️  Unknown jurisdiction code: ${code}. Using generic requirements.`);
        results.push({
          jurisdiction: code,
          requirements: {
            name: `Unknown (${code})`,
            code: code,
            regulatoryBody: 'Unknown - Research Required',
            tokenClassification: ['Unknown'],
            requiredLicenses: ['Research Required'],
            registrationRequired: true, // Assume worst case
            kycRequired: true,
            amlRequired: true,
            taxReporting: true,
            restrictions: ['Research local regulations'],
            penalties: 'Unknown - Research Required',
            timeline: 'Unknown',
            estimatedCost: { min: 0, max: 0 },
            riskLevel: 'HIGH',
            lastUpdated: 'N/A'
          },
          applicable: COMPLIANCE_CHECKLIST.filter(item => item.jurisdictions.includes('ALL'))
        });
      }
    }

    return results;
  }

  calculateComplianceCosts(): { jurisdiction: string; minCost: number; maxCost: number; timeline: string }[] {
    const costs: { jurisdiction: string; minCost: number; maxCost: number; timeline: string }[] = [];

    for (const code of this.config.targetJurisdictions) {
      const req = JURISDICTION_DATABASE[code];
      if (req && req.riskLevel !== 'PROHIBITED') {
        costs.push({
          jurisdiction: req.name,
          minCost: req.estimatedCost.min,
          maxCost: req.estimatedCost.max,
          timeline: req.timeline
        });
      }
    }

    return costs;
  }

  private async confirmOverwrite(filePath: string): Promise<boolean> {
    if (fs.existsSync(filePath)) {
      const confirm = await this.yesNo(`\n⚠️  File ${path.basename(filePath)} already exists. Overwrite?`);
      return confirm;
    }
    return true;
  }

  generateReport(): string {
    const howeyResult = this.analyzeHoweyTest();
    const jurisdictionAnalysis = this.analyzeJurisdictions();
    const costs = this.calculateComplianceCosts();
    const timestamp = new Date().toISOString();

    // Escape user inputs for markdown safety
    const safeProjectName = escapeMarkdown(this.config.projectName);
    const safeTokenName = escapeMarkdown(this.config.tokenName);
    const safeTokenSymbol = escapeMarkdown(this.config.tokenSymbol);

    let report = `# Legal/Regulatory Compliance Report

> **Project:** ${safeProjectName}
> **Token:** ${safeTokenName} (${safeTokenSymbol})
> **Generated:** ${timestamp}
> **Status:** PENDING LEGAL REVIEW

---

## Executive Summary

This report provides a preliminary legal and regulatory compliance analysis for the ${safeProjectName} token project. **THIS IS NOT LEGAL ADVICE.** This analysis is intended to identify potential regulatory considerations and should be reviewed by qualified legal counsel in each target jurisdiction.

---

## 1. Token Classification Analysis

### Token Details

| Attribute | Value |
|-----------|-------|
| Token Type | ${this.config.tokenType} |
| Backing Type | ${this.config.backingType} |
| Has ICO/Token Sale | ${this.config.hasICO ? 'Yes' : 'No'} |
| Has Pre-Sale | ${this.config.hasPreSale ? 'Yes' : 'No'} |
| Has Airdrop | ${this.config.hasAirdrop ? 'Yes' : 'No'} |
| Public Sale | ${this.config.publicSale ? 'Yes' : 'No'} |
| Team Tokens | ${this.config.teamTokens ? 'Yes' : 'No'} |
| Vesting Schedule | ${this.config.vestingSchedule ? 'Yes' : 'No'} |
| DAO Governance | ${this.config.daoGovernance ? 'Yes' : 'No'} |
| Profit Sharing | ${this.config.profitSharing ? 'Yes' : 'No'} |
| Buyback Program | ${this.config.buybackProgram ? 'Yes' : 'No'} |
| Yield Generation | ${this.config.yieldGeneration ? 'Yes' : 'No'} |

---

## 2. Howey Test Analysis (US Securities Law)

### Overview

The Howey Test determines whether an instrument qualifies as an "investment contract" (security) under US law. All four prongs must be satisfied for an instrument to be classified as a security.

### Analysis Results

| Prong | Question | Result | Reasoning |
|-------|----------|--------|-----------|
| 1 | Investment of Money | ${howeyResult.investmentOfMoney.answer ? '⚠️ YES' : '✅ NO'} | ${escapeMarkdown(howeyResult.investmentOfMoney.reasoning)} |
| 2 | Common Enterprise | ${howeyResult.commonEnterprise.answer ? '⚠️ YES' : '✅ NO'} | ${escapeMarkdown(howeyResult.commonEnterprise.reasoning)} |
| 3 | Expectation of Profits | ${howeyResult.expectationOfProfits.answer ? '⚠️ YES' : '✅ NO'} | ${escapeMarkdown(howeyResult.expectationOfProfits.reasoning)} |
| 4 | Efforts of Others | ${howeyResult.effortsOfOthers.answer ? '⚠️ YES' : '✅ NO'} | ${escapeMarkdown(howeyResult.effortsOfOthers.reasoning)} |

### Conclusion

| Assessment | Value |
|------------|-------|
| **Likely Security?** | ${howeyResult.isLikelySecurity ? '⚠️ YES - LIKELY SECURITY' : '✅ NO - LIKELY NOT A SECURITY'} |
| **Confidence Level** | ${howeyResult.confidence} |
| **Recommendation** | ${escapeMarkdown(howeyResult.recommendation)} |

${howeyResult.isLikelySecurity ? `
### ⚠️ CRITICAL WARNING

Based on this preliminary analysis, your token **may be classified as a security** under US law. This means:

1. **Registration Required**: You may need to register with the SEC or qualify for an exemption
2. **Exemption Options**:
   - **Reg D (506b/506c)**: Accredited investors only, limited marketing
   - **Reg S**: Non-US persons only, offshore offering
   - **Reg A+**: Up to $75M, SEC qualification required
   - **Reg CF**: Up to $5M, crowdfunding platforms only
3. **Penalties for Non-Compliance**: Civil and criminal penalties, disgorgement, injunctions

**ACTION REQUIRED**: Retain securities law counsel immediately before proceeding.
` : ''}

---

## 3. Jurisdiction Analysis

### Target Jurisdictions

`;

    // Add jurisdiction analysis
    for (const analysis of jurisdictionAnalysis) {
      const req = analysis.requirements;
      report += `
### ${escapeMarkdown(req.name)} (${req.code})

| Attribute | Value |
|-----------|-------|
| Regulatory Body | ${escapeMarkdown(req.regulatoryBody)} |
| Risk Level | ${req.riskLevel === 'PROHIBITED' ? '🚫 PROHIBITED' : req.riskLevel === 'HIGH' ? '🔴 HIGH' : req.riskLevel === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW'} |
| Registration Required | ${req.registrationRequired ? 'Yes' : 'No'} |
| KYC Required | ${req.kycRequired ? 'Yes' : 'No'} |
| AML Required | ${req.amlRequired ? 'Yes' : 'No'} |
| Tax Reporting | ${req.taxReporting ? 'Yes' : 'No'} |
| Estimated Timeline | ${req.timeline} |
| Estimated Cost | $${req.estimatedCost.min.toLocaleString()} - $${req.estimatedCost.max.toLocaleString()} |
| Data Last Updated | ${req.lastUpdated || 'Unknown'} |

**Token Classifications:** ${req.tokenClassification.join(', ')}

**Required Licenses:**
${req.requiredLicenses.map(l => `- ${escapeMarkdown(l)}`).join('\n')}

**Key Restrictions:**
${req.restrictions.map(r => `- ${escapeMarkdown(r)}`).join('\n')}

**Penalties:** ${escapeMarkdown(req.penalties)}

`;
    }

    // Blocked jurisdictions
    report += `
### Blocked Jurisdictions

The following jurisdictions will be blocked from accessing the platform:

| Jurisdiction | Reason |
|--------------|--------|
${this.config.blockedJurisdictions.map(j => `| ${j} | Sanctions/Regulatory prohibition |`).join('\n')}

---

## 4. Compliance Checklist

### Required Documents and Procedures

`;

    // Group checklist by category
    const categories = [...new Set(COMPLIANCE_CHECKLIST.map(item => item.category))];
    for (const category of categories) {
      const items = COMPLIANCE_CHECKLIST.filter(item => item.category === category);
      const applicableItems = items.filter(item =>
        item.jurisdictions.includes('ALL') ||
        item.jurisdictions.some(j => this.config.targetJurisdictions.includes(j))
      );

      if (applicableItems.length > 0) {
        report += `
#### ${category}

| ID | Item | Description | Required | Template |
|----|------|-------------|----------|----------|
${applicableItems.map(item => `| ${item.id} | ${escapeMarkdown(item.item)} | ${escapeMarkdown(item.description)} | ${item.required ? '✅ Yes' : '⬜ Optional'} | ${item.documentTemplate ? '📄 Yes' : '—'} |`).join('\n')}
`;
      }
    }

    // Cost summary
    const totalMinCost = costs.reduce((sum, c) => sum + c.minCost, 0);
    const totalMaxCost = costs.reduce((sum, c) => sum + c.maxCost, 0);

    report += `
---

## 5. Cost Estimate

### By Jurisdiction

| Jurisdiction | Min Cost | Max Cost | Timeline |
|--------------|----------|----------|----------|
${costs.map(c => `| ${escapeMarkdown(c.jurisdiction)} | $${c.minCost.toLocaleString()} | $${c.maxCost.toLocaleString()} | ${c.timeline} |`).join('\n')}

### Total Estimated Compliance Cost

| Metric | Value |
|--------|-------|
| **Minimum Total** | $${totalMinCost.toLocaleString()} |
| **Maximum Total** | $${totalMaxCost.toLocaleString()} |
| **Recommended Budget** | $${Math.round((totalMinCost + totalMaxCost) / 2).toLocaleString()} |

---

## 6. Recommended Actions

### Immediate Actions (Before Any Launch)

1. **Retain Legal Counsel**
   - Securities lawyer (if US exposure)
   - Regulatory counsel in each target jurisdiction
   - Tax advisor

2. **Obtain Legal Opinions**
   - Token classification opinion
   - Securities exemption analysis
   - Regulatory compliance roadmap

3. **Establish Compliance Infrastructure**
   - KYC/AML provider integration
   - Sanctions screening service
   - Transaction monitoring system

4. **Prepare Required Documents**
   - Terms of Service
   - Privacy Policy
   - Risk Disclosures
   - Whitepaper (if applicable)

### Pre-Launch Checklist

- [ ] Legal entity established in ${escapeMarkdown(this.config.entityJurisdiction)}
- [ ] Legal opinions obtained
- [ ] KYC/AML procedures implemented
- [ ] Sanctions screening active
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Risk disclosures published
- [ ] Required registrations filed
- [ ] Insurance obtained (if required)
- [ ] Compliance officer appointed

---

## 7. Risk Assessment

### Overall Risk Level

`;

    // Calculate overall risk
    const highRiskJurisdictions = jurisdictionAnalysis.filter(a => a.requirements.riskLevel === 'HIGH').length;
    const prohibitedJurisdictions = jurisdictionAnalysis.filter(a => a.requirements.riskLevel === 'PROHIBITED').length;

    let overallRisk = 'LOW';
    if (prohibitedJurisdictions > 0 || (howeyResult.isLikelySecurity && this.config.targetJurisdictions.includes('US'))) {
      overallRisk = 'CRITICAL';
    } else if (highRiskJurisdictions > 0 || howeyResult.isLikelySecurity) {
      overallRisk = 'HIGH';
    } else if (jurisdictionAnalysis.some(a => a.requirements.riskLevel === 'MEDIUM')) {
      overallRisk = 'MEDIUM';
    }

    report += `
| Risk Factor | Assessment |
|-------------|------------|
| Securities Risk | ${howeyResult.isLikelySecurity ? '🔴 HIGH' : '🟢 LOW'} |
| Regulatory Complexity | ${highRiskJurisdictions > 0 ? '🔴 HIGH' : '🟡 MEDIUM'} |
| Compliance Cost | ${totalMaxCost > 500000 ? '🔴 HIGH' : totalMaxCost > 200000 ? '🟡 MEDIUM' : '🟢 LOW'} |
| **OVERALL RISK** | ${overallRisk === 'CRITICAL' ? '🚨 CRITICAL' : overallRisk === 'HIGH' ? '🔴 HIGH' : overallRisk === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW'} |

${overallRisk === 'CRITICAL' ? `
### 🚨 CRITICAL RISK WARNING

This project has been identified as **CRITICAL RISK** due to:
${prohibitedJurisdictions > 0 ? '- Targeting prohibited jurisdictions\n' : ''}${howeyResult.isLikelySecurity && this.config.targetJurisdictions.includes('US') ? '- Likely security classification with US exposure\n' : ''}

**DO NOT PROCEED** without comprehensive legal review and restructuring.
` : ''}

---

## 8. Disclaimer

**THIS DOCUMENT IS NOT LEGAL ADVICE.**

This preliminary compliance analysis is provided for informational purposes only. It does not constitute legal advice and should not be relied upon as such. Laws and regulations vary by jurisdiction and change frequently.

**You must:**
1. Consult with qualified legal counsel in each jurisdiction where you intend to operate
2. Obtain formal legal opinions before launching any token or crypto-related product
3. Implement comprehensive compliance programs as advised by legal counsel

The authors of this document make no representations or warranties regarding the accuracy, completeness, or applicability of this analysis to your specific situation.

---

## Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Legal Counsel | _________________ | _________________ | ________ |
| Compliance Officer | _________________ | _________________ | ________ |
| Project Lead | _________________ | _________________ | ________ |
| CEO/Founder | _________________ | _________________ | ________ |

**Document Status:** ☐ DRAFT  ☐ UNDER REVIEW  ☐ APPROVED  ☐ REJECTED

---

*Generated by SecureMint Engine Legal Compliance Gate v1.1*
`;

    return report;
  }

  async run(): Promise<void> {
    try {
      await this.collectInput();

      console.log('\n\n⏳ Generating Legal Compliance Report...\n');

      const report = this.generateReport();

      // Check for file overwrites
      const outputPath = path.resolve(process.cwd(), 'LEGAL_COMPLIANCE_REPORT.md');
      const configPath = path.resolve(process.cwd(), 'legal-compliance-config.json');

      const canWriteReport = await this.confirmOverwrite(outputPath);
      const canWriteConfig = await this.confirmOverwrite(configPath);

      if (canWriteReport) {
        fs.writeFileSync(outputPath, report);
        console.log('✅ Report saved: LEGAL_COMPLIANCE_REPORT.md');
      } else {
        const altPath = path.resolve(process.cwd(), `LEGAL_COMPLIANCE_REPORT_${Date.now()}.md`);
        fs.writeFileSync(altPath, report);
        console.log(`✅ Report saved: ${path.basename(altPath)}`);
      }

      if (canWriteConfig) {
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        console.log('✅ Config saved: legal-compliance-config.json');
      } else {
        const altPath = path.resolve(process.cwd(), `legal-compliance-config_${Date.now()}.json`);
        fs.writeFileSync(altPath, JSON.stringify(this.config, null, 2));
        console.log(`✅ Config saved: ${path.basename(altPath)}`);
      }

      console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║              LEGAL COMPLIANCE REPORT GENERATED                               ║');
      console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
      console.log('║                                                                               ║');
      console.log('║  ⚠️  THIS IS NOT LEGAL ADVICE                                                 ║');
      console.log('║  ⚠️  CONSULT QUALIFIED LEGAL COUNSEL BEFORE PROCEEDING                        ║');
      console.log('║                                                                               ║');
      console.log('║  ℹ️  Add generated files to .gitignore to protect sensitive data              ║');
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
  const gate = new LegalComplianceGate();
  gate.run();
}

export { LegalComplianceGate, JURISDICTION_DATABASE, COMPLIANCE_CHECKLIST, escapeMarkdown, safeParseInt };
