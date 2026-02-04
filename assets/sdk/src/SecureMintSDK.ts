import { ethers, Contract, Signer, Provider, ContractTransactionResponse } from "ethers";
import { TokenClient } from "./clients/TokenClient";
import { PolicyClient } from "./clients/PolicyClient";
import { OracleClient } from "./clients/OracleClient";
import { TreasuryClient } from "./clients/TreasuryClient";
import { RedemptionClient } from "./clients/RedemptionClient";
import { SDKConfig, ContractAddresses, SystemStatus } from "./types/config";
import { DEFAULT_ADDRESSES, SUPPORTED_CHAINS } from "./constants";

/**
 * Main SDK class for interacting with Secure Mint Engine contracts
 *
 * @example
 * ```typescript
 * import { SecureMintSDK } from '@secure-mint/sdk';
 *
 * const sdk = new SecureMintSDK({
 *   provider: window.ethereum,
 *   chainId: 1,
 * });
 *
 * // Check if minting is possible
 * const canMint = await sdk.policy.canMint(parseEther("1000"));
 *
 * // Get system status
 * const status = await sdk.getSystemStatus();
 * ```
 */
export class SecureMintSDK {
  readonly provider: Provider;
  readonly signer?: Signer;
  readonly chainId: number;
  readonly addresses: ContractAddresses;

  // Client instances
  readonly token: TokenClient;
  readonly policy: PolicyClient;
  readonly oracle: OracleClient;
  readonly treasury: TreasuryClient;
  readonly redemption: RedemptionClient;

  constructor(config: SDKConfig) {
    // Set up provider
    if (typeof config.provider === "string") {
      this.provider = new ethers.JsonRpcProvider(config.provider);
    } else if ("send" in config.provider || "request" in config.provider) {
      this.provider = new ethers.BrowserProvider(config.provider as any);
    } else {
      this.provider = config.provider as Provider;
    }

    this.signer = config.signer;
    this.chainId = config.chainId;

    // Get addresses for this chain
    if (config.addresses) {
      this.addresses = config.addresses;
    } else if (DEFAULT_ADDRESSES[config.chainId]) {
      this.addresses = DEFAULT_ADDRESSES[config.chainId];
    } else {
      throw new Error(`No default addresses for chain ${config.chainId}. Please provide addresses.`);
    }

    // Initialize clients
    this.token = new TokenClient(this);
    this.policy = new PolicyClient(this);
    this.oracle = new OracleClient(this);
    this.treasury = new TreasuryClient(this);
    this.redemption = new RedemptionClient(this);
  }

  /**
   * Connect a signer to the SDK
   */
  connect(signer: Signer): SecureMintSDK {
    return new SecureMintSDK({
      provider: this.provider,
      signer,
      chainId: this.chainId,
      addresses: this.addresses,
    });
  }

  /**
   * Get a signer, throwing if none available
   */
  getSigner(): Signer {
    if (!this.signer) {
      throw new Error("No signer available. Connect a signer first.");
    }
    return this.signer;
  }

  /**
   * Check if the SDK has a signer connected
   */
  hasSigner(): boolean {
    return !!this.signer;
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const [tokenInfo, oracleStatus, treasuryStatus, policyStatus] = await Promise.all([
      this.token.getInfo(),
      this.oracle.getStatus(),
      this.treasury.getStatus(),
      this.policy.getStatus(),
    ]);

    // Calculate health factor
    const healthFactor = tokenInfo.totalSupply > 0n
      ? (oracleStatus.verifiedBacking * 10000n) / (tokenInfo.totalSupply / 10n ** 12n)
      : 10000n;

    return {
      chainId: this.chainId,
      timestamp: Math.floor(Date.now() / 1000),

      // Token metrics
      totalSupply: tokenInfo.totalSupply,
      tokenPaused: tokenInfo.paused,

      // Oracle metrics
      oracleHealthy: oracleStatus.healthy,
      verifiedBacking: oracleStatus.verifiedBacking,
      oracleDataAge: oracleStatus.dataAge,

      // Treasury metrics
      totalReserves: treasuryStatus.totalReserves,
      tierBalances: treasuryStatus.tierBalances,

      // Policy metrics
      policyPaused: policyStatus.paused,
      remainingEpochMint: policyStatus.remainingEpochMint,
      globalSupplyCap: policyStatus.globalCap,

      // Derived metrics
      healthFactor,
      canMint: oracleStatus.healthy && !policyStatus.paused && !tokenInfo.paused,
    };
  }

  /**
   * Validate that the system is in a healthy state for operations
   */
  async validateSystemHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const status = await this.getSystemStatus();
    const issues: string[] = [];

    if (!status.oracleHealthy) {
      issues.push("Oracle is unhealthy");
    }

    if (status.oracleDataAge > 3600) {
      issues.push(`Oracle data is stale (${status.oracleDataAge}s old)`);
    }

    if (status.policyPaused) {
      issues.push("Mint policy is paused");
    }

    if (status.tokenPaused) {
      issues.push("Token is paused");
    }

    if (status.healthFactor < 10000n) {
      issues.push(`Health factor below 100% (${status.healthFactor})`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Check if the chain is supported
   */
  static isChainSupported(chainId: number): boolean {
    return SUPPORTED_CHAINS.includes(chainId);
  }
}
