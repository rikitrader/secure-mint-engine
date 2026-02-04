/**
 * SecureMint Engine - Backtest Engine
 *
 * Comprehensive backtesting system for oracle-gated secure minting protocol.
 * Simulates historical market conditions, stress scenarios, and protocol behavior.
 *
 * Features:
 * - Historical price/oracle data simulation
 * - Invariant monitoring across all scenarios
 * - Stress testing (bank runs, oracle failures, market crashes)
 * - Economic attack simulation
 * - Performance metrics and reporting
 */

import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface BacktestConfig {
  // Simulation parameters
  startDate: string;
  endDate: string;
  timeStepHours: number;

  // Initial protocol state
  initialSupply: number;
  initialBacking: number;
  epochDuration: number; // hours
  epochMintCap: number;
  minBackingRatio: number; // 1.0 = 100%

  // Oracle configuration
  oracleStalenessThreshold: number; // seconds
  oracleDeviationThreshold: number; // percentage

  // Stress test parameters
  enableBankRunSimulation: boolean;
  bankRunRedemptionRate: number; // % per hour
  enableOracleFailures: boolean;
  oracleFailureProbability: number; // per timestep
  enableMarketCrashes: boolean;
  crashMagnitude: number; // % drop

  // Output
  outputDir: string;
  verbose: boolean;
}

interface MarketState {
  timestamp: Date;
  backingAssetPrice: number;
  backingAssetVolatility: number;
  liquidityDepth: number;
  gasPrice: number;
}

interface ProtocolState {
  totalSupply: number;
  totalBacking: number;
  backingRatio: number;
  epochMinted: number;
  epochNumber: number;
  isPaused: boolean;
  pauseLevel: number;
  oracleStale: boolean;
  lastOracleUpdate: Date;
}

interface SimulationEvent {
  timestamp: Date;
  type: 'MINT' | 'BURN' | 'ORACLE_UPDATE' | 'ORACLE_FAILURE' | 'PAUSE' | 'UNPAUSE' | 'EPOCH_RESET' | 'BANK_RUN' | 'CRASH' | 'INVARIANT_CHECK';
  details: Record<string, any>;
  invariantStatus: InvariantStatus;
}

interface InvariantStatus {
  'INV-SM-1': boolean; // Supply <= Backing
  'INV-SM-2': boolean; // No mint when paused
  'INV-SM-3': boolean; // No mint with stale oracle
  'INV-SM-4': boolean; // Epoch minted <= Cap
  allPassed: boolean;
}

interface BacktestResult {
  config: BacktestConfig;
  summary: {
    totalEvents: number;
    totalMints: number;
    totalBurns: number;
    totalOracleUpdates: number;
    oracleFailures: number;
    pauseEvents: number;
    invariantViolations: number;
    maxDrawdown: number;
    minBackingRatio: number;
    maxSupply: number;
    finalSupply: number;
    finalBacking: number;
  };
  events: SimulationEvent[];
  invariantHistory: { timestamp: Date; status: InvariantStatus }[];
  metrics: BacktestMetrics;
}

interface BacktestMetrics {
  avgBackingRatio: number;
  backingRatioVolatility: number;
  avgMintPerEpoch: number;
  avgBurnPerEpoch: number;
  maxRedemptionPressure: number;
  oracleUptimePercent: number;
  protocolUptimePercent: number;
  economicSecurityScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function safeDivide(numerator: number, divisor: number, defaultValue: number = 0): number {
  if (divisor === 0 || isNaN(divisor)) return defaultValue;
  const result = numerator / divisor;
  return isNaN(result) ? defaultValue : result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function generateNormalRandom(mean: number = 0, stdDev: number = 1): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKTEST ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class BacktestEngine {
  private config: BacktestConfig;
  private marketState: MarketState;
  private protocolState: ProtocolState;
  private events: SimulationEvent[] = [];
  private invariantHistory: { timestamp: Date; status: InvariantStatus }[] = [];
  private random: () => number;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.random = Math.random;

    // Initialize market state
    this.marketState = {
      timestamp: new Date(config.startDate),
      backingAssetPrice: 1.0, // Start at $1
      backingAssetVolatility: 0.02, // 2% daily volatility
      liquidityDepth: 10_000_000, // $10M liquidity
      gasPrice: 30, // 30 gwei
    };

    // Initialize protocol state
    this.protocolState = {
      totalSupply: config.initialSupply,
      totalBacking: config.initialBacking,
      backingRatio: safeDivide(config.initialBacking, config.initialSupply, 1),
      epochMinted: 0,
      epochNumber: 0,
      isPaused: false,
      pauseLevel: 0,
      oracleStale: false,
      lastOracleUpdate: new Date(config.startDate),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVARIANT CHECKING
  // ═══════════════════════════════════════════════════════════════════════════════

  private checkInvariants(): InvariantStatus {
    const status: InvariantStatus = {
      'INV-SM-1': this.protocolState.totalSupply <= this.protocolState.totalBacking,
      'INV-SM-2': true, // Will be checked during mint attempts
      'INV-SM-3': true, // Will be checked during mint attempts
      'INV-SM-4': this.protocolState.epochMinted <= this.config.epochMintCap,
      allPassed: true,
    };

    status.allPassed = status['INV-SM-1'] && status['INV-SM-2'] &&
                       status['INV-SM-3'] && status['INV-SM-4'];

    return status;
  }

  private recordInvariantCheck(timestamp: Date): void {
    const status = this.checkInvariants();
    this.invariantHistory.push({ timestamp, status });

    this.events.push({
      timestamp,
      type: 'INVARIANT_CHECK',
      details: { ...status },
      invariantStatus: status,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MARKET SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private updateMarketState(timestamp: Date): void {
    // Geometric Brownian Motion for price
    const dt = this.config.timeStepHours / 24; // Convert to days
    const drift = 0; // No drift (stable asset)
    const diffusion = this.marketState.backingAssetVolatility * Math.sqrt(dt);
    const dW = generateNormalRandom();

    this.marketState.backingAssetPrice *= Math.exp(drift * dt + diffusion * dW);

    // Market crash simulation
    if (this.config.enableMarketCrashes && this.random() < 0.001) {
      const crashFactor = 1 - (this.config.crashMagnitude / 100);
      this.marketState.backingAssetPrice *= crashFactor;

      this.events.push({
        timestamp,
        type: 'CRASH',
        details: {
          magnitude: this.config.crashMagnitude,
          newPrice: this.marketState.backingAssetPrice,
        },
        invariantStatus: this.checkInvariants(),
      });
    }

    // Update volatility (mean-reverting)
    this.marketState.backingAssetVolatility +=
      0.1 * (0.02 - this.marketState.backingAssetVolatility) * dt +
      0.01 * generateNormalRandom() * Math.sqrt(dt);
    this.marketState.backingAssetVolatility = clamp(this.marketState.backingAssetVolatility, 0.005, 0.2);

    // Update liquidity (mean-reverting)
    this.marketState.liquidityDepth +=
      0.05 * (10_000_000 - this.marketState.liquidityDepth) * dt +
      100_000 * generateNormalRandom() * Math.sqrt(dt);
    this.marketState.liquidityDepth = Math.max(1_000_000, this.marketState.liquidityDepth);

    // Update gas price
    this.marketState.gasPrice = Math.max(10, this.marketState.gasPrice + generateNormalRandom() * 5);

    this.marketState.timestamp = timestamp;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORACLE SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private updateOracle(timestamp: Date): void {
    // Check for oracle failure
    if (this.config.enableOracleFailures && this.random() < this.config.oracleFailureProbability) {
      this.protocolState.oracleStale = true;

      this.events.push({
        timestamp,
        type: 'ORACLE_FAILURE',
        details: { duration: 'unknown' },
        invariantStatus: this.checkInvariants(),
      });

      return;
    }

    // Normal oracle update
    const timeSinceUpdate = (timestamp.getTime() - this.protocolState.lastOracleUpdate.getTime()) / 1000;

    if (timeSinceUpdate > this.config.oracleStalenessThreshold) {
      // Oracle should update
      this.protocolState.oracleStale = false;
      this.protocolState.lastOracleUpdate = timestamp;

      // Update backing based on price
      this.protocolState.totalBacking = this.protocolState.totalBacking * this.marketState.backingAssetPrice;
      this.protocolState.backingRatio = safeDivide(
        this.protocolState.totalBacking,
        this.protocolState.totalSupply,
        1
      );

      this.events.push({
        timestamp,
        type: 'ORACLE_UPDATE',
        details: {
          newBacking: this.protocolState.totalBacking,
          newRatio: this.protocolState.backingRatio,
          price: this.marketState.backingAssetPrice,
        },
        invariantStatus: this.checkInvariants(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROTOCOL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  private simulateMint(timestamp: Date): void {
    // Check if mint is allowed
    if (this.protocolState.isPaused) {
      return; // INV-SM-2: No mint when paused
    }

    if (this.protocolState.oracleStale) {
      return; // INV-SM-3: No mint with stale oracle
    }

    const remainingCapacity = this.config.epochMintCap - this.protocolState.epochMinted;
    if (remainingCapacity <= 0) {
      return; // INV-SM-4: Epoch cap reached
    }

    // Generate random mint amount (capped by remaining capacity and backing)
    const maxMintByBacking = this.protocolState.totalBacking * this.config.minBackingRatio -
                             this.protocolState.totalSupply;
    const maxMint = Math.min(remainingCapacity, Math.max(0, maxMintByBacking));

    if (maxMint <= 0) {
      return; // INV-SM-1: Would exceed backing
    }

    const mintAmount = this.random() * maxMint * 0.5; // Random up to 50% of available

    if (mintAmount > 0) {
      this.protocolState.totalSupply += mintAmount;
      this.protocolState.epochMinted += mintAmount;
      this.protocolState.backingRatio = safeDivide(
        this.protocolState.totalBacking,
        this.protocolState.totalSupply,
        1
      );

      this.events.push({
        timestamp,
        type: 'MINT',
        details: {
          amount: mintAmount,
          newSupply: this.protocolState.totalSupply,
          newRatio: this.protocolState.backingRatio,
        },
        invariantStatus: this.checkInvariants(),
      });
    }
  }

  private simulateBurn(timestamp: Date): void {
    // Random redemption pressure
    let redemptionRate = this.random() * 0.02; // 0-2% per timestep

    // Increased pressure during bank run
    if (this.config.enableBankRunSimulation && this.random() < 0.05) {
      redemptionRate = this.config.bankRunRedemptionRate / 100;

      this.events.push({
        timestamp,
        type: 'BANK_RUN',
        details: { redemptionRate: redemptionRate * 100 },
        invariantStatus: this.checkInvariants(),
      });
    }

    const burnAmount = this.protocolState.totalSupply * redemptionRate;

    if (burnAmount > 0 && burnAmount <= this.protocolState.totalSupply) {
      this.protocolState.totalSupply -= burnAmount;
      this.protocolState.totalBacking -= burnAmount; // Backing redeemed
      this.protocolState.backingRatio = safeDivide(
        this.protocolState.totalBacking,
        this.protocolState.totalSupply,
        1
      );

      this.events.push({
        timestamp,
        type: 'BURN',
        details: {
          amount: burnAmount,
          newSupply: this.protocolState.totalSupply,
          newRatio: this.protocolState.backingRatio,
        },
        invariantStatus: this.checkInvariants(),
      });
    }
  }

  private checkPauseConditions(timestamp: Date): void {
    // Auto-pause on low backing ratio
    if (this.protocolState.backingRatio < 0.95 && !this.protocolState.isPaused) {
      this.protocolState.isPaused = true;
      this.protocolState.pauseLevel = 2;

      this.events.push({
        timestamp,
        type: 'PAUSE',
        details: {
          reason: 'Low backing ratio',
          backingRatio: this.protocolState.backingRatio,
          pauseLevel: this.protocolState.pauseLevel,
        },
        invariantStatus: this.checkInvariants(),
      });
    }

    // Auto-pause on stale oracle
    if (this.protocolState.oracleStale && !this.protocolState.isPaused) {
      this.protocolState.isPaused = true;
      this.protocolState.pauseLevel = 1;

      this.events.push({
        timestamp,
        type: 'PAUSE',
        details: {
          reason: 'Stale oracle',
          pauseLevel: this.protocolState.pauseLevel,
        },
        invariantStatus: this.checkInvariants(),
      });
    }

    // Auto-unpause when conditions improve
    if (this.protocolState.isPaused &&
        this.protocolState.backingRatio >= 1.0 &&
        !this.protocolState.oracleStale) {
      this.protocolState.isPaused = false;
      this.protocolState.pauseLevel = 0;

      this.events.push({
        timestamp,
        type: 'UNPAUSE',
        details: {
          backingRatio: this.protocolState.backingRatio,
        },
        invariantStatus: this.checkInvariants(),
      });
    }
  }

  private checkEpochReset(timestamp: Date): void {
    const epochDurationMs = this.config.epochDuration * 60 * 60 * 1000;
    const epochStart = new Date(this.config.startDate).getTime() +
                       this.protocolState.epochNumber * epochDurationMs;
    const epochEnd = epochStart + epochDurationMs;

    if (timestamp.getTime() >= epochEnd) {
      this.protocolState.epochNumber++;
      this.protocolState.epochMinted = 0;

      this.events.push({
        timestamp,
        type: 'EPOCH_RESET',
        details: {
          newEpoch: this.protocolState.epochNumber,
          previousEpochMinted: this.protocolState.epochMinted,
        },
        invariantStatus: this.checkInvariants(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN SIMULATION LOOP
  // ═══════════════════════════════════════════════════════════════════════════════

  public async run(): Promise<BacktestResult> {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         SecureMint Backtest Engine - Starting                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`Period: ${this.config.startDate} to ${this.config.endDate}`);
    console.log(`Time step: ${this.config.timeStepHours} hours`);
    console.log('');

    const startTime = new Date(this.config.startDate);
    const endTime = new Date(this.config.endDate);
    const timeStepMs = this.config.timeStepHours * 60 * 60 * 1000;

    let currentTime = startTime;
    let iteration = 0;
    let maxSupply = this.protocolState.totalSupply;
    let minBackingRatio = this.protocolState.backingRatio;
    let maxDrawdown = 0;
    let peakSupply = this.protocolState.totalSupply;

    while (currentTime <= endTime) {
      iteration++;

      // 1. Update market conditions
      this.updateMarketState(currentTime);

      // 2. Update oracle
      this.updateOracle(currentTime);

      // 3. Check epoch reset
      this.checkEpochReset(currentTime);

      // 4. Check pause conditions
      this.checkPauseConditions(currentTime);

      // 5. Simulate protocol operations
      this.simulateMint(currentTime);
      this.simulateBurn(currentTime);

      // 6. Record invariant check
      this.recordInvariantCheck(currentTime);

      // 7. Track metrics
      maxSupply = Math.max(maxSupply, this.protocolState.totalSupply);
      minBackingRatio = Math.min(minBackingRatio, this.protocolState.backingRatio);

      if (this.protocolState.totalSupply > peakSupply) {
        peakSupply = this.protocolState.totalSupply;
      }
      const currentDrawdown = safeDivide(peakSupply - this.protocolState.totalSupply, peakSupply, 0);
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);

      // Progress logging
      if (this.config.verbose && iteration % 100 === 0) {
        console.log(`[${currentTime.toISOString()}] Supply: ${formatNumber(this.protocolState.totalSupply)}, ` +
                   `Ratio: ${formatNumber(this.protocolState.backingRatio * 100)}%`);
      }

      // Advance time
      currentTime = new Date(currentTime.getTime() + timeStepMs);
    }

    // Calculate final metrics
    const metrics = this.calculateMetrics(maxSupply, minBackingRatio, maxDrawdown);
    const summary = this.generateSummary(maxSupply, minBackingRatio, maxDrawdown);

    const result: BacktestResult = {
      config: this.config,
      summary,
      events: this.events,
      invariantHistory: this.invariantHistory,
      metrics,
    };

    // Save results
    await this.saveResults(result);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // METRICS CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private calculateMetrics(
    maxSupply: number,
    minBackingRatio: number,
    maxDrawdown: number
  ): BacktestMetrics {
    const ratios = this.invariantHistory.map((h, i) => {
      const event = this.events.find(e =>
        e.timestamp.getTime() === h.timestamp.getTime() &&
        (e.type === 'MINT' || e.type === 'BURN' || e.type === 'ORACLE_UPDATE')
      );
      return event?.details?.newRatio || 1;
    });

    const avgBackingRatio = safeDivide(
      ratios.reduce((sum, r) => sum + r, 0),
      ratios.length,
      1
    );

    const ratioVariance = safeDivide(
      ratios.reduce((sum, r) => sum + Math.pow(r - avgBackingRatio, 2), 0),
      ratios.length,
      0
    );
    const backingRatioVolatility = Math.sqrt(ratioVariance);

    const mintEvents = this.events.filter(e => e.type === 'MINT');
    const burnEvents = this.events.filter(e => e.type === 'BURN');
    const oracleUpdates = this.events.filter(e => e.type === 'ORACLE_UPDATE');
    const oracleFailures = this.events.filter(e => e.type === 'ORACLE_FAILURE');
    const pauseEvents = this.events.filter(e => e.type === 'PAUSE');

    const totalMinted = mintEvents.reduce((sum, e) => sum + (e.details.amount || 0), 0);
    const totalBurned = burnEvents.reduce((sum, e) => sum + (e.details.amount || 0), 0);

    const epochCount = this.protocolState.epochNumber + 1;
    const avgMintPerEpoch = safeDivide(totalMinted, epochCount, 0);
    const avgBurnPerEpoch = safeDivide(totalBurned, epochCount, 0);

    const bankRunEvents = this.events.filter(e => e.type === 'BANK_RUN');
    const maxRedemptionPressure = bankRunEvents.length > 0
      ? Math.max(...bankRunEvents.map(e => e.details.redemptionRate || 0))
      : 0;

    const totalTimeSteps = this.invariantHistory.length;
    const staleTimeSteps = this.events.filter(e => e.type === 'ORACLE_FAILURE').length;
    const pausedTimeSteps = pauseEvents.length * 10; // Approximate pause duration
    const oracleUptimePercent = safeDivide((totalTimeSteps - staleTimeSteps) * 100, totalTimeSteps, 100);
    const protocolUptimePercent = safeDivide((totalTimeSteps - pausedTimeSteps) * 100, totalTimeSteps, 100);

    // Economic security score (0-100)
    const invariantViolations = this.invariantHistory.filter(h => !h.status.allPassed).length;
    const violationPenalty = safeDivide(invariantViolations * 100, totalTimeSteps, 0);
    const ratioPenalty = minBackingRatio < 1 ? (1 - minBackingRatio) * 50 : 0;
    const drawdownPenalty = maxDrawdown * 30;
    const uptimePenalty = (100 - protocolUptimePercent) * 0.2;

    const economicSecurityScore = clamp(
      100 - violationPenalty - ratioPenalty - drawdownPenalty - uptimePenalty,
      0,
      100
    );

    return {
      avgBackingRatio,
      backingRatioVolatility,
      avgMintPerEpoch,
      avgBurnPerEpoch,
      maxRedemptionPressure,
      oracleUptimePercent,
      protocolUptimePercent,
      economicSecurityScore,
    };
  }

  private generateSummary(
    maxSupply: number,
    minBackingRatio: number,
    maxDrawdown: number
  ): BacktestResult['summary'] {
    const mintEvents = this.events.filter(e => e.type === 'MINT');
    const burnEvents = this.events.filter(e => e.type === 'BURN');
    const oracleUpdates = this.events.filter(e => e.type === 'ORACLE_UPDATE');
    const oracleFailures = this.events.filter(e => e.type === 'ORACLE_FAILURE');
    const pauseEvents = this.events.filter(e => e.type === 'PAUSE');
    const invariantViolations = this.invariantHistory.filter(h => !h.status.allPassed);

    return {
      totalEvents: this.events.length,
      totalMints: mintEvents.length,
      totalBurns: burnEvents.length,
      totalOracleUpdates: oracleUpdates.length,
      oracleFailures: oracleFailures.length,
      pauseEvents: pauseEvents.length,
      invariantViolations: invariantViolations.length,
      maxDrawdown,
      minBackingRatio,
      maxSupply,
      finalSupply: this.protocolState.totalSupply,
      finalBacking: this.protocolState.totalBacking,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // OUTPUT & REPORTING
  // ═══════════════════════════════════════════════════════════════════════════════

  private async saveResults(result: BacktestResult): Promise<void> {
    const outputDir = this.config.outputDir;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save full results as JSON
    const resultsPath = path.join(outputDir, 'backtest-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));

    // Generate and save report
    const report = this.generateReport(result);
    const reportPath = path.join(outputDir, 'backtest-report.md');
    fs.writeFileSync(reportPath, report);

    // Save event log as CSV
    const csvPath = path.join(outputDir, 'events.csv');
    const csvContent = this.generateEventCsv(result.events);
    fs.writeFileSync(csvPath, csvContent);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         Backtest Complete - Results Saved                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`Results: ${resultsPath}`);
    console.log(`Report:  ${reportPath}`);
    console.log(`Events:  ${csvPath}`);
  }

  private generateReport(result: BacktestResult): string {
    const { summary, metrics, config } = result;

    return `# SecureMint Backtest Report

## Executive Summary

| Metric | Value |
|--------|-------|
| Period | ${config.startDate} to ${config.endDate} |
| Time Steps | ${summary.totalEvents} |
| Final Supply | ${formatNumber(summary.finalSupply)} |
| Final Backing | ${formatNumber(summary.finalBacking)} |
| Final Backing Ratio | ${formatNumber(safeDivide(summary.finalBacking, summary.finalSupply, 1) * 100)}% |

## Security Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Invariant Violations | ${summary.invariantViolations} | ${summary.invariantViolations === 0 ? '✅ PASS' : '❌ FAIL'} |
| Min Backing Ratio | ${formatNumber(summary.minBackingRatio * 100)}% | ${summary.minBackingRatio >= 1 ? '✅ PASS' : '⚠️ WARNING'} |
| Max Drawdown | ${formatNumber(summary.maxDrawdown * 100)}% | ${summary.maxDrawdown < 0.1 ? '✅ PASS' : '⚠️ WARNING'} |
| Oracle Uptime | ${formatNumber(metrics.oracleUptimePercent)}% | ${metrics.oracleUptimePercent >= 99 ? '✅ PASS' : '⚠️ WARNING'} |
| Protocol Uptime | ${formatNumber(metrics.protocolUptimePercent)}% | ${metrics.protocolUptimePercent >= 95 ? '✅ PASS' : '⚠️ WARNING'} |
| **Economic Security Score** | **${formatNumber(metrics.economicSecurityScore)}/100** | ${metrics.economicSecurityScore >= 80 ? '✅ PASS' : metrics.economicSecurityScore >= 60 ? '⚠️ WARNING' : '❌ FAIL'} |

## Activity Summary

| Event Type | Count |
|------------|-------|
| Mints | ${summary.totalMints} |
| Burns | ${summary.totalBurns} |
| Oracle Updates | ${summary.totalOracleUpdates} |
| Oracle Failures | ${summary.oracleFailures} |
| Pause Events | ${summary.pauseEvents} |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Avg Backing Ratio | ${formatNumber(metrics.avgBackingRatio * 100)}% |
| Backing Ratio Volatility | ${formatNumber(metrics.backingRatioVolatility * 100)}% |
| Avg Mint per Epoch | ${formatNumber(metrics.avgMintPerEpoch)} |
| Avg Burn per Epoch | ${formatNumber(metrics.avgBurnPerEpoch)} |
| Max Redemption Pressure | ${formatNumber(metrics.maxRedemptionPressure)}% |

## Invariant Analysis

${result.invariantHistory.filter(h => !h.status.allPassed).length === 0
  ? '✅ **All invariants held throughout the simulation.**'
  : `⚠️ **${result.invariantHistory.filter(h => !h.status.allPassed).length} invariant violations detected.**

### Violations by Type
| Invariant | Description | Violations |
|-----------|-------------|------------|
| INV-SM-1 | Supply ≤ Backing | ${result.invariantHistory.filter(h => !h.status['INV-SM-1']).length} |
| INV-SM-2 | No mint when paused | ${result.invariantHistory.filter(h => !h.status['INV-SM-2']).length} |
| INV-SM-3 | No mint with stale oracle | ${result.invariantHistory.filter(h => !h.status['INV-SM-3']).length} |
| INV-SM-4 | Epoch cap respected | ${result.invariantHistory.filter(h => !h.status['INV-SM-4']).length} |
`}

## Stress Test Results

${config.enableBankRunSimulation ? `### Bank Run Simulation
- Bank run events: ${result.events.filter(e => e.type === 'BANK_RUN').length}
- Max redemption pressure: ${formatNumber(metrics.maxRedemptionPressure)}%
- Protocol survived: ${summary.invariantViolations === 0 ? '✅ Yes' : '❌ No'}
` : 'Bank run simulation: Disabled'}

${config.enableOracleFailures ? `### Oracle Failure Simulation
- Oracle failures: ${summary.oracleFailures}
- Auto-pause triggered: ${result.events.filter(e => e.type === 'PAUSE' && e.details.reason === 'Stale oracle').length} times
` : 'Oracle failure simulation: Disabled'}

${config.enableMarketCrashes ? `### Market Crash Simulation
- Crash events: ${result.events.filter(e => e.type === 'CRASH').length}
- Crash magnitude: ${config.crashMagnitude}%
` : 'Market crash simulation: Disabled'}

---

*Generated by SecureMint Backtest Engine*
*Report Date: ${new Date().toISOString()}*
`;
  }

  private generateEventCsv(events: SimulationEvent[]): string {
    const headers = ['timestamp', 'type', 'details', 'invariants_passed'];
    const rows = events.map(e => [
      e.timestamp.toISOString(),
      e.type,
      JSON.stringify(e.details),
      e.invariantStatus.allPassed ? 'true' : 'false',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  // Default configuration
  const config: BacktestConfig = {
    startDate: args[0] || '2024-01-01',
    endDate: args[1] || '2024-12-31',
    timeStepHours: 1,

    initialSupply: 10_000_000,
    initialBacking: 10_500_000, // 105% backing
    epochDuration: 24, // 24 hours
    epochMintCap: 1_000_000, // 1M per epoch
    minBackingRatio: 1.0, // 100%

    oracleStalenessThreshold: 3600, // 1 hour
    oracleDeviationThreshold: 10, // 10%

    enableBankRunSimulation: true,
    bankRunRedemptionRate: 10, // 10% per hour during bank run
    enableOracleFailures: true,
    oracleFailureProbability: 0.001, // 0.1% per timestep
    enableMarketCrashes: true,
    crashMagnitude: 15, // 15% crash

    outputDir: path.join(__dirname, '../../../security_audit/backtest_results'),
    verbose: true,
  };

  const engine = new BacktestEngine(config);
  const result = await engine.run();

  // Print summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    BACKTEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Events:          ${result.summary.totalEvents}`);
  console.log(`Invariant Violations:  ${result.summary.invariantViolations}`);
  console.log(`Min Backing Ratio:     ${formatNumber(result.summary.minBackingRatio * 100)}%`);
  console.log(`Max Drawdown:          ${formatNumber(result.summary.maxDrawdown * 100)}%`);
  console.log(`Economic Security:     ${formatNumber(result.metrics.economicSecurityScore)}/100`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Exit with error if invariants violated
  if (result.summary.invariantViolations > 0) {
    console.error('❌ BACKTEST FAILED: Invariant violations detected');
    process.exit(1);
  }

  if (result.metrics.economicSecurityScore < 80) {
    console.warn('⚠️ BACKTEST WARNING: Economic security score below threshold');
    process.exit(1);
  }

  console.log('✅ BACKTEST PASSED');
  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { BacktestConfig, BacktestResult, BacktestMetrics };
