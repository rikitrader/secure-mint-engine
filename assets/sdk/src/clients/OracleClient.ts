import { ethers, Contract, formatUnits } from "ethers";
import { SecureMintSDK } from "../SecureMintSDK";
import { OracleStatus } from "../types/operations";

// Minimal ABI for oracle operations
const ORACLE_ABI = [
  "function getVerifiedBacking() view returns (uint256)",
  "function isHealthy() view returns (bool)",
  "function lastUpdate() view returns (uint256)",
  "function getDataAge() view returns (uint256)",
  "function minAttestors() view returns (uint256)",
  "function backingRatio() view returns (uint256)",
  "function getRequiredBacking(uint256 supply) view returns (uint256)",
  "function canMint(uint256 currentSupply, uint256 mintAmount) view returns (bool)",
  "function getStatus() view returns (bool healthy, uint256 verifiedBacking, uint256 lastUpdate, uint256 attestorCount)",
  "event AttestationSubmitted(address indexed attestor, uint256 backing, bytes32 proof, uint256 timestamp)",
  "event ConsensusReached(uint256 verifiedBacking, uint256 timestamp)",
  "event HealthStatusChanged(bool wasHealthy, bool isHealthy, string reason)",
];

/**
 * Client for interacting with the BackingOraclePoR contract
 */
export class OracleClient {
  private sdk: SecureMintSDK;
  private contract: Contract;

  constructor(sdk: SecureMintSDK) {
    this.sdk = sdk;
    this.contract = new Contract(
      sdk.addresses.oracle,
      ORACLE_ABI,
      sdk.provider
    );
  }

  /**
   * Get comprehensive oracle status
   */
  async getStatus(): Promise<OracleStatus> {
    const [healthy, verifiedBacking, lastUpdate, dataAge, minAttestors, backingRatio] =
      await Promise.all([
        this.contract.isHealthy(),
        this.contract.getVerifiedBacking(),
        this.contract.lastUpdate(),
        this.contract.getDataAge(),
        this.contract.minAttestors(),
        this.contract.backingRatio(),
      ]);

    return {
      healthy,
      verifiedBacking,
      formattedBacking: formatUnits(verifiedBacking, 6),
      lastUpdate: Number(lastUpdate),
      dataAge: Number(dataAge),
      minAttestors: Number(minAttestors),
      backingRatio: Number(backingRatio),
    };
  }

  /**
   * Check if oracle is healthy
   */
  async isHealthy(): Promise<boolean> {
    return this.contract.isHealthy();
  }

  /**
   * Get verified backing amount
   */
  async getVerifiedBacking(): Promise<bigint> {
    return this.contract.getVerifiedBacking();
  }

  /**
   * Get formatted verified backing
   */
  async getFormattedBacking(): Promise<string> {
    const backing = await this.getVerifiedBacking();
    return formatUnits(backing, 6);
  }

  /**
   * Get data age in seconds
   */
  async getDataAge(): Promise<number> {
    const age = await this.contract.getDataAge();
    return Number(age);
  }

  /**
   * Check if oracle data is stale
   */
  async isStale(maxAgeSeconds: number = 3600): Promise<boolean> {
    const age = await this.getDataAge();
    return age > maxAgeSeconds;
  }

  /**
   * Get required backing for a given supply
   */
  async getRequiredBacking(supply: bigint): Promise<bigint> {
    return this.contract.getRequiredBacking(supply);
  }

  /**
   * Check if a mint amount can be backed
   */
  async canMint(currentSupply: bigint, mintAmount: bigint): Promise<boolean> {
    return this.contract.canMint(currentSupply, mintAmount);
  }

  /**
   * Get backing ratio (in basis points, 10000 = 100%)
   */
  async getBackingRatio(): Promise<number> {
    const ratio = await this.contract.backingRatio();
    return Number(ratio);
  }

  /**
   * Calculate health factor for a given supply
   */
  async calculateHealthFactor(supply: bigint): Promise<number> {
    if (supply === 0n) return 10000;

    const backing = await this.getVerifiedBacking();
    // Convert supply to 6 decimals for comparison
    const supplyIn6Decimals = supply / 10n ** 12n;

    if (supplyIn6Decimals === 0n) return 10000;

    return Number((backing * 10000n) / supplyIn6Decimals);
  }
}
