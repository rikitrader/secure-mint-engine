/**
 * SecureMint Engine - WebSocket Real-time Subscriptions
 * Event streaming for protocol monitoring
 */

import { ethers, Contract, Provider, Log } from 'ethers';
import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebSocketConfig {
  wsUrl: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

export interface SubscriptionOptions {
  fromBlock?: number | 'latest';
  filter?: Record<string, unknown>;
}

export type EventCallback<T = unknown> = (event: T, log: Log) => void;

export interface MintEvent {
  to: string;
  amount: bigint;
  epoch: bigint;
  backing: bigint;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface BurnEvent {
  from: string;
  amount: bigint;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface OracleUpdateEvent {
  newBacking: bigint;
  oldBacking: bigint;
  updater: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface EmergencyLevelEvent {
  newLevel: number;
  oldLevel: number;
  setter: string;
  reason: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface RedemptionEvent {
  redeemer: string;
  tokenAmount: bigint;
  reserveAmount: bigint;
  fee: bigint;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class SecureMintWebSocket extends EventEmitter {
  private config: WebSocketConfig;
  private provider: ethers.WebSocketProvider | null = null;
  private contracts: Map<string, Contract> = new Map();
  private subscriptions: Map<string, ethers.ContractEventName> = new Map();
  private reconnectAttempts = 0;
  private isConnected = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      ...config,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Connect to WebSocket provider
   */
  async connect(): Promise<void> {
    try {
      this.provider = new ethers.WebSocketProvider(this.config.wsUrl);

      // Set up connection monitoring
      this.provider.websocket.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.startPing();
      });

      this.provider.websocket.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
        this.stopPing();
        this.attemptReconnect();
      });

      this.provider.websocket.on('error', (error) => {
        this.emit('error', error);
      });

      // Wait for connection
      await this.provider.ready;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    this.stopPing();

    if (this.provider) {
      await this.provider.destroy();
      this.provider = null;
    }

    this.isConnected = false;
    this.contracts.clear();
    this.subscriptions.clear();
    this.emit('disconnected');
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONTRACT REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Register a contract for event subscriptions
   */
  registerContract(name: string, address: string, abi: ethers.InterfaceAbi): void {
    if (!this.provider) {
      throw new Error('Not connected');
    }

    const contract = new Contract(address, abi, this.provider);
    this.contracts.set(name, contract);
  }

  /**
   * Register SecureMint contracts
   */
  registerSecureMintContracts(addresses: {
    token: string;
    policy: string;
    oracle: string;
    treasury: string;
    redemption: string;
    emergency: string;
    governor: string;
  }): void {
    // Token events
    this.registerContract('token', addresses.token, [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'event Approval(address indexed owner, address indexed spender, uint256 value)',
    ]);

    // Policy events
    this.registerContract('policy', addresses.policy, [
      'event SecureMint(address indexed to, uint256 amount, uint256 epoch, uint256 backing)',
      'event EpochCapacityUpdated(uint256 oldCapacity, uint256 newCapacity)',
      'event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold)',
    ]);

    // Oracle events
    this.registerContract('oracle', addresses.oracle, [
      'event BackingUpdated(uint256 newBacking, uint256 oldBacking, address indexed updater)',
      'event OracleSourceUpdated(address indexed newSource)',
    ]);

    // Treasury events
    this.registerContract('treasury', addresses.treasury, [
      'event Deposit(address indexed from, uint256 amount, uint8 tier)',
      'event Withdrawal(address indexed to, uint256 amount, uint8 tier, string reason)',
      'event TierTransfer(uint8 fromTier, uint8 toTier, uint256 amount)',
      'event Rebalanced(uint256[4] oldBalances, uint256[4] newBalances)',
    ]);

    // Redemption events
    this.registerContract('redemption', addresses.redemption, [
      'event RedemptionRequested(address indexed redeemer, uint256 tokenAmount, uint256 reserveAmount, uint256 fee)',
      'event RedemptionCompleted(address indexed redeemer, uint256 amount)',
      'event RedemptionCancelled(address indexed redeemer, uint256 amount)',
    ]);

    // Emergency events
    this.registerContract('emergency', addresses.emergency, [
      'event LevelChanged(uint8 newLevel, uint8 oldLevel, address indexed setter, string reason)',
    ]);

    // Governor events
    this.registerContract('governor', addresses.governor, [
      'event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)',
      'event ProposalExecuted(uint256 indexed proposalId)',
      'event ProposalCancelled(uint256 indexed proposalId)',
      'event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight)',
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to SecureMint events
   */
  onMint(callback: EventCallback<MintEvent>): () => void {
    return this.subscribeToEvent('policy', 'SecureMint', (log, decoded) => {
      const event: MintEvent = {
        to: decoded.to,
        amount: decoded.amount,
        epoch: decoded.epoch,
        backing: decoded.backing,
        timestamp: Date.now(),
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
      callback(event, log);
    });
  }

  /**
   * Subscribe to burn events
   */
  onBurn(callback: EventCallback<BurnEvent>): () => void {
    return this.subscribeToEvent('token', 'Transfer', (log, decoded) => {
      // Burn is a transfer to zero address
      if (decoded.to === ethers.ZeroAddress) {
        const event: BurnEvent = {
          from: decoded.from,
          amount: decoded.value,
          timestamp: Date.now(),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
        };
        callback(event, log);
      }
    });
  }

  /**
   * Subscribe to oracle updates
   */
  onOracleUpdate(callback: EventCallback<OracleUpdateEvent>): () => void {
    return this.subscribeToEvent('oracle', 'BackingUpdated', (log, decoded) => {
      const event: OracleUpdateEvent = {
        newBacking: decoded.newBacking,
        oldBacking: decoded.oldBacking,
        updater: decoded.updater,
        timestamp: Date.now(),
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
      callback(event, log);
    });
  }

  /**
   * Subscribe to emergency level changes
   */
  onEmergencyLevel(callback: EventCallback<EmergencyLevelEvent>): () => void {
    return this.subscribeToEvent('emergency', 'LevelChanged', (log, decoded) => {
      const event: EmergencyLevelEvent = {
        newLevel: Number(decoded.newLevel),
        oldLevel: Number(decoded.oldLevel),
        setter: decoded.setter,
        reason: decoded.reason,
        timestamp: Date.now(),
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
      callback(event, log);
    });
  }

  /**
   * Subscribe to redemption events
   */
  onRedemption(callback: EventCallback<RedemptionEvent>): () => void {
    return this.subscribeToEvent('redemption', 'RedemptionRequested', (log, decoded) => {
      const event: RedemptionEvent = {
        redeemer: decoded.redeemer,
        tokenAmount: decoded.tokenAmount,
        reserveAmount: decoded.reserveAmount,
        fee: decoded.fee,
        timestamp: Date.now(),
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
      callback(event, log);
    });
  }

  /**
   * Subscribe to all protocol events
   */
  onAnyEvent(callback: (name: string, event: unknown, log: Log) => void): () => void {
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(this.onMint((e, l) => callback('Mint', e, l)));
    unsubscribers.push(this.onBurn((e, l) => callback('Burn', e, l)));
    unsubscribers.push(this.onOracleUpdate((e, l) => callback('OracleUpdate', e, l)));
    unsubscribers.push(this.onEmergencyLevel((e, l) => callback('EmergencyLevel', e, l)));
    unsubscribers.push(this.onRedemption((e, l) => callback('Redemption', e, l)));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Subscribe to new blocks
   */
  onBlock(callback: (blockNumber: number) => void): () => void {
    if (!this.provider) {
      throw new Error('Not connected');
    }

    this.provider.on('block', callback);

    return () => {
      this.provider?.off('block', callback);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private subscribeToEvent(
    contractName: string,
    eventName: string,
    callback: (log: Log, decoded: any) => void
  ): () => void {
    const contract = this.contracts.get(contractName);
    if (!contract) {
      throw new Error(`Contract ${contractName} not registered`);
    }

    const filter = contract.filters[eventName]();
    const subscriptionId = `${contractName}:${eventName}:${Date.now()}`;

    const listener = (...args: any[]) => {
      const log = args[args.length - 1] as Log;
      const decoded = args.slice(0, -1).reduce((acc, val, idx) => {
        const fragment = contract.interface.getEvent(eventName);
        if (fragment && fragment.inputs[idx]) {
          acc[fragment.inputs[idx].name] = val;
        }
        return acc;
      }, {} as any);

      callback(log, decoded);
    };

    contract.on(filter, listener);
    this.subscriptions.set(subscriptionId, filter);

    return () => {
      contract.off(filter, listener);
      this.subscriptions.delete(subscriptionId);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts);

    setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('reconnectError', error);
      });
    }, this.config.reconnectInterval || 5000);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.provider) {
        this.provider.getBlockNumber().catch(() => {
          // Connection might be dead
          this.emit('pingFailed');
        });
      }
    }, this.config.pingInterval || 30000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export default SecureMintWebSocket;
