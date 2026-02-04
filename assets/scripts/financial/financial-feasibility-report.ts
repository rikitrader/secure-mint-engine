#!/usr/bin/env npx ts-node
/**
 * SecureMint Engine - Financial Feasibility Report Generator
 *
 * MANDATORY GATE: This report MUST be generated and approved
 * BEFORE any implementation, coding, or deployment begins.
 *
 * Generates comprehensive financial analysis including:
 * - Development costs
 * - Infrastructure costs
 * - Service costs (APIs, oracles, audits)
 * - Token economics
 * - Revenue projections
 * - Profit & Loss statements
 * - Break-even analysis
 * - ROI calculations
 * - Risk-adjusted scenarios
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ============================================================================
// TYPES
// ============================================================================

interface FinancialInputs {
  // Project basics
  projectName: string;
  tokenSymbol: string;
  targetLaunchDate: string;

  // Token economics
  initialSupply: number;
  maxSupply: number;
  initialBacking: number;
  targetTVL: number[];  // [month6, month12, month24]

  // Team costs
  teamSize: {
    developers: number;
    security: number;
    operations: number;
    marketing: number;
    legal: number;
  };
  avgMonthlySalary: {
    developers: number;
    security: number;
    operations: number;
    marketing: number;
    legal: number;
  };

  // Development timeline
  developmentMonths: number;
  auditRounds: number;

  // Revenue assumptions
  mintFeePercent: number;
  burnFeePercent: number;
  yieldSharePercent: number;
  avgMonthlyVolume: number[];  // [month6, month12, month24]
  avgYieldRate: number;  // Annual yield on reserves

  // Infrastructure
  cloudProvider: 'AWS' | 'GCP' | 'AZURE';
  expectedTPS: number;

  // Chains
  targetChains: string[];

  // Funding
  fundingRaised: number;
  fundingRounds: {
    name: string;
    amount: number;
    valuation: number;
  }[];
}

interface CostBreakdown {
  category: string;
  item: string;
  oneTime: number;
  monthly: number;
  annual: number;
  notes: string;
}

interface RevenueProjection {
  month: number;
  tvl: number;
  volume: number;
  mintFees: number;
  burnFees: number;
  yieldRevenue: number;
  totalRevenue: number;
}

interface ProfitLoss {
  month: number;
  revenue: number;
  costs: number;
  netIncome: number;
  cumulative: number;
  runway: number;
}

// ============================================================================
// COST CONSTANTS (2024 Market Rates)
// ============================================================================

const COST_DATABASE = {
  // Smart Contract Development
  smartContractDev: {
    coreContracts: 50000,      // Core token + policy + oracle
    advancedFeatures: 30000,   // Bridge, governance, treasury
    testing: 15000,            // Unit, integration, invariant tests
    documentation: 5000,       // NatSpec, technical docs
  },

  // Security
  security: {
    auditTier1: 80000,         // Top-tier (Trail of Bits, OpenZeppelin)
    auditTier2: 40000,         // Mid-tier (Certik, Hacken)
    auditTier3: 20000,         // Budget (smaller firms)
    formalVerification: 50000, // Certora/Halmos
    bugBounty: 100000,         // Initial bug bounty pool
    bugBountyMonthly: 10000,   // Monthly bug bounty maintenance
    pentesting: 15000,         // Infrastructure pentest
  },

  // Infrastructure (Monthly)
  infrastructure: {
    rpcNodes: {
      basic: 500,              // Infura/Alchemy basic
      growth: 2000,            // Growth tier
      enterprise: 5000,        // Enterprise tier
    },
    database: {
      small: 100,              // PostgreSQL small
      medium: 500,             // PostgreSQL medium
      large: 2000,             // PostgreSQL large + replica
    },
    redis: {
      small: 50,
      medium: 200,
      large: 500,
    },
    kubernetes: {
      small: 500,              // 3-node cluster
      medium: 2000,            // 6-node cluster
      large: 5000,             // 12+ node cluster
    },
    cdn: 200,                  // CloudFront/Cloudflare
    monitoring: 500,           // Datadog/Grafana Cloud
    logging: 300,              // Log aggregation
    secrets: 100,              // Vault/AWS Secrets
  },

  // Third-party Services (Monthly)
  services: {
    chainlinkOracle: 1000,     // Chainlink node operation
    chainlinkPoR: 5000,        // Proof of Reserve feed
    theGraph: 500,             // Subgraph hosting
    tenderly: 500,             // Simulation service
    etherscan: 100,            // API access
    coingecko: 500,            // Price data API
    chainalysis: 2000,         // KYC/AML screening
    sentry: 100,               // Error tracking
    pagerduty: 200,            // Incident management
  },

  // Legal & Compliance
  legal: {
    corporateSetup: 20000,     // Entity formation
    tokenOpinion: 50000,       // Legal opinion on token
    regulatoryAdvice: 30000,   // Ongoing regulatory guidance
    termsOfService: 10000,     // T&S, Privacy Policy
    msbLicense: 50000,         // Money Services Business license
    monthlyCompliance: 5000,   // Ongoing compliance
  },

  // Marketing & Growth
  marketing: {
    brandIdentity: 15000,      // Logo, brand guidelines
    website: 20000,            // Marketing website
    documentation: 10000,      // User docs, guides
    launchCampaign: 50000,     // Launch marketing
    monthlyMarketing: 10000,   // Ongoing marketing
    communityManagement: 5000, // Discord/Telegram mods
  },

  // Deployment (per chain)
  deployment: {
    mainnetGas: 5000,          // Contract deployment gas
    verification: 500,         // Contract verification
    subgraph: 1000,            // Subgraph deployment
    liquiditySeeding: 100000,  // Initial liquidity
  },
};

// ============================================================================
// FINANCIAL CALCULATOR
// ============================================================================

class FinancialCalculator {
  private inputs: FinancialInputs;

  constructor(inputs: FinancialInputs) {
    this.inputs = inputs;
  }

  // Calculate all one-time costs
  calculateOneTimeCosts(): CostBreakdown[] {
    const costs: CostBreakdown[] = [];
    const db = COST_DATABASE;

    // Smart Contract Development
    costs.push({
      category: 'Development',
      item: 'Core Smart Contracts (Token, Policy, Oracle)',
      oneTime: db.smartContractDev.coreContracts,
      monthly: 0,
      annual: 0,
      notes: 'ERC-20 token, SecureMint policy, backing oracle integration',
    });

    costs.push({
      category: 'Development',
      item: 'Advanced Features (Bridge, Governance, Treasury)',
      oneTime: db.smartContractDev.advancedFeatures,
      monthly: 0,
      annual: 0,
      notes: 'Cross-chain bridge, DAO governance, multi-tier treasury',
    });

    costs.push({
      category: 'Development',
      item: 'Testing Suite (Unit, Integration, Invariant)',
      oneTime: db.smartContractDev.testing,
      monthly: 0,
      annual: 0,
      notes: 'Comprehensive test coverage with Foundry/Hardhat',
    });

    costs.push({
      category: 'Development',
      item: 'TypeScript SDK Development',
      oneTime: 25000,
      monthly: 0,
      annual: 0,
      notes: 'Full SDK with React hooks, mobile support',
    });

    costs.push({
      category: 'Development',
      item: 'API Gateway Development',
      oneTime: 20000,
      monthly: 0,
      annual: 0,
      notes: 'REST + GraphQL API with auth, rate limiting',
    });

    costs.push({
      category: 'Development',
      item: 'Dashboard/Frontend Development',
      oneTime: 30000,
      monthly: 0,
      annual: 0,
      notes: 'Admin dashboard, user interface',
    });

    costs.push({
      category: 'Development',
      item: 'Documentation',
      oneTime: db.smartContractDev.documentation,
      monthly: 0,
      annual: 0,
      notes: 'Technical docs, API docs, user guides',
    });

    // Security
    const auditCost = this.inputs.auditRounds >= 2
      ? db.security.auditTier1 + db.security.auditTier2 * (this.inputs.auditRounds - 1)
      : db.security.auditTier2 * this.inputs.auditRounds;

    costs.push({
      category: 'Security',
      item: `Smart Contract Audits (${this.inputs.auditRounds} rounds)`,
      oneTime: auditCost,
      monthly: 0,
      annual: 0,
      notes: 'Independent security audits before mainnet',
    });

    costs.push({
      category: 'Security',
      item: 'Formal Verification (Certora)',
      oneTime: db.security.formalVerification,
      monthly: 0,
      annual: 0,
      notes: 'Mathematical proof of invariants',
    });

    costs.push({
      category: 'Security',
      item: 'Bug Bounty Pool (Initial)',
      oneTime: db.security.bugBounty,
      monthly: 0,
      annual: 0,
      notes: 'Initial bug bounty program funding',
    });

    costs.push({
      category: 'Security',
      item: 'Infrastructure Pentest',
      oneTime: db.security.pentesting,
      monthly: 0,
      annual: 0,
      notes: 'API and infrastructure security testing',
    });

    // Legal
    costs.push({
      category: 'Legal & Compliance',
      item: 'Corporate Entity Setup',
      oneTime: db.legal.corporateSetup,
      monthly: 0,
      annual: 0,
      notes: 'Legal entity formation, corporate structure',
    });

    costs.push({
      category: 'Legal & Compliance',
      item: 'Token Legal Opinion',
      oneTime: db.legal.tokenOpinion,
      monthly: 0,
      annual: 0,
      notes: 'Legal opinion on token classification',
    });

    costs.push({
      category: 'Legal & Compliance',
      item: 'Regulatory Advisory',
      oneTime: db.legal.regulatoryAdvice,
      monthly: 0,
      annual: 0,
      notes: 'Regulatory compliance strategy',
    });

    costs.push({
      category: 'Legal & Compliance',
      item: 'Terms of Service & Privacy Policy',
      oneTime: db.legal.termsOfService,
      monthly: 0,
      annual: 0,
      notes: 'Legal documentation for users',
    });

    if (this.inputs.targetTVL[2] > 10000000) {
      costs.push({
        category: 'Legal & Compliance',
        item: 'MSB/MTL License',
        oneTime: db.legal.msbLicense,
        monthly: 0,
        annual: 0,
        notes: 'Money Services Business license (if required)',
      });
    }

    // Marketing
    costs.push({
      category: 'Marketing',
      item: 'Brand Identity & Design',
      oneTime: db.marketing.brandIdentity,
      monthly: 0,
      annual: 0,
      notes: 'Logo, brand guidelines, visual identity',
    });

    costs.push({
      category: 'Marketing',
      item: 'Marketing Website',
      oneTime: db.marketing.website,
      monthly: 0,
      annual: 0,
      notes: 'Public-facing marketing website',
    });

    costs.push({
      category: 'Marketing',
      item: 'Launch Campaign',
      oneTime: db.marketing.launchCampaign,
      monthly: 0,
      annual: 0,
      notes: 'Marketing campaign for mainnet launch',
    });

    // Deployment (per chain)
    for (const chain of this.inputs.targetChains) {
      costs.push({
        category: 'Deployment',
        item: `${chain} - Contract Deployment`,
        oneTime: db.deployment.mainnetGas,
        monthly: 0,
        annual: 0,
        notes: `Gas costs for deploying contracts on ${chain}`,
      });

      costs.push({
        category: 'Deployment',
        item: `${chain} - Initial Liquidity`,
        oneTime: db.deployment.liquiditySeeding,
        monthly: 0,
        annual: 0,
        notes: `Liquidity pool seeding on ${chain}`,
      });
    }

    // Contingency (15%)
    const subtotal = costs.reduce((sum, c) => sum + c.oneTime, 0);
    costs.push({
      category: 'Contingency',
      item: 'Contingency Reserve (15%)',
      oneTime: Math.round(subtotal * 0.15),
      monthly: 0,
      annual: 0,
      notes: 'Buffer for unexpected costs',
    });

    return costs;
  }

  // Calculate monthly operational costs
  calculateMonthlyCosts(): CostBreakdown[] {
    const costs: CostBreakdown[] = [];
    const db = COST_DATABASE;
    const inp = this.inputs;

    // Team salaries
    const teamCategories = ['developers', 'security', 'operations', 'marketing', 'legal'] as const;
    for (const cat of teamCategories) {
      if (inp.teamSize[cat] > 0) {
        const monthly = inp.teamSize[cat] * inp.avgMonthlySalary[cat];
        costs.push({
          category: 'Team',
          item: `${cat.charAt(0).toUpperCase() + cat.slice(1)} (${inp.teamSize[cat]} FTE)`,
          oneTime: 0,
          monthly,
          annual: monthly * 12,
          notes: `${inp.teamSize[cat]} x $${inp.avgMonthlySalary[cat].toLocaleString()}/month`,
        });
      }
    }

    // Infrastructure
    const infraTier = inp.expectedTPS > 100 ? 'large' : inp.expectedTPS > 20 ? 'medium' : 'small';

    costs.push({
      category: 'Infrastructure',
      item: `RPC Nodes (${infraTier})`,
      oneTime: 0,
      monthly: db.infrastructure.rpcNodes[infraTier as keyof typeof db.infrastructure.rpcNodes] * inp.targetChains.length,
      annual: db.infrastructure.rpcNodes[infraTier as keyof typeof db.infrastructure.rpcNodes] * inp.targetChains.length * 12,
      notes: `${inp.targetChains.length} chains x ${infraTier} tier`,
    });

    costs.push({
      category: 'Infrastructure',
      item: `Database (PostgreSQL ${infraTier})`,
      oneTime: 0,
      monthly: db.infrastructure.database[infraTier as keyof typeof db.infrastructure.database],
      annual: db.infrastructure.database[infraTier as keyof typeof db.infrastructure.database] * 12,
      notes: 'Primary + replica for high availability',
    });

    costs.push({
      category: 'Infrastructure',
      item: `Redis Cache (${infraTier})`,
      oneTime: 0,
      monthly: db.infrastructure.redis[infraTier as keyof typeof db.infrastructure.redis],
      annual: db.infrastructure.redis[infraTier as keyof typeof db.infrastructure.redis] * 12,
      notes: 'Session cache, rate limiting',
    });

    costs.push({
      category: 'Infrastructure',
      item: `Kubernetes Cluster (${infraTier})`,
      oneTime: 0,
      monthly: db.infrastructure.kubernetes[infraTier as keyof typeof db.infrastructure.kubernetes],
      annual: db.infrastructure.kubernetes[infraTier as keyof typeof db.infrastructure.kubernetes] * 12,
      notes: `${inp.cloudProvider} managed Kubernetes`,
    });

    costs.push({
      category: 'Infrastructure',
      item: 'CDN & WAF',
      oneTime: 0,
      monthly: db.infrastructure.cdn,
      annual: db.infrastructure.cdn * 12,
      notes: 'Content delivery and web application firewall',
    });

    costs.push({
      category: 'Infrastructure',
      item: 'Monitoring & Alerting',
      oneTime: 0,
      monthly: db.infrastructure.monitoring,
      annual: db.infrastructure.monitoring * 12,
      notes: 'Prometheus, Grafana, alerting',
    });

    // Services
    costs.push({
      category: 'Services',
      item: 'Chainlink Oracle',
      oneTime: 0,
      monthly: db.services.chainlinkOracle,
      annual: db.services.chainlinkOracle * 12,
      notes: 'Oracle node operation costs',
    });

    if (inp.initialBacking > 1000000) {
      costs.push({
        category: 'Services',
        item: 'Chainlink Proof of Reserve',
        oneTime: 0,
        monthly: db.services.chainlinkPoR,
        annual: db.services.chainlinkPoR * 12,
        notes: 'PoR feed for off-chain reserves',
      });
    }

    costs.push({
      category: 'Services',
      item: 'The Graph (Subgraph)',
      oneTime: 0,
      monthly: db.services.theGraph * inp.targetChains.length,
      annual: db.services.theGraph * inp.targetChains.length * 12,
      notes: `${inp.targetChains.length} subgraphs`,
    });

    costs.push({
      category: 'Services',
      item: 'Tenderly Simulation',
      oneTime: 0,
      monthly: db.services.tenderly,
      annual: db.services.tenderly * 12,
      notes: 'Transaction simulation service',
    });

    costs.push({
      category: 'Services',
      item: 'KYC/AML Screening (Chainalysis)',
      oneTime: 0,
      monthly: db.services.chainalysis,
      annual: db.services.chainalysis * 12,
      notes: 'Compliance screening service',
    });

    // Bug bounty maintenance
    costs.push({
      category: 'Security',
      item: 'Bug Bounty Program (Monthly)',
      oneTime: 0,
      monthly: db.security.bugBountyMonthly,
      annual: db.security.bugBountyMonthly * 12,
      notes: 'Ongoing bug bounty pool replenishment',
    });

    // Legal compliance
    costs.push({
      category: 'Legal',
      item: 'Ongoing Compliance',
      oneTime: 0,
      monthly: db.legal.monthlyCompliance,
      annual: db.legal.monthlyCompliance * 12,
      notes: 'Regulatory compliance, legal counsel',
    });

    // Marketing
    costs.push({
      category: 'Marketing',
      item: 'Marketing & Growth',
      oneTime: 0,
      monthly: db.marketing.monthlyMarketing,
      annual: db.marketing.monthlyMarketing * 12,
      notes: 'Content, ads, partnerships',
    });

    costs.push({
      category: 'Marketing',
      item: 'Community Management',
      oneTime: 0,
      monthly: db.marketing.communityManagement,
      annual: db.marketing.communityManagement * 12,
      notes: 'Discord/Telegram moderation',
    });

    return costs;
  }

  // Calculate revenue projections
  calculateRevenueProjections(): RevenueProjection[] {
    const projections: RevenueProjection[] = [];
    const inp = this.inputs;

    for (let month = 1; month <= 24; month++) {
      // Interpolate TVL and volume based on milestones
      let tvl: number;
      let volume: number;

      if (month <= 6) {
        tvl = inp.targetTVL[0] * (month / 6);
        volume = inp.avgMonthlyVolume[0] * (month / 6);
      } else if (month <= 12) {
        const progress = (month - 6) / 6;
        tvl = inp.targetTVL[0] + (inp.targetTVL[1] - inp.targetTVL[0]) * progress;
        volume = inp.avgMonthlyVolume[0] + (inp.avgMonthlyVolume[1] - inp.avgMonthlyVolume[0]) * progress;
      } else {
        const progress = (month - 12) / 12;
        tvl = inp.targetTVL[1] + (inp.targetTVL[2] - inp.targetTVL[1]) * progress;
        volume = inp.avgMonthlyVolume[1] + (inp.avgMonthlyVolume[2] - inp.avgMonthlyVolume[1]) * progress;
      }

      // Calculate fees
      const mintFees = volume * 0.5 * (inp.mintFeePercent / 100);  // 50% of volume is mints
      const burnFees = volume * 0.5 * (inp.burnFeePercent / 100);  // 50% of volume is burns
      const yieldRevenue = tvl * (inp.avgYieldRate / 100) * (inp.yieldSharePercent / 100) / 12;

      projections.push({
        month,
        tvl: Math.round(tvl),
        volume: Math.round(volume),
        mintFees: Math.round(mintFees),
        burnFees: Math.round(burnFees),
        yieldRevenue: Math.round(yieldRevenue),
        totalRevenue: Math.round(mintFees + burnFees + yieldRevenue),
      });
    }

    return projections;
  }

  // Calculate P&L
  calculateProfitLoss(oneTimeCosts: CostBreakdown[], monthlyCosts: CostBreakdown[], revenue: RevenueProjection[]): ProfitLoss[] {
    const pnl: ProfitLoss[] = [];
    const totalOneTime = oneTimeCosts.reduce((sum, c) => sum + c.oneTime, 0);
    const totalMonthly = monthlyCosts.reduce((sum, c) => sum + c.monthly, 0);

    let cumulative = -totalOneTime;  // Start with one-time costs as negative
    const cashOnHand = this.inputs.fundingRaised;

    for (let month = 1; month <= 24; month++) {
      const rev = revenue.find(r => r.month === month)!;
      const costs = totalMonthly;
      const netIncome = rev.totalRevenue - costs;
      cumulative += netIncome;

      const runway = cumulative < 0
        ? Math.max(0, Math.floor((cashOnHand + cumulative) / totalMonthly))
        : 999;  // Profitable

      pnl.push({
        month,
        revenue: rev.totalRevenue,
        costs,
        netIncome,
        cumulative,
        runway,
      });
    }

    return pnl;
  }

  // Calculate break-even
  calculateBreakEven(pnl: ProfitLoss[]): { month: number | null; requiresTVL: number; requiresVolume: number } {
    const breakEvenMonth = pnl.find(p => p.cumulative >= 0)?.month || null;

    const monthlyFixed = pnl[0].costs;
    const inp = this.inputs;

    // Calculate required TVL for break-even (assuming current fee structure)
    const feeRate = (inp.mintFeePercent + inp.burnFeePercent) / 200;  // Average fee on volume
    const yieldContrib = inp.avgYieldRate * inp.yieldSharePercent / 10000 / 12;

    // Monthly revenue = volume * feeRate + tvl * yieldContrib
    // Assuming volume = tvl * 0.2 (20% monthly turnover)
    const turnover = 0.2;
    const requiresTVL = monthlyFixed / (turnover * feeRate + yieldContrib);
    const requiresVolume = requiresTVL * turnover;

    return {
      month: breakEvenMonth,
      requiresTVL: Math.round(requiresTVL),
      requiresVolume: Math.round(requiresVolume),
    };
  }

  // Calculate ROI scenarios
  calculateROI(): { conservative: number; base: number; optimistic: number } {
    const totalInvestment = this.inputs.fundingRaised;
    const pnl = this.calculateProfitLoss(
      this.calculateOneTimeCosts(),
      this.calculateMonthlyCosts(),
      this.calculateRevenueProjections()
    );

    const year2Net = pnl.slice(12, 24).reduce((sum, p) => sum + p.netIncome, 0);

    return {
      conservative: Math.round((year2Net * 0.5 / totalInvestment) * 100),
      base: Math.round((year2Net / totalInvestment) * 100),
      optimistic: Math.round((year2Net * 1.5 / totalInvestment) * 100),
    };
  }
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateFinancialReport(inputs: FinancialInputs): string {
  const calc = new FinancialCalculator(inputs);
  const oneTimeCosts = calc.calculateOneTimeCosts();
  const monthlyCosts = calc.calculateMonthlyCosts();
  const revenue = calc.calculateRevenueProjections();
  const pnl = calc.calculateProfitLoss(oneTimeCosts, monthlyCosts, revenue);
  const breakEven = calc.calculateBreakEven(pnl);
  const roi = calc.calculateROI();

  const totalOneTime = oneTimeCosts.reduce((sum, c) => sum + c.oneTime, 0);
  const totalMonthly = monthlyCosts.reduce((sum, c) => sum + c.monthly, 0);
  const totalAnnual = monthlyCosts.reduce((sum, c) => sum + c.annual, 0);
  const totalYear1 = totalOneTime + totalAnnual;

  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
  const formatPercent = (n: number) => `${n.toFixed(1)}%`;

  return `# Financial Feasibility Report
## ${inputs.projectName} (${inputs.tokenSymbol})

Generated: ${new Date().toISOString().split('T')[0]}
Status: **PENDING APPROVAL**

---

## EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Total Startup Costs** | ${formatCurrency(totalOneTime)} |
| **Monthly Operating Costs** | ${formatCurrency(totalMonthly)} |
| **Year 1 Total Costs** | ${formatCurrency(totalYear1)} |
| **Funding Required** | ${formatCurrency(Math.max(totalYear1 * 1.2, inputs.fundingRaised))} |
| **Break-Even Month** | ${breakEven.month ? `Month ${breakEven.month}` : 'Not achieved in 24 months'} |
| **Required TVL for Break-Even** | ${formatCurrency(breakEven.requiresTVL)} |
| **Year 2 ROI (Base Case)** | ${formatPercent(roi.base)} |

### APPROVAL GATE

\`\`\`
[ ] Financial projections reviewed
[ ] Funding secured: ${formatCurrency(inputs.fundingRaised)}
[ ] Runway verified: ${Math.floor(inputs.fundingRaised / totalMonthly)} months
[ ] Break-even plan validated
[ ] Risk scenarios acceptable
[ ] Stakeholder approval obtained

APPROVED BY: _______________________  DATE: ___________
\`\`\`

---

## 1. STARTUP COSTS (One-Time)

### 1.1 Development Costs

| Item | Cost | Notes |
|------|------|-------|
${oneTimeCosts.filter(c => c.category === 'Development').map(c =>
  `| ${c.item} | ${formatCurrency(c.oneTime)} | ${c.notes} |`
).join('\n')}
| **Subtotal** | **${formatCurrency(oneTimeCosts.filter(c => c.category === 'Development').reduce((s, c) => s + c.oneTime, 0))}** | |

### 1.2 Security Costs

| Item | Cost | Notes |
|------|------|-------|
${oneTimeCosts.filter(c => c.category === 'Security').map(c =>
  `| ${c.item} | ${formatCurrency(c.oneTime)} | ${c.notes} |`
).join('\n')}
| **Subtotal** | **${formatCurrency(oneTimeCosts.filter(c => c.category === 'Security').reduce((s, c) => s + c.oneTime, 0))}** | |

### 1.3 Legal & Compliance Costs

| Item | Cost | Notes |
|------|------|-------|
${oneTimeCosts.filter(c => c.category === 'Legal & Compliance').map(c =>
  `| ${c.item} | ${formatCurrency(c.oneTime)} | ${c.notes} |`
).join('\n')}
| **Subtotal** | **${formatCurrency(oneTimeCosts.filter(c => c.category === 'Legal & Compliance').reduce((s, c) => s + c.oneTime, 0))}** | |

### 1.4 Marketing Costs

| Item | Cost | Notes |
|------|------|-------|
${oneTimeCosts.filter(c => c.category === 'Marketing').map(c =>
  `| ${c.item} | ${formatCurrency(c.oneTime)} | ${c.notes} |`
).join('\n')}
| **Subtotal** | **${formatCurrency(oneTimeCosts.filter(c => c.category === 'Marketing').reduce((s, c) => s + c.oneTime, 0))}** | |

### 1.5 Deployment Costs

| Item | Cost | Notes |
|------|------|-------|
${oneTimeCosts.filter(c => c.category === 'Deployment').map(c =>
  `| ${c.item} | ${formatCurrency(c.oneTime)} | ${c.notes} |`
).join('\n')}
| **Subtotal** | **${formatCurrency(oneTimeCosts.filter(c => c.category === 'Deployment').reduce((s, c) => s + c.oneTime, 0))}** | |

### 1.6 Contingency

| Item | Cost | Notes |
|------|------|-------|
${oneTimeCosts.filter(c => c.category === 'Contingency').map(c =>
  `| ${c.item} | ${formatCurrency(c.oneTime)} | ${c.notes} |`
).join('\n')}

### TOTAL STARTUP COSTS: ${formatCurrency(totalOneTime)}

---

## 2. MONTHLY OPERATING COSTS

### 2.1 Team Costs

| Role | Headcount | Monthly | Annual |
|------|-----------|---------|--------|
${monthlyCosts.filter(c => c.category === 'Team').map(c =>
  `| ${c.item} | ${c.notes.split('x')[0].trim()} | ${formatCurrency(c.monthly)} | ${formatCurrency(c.annual)} |`
).join('\n')}
| **Team Total** | | **${formatCurrency(monthlyCosts.filter(c => c.category === 'Team').reduce((s, c) => s + c.monthly, 0))}** | **${formatCurrency(monthlyCosts.filter(c => c.category === 'Team').reduce((s, c) => s + c.annual, 0))}** |

### 2.2 Infrastructure Costs

| Item | Monthly | Annual | Notes |
|------|---------|--------|-------|
${monthlyCosts.filter(c => c.category === 'Infrastructure').map(c =>
  `| ${c.item} | ${formatCurrency(c.monthly)} | ${formatCurrency(c.annual)} | ${c.notes} |`
).join('\n')}
| **Infrastructure Total** | **${formatCurrency(monthlyCosts.filter(c => c.category === 'Infrastructure').reduce((s, c) => s + c.monthly, 0))}** | **${formatCurrency(monthlyCosts.filter(c => c.category === 'Infrastructure').reduce((s, c) => s + c.annual, 0))}** | |

### 2.3 Third-Party Services

| Service | Monthly | Annual | Notes |
|---------|---------|--------|-------|
${monthlyCosts.filter(c => c.category === 'Services').map(c =>
  `| ${c.item} | ${formatCurrency(c.monthly)} | ${formatCurrency(c.annual)} | ${c.notes} |`
).join('\n')}
| **Services Total** | **${formatCurrency(monthlyCosts.filter(c => c.category === 'Services').reduce((s, c) => s + c.monthly, 0))}** | **${formatCurrency(monthlyCosts.filter(c => c.category === 'Services').reduce((s, c) => s + c.annual, 0))}** | |

### 2.4 Other Monthly Costs

| Item | Monthly | Annual | Notes |
|------|---------|--------|-------|
${monthlyCosts.filter(c => !['Team', 'Infrastructure', 'Services'].includes(c.category)).map(c =>
  `| ${c.item} | ${formatCurrency(c.monthly)} | ${formatCurrency(c.annual)} | ${c.notes} |`
).join('\n')}

### TOTAL MONTHLY OPERATING: ${formatCurrency(totalMonthly)}
### TOTAL ANNUAL OPERATING: ${formatCurrency(totalAnnual)}

---

## 3. REVENUE PROJECTIONS

### 3.1 Revenue Model

| Revenue Stream | Rate | Description |
|----------------|------|-------------|
| Mint Fees | ${formatPercent(inputs.mintFeePercent)} | Fee on token minting |
| Burn Fees | ${formatPercent(inputs.burnFeePercent)} | Fee on token burning/redemption |
| Yield Share | ${formatPercent(inputs.yieldSharePercent)} | Share of reserve yield (${formatPercent(inputs.avgYieldRate)} APY) |

### 3.2 Monthly Revenue Projections

| Month | TVL | Volume | Mint Fees | Burn Fees | Yield | Total Revenue |
|-------|-----|--------|-----------|-----------|-------|---------------|
${revenue.filter((_, i) => i % 3 === 0 || i === revenue.length - 1).map(r =>
  `| ${r.month} | ${formatCurrency(r.tvl)} | ${formatCurrency(r.volume)} | ${formatCurrency(r.mintFees)} | ${formatCurrency(r.burnFees)} | ${formatCurrency(r.yieldRevenue)} | ${formatCurrency(r.totalRevenue)} |`
).join('\n')}

### 3.3 Annual Revenue Summary

| Year | Projected TVL | Projected Volume | Total Revenue |
|------|---------------|------------------|---------------|
| Year 1 | ${formatCurrency(inputs.targetTVL[1])} | ${formatCurrency(inputs.avgMonthlyVolume[1] * 12)} | ${formatCurrency(revenue.slice(0, 12).reduce((s, r) => s + r.totalRevenue, 0))} |
| Year 2 | ${formatCurrency(inputs.targetTVL[2])} | ${formatCurrency(inputs.avgMonthlyVolume[2] * 12)} | ${formatCurrency(revenue.slice(12, 24).reduce((s, r) => s + r.totalRevenue, 0))} |

---

## 4. PROFIT & LOSS STATEMENT

### 4.1 Monthly P&L

| Month | Revenue | Costs | Net Income | Cumulative | Runway |
|-------|---------|-------|------------|------------|--------|
${pnl.filter((_, i) => i % 3 === 0 || i === pnl.length - 1).map(p =>
  `| ${p.month} | ${formatCurrency(p.revenue)} | ${formatCurrency(p.costs)} | ${formatCurrency(p.netIncome)} | ${formatCurrency(p.cumulative)} | ${p.runway === 999 ? 'Profitable' : `${p.runway} months`} |`
).join('\n')}

### 4.2 Annual P&L Summary

| Metric | Year 1 | Year 2 |
|--------|--------|--------|
| Revenue | ${formatCurrency(pnl.slice(0, 12).reduce((s, p) => s + p.revenue, 0))} | ${formatCurrency(pnl.slice(12, 24).reduce((s, p) => s + p.revenue, 0))} |
| Operating Costs | ${formatCurrency(pnl.slice(0, 12).reduce((s, p) => s + p.costs, 0))} | ${formatCurrency(pnl.slice(12, 24).reduce((s, p) => s + p.costs, 0))} |
| One-Time Costs | ${formatCurrency(totalOneTime)} | $0 |
| **Net Income** | **${formatCurrency(pnl.slice(0, 12).reduce((s, p) => s + p.revenue, 0) - pnl.slice(0, 12).reduce((s, p) => s + p.costs, 0) - totalOneTime)}** | **${formatCurrency(pnl.slice(12, 24).reduce((s, p) => s + p.netIncome, 0))}** |

---

## 5. BREAK-EVEN ANALYSIS

### 5.1 Break-Even Point

| Metric | Value |
|--------|-------|
| Break-Even Month | ${breakEven.month ? `Month ${breakEven.month}` : 'Not achieved in 24 months'} |
| Required TVL | ${formatCurrency(breakEven.requiresTVL)} |
| Required Monthly Volume | ${formatCurrency(breakEven.requiresVolume)} |
| Monthly Fixed Costs | ${formatCurrency(totalMonthly)} |

### 5.2 Sensitivity Analysis

| Scenario | TVL Required | Volume Required | Break-Even |
|----------|--------------|-----------------|------------|
| Base (current fees) | ${formatCurrency(breakEven.requiresTVL)} | ${formatCurrency(breakEven.requiresVolume)} | Month ${breakEven.month || 'N/A'} |
| Higher fees (+50%) | ${formatCurrency(Math.round(breakEven.requiresTVL * 0.67))} | ${formatCurrency(Math.round(breakEven.requiresVolume * 0.67))} | Earlier |
| Lower costs (-20%) | ${formatCurrency(Math.round(breakEven.requiresTVL * 0.8))} | ${formatCurrency(Math.round(breakEven.requiresVolume * 0.8))} | Earlier |
| Lower TVL (-30%) | ${formatCurrency(Math.round(breakEven.requiresTVL))} | ${formatCurrency(breakEven.requiresVolume)} | Later |

---

## 6. INVESTMENT & ROI

### 6.1 Funding Requirements

| Round | Amount | Use of Funds |
|-------|--------|--------------|
${inputs.fundingRounds.map(r =>
  `| ${r.name} | ${formatCurrency(r.amount)} | Development, security, operations |`
).join('\n')}
| **Total** | **${formatCurrency(inputs.fundingRaised)}** | |

### 6.2 Use of Funds Breakdown

| Category | Amount | Percentage |
|----------|--------|------------|
| Development | ${formatCurrency(oneTimeCosts.filter(c => c.category === 'Development').reduce((s, c) => s + c.oneTime, 0))} | ${formatPercent(oneTimeCosts.filter(c => c.category === 'Development').reduce((s, c) => s + c.oneTime, 0) / totalOneTime * 100)} |
| Security | ${formatCurrency(oneTimeCosts.filter(c => c.category === 'Security').reduce((s, c) => s + c.oneTime, 0))} | ${formatPercent(oneTimeCosts.filter(c => c.category === 'Security').reduce((s, c) => s + c.oneTime, 0) / totalOneTime * 100)} |
| Legal | ${formatCurrency(oneTimeCosts.filter(c => c.category === 'Legal & Compliance').reduce((s, c) => s + c.oneTime, 0))} | ${formatPercent(oneTimeCosts.filter(c => c.category === 'Legal & Compliance').reduce((s, c) => s + c.oneTime, 0) / totalOneTime * 100)} |
| Marketing | ${formatCurrency(oneTimeCosts.filter(c => c.category === 'Marketing').reduce((s, c) => s + c.oneTime, 0))} | ${formatPercent(oneTimeCosts.filter(c => c.category === 'Marketing').reduce((s, c) => s + c.oneTime, 0) / totalOneTime * 100)} |
| Deployment | ${formatCurrency(oneTimeCosts.filter(c => c.category === 'Deployment').reduce((s, c) => s + c.oneTime, 0))} | ${formatPercent(oneTimeCosts.filter(c => c.category === 'Deployment').reduce((s, c) => s + c.oneTime, 0) / totalOneTime * 100)} |
| Operating Reserve | ${formatCurrency(Math.round(inputs.fundingRaised - totalOneTime))} | ${formatPercent((inputs.fundingRaised - totalOneTime) / inputs.fundingRaised * 100)} |

### 6.3 ROI Projections (Year 2)

| Scenario | ROI | Notes |
|----------|-----|-------|
| Conservative (-50%) | ${formatPercent(roi.conservative)} | Slower growth, higher costs |
| Base Case | ${formatPercent(roi.base)} | Current projections |
| Optimistic (+50%) | ${formatPercent(roi.optimistic)} | Faster growth, partnerships |

---

## 7. RISK ANALYSIS

### 7.1 Financial Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| TVL growth below projections | Medium | High | Conservative projections, multiple growth channels |
| Higher than expected costs | Medium | Medium | 15% contingency buffer |
| Audit delays | Medium | Medium | Start audits early, multiple auditor relationships |
| Regulatory changes | Low | High | Legal counsel, compliance buffer |
| Security incident | Low | Critical | Bug bounty, insurance consideration |
| Oracle costs increase | Low | Low | Multi-oracle strategy |

### 7.2 Cash Flow Risks

| Scenario | Impact | Runway Change |
|----------|--------|---------------|
| 30% revenue shortfall | ${formatCurrency(-pnl[11].revenue * 0.3 * 12)} | -${Math.floor(pnl[11].revenue * 0.3 * 12 / totalMonthly)} months |
| 20% cost overrun | ${formatCurrency(-totalAnnual * 0.2)} | -${Math.floor(totalAnnual * 0.2 / totalMonthly)} months |
| Both combined | ${formatCurrency(-pnl[11].revenue * 0.3 * 12 - totalAnnual * 0.2)} | Critical |

---

## 8. RECOMMENDATIONS

### 8.1 Go/No-Go Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Funding >= ${formatCurrency(totalYear1 * 1.2)} | ${inputs.fundingRaised >= totalYear1 * 1.2 ? '✅ PASS' : '❌ FAIL'} | Minimum 12 months runway |
| Break-even < 24 months | ${breakEven.month && breakEven.month <= 24 ? '✅ PASS' : '⚠️ REVIEW'} | Target: 18 months |
| ROI > 0% (Year 2) | ${roi.base > 0 ? '✅ PASS' : '❌ FAIL'} | Minimum positive ROI |
| Contingency > 10% | ✅ PASS | 15% included |

### 8.2 Recommendation

${inputs.fundingRaised >= totalYear1 * 1.2 && roi.base > 0
  ? `**PROCEED** - Financial projections support implementation. Ensure all approval checkboxes are signed before beginning development.`
  : `**CAUTION** - Review funding requirements and projections before proceeding. Consider additional funding or cost reductions.`}

---

## APPROVAL SIGNATURES

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CEO/Founder | | | |
| CFO/Finance Lead | | | |
| Technical Lead | | | |
| Legal Counsel | | | |
| Lead Investor | | | |

---

*This report was generated by SecureMint Engine Financial Analysis Tool.*
*All projections are estimates based on provided inputs and market assumptions.*
*Actual results may vary significantly from projections.*
`;
}

// ============================================================================
// INTERACTIVE CLI
// ============================================================================

async function runInteractiveCLI(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  };

  console.log('\n' + '═'.repeat(70));
  console.log('  SecureMint Engine - Financial Feasibility Report Generator');
  console.log('═'.repeat(70));
  console.log('\nThis tool generates a comprehensive financial analysis that must be');
  console.log('approved BEFORE any implementation begins.\n');

  // Collect inputs
  const inputs: FinancialInputs = {
    projectName: await prompt('Project Name: ') || 'SecureMint Token',
    tokenSymbol: await prompt('Token Symbol: ') || 'SMT',
    targetLaunchDate: await prompt('Target Launch Date (YYYY-MM): ') || '2025-06',

    initialSupply: parseInt(await prompt('Initial Token Supply [1000000]: ') || '1000000'),
    maxSupply: parseInt(await prompt('Max Token Supply [1000000000]: ') || '1000000000'),
    initialBacking: parseInt(await prompt('Initial Backing ($) [1000000]: ') || '1000000'),
    targetTVL: [
      parseInt(await prompt('Target TVL Month 6 ($) [5000000]: ') || '5000000'),
      parseInt(await prompt('Target TVL Month 12 ($) [20000000]: ') || '20000000'),
      parseInt(await prompt('Target TVL Month 24 ($) [100000000]: ') || '100000000'),
    ],

    teamSize: {
      developers: parseInt(await prompt('Team Size - Developers [3]: ') || '3'),
      security: parseInt(await prompt('Team Size - Security [1]: ') || '1'),
      operations: parseInt(await prompt('Team Size - Operations [2]: ') || '2'),
      marketing: parseInt(await prompt('Team Size - Marketing [2]: ') || '2'),
      legal: parseInt(await prompt('Team Size - Legal/Compliance [1]: ') || '1'),
    },
    avgMonthlySalary: {
      developers: parseInt(await prompt('Avg Salary - Developers ($/month) [12000]: ') || '12000'),
      security: parseInt(await prompt('Avg Salary - Security ($/month) [15000]: ') || '15000'),
      operations: parseInt(await prompt('Avg Salary - Operations ($/month) [8000]: ') || '8000'),
      marketing: parseInt(await prompt('Avg Salary - Marketing ($/month) [8000]: ') || '8000'),
      legal: parseInt(await prompt('Avg Salary - Legal ($/month) [15000]: ') || '15000'),
    },

    developmentMonths: parseInt(await prompt('Development Timeline (months) [6]: ') || '6'),
    auditRounds: parseInt(await prompt('Security Audit Rounds [2]: ') || '2'),

    mintFeePercent: parseFloat(await prompt('Mint Fee (%) [0.1]: ') || '0.1'),
    burnFeePercent: parseFloat(await prompt('Burn Fee (%) [0.1]: ') || '0.1'),
    yieldSharePercent: parseFloat(await prompt('Yield Share (%) [30]: ') || '30'),
    avgMonthlyVolume: [
      parseInt(await prompt('Avg Monthly Volume Month 6 ($) [10000000]: ') || '10000000'),
      parseInt(await prompt('Avg Monthly Volume Month 12 ($) [50000000]: ') || '50000000'),
      parseInt(await prompt('Avg Monthly Volume Month 24 ($) [200000000]: ') || '200000000'),
    ],
    avgYieldRate: parseFloat(await prompt('Avg Annual Yield on Reserves (%) [4]: ') || '4'),

    cloudProvider: (await prompt('Cloud Provider (AWS/GCP/AZURE) [AWS]: ') || 'AWS') as 'AWS' | 'GCP' | 'AZURE',
    expectedTPS: parseInt(await prompt('Expected Transactions Per Second [50]: ') || '50'),

    targetChains: (await prompt('Target Chains (comma-separated) [Ethereum,Polygon]: ') || 'Ethereum,Polygon').split(',').map(s => s.trim()),

    fundingRaised: parseInt(await prompt('Total Funding Raised ($) [2000000]: ') || '2000000'),
    fundingRounds: [
      {
        name: 'Seed',
        amount: parseInt(await prompt('Seed Round Amount ($) [500000]: ') || '500000'),
        valuation: parseInt(await prompt('Seed Valuation ($) [5000000]: ') || '5000000'),
      },
      {
        name: 'Series A',
        amount: parseInt(await prompt('Series A Amount ($) [1500000]: ') || '1500000'),
        valuation: parseInt(await prompt('Series A Valuation ($) [15000000]: ') || '15000000'),
      },
    ],
  };

  rl.close();

  console.log('\n' + '═'.repeat(70));
  console.log('  Generating Financial Feasibility Report...');
  console.log('═'.repeat(70) + '\n');

  const report = generateFinancialReport(inputs);

  // Save report
  const outputPath = path.join(process.cwd(), 'FINANCIAL_FEASIBILITY_REPORT.md');
  fs.writeFileSync(outputPath, report);
  console.log(`✅ Report saved to: ${outputPath}`);

  // Also save inputs for reproducibility
  const inputsPath = path.join(process.cwd(), 'financial-inputs.json');
  fs.writeFileSync(inputsPath, JSON.stringify(inputs, null, 2));
  console.log(`✅ Inputs saved to: ${inputsPath}`);

  console.log('\n' + '═'.repeat(70));
  console.log('  IMPORTANT: Review and approve the report before implementation');
  console.log('═'.repeat(70) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
SecureMint Engine - Financial Feasibility Report Generator

Usage:
  npx ts-node financial-feasibility-report.ts [options]

Options:
  --help, -h          Show this help message
  --config FILE       Load inputs from JSON file
  --output FILE       Output file path (default: FINANCIAL_FEASIBILITY_REPORT.md)

Examples:
  npx ts-node financial-feasibility-report.ts
  npx ts-node financial-feasibility-report.ts --config inputs.json
`);
  process.exit(0);
}

if (args.includes('--config')) {
  const configIndex = args.indexOf('--config');
  const configPath = args[configIndex + 1];

  if (!configPath || !fs.existsSync(configPath)) {
    console.error('Error: Config file not found');
    process.exit(1);
  }

  const inputs = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FinancialInputs;
  const report = generateFinancialReport(inputs);

  const outputPath = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : 'FINANCIAL_FEASIBILITY_REPORT.md';

  fs.writeFileSync(outputPath, report);
  console.log(`✅ Report saved to: ${outputPath}`);
} else {
  runInteractiveCLI().catch(console.error);
}
