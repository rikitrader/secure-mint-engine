/**
 * SecureMint Engine - KYC/AML Compliance Integration
 * Hooks for compliance provider integration
 */

import { ethers, Contract, Provider } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type KYCProvider =
  | 'chainalysis'
  | 'elliptic'
  | 'trmlabs'
  | 'merkle-science'
  | 'coinfirm'
  | 'custom';

export type KYCLevel = 'none' | 'basic' | 'enhanced' | 'institutional';

export type RiskLevel = 'low' | 'medium' | 'high' | 'severe' | 'blocked';

export interface KYCStatus {
  address: string;
  verified: boolean;
  level: KYCLevel;
  provider: KYCProvider;
  verifiedAt: number;
  expiresAt: number;
  country?: string;
  riskScore?: number;
}

export interface AMLScreeningResult {
  address: string;
  riskLevel: RiskLevel;
  flags: string[];
  sanctioned: boolean;
  pep: boolean; // Politically Exposed Person
  adverseMedia: boolean;
  sourceOfFunds?: string;
  lastChecked: number;
}

export interface TransactionScreeningResult {
  txHash: string;
  from: string;
  to: string;
  riskLevel: RiskLevel;
  flags: string[];
  blocked: boolean;
  reason?: string;
}

export interface ComplianceConfig {
  providers: KYCProvider[];
  minKYCLevel: KYCLevel;
  maxRiskLevel: RiskLevel;
  blockedCountries: string[];
  sanctionsListUrl?: string;
  webhookUrl?: string;
}

export interface ComplianceHooks {
  onKYCRequired: (address: string, operation: string) => Promise<KYCStatus | null>;
  onAMLCheck: (address: string) => Promise<AMLScreeningResult>;
  onTransactionScreen: (tx: ethers.TransactionRequest) => Promise<TransactionScreeningResult>;
  onBlockedAddress: (address: string, reason: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KYC REGISTRY (ON-CHAIN)
// ═══════════════════════════════════════════════════════════════════════════════

const KYC_REGISTRY_ABI = [
  'function isVerified(address user) view returns (bool)',
  'function getKYCLevel(address user) view returns (uint8)',
  'function getVerificationExpiry(address user) view returns (uint256)',
  'function setVerification(address user, uint8 level, uint256 expiry)',
  'function revokeVerification(address user)',
  'event Verified(address indexed user, uint8 level, uint256 expiry)',
  'event Revoked(address indexed user)',
];

export class KYCRegistry {
  private contract: Contract;

  constructor(address: string, providerOrSigner: Provider | ethers.Signer) {
    this.contract = new Contract(address, KYC_REGISTRY_ABI, providerOrSigner);
  }

  async isVerified(address: string): Promise<boolean> {
    return this.contract.isVerified(address);
  }

  async getKYCLevel(address: string): Promise<KYCLevel> {
    const level = await this.contract.getKYCLevel(address);
    const levels: KYCLevel[] = ['none', 'basic', 'enhanced', 'institutional'];
    return levels[level] || 'none';
  }

  async getExpiry(address: string): Promise<number> {
    const expiry = await this.contract.getVerificationExpiry(address);
    return Number(expiry);
  }

  async setVerification(
    address: string,
    level: KYCLevel,
    expiryTimestamp: number
  ): Promise<ethers.TransactionResponse> {
    const levels: Record<KYCLevel, number> = {
      none: 0,
      basic: 1,
      enhanced: 2,
      institutional: 3,
    };
    return this.contract.setVerification(address, levels[level], expiryTimestamp);
  }

  async revokeVerification(address: string): Promise<ethers.TransactionResponse> {
    return this.contract.revokeVerification(address);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AML SCREENING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class AMLScreeningService {
  private provider: KYCProvider;
  private apiKey: string;
  private baseUrl: string;
  private cache: Map<string, { result: AMLScreeningResult; timestamp: number }> = new Map();
  private cacheTTL: number = 3600000; // 1 hour

  constructor(provider: KYCProvider, apiKey: string, baseUrl?: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || this.getDefaultBaseUrl(provider);
  }

  async screenAddress(address: string): Promise<AMLScreeningResult> {
    // Check cache
    const cached = this.cache.get(address.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    // Call provider API
    const result = await this.callProviderAPI(address);

    // Cache result
    this.cache.set(address.toLowerCase(), {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  async screenTransaction(
    from: string,
    to: string,
    value: bigint
  ): Promise<TransactionScreeningResult> {
    const [fromResult, toResult] = await Promise.all([
      this.screenAddress(from),
      this.screenAddress(to),
    ]);

    const highestRisk = this.getHigherRisk(fromResult.riskLevel, toResult.riskLevel);
    const flags = [...fromResult.flags, ...toResult.flags];
    const blocked = fromResult.sanctioned || toResult.sanctioned;

    return {
      txHash: '', // Will be set after tx is created
      from,
      to,
      riskLevel: highestRisk,
      flags: [...new Set(flags)],
      blocked,
      reason: blocked ? 'Address on sanctions list' : undefined,
    };
  }

  private async callProviderAPI(address: string): Promise<AMLScreeningResult> {
    // Provider-specific implementations
    switch (this.provider) {
      case 'chainalysis':
        return this.callChainalysis(address);
      case 'elliptic':
        return this.callElliptic(address);
      case 'trmlabs':
        return this.callTRMLabs(address);
      default:
        return this.callCustomProvider(address);
    }
  }

  private async callChainalysis(address: string): Promise<AMLScreeningResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/address/${address}`, {
      headers: {
        'Token': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Chainalysis API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      address,
      riskLevel: this.mapChainalysisRisk(data.risk),
      flags: data.cluster?.category ? [data.cluster.category] : [],
      sanctioned: data.sanctioned || false,
      pep: false,
      adverseMedia: false,
      lastChecked: Date.now(),
    };
  }

  private async callElliptic(address: string): Promise<AMLScreeningResult> {
    const response = await fetch(`${this.baseUrl}/v2/wallet/synchronous`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: {
          asset: 'holistic',
          blockchain: 'ethereum',
          hash: address,
          type: 'address',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Elliptic API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      address,
      riskLevel: this.mapEllipticRisk(data.risk_score),
      flags: data.risk_indicators || [],
      sanctioned: data.sanctioned || false,
      pep: data.pep || false,
      adverseMedia: data.adverse_media || false,
      lastChecked: Date.now(),
    };
  }

  private async callTRMLabs(address: string): Promise<AMLScreeningResult> {
    const response = await fetch(`${this.baseUrl}/public/v2/screening/addresses`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        chain: 'ethereum',
      }),
    });

    if (!response.ok) {
      throw new Error(`TRM Labs API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      address,
      riskLevel: this.mapTRMRisk(data.risk_level),
      flags: data.entities?.map((e: any) => e.category) || [],
      sanctioned: data.is_sanctioned || false,
      pep: false,
      adverseMedia: false,
      lastChecked: Date.now(),
    };
  }

  private async callCustomProvider(address: string): Promise<AMLScreeningResult> {
    const response = await fetch(`${this.baseUrl}/screen`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      throw new Error(`Custom provider API error: ${response.status}`);
    }

    return response.json();
  }

  private getDefaultBaseUrl(provider: KYCProvider): string {
    const urls: Record<KYCProvider, string> = {
      chainalysis: 'https://api.chainalysis.com',
      elliptic: 'https://aml-api.elliptic.co',
      trmlabs: 'https://api.trmlabs.com',
      'merkle-science': 'https://api.merklescience.com',
      coinfirm: 'https://api.coinfirm.io',
      custom: '',
    };
    return urls[provider];
  }

  private mapChainalysisRisk(risk: string): RiskLevel {
    const mapping: Record<string, RiskLevel> = {
      lowRisk: 'low',
      mediumRisk: 'medium',
      highRisk: 'high',
      severe: 'severe',
      blocked: 'blocked',
    };
    return mapping[risk] || 'medium';
  }

  private mapEllipticRisk(score: number): RiskLevel {
    if (score < 2) return 'low';
    if (score < 5) return 'medium';
    if (score < 8) return 'high';
    if (score < 10) return 'severe';
    return 'blocked';
  }

  private mapTRMRisk(level: string): RiskLevel {
    const mapping: Record<string, RiskLevel> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'severe',
    };
    return mapping[level] || 'medium';
  }

  private getHigherRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
    const order: RiskLevel[] = ['low', 'medium', 'high', 'severe', 'blocked'];
    return order.indexOf(a) > order.indexOf(b) ? a : b;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export class ComplianceMiddleware {
  private config: ComplianceConfig;
  private kycRegistry: KYCRegistry | null;
  private amlService: AMLScreeningService | null;
  private hooks: Partial<ComplianceHooks>;

  constructor(
    config: ComplianceConfig,
    kycRegistry?: KYCRegistry,
    amlService?: AMLScreeningService,
    hooks?: Partial<ComplianceHooks>
  ) {
    this.config = config;
    this.kycRegistry = kycRegistry || null;
    this.amlService = amlService || null;
    this.hooks = hooks || {};
  }

  /**
   * Check if address is compliant for an operation
   */
  async checkCompliance(
    address: string,
    operation: 'mint' | 'redeem' | 'transfer'
  ): Promise<{
    compliant: boolean;
    reason?: string;
    kycStatus?: KYCStatus;
    amlResult?: AMLScreeningResult;
  }> {
    // KYC Check
    if (this.kycRegistry) {
      const isVerified = await this.kycRegistry.isVerified(address);
      if (!isVerified) {
        // Call hook for KYC requirement
        if (this.hooks.onKYCRequired) {
          const status = await this.hooks.onKYCRequired(address, operation);
          if (!status?.verified) {
            return {
              compliant: false,
              reason: 'KYC verification required',
            };
          }
        } else {
          return {
            compliant: false,
            reason: 'KYC verification required',
          };
        }
      }

      // Check KYC level
      const level = await this.kycRegistry.getKYCLevel(address);
      if (!this.meetsMinKYCLevel(level)) {
        return {
          compliant: false,
          reason: `KYC level ${level} does not meet minimum requirement ${this.config.minKYCLevel}`,
        };
      }

      // Check expiry
      const expiry = await this.kycRegistry.getExpiry(address);
      if (expiry > 0 && Date.now() / 1000 > expiry) {
        return {
          compliant: false,
          reason: 'KYC verification has expired',
        };
      }
    }

    // AML Check
    if (this.amlService) {
      const amlResult = await this.amlService.screenAddress(address);

      if (amlResult.sanctioned) {
        if (this.hooks.onBlockedAddress) {
          this.hooks.onBlockedAddress(address, 'Address on sanctions list');
        }
        return {
          compliant: false,
          reason: 'Address is on sanctions list',
          amlResult,
        };
      }

      if (!this.meetsMaxRiskLevel(amlResult.riskLevel)) {
        if (this.hooks.onBlockedAddress) {
          this.hooks.onBlockedAddress(address, `Risk level too high: ${amlResult.riskLevel}`);
        }
        return {
          compliant: false,
          reason: `Risk level ${amlResult.riskLevel} exceeds maximum allowed ${this.config.maxRiskLevel}`,
          amlResult,
        };
      }
    }

    return { compliant: true };
  }

  /**
   * Screen a transaction before execution
   */
  async screenTransaction(
    tx: ethers.TransactionRequest
  ): Promise<TransactionScreeningResult | null> {
    if (!this.amlService || !tx.from || !tx.to) {
      return null;
    }

    const result = await this.amlService.screenTransaction(
      tx.from,
      tx.to as string,
      tx.value ? BigInt(tx.value.toString()) : 0n
    );

    if (this.hooks.onTransactionScreen) {
      return this.hooks.onTransactionScreen(tx);
    }

    return result;
  }

  private meetsMinKYCLevel(level: KYCLevel): boolean {
    const order: KYCLevel[] = ['none', 'basic', 'enhanced', 'institutional'];
    return order.indexOf(level) >= order.indexOf(this.config.minKYCLevel);
  }

  private meetsMaxRiskLevel(level: RiskLevel): boolean {
    const order: RiskLevel[] = ['low', 'medium', 'high', 'severe', 'blocked'];
    return order.indexOf(level) <= order.indexOf(this.config.maxRiskLevel);
  }
}

export default {
  KYCRegistry,
  AMLScreeningService,
  ComplianceMiddleware,
};
