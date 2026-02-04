/**
 * SecureMint Engine - Gnosis Safe Integration
 * Multi-sig wallet for admin operations
 */

import { ethers, Contract, Signer } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SafeConfig {
  safeAddress: string;
  chainId: number;
  rpcUrl: string;
  safeServiceUrl?: string;
}

export interface SafeTransaction {
  to: string;
  value: string;
  data: string;
  operation: 0 | 1; // 0 = Call, 1 = DelegateCall
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
}

export interface SafeSignature {
  signer: string;
  data: string;
  timestamp: number;
}

export interface PendingTransaction {
  safeTxHash: string;
  transaction: SafeTransaction;
  signatures: SafeSignature[];
  confirmationsRequired: number;
  confirmations: number;
  isExecutable: boolean;
  proposer: string;
  createdAt: Date;
}

export type AdminOperation =
  | 'UPDATE_ORACLE'
  | 'SET_EPOCH_CAP'
  | 'SET_GLOBAL_CAP'
  | 'PAUSE'
  | 'UNPAUSE'
  | 'ADD_MINTER'
  | 'REMOVE_MINTER'
  | 'UPDATE_FEE'
  | 'UPGRADE_CONTRACT'
  | 'EMERGENCY_WITHDRAW';

// ═══════════════════════════════════════════════════════════════════════════════
// GNOSIS SAFE ABI (PARTIAL)
// ═══════════════════════════════════════════════════════════════════════════════

const SAFE_ABI = [
  'function getThreshold() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function nonce() view returns (uint256)',
  'function isOwner(address owner) view returns (bool)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function approveHash(bytes32 hashToApprove) external',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)',
  'event ExecutionSuccess(bytes32 txHash, uint256 payment)',
  'event ExecutionFailure(bytes32 txHash, uint256 payment)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// GNOSIS SAFE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class GnosisSafeClient {
  private safe: Contract;
  private provider: ethers.JsonRpcProvider;
  private config: SafeConfig;
  private pendingTxs: Map<string, PendingTransaction> = new Map();

  constructor(config: SafeConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.safe = new ethers.Contract(config.safeAddress, SAFE_ABI, this.provider);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFE INFO
  // ═══════════════════════════════════════════════════════════════════════════

  async getSafeInfo(): Promise<{
    address: string;
    threshold: number;
    owners: string[];
    nonce: number;
    chainId: number;
  }> {
    const [threshold, owners, nonce] = await Promise.all([
      this.safe.getThreshold(),
      this.safe.getOwners(),
      this.safe.nonce(),
    ]);

    return {
      address: this.config.safeAddress,
      threshold: Number(threshold),
      owners,
      nonce: Number(nonce),
      chainId: this.config.chainId,
    };
  }

  async isOwner(address: string): Promise<boolean> {
    return this.safe.isOwner(address);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  async createTransaction(
    to: string,
    value: string,
    data: string,
    operation: AdminOperation,
    signer: Signer
  ): Promise<string> {
    const signerAddress = await signer.getAddress();

    // Verify signer is owner
    if (!(await this.isOwner(signerAddress))) {
      throw new Error(`${signerAddress} is not a Safe owner`);
    }

    const nonce = await this.safe.nonce();

    const safeTx: SafeTransaction = {
      to,
      value,
      data,
      operation: 0, // Call
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce: Number(nonce),
    };

    // Calculate transaction hash
    const safeTxHash = await this.safe.getTransactionHash(
      safeTx.to,
      safeTx.value,
      safeTx.data,
      safeTx.operation,
      safeTx.safeTxGas,
      safeTx.baseGas,
      safeTx.gasPrice,
      safeTx.gasToken,
      safeTx.refundReceiver,
      safeTx.nonce
    );

    // Sign the hash
    const signature = await signer.signMessage(ethers.getBytes(safeTxHash));

    const safeInfo = await this.getSafeInfo();

    // Store pending transaction
    const pendingTx: PendingTransaction = {
      safeTxHash,
      transaction: safeTx,
      signatures: [
        {
          signer: signerAddress,
          data: signature,
          timestamp: Date.now(),
        },
      ],
      confirmationsRequired: safeInfo.threshold,
      confirmations: 1,
      isExecutable: safeInfo.threshold === 1,
      proposer: signerAddress,
      createdAt: new Date(),
    };

    this.pendingTxs.set(safeTxHash, pendingTx);

    // If using Safe Transaction Service, submit there
    if (this.config.safeServiceUrl) {
      await this.submitToService(pendingTx);
    }

    return safeTxHash;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION CONFIRMATION
  // ═══════════════════════════════════════════════════════════════════════════

  async confirmTransaction(safeTxHash: string, signer: Signer): Promise<void> {
    const signerAddress = await signer.getAddress();

    if (!(await this.isOwner(signerAddress))) {
      throw new Error(`${signerAddress} is not a Safe owner`);
    }

    const pendingTx = this.pendingTxs.get(safeTxHash);
    if (!pendingTx) {
      throw new Error('Transaction not found');
    }

    // Check if already signed
    if (pendingTx.signatures.some((s) => s.signer === signerAddress)) {
      throw new Error('Already confirmed by this signer');
    }

    // Sign the hash
    const signature = await signer.signMessage(ethers.getBytes(safeTxHash));

    pendingTx.signatures.push({
      signer: signerAddress,
      data: signature,
      timestamp: Date.now(),
    });

    pendingTx.confirmations++;
    pendingTx.isExecutable = pendingTx.confirmations >= pendingTx.confirmationsRequired;

    this.pendingTxs.set(safeTxHash, pendingTx);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  async executeTransaction(safeTxHash: string, signer: Signer): Promise<string> {
    const pendingTx = this.pendingTxs.get(safeTxHash);
    if (!pendingTx) {
      throw new Error('Transaction not found');
    }

    if (!pendingTx.isExecutable) {
      throw new Error(
        `Not enough confirmations: ${pendingTx.confirmations}/${pendingTx.confirmationsRequired}`
      );
    }

    // Sort signatures by signer address (required by Safe)
    const sortedSignatures = [...pendingTx.signatures].sort((a, b) =>
      a.signer.toLowerCase().localeCompare(b.signer.toLowerCase())
    );

    // Concatenate signatures
    const signatures = ethers.concat(sortedSignatures.map((s) => s.data));

    const tx = pendingTx.transaction;

    // Execute
    const safeWithSigner = this.safe.connect(signer) as Contract;
    const execTx = await safeWithSigner.execTransaction(
      tx.to,
      tx.value,
      tx.data,
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      signatures
    );

    const receipt = await execTx.wait();

    // Remove from pending
    this.pendingTxs.delete(safeTxHash);

    return receipt.hash;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PENDING TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  getPendingTransactions(): PendingTransaction[] {
    return Array.from(this.pendingTxs.values());
  }

  getPendingTransaction(safeTxHash: string): PendingTransaction | undefined {
    return this.pendingTxs.get(safeTxHash);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFE TRANSACTION SERVICE
  // ═══════════════════════════════════════════════════════════════════════════

  private async submitToService(pendingTx: PendingTransaction): Promise<void> {
    if (!this.config.safeServiceUrl) return;

    const response = await fetch(
      `${this.config.safeServiceUrl}/api/v1/safes/${this.config.safeAddress}/multisig-transactions/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: pendingTx.transaction.to,
          value: pendingTx.transaction.value,
          data: pendingTx.transaction.data,
          operation: pendingTx.transaction.operation,
          safeTxGas: pendingTx.transaction.safeTxGas,
          baseGas: pendingTx.transaction.baseGas,
          gasPrice: pendingTx.transaction.gasPrice,
          gasToken: pendingTx.transaction.gasToken,
          refundReceiver: pendingTx.transaction.refundReceiver,
          nonce: pendingTx.transaction.nonce,
          contractTransactionHash: pendingTx.safeTxHash,
          sender: pendingTx.proposer,
          signature: pendingTx.signatures[0].data,
        }),
      }
    );

    if (!response.ok) {
      console.warn('Failed to submit to Safe Transaction Service');
    }
  }

  async fetchFromService(): Promise<PendingTransaction[]> {
    if (!this.config.safeServiceUrl) return [];

    const response = await fetch(
      `${this.config.safeServiceUrl}/api/v1/safes/${this.config.safeAddress}/multisig-transactions/?executed=false`
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.results || [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECUREMINT SAFE ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

export class SecureMintSafeAdmin {
  private safeClient: GnosisSafeClient;
  private contracts: {
    policy?: string;
    oracle?: string;
    treasury?: string;
    emergency?: string;
    governor?: string;
  };

  constructor(
    safeConfig: SafeConfig,
    contracts: {
      policy?: string;
      oracle?: string;
      treasury?: string;
      emergency?: string;
      governor?: string;
    }
  ) {
    this.safeClient = new GnosisSafeClient(safeConfig);
    this.contracts = contracts;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async proposeSetEpochCap(newCap: bigint, signer: Signer): Promise<string> {
    if (!this.contracts.policy) throw new Error('Policy contract not configured');

    const iface = new ethers.Interface(['function setEpochCapacity(uint256 newCapacity)']);
    const data = iface.encodeFunctionData('setEpochCapacity', [newCap]);

    return this.safeClient.createTransaction(
      this.contracts.policy,
      '0',
      data,
      'SET_EPOCH_CAP',
      signer
    );
  }

  async proposeSetGlobalCap(newCap: bigint, signer: Signer): Promise<string> {
    if (!this.contracts.policy) throw new Error('Policy contract not configured');

    const iface = new ethers.Interface(['function setGlobalCap(uint256 newCap)']);
    const data = iface.encodeFunctionData('setGlobalCap', [newCap]);

    return this.safeClient.createTransaction(
      this.contracts.policy,
      '0',
      data,
      'SET_GLOBAL_CAP',
      signer
    );
  }

  async proposePause(level: number, signer: Signer): Promise<string> {
    if (!this.contracts.emergency) throw new Error('Emergency contract not configured');

    const iface = new ethers.Interface(['function setEmergencyLevel(uint8 level)']);
    const data = iface.encodeFunctionData('setEmergencyLevel', [level]);

    return this.safeClient.createTransaction(
      this.contracts.emergency,
      '0',
      data,
      'PAUSE',
      signer
    );
  }

  async proposeUnpause(signer: Signer): Promise<string> {
    if (!this.contracts.emergency) throw new Error('Emergency contract not configured');

    const iface = new ethers.Interface(['function setEmergencyLevel(uint8 level)']);
    const data = iface.encodeFunctionData('setEmergencyLevel', [0]);

    return this.safeClient.createTransaction(
      this.contracts.emergency,
      '0',
      data,
      'UNPAUSE',
      signer
    );
  }

  async proposeAddMinter(minter: string, signer: Signer): Promise<string> {
    if (!this.contracts.policy) throw new Error('Policy contract not configured');

    const iface = new ethers.Interface(['function grantRole(bytes32 role, address account)']);
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
    const data = iface.encodeFunctionData('grantRole', [MINTER_ROLE, minter]);

    return this.safeClient.createTransaction(
      this.contracts.policy,
      '0',
      data,
      'ADD_MINTER',
      signer
    );
  }

  async proposeRemoveMinter(minter: string, signer: Signer): Promise<string> {
    if (!this.contracts.policy) throw new Error('Policy contract not configured');

    const iface = new ethers.Interface(['function revokeRole(bytes32 role, address account)']);
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
    const data = iface.encodeFunctionData('revokeRole', [MINTER_ROLE, minter]);

    return this.safeClient.createTransaction(
      this.contracts.policy,
      '0',
      data,
      'REMOVE_MINTER',
      signer
    );
  }

  async proposeUpgrade(
    proxyAddress: string,
    newImplementation: string,
    signer: Signer
  ): Promise<string> {
    const iface = new ethers.Interface(['function upgradeTo(address newImplementation)']);
    const data = iface.encodeFunctionData('upgradeTo', [newImplementation]);

    return this.safeClient.createTransaction(
      proxyAddress,
      '0',
      data,
      'UPGRADE_CONTRACT',
      signer
    );
  }

  async proposeEmergencyWithdraw(
    token: string,
    to: string,
    amount: bigint,
    signer: Signer
  ): Promise<string> {
    if (!this.contracts.treasury) throw new Error('Treasury contract not configured');

    const iface = new ethers.Interface([
      'function emergencyWithdraw(address token, address to, uint256 amount)',
    ]);
    const data = iface.encodeFunctionData('emergencyWithdraw', [token, to, amount]);

    return this.safeClient.createTransaction(
      this.contracts.treasury,
      '0',
      data,
      'EMERGENCY_WITHDRAW',
      signer
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIRMATION & EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  async confirm(safeTxHash: string, signer: Signer): Promise<void> {
    return this.safeClient.confirmTransaction(safeTxHash, signer);
  }

  async execute(safeTxHash: string, signer: Signer): Promise<string> {
    return this.safeClient.executeTransaction(safeTxHash, signer);
  }

  getPending(): PendingTransaction[] {
    return this.safeClient.getPendingTransactions();
  }

  getSafeInfo() {
    return this.safeClient.getSafeInfo();
  }
}

export default SecureMintSafeAdmin;
