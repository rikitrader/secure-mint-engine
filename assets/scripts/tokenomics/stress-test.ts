#!/usr/bin/env npx ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SecureMint Engine - Tokenomics Stress Test
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * MANDATORY GATE: Simulates economic attacks and stress scenarios
 *
 * This tool stress tests your token economics against:
 * - Bank run scenarios
 * - Oracle manipulation attacks
 * - Whale dump simulations
 * - Liquidity crisis modeling
 * - Death spiral analysis
 * - Flash loan attack vectors
 *
 * Usage: npx ts-node scripts/tokenomics/stress-test.ts
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
 * Safe division that returns 0 when divisor is 0
 */
function safeDivide(numerator: number, divisor: number, defaultValue: number = 0): number {
  if (divisor === 0 || isNaN(divisor)) return defaultValue;
  const result = numerator / divisor;
  return isNaN(result) ? defaultValue : result;
}

/**
 * Safely parses float with NaN protection
 */
function safeParseFloat(value: string, defaultValue: number = 0): number {
  const cleaned = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════════

interface TokenomicsConfig {
  // Token Basics
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number;
  circulatingSupply: number;
  tokenPrice: number;

  // Backing/Collateral
  backingType: 'FIAT' | 'CRYPTO' | 'MIXED' | 'ALGORITHMIC' | 'NONE';
  totalBacking: number;
  backingRatio: number; // e.g., 1.0 = 100%, 1.5 = 150%
  liquidReserves: number; // % immediately available
  reserveComposition: { asset: string; percentage: number; volatility: number }[];

  // Liquidity
  dexLiquidity: number;
  cexLiquidity: number;
  liquidityConcentration: number; // % in top pool

  // Holders
  totalHolders: number;
  top10HoldersPercent: number;
  top50HoldersPercent: number;
  teamTokensPercent: number;
  teamTokensLocked: boolean;
  vestingDuration: number; // months

  // Mechanisms
  hasMintFunction: boolean;
  hasBurnFunction: boolean;
  hasRedemption: boolean;
  redemptionFee: number;
  mintingCap: number;
  epochMintCap: number;

  // Oracle
  oracleType: 'CHAINLINK' | 'BAND' | 'CUSTOM' | 'NONE';
  oracleSources: number;
  oracleHeartbeat: number; // seconds
  oracleDeviation: number; // percentage

  // Emergency
  hasPauseFunction: boolean;
  pauseThreshold: number;
  hasCircuitBreaker: boolean;
  circuitBreakerLevel: number;
}

interface SimulationResult {
  scenario: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
  impact: string;
  probability: string;
  outcome: string;
  recommendation: string;
  metrics: Record<string, number | string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRESS TEST ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Safe default config to avoid {} as Type antipattern
const DEFAULT_TOKENOMICS_CONFIG: TokenomicsConfig = {
  tokenName: '',
  tokenSymbol: '',
  totalSupply: 0,
  circulatingSupply: 0,
  tokenPrice: 0,
  backingType: 'NONE',
  totalBacking: 0,
  backingRatio: 0,
  liquidReserves: 0,
  reserveComposition: [],
  dexLiquidity: 0,
  cexLiquidity: 0,
  liquidityConcentration: 0,
  totalHolders: 0,
  top10HoldersPercent: 0,
  top50HoldersPercent: 0,
  teamTokensPercent: 0,
  teamTokensLocked: false,
  vestingDuration: 0,
  hasMintFunction: false,
  hasBurnFunction: false,
  hasRedemption: false,
  redemptionFee: 0,
  mintingCap: 0,
  epochMintCap: 0,
  oracleType: 'NONE',
  oracleSources: 0,
  oracleHeartbeat: 0,
  oracleDeviation: 0,
  hasPauseFunction: false,
  pauseThreshold: 0,
  hasCircuitBreaker: false,
  circuitBreakerLevel: 0
};

class TokenomicsStressTest {
  private config: TokenomicsConfig;
  private rl: readline.Interface;
  private results: SimulationResult[] = [];
  private isShuttingDown: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_TOKENOMICS_CONFIG };
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
    const index = safeParseFloat(answer, 1) - 1;
    return options[Math.floor(index)] || options[0];
  }

  private async yesNo(prompt: string): Promise<boolean> {
    const answer = await this.question(`${prompt} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
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

  private parseNumber(input: string): number {
    return safeParseFloat(input, 0);
  }

  async collectInput(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              SECUREMINT ENGINE - TOKENOMICS STRESS TEST                       ║');
    console.log('║                   Economic Attack & Stress Simulation                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    // Section 1: Token Basics
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 1: TOKEN BASICS                                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.tokenName = await this.question('Token Name: ');
    this.config.tokenSymbol = await this.question('Token Symbol: ');
    this.config.totalSupply = this.parseNumber(await this.question('Total Supply: '));
    this.config.circulatingSupply = this.parseNumber(await this.question('Circulating Supply: '));
    this.config.tokenPrice = this.parseNumber(await this.question('Current/Target Token Price ($): '));

    // Section 2: Backing/Collateral
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 2: BACKING & COLLATERAL                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.backingType = await this.selectOne(
      'Backing Type:',
      ['FIAT', 'CRYPTO', 'MIXED', 'ALGORITHMIC', 'NONE']
    ) as TokenomicsConfig['backingType'];

    if (this.config.backingType !== 'NONE' && this.config.backingType !== 'ALGORITHMIC') {
      this.config.totalBacking = this.parseNumber(await this.question('Total Backing Value ($): '));
      this.config.backingRatio = this.parseNumber(await this.question('Backing Ratio (e.g., 1.0 = 100%): '));
      this.config.liquidReserves = this.parseNumber(await this.question('Liquid Reserves (% immediately available): '));

      // Collect reserve composition
      this.config.reserveComposition = [];
      console.log('\nReserve Composition (enter assets, "done" to finish):');
      let addMore = true;
      while (addMore) {
        const asset = await this.question('Asset name (or "done"): ');
        if (asset.toLowerCase() === 'done') {
          addMore = false;
          continue;
        }
        const percentage = this.parseNumber(await this.question('Percentage of reserves (%): '));
        const volatility = this.parseNumber(await this.question('Volatility (0-100, e.g., USD=0, BTC=50): '));
        this.config.reserveComposition.push({ asset, percentage, volatility });
      }
    } else {
      this.config.totalBacking = 0;
      this.config.backingRatio = 0;
      this.config.liquidReserves = 0;
      this.config.reserveComposition = [];
    }

    // Section 3: Liquidity
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 3: LIQUIDITY                                           │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.dexLiquidity = this.parseNumber(await this.question('DEX Liquidity ($): '));
    this.config.cexLiquidity = this.parseNumber(await this.question('CEX Liquidity ($): '));
    this.config.liquidityConcentration = this.parseNumber(await this.question('% of liquidity in top pool: '));

    // Section 4: Holder Distribution
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 4: HOLDER DISTRIBUTION                                 │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.totalHolders = this.parseNumber(await this.question('Total Holders: '));
    this.config.top10HoldersPercent = this.parseNumber(await this.question('Top 10 holders control (%): '));
    this.config.top50HoldersPercent = this.parseNumber(await this.question('Top 50 holders control (%): '));
    this.config.teamTokensPercent = this.parseNumber(await this.question('Team token allocation (%): '));
    this.config.teamTokensLocked = await this.yesNo('Are team tokens locked/vesting?');
    if (this.config.teamTokensLocked) {
      this.config.vestingDuration = this.parseNumber(await this.question('Vesting duration (months): '));
    } else {
      this.config.vestingDuration = 0;
    }

    // Section 5: Mechanisms
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 5: TOKEN MECHANISMS                                    │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.hasMintFunction = await this.yesNo('Does token have mint function?');
    this.config.hasBurnFunction = await this.yesNo('Does token have burn function?');
    this.config.hasRedemption = await this.yesNo('Can users redeem tokens for backing?');
    if (this.config.hasRedemption) {
      this.config.redemptionFee = this.parseNumber(await this.question('Redemption fee (%): '));
    } else {
      this.config.redemptionFee = 0;
    }
    if (this.config.hasMintFunction) {
      this.config.mintingCap = this.parseNumber(await this.question('Global minting cap: '));
      this.config.epochMintCap = this.parseNumber(await this.question('Per-epoch mint cap: '));
    } else {
      this.config.mintingCap = 0;
      this.config.epochMintCap = 0;
    }

    // Section 6: Oracle
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 6: ORACLE CONFIGURATION                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.oracleType = await this.selectOne(
      'Oracle Type:',
      ['CHAINLINK', 'BAND', 'CUSTOM', 'NONE']
    ) as TokenomicsConfig['oracleType'];

    if (this.config.oracleType !== 'NONE') {
      this.config.oracleSources = this.parseNumber(await this.question('Number of oracle sources: '));
      this.config.oracleHeartbeat = this.parseNumber(await this.question('Oracle heartbeat (seconds): '));
      this.config.oracleDeviation = this.parseNumber(await this.question('Max oracle deviation (%): '));
    } else {
      this.config.oracleSources = 0;
      this.config.oracleHeartbeat = 0;
      this.config.oracleDeviation = 0;
    }

    // Section 7: Emergency Mechanisms
    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  SECTION 7: EMERGENCY MECHANISMS                                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    this.config.hasPauseFunction = await this.yesNo('Has pause function?');
    if (this.config.hasPauseFunction) {
      this.config.pauseThreshold = this.parseNumber(await this.question('Auto-pause threshold (depeg %): '));
    } else {
      this.config.pauseThreshold = 0;
    }
    this.config.hasCircuitBreaker = await this.yesNo('Has circuit breaker?');
    if (this.config.hasCircuitBreaker) {
      this.config.circuitBreakerLevel = this.parseNumber(await this.question('Circuit breaker trigger level (%): '));
    } else {
      this.config.circuitBreakerLevel = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STRESS TEST SIMULATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  runBankRunSimulation(): SimulationResult {
    const marketCap = this.config.circulatingSupply * this.config.tokenPrice;
    const totalLiquidity = this.config.dexLiquidity + this.config.cexLiquidity;
    // FIXED: Guard against division by zero when marketCap is 0
    const liquidBacking = (this.config.liquidReserves / 100) * this.config.totalBacking;
    const liquidBackingRatio = safeDivide(liquidBacking, marketCap, 0);

    // Simulate 25% redemption rush
    const redemptionAmount = marketCap * 0.25;
    const canHandleRedemption = this.config.liquidReserves / 100 * this.config.totalBacking >= redemptionAmount;

    // Simulate 50% redemption rush
    const redemption50 = marketCap * 0.50;
    const canHandle50 = this.config.totalBacking >= redemption50;

    let severity: SimulationResult['severity'] = 'PASS';
    let outcome = '';
    let recommendation = '';

    if (!this.config.hasRedemption) {
      severity = 'MEDIUM';
      outcome = 'No redemption mechanism - price depends entirely on secondary market';
      recommendation = 'Consider adding redemption mechanism for price stability';
    } else if (!canHandleRedemption) {
      severity = 'CRITICAL';
      outcome = `BANK RUN VULNERABLE: Only ${(liquidBackingRatio * 100).toFixed(1)}% liquid backing for 25% redemption rush`;
      recommendation = 'Increase liquid reserves to at least 30% of market cap';
    } else if (!canHandle50) {
      severity = 'HIGH';
      outcome = `Cannot handle 50% redemption: Total backing ($${(this.config.totalBacking / 1e6).toFixed(1)}M) < 50% market cap ($${(redemption50 / 1e6).toFixed(1)}M)`;
      recommendation = 'Increase total backing or reduce circulating supply';
    } else {
      severity = 'PASS';
      outcome = 'System can handle reasonable redemption scenarios';
      recommendation = 'Maintain current reserve levels';
    }

    return {
      scenario: 'Bank Run Simulation',
      severity,
      impact: 'Complete protocol insolvency and user fund loss',
      probability: this.config.backingType === 'ALGORITHMIC' ? 'Medium-High' : 'Low-Medium',
      outcome,
      recommendation,
      metrics: {
        marketCap: `$${(marketCap / 1e6).toFixed(2)}M`,
        totalBacking: `$${(this.config.totalBacking / 1e6).toFixed(2)}M`,
        liquidBacking: `$${(this.config.liquidReserves / 100 * this.config.totalBacking / 1e6).toFixed(2)}M`,
        backingRatio: `${(this.config.backingRatio * 100).toFixed(0)}%`,
        redemption25Possible: canHandleRedemption ? 'YES' : 'NO',
        redemption50Possible: canHandle50 ? 'YES' : 'NO'
      }
    };
  }

  runOracleManipulationSimulation(): SimulationResult {
    if (this.config.oracleType === 'NONE') {
      return {
        scenario: 'Oracle Manipulation',
        severity: this.config.hasMintFunction ? 'CRITICAL' : 'LOW',
        impact: 'Unbacked minting or incorrect valuations',
        probability: 'N/A - No oracle',
        outcome: this.config.hasMintFunction
          ? 'NO ORACLE: Minting without price verification is extremely dangerous'
          : 'No oracle, but no minting function either',
        recommendation: this.config.hasMintFunction
          ? 'CRITICAL: Implement oracle-gated minting immediately'
          : 'Consider adding oracle for price tracking',
        metrics: {
          oracleType: 'NONE',
          oracleSources: 0,
          manipulationRisk: this.config.hasMintFunction ? 'CRITICAL' : 'LOW'
        }
      };
    }

    let severity: SimulationResult['severity'] = 'PASS';
    let outcome = '';
    let recommendation = '';

    // Check oracle robustness
    const singleSourceRisk = this.config.oracleSources === 1;
    const longHeartbeat = this.config.oracleHeartbeat > 3600;
    const wideDeviation = this.config.oracleDeviation > 5;

    if (singleSourceRisk) {
      severity = 'CRITICAL';
      outcome = 'Single oracle source - vulnerable to manipulation or downtime';
      recommendation = 'Use aggregated oracles with minimum 3 sources';
    } else if (longHeartbeat && this.config.hasMintFunction) {
      severity = 'HIGH';
      outcome = `Long oracle heartbeat (${this.config.oracleHeartbeat}s) allows stale price exploitation`;
      recommendation = 'Reduce heartbeat to <1 hour for minting operations';
    } else if (wideDeviation) {
      severity = 'MEDIUM';
      outcome = `Wide deviation threshold (${this.config.oracleDeviation}%) may allow profitable manipulation`;
      recommendation = 'Tighten deviation threshold to 1-2%';
    } else {
      severity = 'PASS';
      outcome = 'Oracle configuration appears robust';
      recommendation = 'Monitor for new attack vectors';
    }

    // Calculate manipulation profit potential
    const manipulationProfit = this.config.epochMintCap * this.config.tokenPrice * (this.config.oracleDeviation / 100);

    return {
      scenario: 'Oracle Manipulation',
      severity,
      impact: 'Unbacked minting, protocol insolvency',
      probability: singleSourceRisk ? 'High' : longHeartbeat ? 'Medium' : 'Low',
      outcome,
      recommendation,
      metrics: {
        oracleType: this.config.oracleType,
        oracleSources: this.config.oracleSources,
        heartbeat: `${this.config.oracleHeartbeat}s`,
        maxDeviation: `${this.config.oracleDeviation}%`,
        maxManipulationProfit: `$${manipulationProfit.toLocaleString()}`
      }
    };
  }

  runWhaleDumpSimulation(): SimulationResult {
    const top10Holdings = this.config.circulatingSupply * (this.config.top10HoldersPercent / 100);
    const top10Value = top10Holdings * this.config.tokenPrice;
    const totalLiquidity = this.config.dexLiquidity + this.config.cexLiquidity;

    // Calculate price impact of whale dump (simplified AMM model)
    // Price impact ≈ (trade_size / liquidity) * constant_product_factor
    const dumpSize = top10Value * 0.5; // 50% of top 10 holdings
    const priceImpact = (dumpSize / totalLiquidity) * 0.5; // Simplified

    let severity: SimulationResult['severity'] = 'PASS';
    let outcome = '';
    let recommendation = '';

    if (this.config.top10HoldersPercent > 60 && !this.config.teamTokensLocked) {
      severity = 'CRITICAL';
      outcome = `Top 10 holders control ${this.config.top10HoldersPercent}% with no vesting - massive rug pull risk`;
      recommendation = 'Implement vesting for large holders, diversify distribution';
    } else if (priceImpact > 0.5) {
      severity = 'HIGH';
      outcome = `50% whale dump would cause ~${(priceImpact * 100).toFixed(0)}% price crash due to low liquidity`;
      recommendation = 'Increase DEX liquidity or implement sell restrictions';
    } else if (this.config.top10HoldersPercent > 50) {
      severity = 'MEDIUM';
      outcome = `High concentration (${this.config.top10HoldersPercent}%) creates dump vulnerability`;
      recommendation = 'Consider airdrops or incentive programs to diversify holdings';
    } else {
      severity = 'PASS';
      outcome = 'Holder distribution and liquidity can absorb reasonable dumps';
      recommendation = 'Maintain liquidity incentives';
    }

    return {
      scenario: 'Whale Dump Simulation',
      severity,
      impact: 'Massive price crash, liquidity drain, cascade liquidations',
      probability: this.config.teamTokensLocked ? 'Low' : 'Medium',
      outcome,
      recommendation,
      metrics: {
        top10Holdings: `${this.config.top10HoldersPercent}%`,
        top10Value: `$${(top10Value / 1e6).toFixed(2)}M`,
        totalLiquidity: `$${(totalLiquidity / 1e6).toFixed(2)}M`,
        liquidityRatio: `${(totalLiquidity / top10Value * 100).toFixed(1)}%`,
        estimatedPriceImpact: `${(priceImpact * 100).toFixed(1)}%`,
        teamTokensLocked: this.config.teamTokensLocked ? 'YES' : 'NO'
      }
    };
  }

  runLiquidityCrisisSimulation(): SimulationResult {
    const totalLiquidity = this.config.dexLiquidity + this.config.cexLiquidity;
    const marketCap = this.config.circulatingSupply * this.config.tokenPrice;
    const liquidityRatio = totalLiquidity / marketCap;

    let severity: SimulationResult['severity'] = 'PASS';
    let outcome = '';
    let recommendation = '';

    // Check liquidity concentration
    if (this.config.liquidityConcentration > 80) {
      severity = 'HIGH';
      outcome = `${this.config.liquidityConcentration}% of liquidity in single pool - extreme concentration risk`;
      recommendation = 'Diversify across multiple DEXs and pools';
    } else if (liquidityRatio < 0.05) {
      severity = 'CRITICAL';
      outcome = `Liquidity ratio (${(liquidityRatio * 100).toFixed(2)}%) is dangerously low - illiquid market`;
      recommendation = 'Increase liquidity to at least 10% of market cap';
    } else if (liquidityRatio < 0.10) {
      severity = 'MEDIUM';
      outcome = `Low liquidity ratio (${(liquidityRatio * 100).toFixed(2)}%) - vulnerable to price manipulation`;
      recommendation = 'Increase liquidity incentives';
    } else {
      severity = 'PASS';
      outcome = 'Liquidity appears adequate for market cap';
      recommendation = 'Maintain liquidity mining programs';
    }

    // Calculate slippage for various trade sizes
    // FIXED: Guard against division by zero when dexLiquidity is 0
    const slippage1M = safeDivide(1000000, this.config.dexLiquidity, 100) * 0.3 * 100;
    const slippage10M = safeDivide(10000000, this.config.dexLiquidity, 100) * 0.3 * 100;

    return {
      scenario: 'Liquidity Crisis Simulation',
      severity,
      impact: 'Price manipulation, inability to exit positions, cascade failures',
      probability: liquidityRatio < 0.1 ? 'Medium' : 'Low',
      outcome,
      recommendation,
      metrics: {
        dexLiquidity: `$${(this.config.dexLiquidity / 1e6).toFixed(2)}M`,
        cexLiquidity: `$${(this.config.cexLiquidity / 1e6).toFixed(2)}M`,
        liquidityRatio: `${(liquidityRatio * 100).toFixed(2)}%`,
        concentration: `${this.config.liquidityConcentration}%`,
        slippage1M: `${Math.min(slippage1M, 100).toFixed(1)}%`,
        slippage10M: `${Math.min(slippage10M, 100).toFixed(1)}%`
      }
    };
  }

  runDeathSpiralSimulation(): SimulationResult {
    // Death spiral specific to algorithmic stablecoins
    if (this.config.backingType !== 'ALGORITHMIC' && this.config.backingRatio >= 1.0) {
      return {
        scenario: 'Death Spiral Analysis',
        severity: 'PASS',
        impact: 'N/A - Fully backed token',
        probability: 'Very Low',
        outcome: 'Token is backed, death spiral unlikely',
        recommendation: 'Maintain backing ratio above 100%',
        metrics: {
          backingType: this.config.backingType,
          backingRatio: `${(this.config.backingRatio * 100).toFixed(0)}%`,
          deathSpiralRisk: 'LOW'
        }
      };
    }

    let severity: SimulationResult['severity'] = 'PASS';
    let outcome = '';
    let recommendation = '';

    // Check for death spiral vulnerability factors
    const vulnerabilityFactors: string[] = [];

    if (this.config.backingType === 'ALGORITHMIC') {
      vulnerabilityFactors.push('Algorithmic backing');
    }
    if (this.config.backingRatio < 1.0) {
      vulnerabilityFactors.push(`Under-collateralized (${(this.config.backingRatio * 100).toFixed(0)}%)`);
    }
    if (!this.config.hasCircuitBreaker) {
      vulnerabilityFactors.push('No circuit breaker');
    }
    if (!this.config.hasPauseFunction) {
      vulnerabilityFactors.push('No pause function');
    }
    if (this.config.reserveComposition.some(r => r.volatility > 30)) {
      vulnerabilityFactors.push('Volatile reserve assets');
    }

    if (vulnerabilityFactors.length >= 3) {
      severity = 'CRITICAL';
      outcome = `HIGH DEATH SPIRAL RISK: ${vulnerabilityFactors.join(', ')}`;
      recommendation = 'CRITICAL: Add circuit breakers, increase collateral, diversify reserves';
    } else if (vulnerabilityFactors.length >= 2) {
      severity = 'HIGH';
      outcome = `Elevated death spiral risk: ${vulnerabilityFactors.join(', ')}`;
      recommendation = 'Add protective mechanisms and increase backing';
    } else if (vulnerabilityFactors.length >= 1) {
      severity = 'MEDIUM';
      outcome = `Some vulnerability factors: ${vulnerabilityFactors.join(', ')}`;
      recommendation = 'Monitor closely and prepare contingency plans';
    } else {
      severity = 'PASS';
      outcome = 'Death spiral risk appears manageable';
      recommendation = 'Maintain current protective measures';
    }

    return {
      scenario: 'Death Spiral Analysis',
      severity,
      impact: 'Complete protocol collapse, 100% value loss',
      probability: this.config.backingType === 'ALGORITHMIC' ? 'Medium-High' : 'Low',
      outcome,
      recommendation,
      metrics: {
        backingType: this.config.backingType,
        backingRatio: `${(this.config.backingRatio * 100).toFixed(0)}%`,
        hasCircuitBreaker: this.config.hasCircuitBreaker ? 'YES' : 'NO',
        hasPause: this.config.hasPauseFunction ? 'YES' : 'NO',
        vulnerabilityFactors: vulnerabilityFactors.length
      }
    };
  }

  runFlashLoanAttackSimulation(): SimulationResult {
    let severity: SimulationResult['severity'] = 'PASS';
    let outcome = '';
    let recommendation = '';

    // Flash loan attack vectors
    const attackVectors: string[] = [];

    // Price manipulation via flash loan
    if (this.config.oracleSources === 1 || this.config.oracleType === 'CUSTOM') {
      attackVectors.push('Oracle manipulation');
    }

    // Governance attacks
    if (this.config.top10HoldersPercent < 30) { // Low concentration means easier vote manipulation
      attackVectors.push('Governance vote manipulation');
    }

    // Liquidity manipulation
    if (this.config.liquidityConcentration > 70) {
      attackVectors.push('DEX price manipulation');
    }

    // Vault/lending attacks
    if (this.config.hasMintFunction && this.config.oracleHeartbeat > 1800) {
      attackVectors.push('Stale price exploitation');
    }

    if (attackVectors.length >= 3) {
      severity = 'CRITICAL';
      outcome = `Multiple flash loan attack vectors: ${attackVectors.join(', ')}`;
      recommendation = 'Implement: TWAP oracles, flash loan guards, time-weighted voting';
    } else if (attackVectors.length >= 2) {
      severity = 'HIGH';
      outcome = `Flash loan vectors detected: ${attackVectors.join(', ')}`;
      recommendation = 'Add flash loan protection mechanisms';
    } else if (attackVectors.length >= 1) {
      severity = 'MEDIUM';
      outcome = `Potential vector: ${attackVectors.join(', ')}`;
      recommendation = 'Monitor and implement defensive measures';
    } else {
      severity = 'PASS';
      outcome = 'No obvious flash loan attack vectors';
      recommendation = 'Continue monitoring for new attack patterns';
    }

    // Calculate potential profit from flash loan attack
    const potentialProfit = this.config.epochMintCap * this.config.tokenPrice * 0.1; // 10% arb opportunity

    return {
      scenario: 'Flash Loan Attack Simulation',
      severity,
      impact: 'Instant fund extraction, protocol insolvency',
      probability: attackVectors.length > 1 ? 'High' : 'Low',
      outcome,
      recommendation,
      metrics: {
        attackVectors: attackVectors.length,
        identifiedVectors: attackVectors.join(', ') || 'None',
        potentialProfit: `$${potentialProfit.toLocaleString()}`,
        flashLoanAvailable: 'YES (all major protocols)'
      }
    };
  }

  runAllSimulations(): void {
    console.log('\n\n⏳ Running Stress Test Simulations...\n');

    this.results = [
      this.runBankRunSimulation(),
      this.runOracleManipulationSimulation(),
      this.runWhaleDumpSimulation(),
      this.runLiquidityCrisisSimulation(),
      this.runDeathSpiralSimulation(),
      this.runFlashLoanAttackSimulation()
    ];
  }

  generateReport(): string {
    const timestamp = new Date().toISOString();
    const criticalCount = this.results.filter(r => r.severity === 'CRITICAL').length;
    const highCount = this.results.filter(r => r.severity === 'HIGH').length;
    const mediumCount = this.results.filter(r => r.severity === 'MEDIUM').length;
    const passCount = this.results.filter(r => r.severity === 'PASS').length;

    let overallRisk = 'LOW';
    if (criticalCount > 0) overallRisk = 'CRITICAL';
    else if (highCount > 1) overallRisk = 'HIGH';
    else if (highCount > 0 || mediumCount > 2) overallRisk = 'MEDIUM';

    const marketCap = this.config.circulatingSupply * this.config.tokenPrice;

    let report = `# Tokenomics Stress Test Report

**Token:** ${this.config.tokenName} (${this.config.tokenSymbol})
**Generated:** ${timestamp}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Risk Level** | ${overallRisk === 'CRITICAL' ? '🚨 CRITICAL' : overallRisk === 'HIGH' ? '🔴 HIGH' : overallRisk === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW'} |
| Critical Issues | ${criticalCount} |
| High Issues | ${highCount} |
| Medium Issues | ${mediumCount} |
| Tests Passed | ${passCount} |

${criticalCount > 0 ? `
### 🚨 CRITICAL WARNING

This token has **${criticalCount} CRITICAL** vulnerabilities that could result in complete fund loss or protocol collapse. **DO NOT DEPLOY** until all critical issues are resolved.
` : ''}

---

## Token Overview

| Parameter | Value |
|-----------|-------|
| Token Name | ${this.config.tokenName} |
| Token Symbol | ${this.config.tokenSymbol} |
| Total Supply | ${this.config.totalSupply.toLocaleString()} |
| Circulating Supply | ${this.config.circulatingSupply.toLocaleString()} |
| Token Price | $${this.config.tokenPrice.toFixed(4)} |
| Market Cap | $${(marketCap / 1e6).toFixed(2)}M |
| Backing Type | ${this.config.backingType} |
| Backing Ratio | ${(this.config.backingRatio * 100).toFixed(0)}% |
| Total Liquidity | $${((this.config.dexLiquidity + this.config.cexLiquidity) / 1e6).toFixed(2)}M |
| Holder Concentration | Top 10: ${this.config.top10HoldersPercent}% |

---

## Stress Test Results

`;

    // Add each simulation result
    for (const result of this.results) {
      const severityIcon = result.severity === 'CRITICAL' ? '🚨' :
                          result.severity === 'HIGH' ? '🔴' :
                          result.severity === 'MEDIUM' ? '🟡' :
                          result.severity === 'LOW' ? '🟢' : '✅';

      report += `
### ${severityIcon} ${result.scenario}

**Severity:** ${result.severity}
**Probability:** ${result.probability}
**Impact:** ${result.impact}

#### Outcome
${result.outcome}

#### Recommendation
${result.recommendation}

#### Metrics
| Metric | Value |
|--------|-------|
${Object.entries(result.metrics).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

---
`;
    }

    report += `
## Recommendations Summary

### Critical Actions (Must Do Before Launch)

${criticalCount > 0 ? this.results.filter(r => r.severity === 'CRITICAL').map(r => `
- **${r.scenario}**: ${r.recommendation}
`).join('') : '- No critical actions required'}

### High Priority Actions

${highCount > 0 ? this.results.filter(r => r.severity === 'HIGH').map(r => `
- **${r.scenario}**: ${r.recommendation}
`).join('') : '- No high priority actions'}

### Medium Priority Actions

${mediumCount > 0 ? this.results.filter(r => r.severity === 'MEDIUM').map(r => `
- **${r.scenario}**: ${r.recommendation}
`).join('') : '- No medium priority actions'}

---

## Risk Mitigation Framework

### Immediate Mitigations

1. **Oracle Security**
   - Use multiple oracle sources (minimum 3)
   - Implement TWAP for price feeds
   - Set tight deviation bounds (1-2%)
   - Add staleness checks

2. **Liquidity Protection**
   - Maintain liquidity > 10% of market cap
   - Diversify across multiple DEXs
   - Implement liquidity mining incentives

3. **Holder Distribution**
   - Enforce vesting for large holders
   - Implement sell restrictions during vesting
   - Airdrop to diversify holdings

4. **Emergency Controls**
   - Implement pause function
   - Add circuit breakers
   - Create incident response plan

### Ongoing Monitoring

Monitor these metrics in production:

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Backing Ratio | < 105% | < 100% |
| Liquidity Ratio | < 10% | < 5% |
| Price Deviation | > 2% | > 5% |
| Daily Volume | < 0.5% mcap | < 0.1% mcap |
| Top 10 Holdings | > 50% | > 70% |

---

## Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tokenomics Lead | _________________ | _________________ | ________ |
| Risk Manager | _________________ | _________________ | ________ |
| CTO | _________________ | _________________ | ________ |

**Stress Test Status:** ${overallRisk === 'CRITICAL' ? '❌ FAILED - DO NOT PROCEED' : overallRisk === 'HIGH' ? '⚠️ CONDITIONAL - ADDRESS HIGH ISSUES' : '✅ PASSED'}

---

*Generated by SecureMint Engine Tokenomics Stress Test v1.0*
`;

    return report;
  }

  async run(): Promise<void> {
    try {
      await this.collectInput();
      this.runAllSimulations();

      const report = this.generateReport();

      // Save files with overwrite confirmation
      const reportPath = path.resolve(process.cwd(), 'TOKENOMICS_STRESS_TEST.md');
      const configPath = path.resolve(process.cwd(), 'tokenomics-config.json');

      if (await this.confirmOverwrite(reportPath)) {
        fs.writeFileSync(reportPath, report);
      }
      if (await this.confirmOverwrite(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      }

      // Display summary
      const criticalCount = this.results.filter(r => r.severity === 'CRITICAL').length;
      const highCount = this.results.filter(r => r.severity === 'HIGH').length;

      console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║              TOKENOMICS STRESS TEST COMPLETE                                  ║');
      console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
      console.log('║                                                                               ║');
      console.log(`║  ${criticalCount > 0 ? '🚨 CRITICAL ISSUES: ' + criticalCount : '✅ No critical issues'}                                              ║`);
      console.log(`║  ${highCount > 0 ? '🔴 HIGH ISSUES: ' + highCount : '✅ No high issues'}                                                   ║`);
      console.log('║                                                                               ║');
      console.log('║  📄 Report: TOKENOMICS_STRESS_TEST.md                                         ║');
      console.log('║  ⚙️  Config: tokenomics-config.json                                           ║');
      console.log('║                                                                               ║');
      if (criticalCount > 0) {
        console.log('║  ⚠️  DO NOT PROCEED TO MAINNET UNTIL CRITICAL ISSUES ARE RESOLVED            ║');
      }
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
  const test = new TokenomicsStressTest();
  test.run();
}

export { TokenomicsStressTest };
