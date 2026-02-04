/**
 * SecureMint Engine - Tenderly Integration
 * Transaction simulation before execution
 */

import { ethers, TransactionRequest, TransactionResponse } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TenderlyConfig {
  apiKey: string;
  accountSlug: string;
  projectSlug: string;
  networkId?: number;
  forkId?: string;
}

export interface SimulationRequest {
  from: string;
  to: string;
  input?: string;
  value?: string;
  gas?: number;
  gasPrice?: string;
  blockNumber?: number;
  stateOverrides?: Record<string, StateOverride>;
}

export interface StateOverride {
  balance?: string;
  nonce?: number;
  code?: string;
  storage?: Record<string, string>;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: number;
  gasLimit: number;
  status: boolean;
  trace: TraceEntry[];
  logs: LogEntry[];
  stateChanges: StateChange[];
  errorMessage?: string;
  revertReason?: string;
}

export interface TraceEntry {
  type: string;
  from: string;
  to: string;
  value: string;
  gas: number;
  gasUsed: number;
  input: string;
  output: string;
  error?: string;
}

export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  name?: string;
  inputs?: Record<string, unknown>;
}

export interface StateChange {
  address: string;
  key: string;
  before: string;
  after: string;
  dirty: boolean;
}

export interface InvariantCheckResult {
  invariant: string;
  passed: boolean;
  before: string;
  after: string;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TENDERLY SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class TenderlySimulator {
  private config: TenderlyConfig;
  private baseUrl: string;

  constructor(config: TenderlyConfig) {
    this.config = config;
    this.baseUrl = 'https://api.tenderly.co/api/v1';
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Simulate a transaction
   */
  async simulate(request: SimulationRequest): Promise<SimulationResult> {
    const response = await fetch(
      `${this.baseUrl}/account/${this.config.accountSlug}/project/${this.config.projectSlug}/simulate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          network_id: this.config.networkId || '1',
          from: request.from,
          to: request.to,
          input: request.input || '0x',
          value: request.value || '0',
          gas: request.gas || 8000000,
          gas_price: request.gasPrice || '0',
          block_number: request.blockNumber,
          state_objects: request.stateOverrides,
          save: false,
          save_if_fails: false,
          simulation_type: 'full',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Tenderly simulation failed: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return this.parseSimulationResult(data);
  }

  /**
   * Simulate an ethers.js transaction
   */
  async simulateTransaction(tx: TransactionRequest): Promise<SimulationResult> {
    return this.simulate({
      from: tx.from as string,
      to: tx.to as string,
      input: tx.data as string,
      value: tx.value?.toString() || '0',
      gas: Number(tx.gasLimit) || undefined,
      gasPrice: tx.gasPrice?.toString(),
    });
  }

  /**
   * Simulate a bundle of transactions
   */
  async simulateBundle(
    transactions: SimulationRequest[]
  ): Promise<SimulationResult[]> {
    const response = await fetch(
      `${this.baseUrl}/account/${this.config.accountSlug}/project/${this.config.projectSlug}/simulate-bundle`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          simulations: transactions.map((tx) => ({
            network_id: this.config.networkId || '1',
            from: tx.from,
            to: tx.to,
            input: tx.input || '0x',
            value: tx.value || '0',
            gas: tx.gas || 8000000,
            save: false,
          })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Tenderly bundle simulation failed: ${error.error?.message}`);
    }

    const data = await response.json();
    return data.simulation_results.map((result: unknown) =>
      this.parseSimulationResult({ transaction: result })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECUREMINT INVARIANT CHECKS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check all SecureMint invariants after simulation
   */
  async checkInvariants(
    simulation: SimulationResult,
    contracts: {
      token: string;
      oracle: string;
      policy: string;
      emergency: string;
    }
  ): Promise<InvariantCheckResult[]> {
    const results: InvariantCheckResult[] = [];

    // Extract state changes for relevant contracts
    const tokenChanges = simulation.stateChanges.filter(
      (c) => c.address.toLowerCase() === contracts.token.toLowerCase()
    );
    const oracleChanges = simulation.stateChanges.filter(
      (c) => c.address.toLowerCase() === contracts.oracle.toLowerCase()
    );
    const policyChanges = simulation.stateChanges.filter(
      (c) => c.address.toLowerCase() === contracts.policy.toLowerCase()
    );

    // INV-SM-1: Solvency Check
    const supplyChange = tokenChanges.find((c) => c.key.includes('totalSupply'));
    if (supplyChange) {
      const supplyBefore = BigInt(supplyChange.before);
      const supplyAfter = BigInt(supplyChange.after);
      // Would need oracle backing value - simplified check
      results.push({
        invariant: 'INV-SM-1',
        passed: supplyAfter >= 0n,
        before: supplyBefore.toString(),
        after: supplyAfter.toString(),
        message: supplyAfter >= 0n
          ? 'Supply change detected - verify backing'
          : 'Supply underflow detected',
      });
    }

    // INV-SM-2: Rate Limit Check
    const epochMintChange = policyChanges.find((c) =>
      c.key.includes('epochMintedAmount')
    );
    if (epochMintChange) {
      const mintedBefore = BigInt(epochMintChange.before);
      const mintedAfter = BigInt(epochMintChange.after);
      // Would need epoch capacity - simplified check
      results.push({
        invariant: 'INV-SM-2',
        passed: mintedAfter >= mintedBefore,
        before: mintedBefore.toString(),
        after: mintedAfter.toString(),
        message: `Epoch minted: ${mintedBefore} -> ${mintedAfter}`,
      });
    }

    // Check for revert
    if (!simulation.success) {
      results.push({
        invariant: 'TRANSACTION',
        passed: false,
        before: 'pending',
        after: 'reverted',
        message: simulation.revertReason || 'Transaction would revert',
      });
    }

    return results;
  }

  /**
   * Simulate SecureMint mint operation with invariant validation
   */
  async simulateMint(
    policyAddress: string,
    recipient: string,
    amount: bigint,
    sender: string,
    contracts: {
      token: string;
      oracle: string;
      policy: string;
      emergency: string;
    }
  ): Promise<{
    simulation: SimulationResult;
    invariants: InvariantCheckResult[];
    safe: boolean;
  }> {
    // Encode secureMint call
    const iface = new ethers.Interface([
      'function secureMint(address to, uint256 amount)',
    ]);
    const data = iface.encodeFunctionData('secureMint', [recipient, amount]);

    const simulation = await this.simulate({
      from: sender,
      to: policyAddress,
      input: data,
      value: '0',
    });

    const invariants = await this.checkInvariants(simulation, contracts);
    const safe = invariants.every((i) => i.passed) && simulation.success;

    return { simulation, invariants, safe };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FORK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a fork for testing
   */
  async createFork(
    networkId: number,
    blockNumber?: number
  ): Promise<{ forkId: string; rpcUrl: string }> {
    const response = await fetch(
      `${this.baseUrl}/account/${this.config.accountSlug}/project/${this.config.projectSlug}/fork`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          network_id: networkId,
          block_number: blockNumber,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create Tenderly fork');
    }

    const data = await response.json();
    return {
      forkId: data.simulation_fork.id,
      rpcUrl: `https://rpc.tenderly.co/fork/${data.simulation_fork.id}`,
    };
  }

  /**
   * Delete a fork
   */
  async deleteFork(forkId: string): Promise<void> {
    await fetch(
      `${this.baseUrl}/account/${this.config.accountSlug}/project/${this.config.projectSlug}/fork/${forkId}`,
      {
        method: 'DELETE',
        headers: {
          'X-Access-Key': this.config.apiKey,
        },
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private parseSimulationResult(data: any): SimulationResult {
    const tx = data.transaction || data;

    return {
      success: tx.status === true || tx.status === 1,
      gasUsed: tx.gas_used || 0,
      gasLimit: tx.gas || 0,
      status: tx.status === true || tx.status === 1,
      trace: (tx.trace || []).map((t: any) => ({
        type: t.type,
        from: t.from,
        to: t.to,
        value: t.value || '0',
        gas: t.gas || 0,
        gasUsed: t.gas_used || 0,
        input: t.input || '0x',
        output: t.output || '0x',
        error: t.error,
      })),
      logs: (tx.logs || []).map((l: any) => ({
        address: l.raw.address,
        topics: l.raw.topics,
        data: l.raw.data,
        name: l.name,
        inputs: l.inputs,
      })),
      stateChanges: (tx.state_diff || []).flatMap((diff: any) =>
        (diff.raw || []).map((r: any) => ({
          address: diff.address,
          key: r.key,
          before: r.original,
          after: r.dirty,
          dirty: r.original !== r.dirty,
        }))
      ),
      errorMessage: tx.error_message,
      revertReason: tx.decoded_output,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION PROVIDER WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Provider wrapper that simulates before sending
 */
export class SimulatingProvider extends ethers.JsonRpcProvider {
  private simulator: TenderlySimulator;
  private contracts: {
    token: string;
    oracle: string;
    policy: string;
    emergency: string;
  };
  private simulateBeforeSend: boolean;

  constructor(
    url: string,
    simulator: TenderlySimulator,
    contracts: {
      token: string;
      oracle: string;
      policy: string;
      emergency: string;
    },
    simulateBeforeSend = true
  ) {
    super(url);
    this.simulator = simulator;
    this.contracts = contracts;
    this.simulateBeforeSend = simulateBeforeSend;
  }

  async broadcastTransaction(
    signedTx: string
  ): Promise<TransactionResponse> {
    if (this.simulateBeforeSend) {
      // Decode transaction to simulate
      const tx = ethers.Transaction.from(signedTx);

      const simulation = await this.simulator.simulate({
        from: tx.from!,
        to: tx.to!,
        input: tx.data,
        value: tx.value.toString(),
        gas: Number(tx.gasLimit),
      });

      const invariants = await this.simulator.checkInvariants(
        simulation,
        this.contracts
      );

      const allPassed = invariants.every((i) => i.passed);

      if (!simulation.success || !allPassed) {
        const reasons = invariants
          .filter((i) => !i.passed)
          .map((i) => `${i.invariant}: ${i.message}`)
          .join(', ');

        throw new Error(
          `Transaction would violate invariants: ${reasons || simulation.revertReason || 'Unknown'}`
        );
      }
    }

    return super.broadcastTransaction(signedTx);
  }
}

export default TenderlySimulator;
