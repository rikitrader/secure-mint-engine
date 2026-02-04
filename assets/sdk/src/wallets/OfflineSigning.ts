/**
 * SecureMint Engine - Offline Transaction Signing
 * Air-gapped transaction preparation and signing
 */

import { ethers, TransactionRequest, TypedDataDomain, TypedDataField } from 'ethers';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UnsignedTransaction {
  id: string;
  type: 'transaction' | 'message' | 'typedData';
  chainId: number;
  createdAt: number;
  expiresAt: number;
  data: TransactionRequest | string | TypedDataPayload;
  metadata?: Record<string, unknown>;
}

export interface TypedDataPayload {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  value: Record<string, unknown>;
}

export interface SignedTransaction {
  id: string;
  originalId: string;
  type: 'transaction' | 'message' | 'typedData';
  signature: string;
  signedAt: number;
  signerAddress: string;
}

export interface TransactionBundle {
  version: string;
  createdAt: number;
  transactions: UnsignedTransaction[];
  checksum: string;
}

export interface SignedBundle {
  version: string;
  signedAt: number;
  signatures: SignedTransaction[];
  checksum: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE TRANSACTION PREPARER (ONLINE MACHINE)
// ═══════════════════════════════════════════════════════════════════════════════

export class OfflineTransactionPreparer {
  private provider: ethers.Provider;
  private chainId: number;

  constructor(provider: ethers.Provider, chainId: number) {
    this.provider = provider;
    this.chainId = chainId;
  }

  /**
   * Prepare a transaction for offline signing
   */
  async prepareTransaction(
    tx: TransactionRequest,
    from: string,
    expiresInSeconds: number = 3600
  ): Promise<UnsignedTransaction> {
    // Fetch nonce if not provided
    if (tx.nonce === undefined) {
      tx.nonce = await this.provider.getTransactionCount(from, 'pending');
    }

    // Fetch gas price if not provided
    if (tx.gasPrice === undefined && tx.maxFeePerGas === undefined) {
      const feeData = await this.provider.getFeeData();
      tx.maxFeePerGas = feeData.maxFeePerGas;
      tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    }

    // Estimate gas if not provided
    if (tx.gasLimit === undefined) {
      tx.gasLimit = await this.provider.estimateGas({ ...tx, from });
    }

    // Set chain ID
    tx.chainId = this.chainId;

    const now = Date.now();
    return {
      id: this.generateId(),
      type: 'transaction',
      chainId: this.chainId,
      createdAt: now,
      expiresAt: now + expiresInSeconds * 1000,
      data: tx,
    };
  }

  /**
   * Prepare a message for offline signing
   */
  prepareMessage(
    message: string,
    expiresInSeconds: number = 3600
  ): UnsignedTransaction {
    const now = Date.now();
    return {
      id: this.generateId(),
      type: 'message',
      chainId: this.chainId,
      createdAt: now,
      expiresAt: now + expiresInSeconds * 1000,
      data: message,
    };
  }

  /**
   * Prepare typed data for offline signing
   */
  prepareTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>,
    expiresInSeconds: number = 3600
  ): UnsignedTransaction {
    const now = Date.now();
    return {
      id: this.generateId(),
      type: 'typedData',
      chainId: this.chainId,
      createdAt: now,
      expiresAt: now + expiresInSeconds * 1000,
      data: { domain, types, value },
    };
  }

  /**
   * Create a bundle of transactions for offline signing
   */
  createBundle(transactions: UnsignedTransaction[]): TransactionBundle {
    const bundle: TransactionBundle = {
      version: '1.0.0',
      createdAt: Date.now(),
      transactions,
      checksum: '',
    };

    bundle.checksum = this.calculateChecksum(bundle);
    return bundle;
  }

  /**
   * Export bundle as JSON string (for QR code or file transfer)
   */
  exportBundle(bundle: TransactionBundle): string {
    return JSON.stringify(bundle);
  }

  /**
   * Export bundle as base64 (more compact for QR codes)
   */
  exportBundleBase64(bundle: TransactionBundle): string {
    return Buffer.from(JSON.stringify(bundle)).toString('base64');
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private calculateChecksum(bundle: Omit<TransactionBundle, 'checksum'>): string {
    const data = JSON.stringify({
      version: bundle.version,
      createdAt: bundle.createdAt,
      transactions: bundle.transactions,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE SIGNER (AIR-GAPPED MACHINE)
// ═══════════════════════════════════════════════════════════════════════════════

export class OfflineSigner {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  /**
   * Get the signer address
   */
  get address(): string {
    return this.wallet.address;
  }

  /**
   * Import a bundle from JSON string
   */
  importBundle(bundleJson: string): TransactionBundle {
    const bundle = JSON.parse(bundleJson) as TransactionBundle;
    if (!this.verifyBundleChecksum(bundle)) {
      throw new Error('Bundle checksum verification failed');
    }
    return bundle;
  }

  /**
   * Import a bundle from base64
   */
  importBundleBase64(base64: string): TransactionBundle {
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return this.importBundle(json);
  }

  /**
   * Sign a single unsigned transaction
   */
  async signTransaction(unsigned: UnsignedTransaction): Promise<SignedTransaction> {
    // Check expiration
    if (Date.now() > unsigned.expiresAt) {
      throw new Error(`Transaction ${unsigned.id} has expired`);
    }

    let signature: string;

    switch (unsigned.type) {
      case 'transaction':
        signature = await this.wallet.signTransaction(unsigned.data as TransactionRequest);
        break;

      case 'message':
        signature = await this.wallet.signMessage(unsigned.data as string);
        break;

      case 'typedData':
        const typedData = unsigned.data as TypedDataPayload;
        signature = await this.wallet.signTypedData(
          typedData.domain,
          typedData.types,
          typedData.value
        );
        break;

      default:
        throw new Error(`Unknown transaction type: ${unsigned.type}`);
    }

    return {
      id: crypto.randomBytes(16).toString('hex'),
      originalId: unsigned.id,
      type: unsigned.type,
      signature,
      signedAt: Date.now(),
      signerAddress: this.wallet.address,
    };
  }

  /**
   * Sign all transactions in a bundle
   */
  async signBundle(bundle: TransactionBundle): Promise<SignedBundle> {
    const signatures: SignedTransaction[] = [];

    for (const tx of bundle.transactions) {
      const signed = await this.signTransaction(tx);
      signatures.push(signed);
    }

    const signedBundle: SignedBundle = {
      version: bundle.version,
      signedAt: Date.now(),
      signatures,
      checksum: '',
    };

    signedBundle.checksum = this.calculateSignedChecksum(signedBundle);
    return signedBundle;
  }

  /**
   * Export signed bundle as JSON
   */
  exportSignedBundle(bundle: SignedBundle): string {
    return JSON.stringify(bundle);
  }

  /**
   * Export signed bundle as base64
   */
  exportSignedBundleBase64(bundle: SignedBundle): string {
    return Buffer.from(JSON.stringify(bundle)).toString('base64');
  }

  private verifyBundleChecksum(bundle: TransactionBundle): boolean {
    const expectedChecksum = this.calculateBundleChecksum(bundle);
    return bundle.checksum === expectedChecksum;
  }

  private calculateBundleChecksum(bundle: TransactionBundle): string {
    const data = JSON.stringify({
      version: bundle.version,
      createdAt: bundle.createdAt,
      transactions: bundle.transactions,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateSignedChecksum(bundle: Omit<SignedBundle, 'checksum'>): string {
    const data = JSON.stringify({
      version: bundle.version,
      signedAt: bundle.signedAt,
      signatures: bundle.signatures,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION BROADCASTER (ONLINE MACHINE)
// ═══════════════════════════════════════════════════════════════════════════════

export class TransactionBroadcaster {
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Import signed bundle from JSON
   */
  importSignedBundle(bundleJson: string): SignedBundle {
    const bundle = JSON.parse(bundleJson) as SignedBundle;
    if (!this.verifySignedChecksum(bundle)) {
      throw new Error('Signed bundle checksum verification failed');
    }
    return bundle;
  }

  /**
   * Import signed bundle from base64
   */
  importSignedBundleBase64(base64: string): SignedBundle {
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return this.importSignedBundle(json);
  }

  /**
   * Broadcast a single signed transaction
   */
  async broadcastTransaction(
    signed: SignedTransaction
  ): Promise<ethers.TransactionResponse> {
    if (signed.type !== 'transaction') {
      throw new Error('Can only broadcast transaction type');
    }

    return this.provider.broadcastTransaction(signed.signature);
  }

  /**
   * Broadcast all transactions in a bundle
   */
  async broadcastBundle(
    bundle: SignedBundle,
    options?: {
      stopOnError?: boolean;
      delayBetweenMs?: number;
    }
  ): Promise<{
    successful: Array<{ id: string; txHash: string }>;
    failed: Array<{ id: string; error: string }>;
  }> {
    const results = {
      successful: [] as Array<{ id: string; txHash: string }>,
      failed: [] as Array<{ id: string; error: string }>,
    };

    for (const signed of bundle.signatures) {
      if (signed.type !== 'transaction') {
        continue;
      }

      try {
        const response = await this.broadcastTransaction(signed);
        results.successful.push({
          id: signed.originalId,
          txHash: response.hash,
        });

        if (options?.delayBetweenMs) {
          await new Promise((r) => setTimeout(r, options.delayBetweenMs));
        }
      } catch (error: any) {
        results.failed.push({
          id: signed.originalId,
          error: error.message,
        });

        if (options?.stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  private verifySignedChecksum(bundle: SignedBundle): boolean {
    const data = JSON.stringify({
      version: bundle.version,
      signedAt: bundle.signedAt,
      signatures: bundle.signatures,
    });
    const expectedChecksum = crypto.createHash('sha256').update(data).digest('hex');
    return bundle.checksum === expectedChecksum;
  }
}

export default {
  OfflineTransactionPreparer,
  OfflineSigner,
  TransactionBroadcaster,
};
