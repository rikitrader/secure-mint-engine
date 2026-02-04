/**
 * SecureMint Engine - React Native Mobile SDK
 * Cross-platform mobile bindings for iOS and Android
 */

import { ethers } from 'ethers';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MobileSDKConfig {
  rpcUrl: string;
  chainId: number;
  apiUrl: string;
  tokenAddress: string;
  policyAddress: string;
  useBiometrics?: boolean;
  enablePushNotifications?: boolean;
}

export interface WalletInfo {
  address: string;
  isConnected: boolean;
  connectionType: 'injected' | 'walletconnect' | 'local';
}

export interface TokenBalance {
  balance: bigint;
  formattedBalance: string;
  symbol: string;
  decimals: number;
}

export interface MintResult {
  success: boolean;
  transactionHash?: string;
  amount: string;
  recipient: string;
  error?: string;
}

export interface NotificationPreferences {
  mintConfirmations: boolean;
  burnConfirmations: boolean;
  redemptionUpdates: boolean;
  emergencyAlerts: boolean;
  priceAlerts: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURE STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

class SecureStorage {
  private static KEYCHAIN_SERVICE = 'com.securemint.wallet';

  static async storePrivateKey(key: string): Promise<void> {
    await Keychain.setGenericPassword('wallet', key, {
      service: this.KEYCHAIN_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  static async getPrivateKey(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({
      service: this.KEYCHAIN_SERVICE,
    });
    return credentials ? credentials.password : null;
  }

  static async clearPrivateKey(): Promise<void> {
    await Keychain.resetGenericPassword({ service: this.KEYCHAIN_SERVICE });
  }

  static async storeData(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(`@securemint:${key}`, value);
  }

  static async getData(key: string): Promise<string | null> {
    return AsyncStorage.getItem(`@securemint:${key}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE SDK
// ═══════════════════════════════════════════════════════════════════════════════

export class SecureMintMobileSDK {
  private config: MobileSDKConfig;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private policyContract: ethers.Contract | null = null;

  constructor(config: MobileSDKConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WALLET MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async createWallet(): Promise<WalletInfo> {
    const wallet = ethers.Wallet.createRandom();
    await SecureStorage.storePrivateKey(wallet.privateKey);

    this.signer = wallet.connect(this.provider);
    await this.initializeContracts();

    return {
      address: wallet.address,
      isConnected: true,
      connectionType: 'local',
    };
  }

  async importWallet(mnemonic: string): Promise<WalletInfo> {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    await SecureStorage.storePrivateKey(wallet.privateKey);

    this.signer = wallet.connect(this.provider);
    await this.initializeContracts();

    return {
      address: wallet.address,
      isConnected: true,
      connectionType: 'local',
    };
  }

  async loadWallet(): Promise<WalletInfo | null> {
    const privateKey = await SecureStorage.getPrivateKey();
    if (!privateKey) return null;

    const wallet = new ethers.Wallet(privateKey, this.provider);
    this.signer = wallet;
    await this.initializeContracts();

    return {
      address: wallet.address,
      isConnected: true,
      connectionType: 'local',
    };
  }

  async connectWalletConnect(uri: string): Promise<WalletInfo> {
    // WalletConnect integration would go here
    throw new Error('WalletConnect integration requires @walletconnect/react-native-compat');
  }

  async disconnect(): Promise<void> {
    await SecureStorage.clearPrivateKey();
    this.signer = null;
    this.tokenContract = null;
    this.policyContract = null;
  }

  private async initializeContracts(): Promise<void> {
    if (!this.signer) return;

    const tokenAbi = [
      'function balanceOf(address) view returns (uint256)',
      'function transfer(address, uint256) returns (bool)',
      'function approve(address, uint256) returns (bool)',
      'function allowance(address, address) view returns (uint256)',
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
    ];

    const policyAbi = [
      'function canMint(address, uint256) view returns (bool, string)',
      'function epochCapacity() view returns (uint256)',
      'function epochMintedAmount() view returns (uint256)',
    ];

    this.tokenContract = new ethers.Contract(
      this.config.tokenAddress,
      tokenAbi,
      this.signer
    );

    this.policyContract = new ethers.Contract(
      this.config.policyAddress,
      policyAbi,
      this.signer
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async getBalance(address?: string): Promise<TokenBalance> {
    if (!this.tokenContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const targetAddress = address || await this.signer.getAddress();
    const [balance, symbol, decimals] = await Promise.all([
      this.tokenContract.balanceOf(targetAddress),
      this.tokenContract.symbol(),
      this.tokenContract.decimals(),
    ]);

    return {
      balance,
      formattedBalance: ethers.formatUnits(balance, decimals),
      symbol,
      decimals,
    };
  }

  async transfer(to: string, amount: string): Promise<string> {
    if (!this.tokenContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const decimals = await this.tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await this.tokenContract.transfer(to, amountWei);
    const receipt = await tx.wait();

    return receipt.hash;
  }

  async approve(spender: string, amount: string): Promise<string> {
    if (!this.tokenContract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const decimals = await this.tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await this.tokenContract.approve(spender, amountWei);
    const receipt = await tx.wait();

    return receipt.hash;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MINT/BURN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async simulateMint(recipient: string, amount: string): Promise<{
    canMint: boolean;
    reason: string;
    estimatedGas: string;
  }> {
    const response = await fetch(`${this.config.apiUrl}/api/mint/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, amount }),
    });

    if (!response.ok) {
      throw new Error('Simulation failed');
    }

    return response.json();
  }

  async getMintCapacity(): Promise<{
    epochCapacity: string;
    epochMinted: string;
    remainingCapacity: string;
    utilizationPercent: number;
  }> {
    const response = await fetch(`${this.config.apiUrl}/api/mint/capacity`);
    if (!response.ok) {
      throw new Error('Failed to fetch capacity');
    }
    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS AND MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  async getSystemStatus(): Promise<{
    totalSupply: string;
    backingRatio: number;
    emergencyLevel: number;
    isOracleStale: boolean;
  }> {
    const response = await fetch(`${this.config.apiUrl}/api/status`);
    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }
    return response.json();
  }

  async checkInvariants(): Promise<Array<{
    id: string;
    name: string;
    passed: boolean;
    details: string;
  }>> {
    const response = await fetch(`${this.config.apiUrl}/api/invariants`);
    if (!response.ok) {
      throw new Error('Failed to check invariants');
    }
    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async registerPushToken(token: string): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const address = await this.signer.getAddress();
    const response = await fetch(`${this.config.apiUrl}/api/notifications/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        pushToken: token,
        platform: Platform.OS,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register push token');
    }
  }

  async updateNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const address = await this.signer.getAddress();
    await SecureStorage.storeData('notificationPrefs', JSON.stringify(prefs));

    const response = await fetch(`${this.config.apiUrl}/api/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, ...prefs }),
    });

    if (!response.ok) {
      throw new Error('Failed to update preferences');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BIOMETRIC AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  async authenticateWithBiometrics(): Promise<boolean> {
    if (!this.config.useBiometrics) {
      return true;
    }

    try {
      const result = await Keychain.getGenericPassword({
        service: 'com.securemint.wallet',
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      });
      return !!result;
    } catch (error) {
      return false;
    }
  }

  static async isBiometricsAvailable(): Promise<boolean> {
    const biometryType = await Keychain.getSupportedBiometryType();
    return biometryType !== null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let sdkInstance: SecureMintMobileSDK | null = null;

export function initializeSDK(config: MobileSDKConfig): SecureMintMobileSDK {
  sdkInstance = new SecureMintMobileSDK(config);
  return sdkInstance;
}

export function getSDK(): SecureMintMobileSDK {
  if (!sdkInstance) {
    throw new Error('SDK not initialized. Call initializeSDK first.');
  }
  return sdkInstance;
}

export default SecureMintMobileSDK;
