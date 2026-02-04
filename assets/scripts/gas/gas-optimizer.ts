/**
 * SecureMint Engine - Gas Optimization Tools
 * Estimate and optimize transaction costs
 */

import { ethers, Contract, TransactionRequest } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface GasEstimate {
  operation: string;
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
  estimatedCostGwei: string;
  estimatedCostEth: string;
  estimatedCostUsd: number;
}

interface GasOptimizationResult {
  original: GasEstimate;
  optimized: GasEstimate;
  savings: {
    gasUnits: bigint;
    costWei: bigint;
    costUsd: number;
    percentSaved: number;
  };
  suggestions: string[];
}

interface BatchOperationEstimate {
  individual: GasEstimate;
  batched: GasEstimate;
  totalSavings: {
    gasUnits: bigint;
    costWei: bigint;
    costUsd: number;
    percentSaved: number;
  };
  breakEvenCount: number;
}

interface GasConfig {
  rpcUrl: string;
  tokenAddress: string;
  policyAddress: string;
  treasuryAddress: string;
  ethPriceUsd: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAS OPTIMIZER
// ═══════════════════════════════════════════════════════════════════════════════

export class GasOptimizer {
  private provider: ethers.JsonRpcProvider;
  private config: GasConfig;

  constructor(config: GasConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAS ESTIMATION
  // ═══════════════════════════════════════════════════════════════════════════

  async estimateOperation(
    operation: string,
    contract: Contract,
    method: string,
    args: any[]
  ): Promise<GasEstimate> {
    const feeData = await this.provider.getFeeData();

    // Estimate gas for the operation
    const gasLimit = await contract[method].estimateGas(...args);

    const gasPrice = feeData.gasPrice || 0n;
    const maxFeePerGas = feeData.maxFeePerGas || gasPrice;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 0n;

    const estimatedCostWei = gasLimit * maxFeePerGas;

    return {
      operation,
      gasLimit,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      estimatedCostWei,
      estimatedCostGwei: ethers.formatUnits(estimatedCostWei, 'gwei'),
      estimatedCostEth: ethers.formatEther(estimatedCostWei),
      estimatedCostUsd: Number(ethers.formatEther(estimatedCostWei)) * this.config.ethPriceUsd,
    };
  }

  async estimateAllOperations(): Promise<Record<string, GasEstimate>> {
    const estimates: Record<string, GasEstimate> = {};

    // Standard gas estimates (can be refined with actual contract calls)
    const operations = [
      { name: 'transfer', gas: 65000n },
      { name: 'approve', gas: 46000n },
      { name: 'mint', gas: 150000n },
      { name: 'burn', gas: 100000n },
      { name: 'redemption_request', gas: 200000n },
      { name: 'redemption_process', gas: 180000n },
      { name: 'bridge_initiate', gas: 250000n },
      { name: 'bridge_complete', gas: 200000n },
      { name: 'oracle_update', gas: 80000n },
      { name: 'emergency_pause', gas: 50000n },
      { name: 'governance_propose', gas: 300000n },
      { name: 'governance_vote', gas: 120000n },
      { name: 'governance_execute', gas: 500000n },
    ];

    const feeData = await this.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 0n;

    for (const op of operations) {
      const estimatedCostWei = op.gas * maxFeePerGas;

      estimates[op.name] = {
        operation: op.name,
        gasLimit: op.gas,
        gasPrice: feeData.gasPrice || 0n,
        maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
        estimatedCostWei,
        estimatedCostGwei: ethers.formatUnits(estimatedCostWei, 'gwei'),
        estimatedCostEth: ethers.formatEther(estimatedCostWei),
        estimatedCostUsd: Number(ethers.formatEther(estimatedCostWei)) * this.config.ethPriceUsd,
      };
    }

    return estimates;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async estimateBatchOptimization(
    operation: string,
    count: number
  ): Promise<BatchOperationEstimate> {
    const feeData = await this.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 0n;

    // Individual operation costs
    const individualGas: Record<string, bigint> = {
      transfer: 65000n,
      mint: 150000n,
      burn: 100000n,
      approve: 46000n,
    };

    // Batched operation costs (base + per-item)
    const batchedGas: Record<string, { base: bigint; perItem: bigint }> = {
      transfer: { base: 50000n, perItem: 45000n },
      mint: { base: 100000n, perItem: 100000n },
      burn: { base: 80000n, perItem: 70000n },
      approve: { base: 40000n, perItem: 30000n },
    };

    const indivGas = individualGas[operation] || 100000n;
    const batchConfig = batchedGas[operation] || { base: 80000n, perItem: 70000n };

    const totalIndividualGas = indivGas * BigInt(count);
    const totalBatchedGas = batchConfig.base + batchConfig.perItem * BigInt(count);

    const individualCostWei = totalIndividualGas * maxFeePerGas;
    const batchedCostWei = totalBatchedGas * maxFeePerGas;

    const gasSaved = totalIndividualGas - totalBatchedGas;
    const costSaved = individualCostWei - batchedCostWei;

    // Calculate break-even point
    const breakEven = Number(batchConfig.base) / (Number(indivGas) - Number(batchConfig.perItem));

    return {
      individual: {
        operation: `${count}x ${operation}`,
        gasLimit: totalIndividualGas,
        gasPrice: feeData.gasPrice || 0n,
        maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
        estimatedCostWei: individualCostWei,
        estimatedCostGwei: ethers.formatUnits(individualCostWei, 'gwei'),
        estimatedCostEth: ethers.formatEther(individualCostWei),
        estimatedCostUsd: Number(ethers.formatEther(individualCostWei)) * this.config.ethPriceUsd,
      },
      batched: {
        operation: `batch_${operation}`,
        gasLimit: totalBatchedGas,
        gasPrice: feeData.gasPrice || 0n,
        maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
        estimatedCostWei: batchedCostWei,
        estimatedCostGwei: ethers.formatUnits(batchedCostWei, 'gwei'),
        estimatedCostEth: ethers.formatEther(batchedCostWei),
        estimatedCostUsd: Number(ethers.formatEther(batchedCostWei)) * this.config.ethPriceUsd,
      },
      totalSavings: {
        gasUnits: gasSaved,
        costWei: costSaved,
        costUsd: Number(ethers.formatEther(costSaved)) * this.config.ethPriceUsd,
        percentSaved: Number((gasSaved * 100n) / totalIndividualGas),
      },
      breakEvenCount: Math.ceil(breakEven),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAS PRICE STRATEGIES
  // ═══════════════════════════════════════════════════════════════════════════

  async getOptimalGasPrice(
    urgency: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    estimatedWaitBlocks: number;
  }> {
    const feeData = await this.provider.getFeeData();
    const baseFee = feeData.maxFeePerGas || feeData.gasPrice || 0n;
    const priorityFee = feeData.maxPriorityFeePerGas || 0n;

    // Adjust based on urgency
    const multipliers: Record<string, { base: number; priority: number; wait: number }> = {
      low: { base: 0.8, priority: 0.5, wait: 10 },
      medium: { base: 1.0, priority: 1.0, wait: 3 },
      high: { base: 1.2, priority: 1.5, wait: 1 },
    };

    const mult = multipliers[urgency];

    return {
      maxFeePerGas: BigInt(Math.floor(Number(baseFee) * mult.base)),
      maxPriorityFeePerGas: BigInt(Math.floor(Number(priorityFee) * mult.priority)),
      estimatedWaitBlocks: mult.wait,
    };
  }

  async getHistoricalGasPrices(
    blocks: number = 100
  ): Promise<{
    min: bigint;
    max: bigint;
    average: bigint;
    median: bigint;
    percentiles: Record<string, bigint>;
  }> {
    const currentBlock = await this.provider.getBlockNumber();
    const gasPrices: bigint[] = [];

    // Fetch gas prices from recent blocks
    for (let i = 0; i < blocks; i++) {
      try {
        const block = await this.provider.getBlock(currentBlock - i);
        if (block?.baseFeePerGas) {
          gasPrices.push(block.baseFeePerGas);
        }
      } catch {
        // Skip blocks that fail
      }
    }

    if (gasPrices.length === 0) {
      const feeData = await this.provider.getFeeData();
      const current = feeData.gasPrice || 0n;
      return {
        min: current,
        max: current,
        average: current,
        median: current,
        percentiles: { '25': current, '50': current, '75': current, '90': current },
      };
    }

    gasPrices.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const sum = gasPrices.reduce((a, b) => a + b, 0n);
    const average = sum / BigInt(gasPrices.length);
    const median = gasPrices[Math.floor(gasPrices.length / 2)];

    const percentile = (p: number) => gasPrices[Math.floor(gasPrices.length * p / 100)];

    return {
      min: gasPrices[0],
      max: gasPrices[gasPrices.length - 1],
      average,
      median,
      percentiles: {
        '25': percentile(25),
        '50': percentile(50),
        '75': percentile(75),
        '90': percentile(90),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMIZATION SUGGESTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async analyzeAndOptimize(
    operation: string,
    tx: TransactionRequest
  ): Promise<GasOptimizationResult> {
    const feeData = await this.provider.getFeeData();

    // Estimate original gas
    const originalGas = await this.provider.estimateGas(tx);
    const originalCost = originalGas * (feeData.maxFeePerGas || feeData.gasPrice || 0n);

    // Apply optimizations
    const suggestions: string[] = [];
    let optimizedGas = originalGas;

    // Check data size
    if (tx.data && tx.data.toString().length > 1000) {
      suggestions.push('Consider using calldata compression for large payloads');
      optimizedGas = (optimizedGas * 95n) / 100n;
    }

    // Check value transfers
    if (tx.value && tx.value > 0n) {
      suggestions.push('Batch multiple value transfers to save base transaction gas');
    }

    // Check time of day for gas prices
    const hour = new Date().getUTCHours();
    if (hour >= 12 && hour <= 20) {
      suggestions.push('Consider scheduling transactions for off-peak hours (UTC 0-8)');
    }

    // Check for potential batching
    if (['transfer', 'mint', 'burn'].includes(operation)) {
      suggestions.push(`Use batch${operation} for multiple operations to save ~30% gas`);
    }

    const optimizedCost = optimizedGas * (feeData.maxFeePerGas || feeData.gasPrice || 0n);

    const createEstimate = (gas: bigint, cost: bigint): GasEstimate => ({
      operation,
      gasLimit: gas,
      gasPrice: feeData.gasPrice || 0n,
      maxFeePerGas: feeData.maxFeePerGas || 0n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
      estimatedCostWei: cost,
      estimatedCostGwei: ethers.formatUnits(cost, 'gwei'),
      estimatedCostEth: ethers.formatEther(cost),
      estimatedCostUsd: Number(ethers.formatEther(cost)) * this.config.ethPriceUsd,
    });

    return {
      original: createEstimate(originalGas, originalCost),
      optimized: createEstimate(optimizedGas, optimizedCost),
      savings: {
        gasUnits: originalGas - optimizedGas,
        costWei: originalCost - optimizedCost,
        costUsd: Number(ethers.formatEther(originalCost - optimizedCost)) * this.config.ethPriceUsd,
        percentSaved: Number(((originalGas - optimizedGas) * 100n) / originalGas),
      },
      suggestions,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  async generateGasReport(): Promise<string> {
    const estimates = await this.estimateAllOperations();
    const historical = await this.getHistoricalGasPrices();

    let report = '# SecureMint Gas Optimization Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `ETH Price: $${this.config.ethPriceUsd}\n\n`;

    report += '## Current Gas Prices\n\n';
    report += `| Metric | Value (Gwei) |\n`;
    report += `|--------|-------------|\n`;
    report += `| Min (100 blocks) | ${ethers.formatUnits(historical.min, 'gwei')} |\n`;
    report += `| Average | ${ethers.formatUnits(historical.average, 'gwei')} |\n`;
    report += `| Median | ${ethers.formatUnits(historical.median, 'gwei')} |\n`;
    report += `| Max | ${ethers.formatUnits(historical.max, 'gwei')} |\n\n`;

    report += '## Operation Costs\n\n';
    report += `| Operation | Gas | Cost (ETH) | Cost (USD) |\n`;
    report += `|-----------|-----|------------|------------|\n`;

    for (const [name, estimate] of Object.entries(estimates)) {
      report += `| ${name} | ${estimate.gasLimit} | ${estimate.estimatedCostEth} | $${estimate.estimatedCostUsd.toFixed(2)} |\n`;
    }

    report += '\n## Batch Optimization Recommendations\n\n';

    for (const op of ['transfer', 'mint', 'burn']) {
      const batch = await this.estimateBatchOptimization(op, 10);
      report += `### ${op} (10 operations)\n`;
      report += `- Individual: ${batch.individual.estimatedCostEth} ETH ($${batch.individual.estimatedCostUsd.toFixed(2)})\n`;
      report += `- Batched: ${batch.batched.estimatedCostEth} ETH ($${batch.batched.estimatedCostUsd.toFixed(2)})\n`;
      report += `- Savings: ${batch.totalSavings.percentSaved}% ($${batch.totalSavings.costUsd.toFixed(2)})\n`;
      report += `- Break-even: ${batch.breakEvenCount} operations\n\n`;
    }

    return report;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const optimizer = new GasOptimizer({
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    tokenAddress: process.env.TOKEN_ADDRESS || '',
    policyAddress: process.env.POLICY_ADDRESS || '',
    treasuryAddress: process.env.TREASURY_ADDRESS || '',
    ethPriceUsd: parseFloat(process.env.ETH_PRICE_USD || '2000'),
  });

  const report = await optimizer.generateGasReport();
  console.log(report);
}

main().catch(console.error);

export default GasOptimizer;
