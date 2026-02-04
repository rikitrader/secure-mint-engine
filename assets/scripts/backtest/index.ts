/**
 * SecureMint Engine - Backtest Module
 *
 * Exports the backtest engine and related utilities for
 * testing protocol behavior under various market conditions.
 */

export { BacktestEngine, BacktestConfig, BacktestResult, BacktestMetrics } from './backtest-engine';

// Scenario presets for common backtest configurations
export const BacktestScenarios = {
  // Normal market conditions (baseline)
  BASELINE: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    timeStepHours: 1,
    initialSupply: 10_000_000,
    initialBacking: 10_500_000,
    epochDuration: 24,
    epochMintCap: 1_000_000,
    minBackingRatio: 1.0,
    oracleStalenessThreshold: 3600,
    oracleDeviationThreshold: 10,
    enableBankRunSimulation: false,
    bankRunRedemptionRate: 5,
    enableOracleFailures: false,
    oracleFailureProbability: 0,
    enableMarketCrashes: false,
    crashMagnitude: 10,
    outputDir: './backtest_results/baseline',
    verbose: false,
  },

  // Stress test: Bank run scenario
  BANK_RUN: {
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    timeStepHours: 1,
    initialSupply: 10_000_000,
    initialBacking: 10_500_000,
    epochDuration: 24,
    epochMintCap: 1_000_000,
    minBackingRatio: 1.0,
    oracleStalenessThreshold: 3600,
    oracleDeviationThreshold: 10,
    enableBankRunSimulation: true,
    bankRunRedemptionRate: 15, // 15% per hour (severe)
    enableOracleFailures: false,
    oracleFailureProbability: 0,
    enableMarketCrashes: false,
    crashMagnitude: 10,
    outputDir: './backtest_results/bank_run',
    verbose: true,
  },

  // Stress test: Oracle failures
  ORACLE_STRESS: {
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    timeStepHours: 1,
    initialSupply: 10_000_000,
    initialBacking: 10_500_000,
    epochDuration: 24,
    epochMintCap: 1_000_000,
    minBackingRatio: 1.0,
    oracleStalenessThreshold: 3600,
    oracleDeviationThreshold: 10,
    enableBankRunSimulation: false,
    bankRunRedemptionRate: 5,
    enableOracleFailures: true,
    oracleFailureProbability: 0.01, // 1% per timestep (high)
    enableMarketCrashes: false,
    crashMagnitude: 10,
    outputDir: './backtest_results/oracle_stress',
    verbose: true,
  },

  // Stress test: Market crash
  MARKET_CRASH: {
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    timeStepHours: 1,
    initialSupply: 10_000_000,
    initialBacking: 10_500_000,
    epochDuration: 24,
    epochMintCap: 1_000_000,
    minBackingRatio: 1.0,
    oracleStalenessThreshold: 3600,
    oracleDeviationThreshold: 10,
    enableBankRunSimulation: false,
    bankRunRedemptionRate: 5,
    enableOracleFailures: false,
    oracleFailureProbability: 0,
    enableMarketCrashes: true,
    crashMagnitude: 30, // 30% crash (severe)
    outputDir: './backtest_results/market_crash',
    verbose: true,
  },

  // Combined stress test: All scenarios
  COMBINED_STRESS: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    timeStepHours: 1,
    initialSupply: 10_000_000,
    initialBacking: 10_500_000,
    epochDuration: 24,
    epochMintCap: 1_000_000,
    minBackingRatio: 1.0,
    oracleStalenessThreshold: 3600,
    oracleDeviationThreshold: 10,
    enableBankRunSimulation: true,
    bankRunRedemptionRate: 10,
    enableOracleFailures: true,
    oracleFailureProbability: 0.005,
    enableMarketCrashes: true,
    crashMagnitude: 20,
    outputDir: './backtest_results/combined_stress',
    verbose: true,
  },
};

// Quick run function for CI integration
export async function runBacktest(scenario: keyof typeof BacktestScenarios): Promise<boolean> {
  const { BacktestEngine } = await import('./backtest-engine');
  const config = BacktestScenarios[scenario];
  const engine = new BacktestEngine(config as any);
  const result = await engine.run();

  return result.summary.invariantViolations === 0 &&
         result.metrics.economicSecurityScore >= 80;
}

// CI integration function
export async function runAllScenarios(): Promise<{
  passed: boolean;
  results: Record<string, boolean>;
}> {
  const results: Record<string, boolean> = {};
  let allPassed = true;

  for (const scenario of Object.keys(BacktestScenarios) as Array<keyof typeof BacktestScenarios>) {
    console.log(`\n\nRunning scenario: ${scenario}`);
    console.log('='.repeat(60));

    try {
      const passed = await runBacktest(scenario);
      results[scenario] = passed;
      if (!passed) allPassed = false;

      console.log(`Scenario ${scenario}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    } catch (error) {
      console.error(`Scenario ${scenario} error:`, error);
      results[scenario] = false;
      allPassed = false;
    }
  }

  return { passed: allPassed, results };
}
