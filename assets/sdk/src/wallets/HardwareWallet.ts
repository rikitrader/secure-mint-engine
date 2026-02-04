/**
 * SecureMint Engine - Hardware Wallet Integration
 * Ledger and Trezor support for secure signing
 */

import { ethers, Signer, TransactionRequest, TransactionResponse, TypedDataDomain, TypedDataField } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type HardwareWalletType = 'ledger' | 'trezor';

export interface HardwareWalletConfig {
  type: HardwareWalletType;
  derivationPath?: string;
  provider: ethers.Provider;
}

export interface LedgerConfig extends HardwareWalletConfig {
  type: 'ledger';
  transport?: 'hid' | 'webusb' | 'webhid';
}

export interface TrezorConfig extends HardwareWalletConfig {
  type: 'trezor';
  manifest?: {
    email: string;
    appUrl: string;
  };
}

export interface HardwareWalletStatus {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  path: string;
  walletType: HardwareWalletType;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABSTRACT HARDWARE WALLET
// ═══════════════════════════════════════════════════════════════════════════════

export abstract class HardwareWalletSigner extends ethers.AbstractSigner {
  protected _address: string | null = null;
  protected _path: string;
  protected _walletType: HardwareWalletType;
  protected _provider: ethers.Provider;

  constructor(
    type: HardwareWalletType,
    provider: ethers.Provider,
    path: string = "m/44'/60'/0'/0/0"
  ) {
    super(provider);
    this._walletType = type;
    this._provider = provider;
    this._path = path;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  async getAddress(): Promise<string> {
    if (!this._address) {
      throw new Error('Wallet not connected');
    }
    return this._address;
  }

  getStatus(): HardwareWalletStatus {
    return {
      connected: this.isConnected(),
      address: this._address,
      chainId: null, // Will be populated from provider
      path: this._path,
      walletType: this._walletType,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER SIGNER
// ═══════════════════════════════════════════════════════════════════════════════

export class LedgerSigner extends HardwareWalletSigner {
  private ledgerApp: any = null;
  private transport: any = null;
  private transportType: 'hid' | 'webusb' | 'webhid';

  constructor(config: LedgerConfig) {
    super('ledger', config.provider, config.derivationPath);
    this.transportType = config.transport || 'webhid';
  }

  async connect(): Promise<void> {
    try {
      // Dynamic import for Ledger libraries
      const TransportModule = await this.getTransportModule();
      const Eth = (await import('@ledgerhq/hw-app-eth')).default;

      this.transport = await TransportModule.create();
      this.ledgerApp = new Eth(this.transport);

      // Get address from device
      const result = await this.ledgerApp.getAddress(this._path, false, true);
      this._address = result.address;
    } catch (error: any) {
      throw new Error(`Failed to connect to Ledger: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.ledgerApp = null;
      this._address = null;
    }
  }

  isConnected(): boolean {
    return this.ledgerApp !== null && this._address !== null;
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    if (!this.ledgerApp) {
      throw new Error('Ledger not connected');
    }

    // Serialize transaction for signing
    const unsignedTx = ethers.Transaction.from(tx);
    const serialized = unsignedTx.unsignedSerialized;

    // Sign with Ledger
    const signature = await this.ledgerApp.signTransaction(
      this._path,
      serialized.slice(2) // Remove 0x prefix
    );

    // Reconstruct signed transaction
    const signedTx = ethers.Transaction.from({
      ...tx,
      signature: {
        r: '0x' + signature.r,
        s: '0x' + signature.s,
        v: parseInt(signature.v, 16),
      },
    });

    return signedTx.serialized;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.ledgerApp) {
      throw new Error('Ledger not connected');
    }

    const messageHex =
      typeof message === 'string'
        ? ethers.hexlify(ethers.toUtf8Bytes(message))
        : ethers.hexlify(message);

    const signature = await this.ledgerApp.signPersonalMessage(
      this._path,
      messageHex.slice(2)
    );

    return ethers.Signature.from({
      r: '0x' + signature.r,
      s: '0x' + signature.s,
      v: parseInt(signature.v, 16),
    }).serialized;
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    if (!this.ledgerApp) {
      throw new Error('Ledger not connected');
    }

    // EIP-712 signing
    const domainSeparator = ethers.TypedDataEncoder.hashDomain(domain);
    const hashStruct = ethers.TypedDataEncoder.from(types).hash(value);

    const signature = await this.ledgerApp.signEIP712HashedMessage(
      this._path,
      domainSeparator.slice(2),
      hashStruct.slice(2)
    );

    return ethers.Signature.from({
      r: '0x' + signature.r,
      s: '0x' + signature.s,
      v: parseInt(signature.v, 16),
    }).serialized;
  }

  private async getTransportModule(): Promise<any> {
    switch (this.transportType) {
      case 'webhid':
        return (await import('@ledgerhq/hw-transport-webhid')).default;
      case 'webusb':
        return (await import('@ledgerhq/hw-transport-webusb')).default;
      case 'hid':
        return (await import('@ledgerhq/hw-transport-node-hid')).default;
      default:
        throw new Error(`Unknown transport type: ${this.transportType}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREZOR SIGNER
// ═══════════════════════════════════════════════════════════════════════════════

export class TrezorSigner extends HardwareWalletSigner {
  private trezorConnect: any = null;
  private manifest: { email: string; appUrl: string };

  constructor(config: TrezorConfig) {
    super('trezor', config.provider, config.derivationPath);
    this.manifest = config.manifest || {
      email: 'security@securemint.io',
      appUrl: 'https://securemint.io',
    };
  }

  async connect(): Promise<void> {
    try {
      // Dynamic import for Trezor
      const TrezorConnect = (await import('@trezor/connect-web')).default;
      this.trezorConnect = TrezorConnect;

      await TrezorConnect.init({
        manifest: this.manifest,
      });

      // Get address from device
      const result = await TrezorConnect.ethereumGetAddress({
        path: this._path,
        showOnTrezor: true,
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      this._address = result.payload.address;
    } catch (error: any) {
      throw new Error(`Failed to connect to Trezor: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.trezorConnect) {
      await this.trezorConnect.dispose();
      this.trezorConnect = null;
      this._address = null;
    }
  }

  isConnected(): boolean {
    return this.trezorConnect !== null && this._address !== null;
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    if (!this.trezorConnect) {
      throw new Error('Trezor not connected');
    }

    const result = await this.trezorConnect.ethereumSignTransaction({
      path: this._path,
      transaction: {
        to: tx.to as string,
        value: ethers.toBeHex(tx.value || 0),
        gasPrice: ethers.toBeHex(tx.gasPrice || 0),
        gasLimit: ethers.toBeHex(tx.gasLimit || 21000),
        nonce: ethers.toBeHex(tx.nonce || 0),
        data: (tx.data as string) || '0x',
        chainId: Number(tx.chainId || 1),
      },
    });

    if (!result.success) {
      throw new Error(result.payload.error);
    }

    const signedTx = ethers.Transaction.from({
      ...tx,
      signature: {
        r: result.payload.r,
        s: result.payload.s,
        v: parseInt(result.payload.v, 16),
      },
    });

    return signedTx.serialized;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    if (!this.trezorConnect) {
      throw new Error('Trezor not connected');
    }

    const messageHex =
      typeof message === 'string'
        ? ethers.hexlify(ethers.toUtf8Bytes(message))
        : ethers.hexlify(message);

    const result = await this.trezorConnect.ethereumSignMessage({
      path: this._path,
      message: messageHex,
      hex: true,
    });

    if (!result.success) {
      throw new Error(result.payload.error);
    }

    return result.payload.signature;
  }

  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    if (!this.trezorConnect) {
      throw new Error('Trezor not connected');
    }

    const result = await this.trezorConnect.ethereumSignTypedData({
      path: this._path,
      data: {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ...types,
        },
        primaryType: Object.keys(types)[0],
        domain,
        message: value,
      },
      metamask_v4_compat: true,
    });

    if (!result.success) {
      throw new Error(result.payload.error);
    }

    return result.payload.signature;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createHardwareWallet(
  config: LedgerConfig | TrezorConfig
): HardwareWalletSigner {
  switch (config.type) {
    case 'ledger':
      return new LedgerSigner(config as LedgerConfig);
    case 'trezor':
      return new TrezorSigner(config as TrezorConfig);
    default:
      throw new Error(`Unknown hardware wallet type: ${(config as any).type}`);
  }
}

export default { LedgerSigner, TrezorSigner, createHardwareWallet };
