import { ethers, Contract, formatUnits } from "ethers";
import { SecureMintSDK } from "../SecureMintSDK";
import { TreasuryStatus } from "../types/operations";
import { TierInfo } from "../types/entities";

// Minimal ABI for treasury operations
const TREASURY_ABI = [
  "function reserveAsset() view returns (address)",
  "function totalReserves() view returns (uint256)",
  "function getTierBalances() view returns (uint256[4])",
  "function getTargetAllocations() view returns (uint256[4])",
  "function getCurrentAllocations() view returns (uint256[4])",
  "function needsRebalancing() view returns (bool)",
  "function getHealthFactor(uint256 totalSupply) view returns (uint256)",
  "function getStatus() view returns (uint256 _totalReserves, uint256[4] tierBalances, uint256[4] targetAllocations, bool _isPaused, bool _needsRebalancing)",
  "event Deposit(address indexed from, uint256 amount, uint8 tier)",
  "event Withdrawal(address indexed to, uint256 amount, uint8 tier, string reason)",
  "event Rebalanced(uint256[4] oldBalances, uint256[4] newBalances)",
];

const TIER_NAMES = ["HOT", "WARM", "COLD", "RWA"];

/**
 * Client for interacting with the TreasuryVault contract
 */
export class TreasuryClient {
  private sdk: SecureMintSDK;
  private contract: Contract;

  constructor(sdk: SecureMintSDK) {
    this.sdk = sdk;
    this.contract = new Contract(
      sdk.addresses.treasury,
      TREASURY_ABI,
      sdk.provider
    );
  }

  /**
   * Get comprehensive treasury status
   */
  async getStatus(): Promise<TreasuryStatus> {
    const result = await this.contract.getStatus();

    const tierBalances = result.tierBalances.map((b: bigint) => b);
    const targetAllocations = result.targetAllocations.map((a: bigint) => Number(a));
    const currentAllocations = await this.getCurrentAllocations();

    const tiers: TierInfo[] = TIER_NAMES.map((name, i) => ({
      index: i,
      name,
      balance: tierBalances[i],
      formattedBalance: formatUnits(tierBalances[i], 6),
      targetAllocation: targetAllocations[i],
      currentAllocation: currentAllocations[i],
    }));

    return {
      totalReserves: result._totalReserves,
      formattedReserves: formatUnits(result._totalReserves, 6),
      tierBalances,
      targetAllocations,
      currentAllocations,
      tiers,
      isPaused: result._isPaused,
      needsRebalancing: result._needsRebalancing,
    };
  }

  /**
   * Get total reserves
   */
  async getTotalReserves(): Promise<bigint> {
    return this.contract.totalReserves();
  }

  /**
   * Get formatted total reserves
   */
  async getFormattedReserves(): Promise<string> {
    const reserves = await this.getTotalReserves();
    return formatUnits(reserves, 6);
  }

  /**
   * Get tier balances
   */
  async getTierBalances(): Promise<bigint[]> {
    const balances = await this.contract.getTierBalances();
    return balances.map((b: bigint) => b);
  }

  /**
   * Get target allocations (basis points)
   */
  async getTargetAllocations(): Promise<number[]> {
    const allocations = await this.contract.getTargetAllocations();
    return allocations.map((a: bigint) => Number(a));
  }

  /**
   * Get current allocations (basis points)
   */
  async getCurrentAllocations(): Promise<number[]> {
    const allocations = await this.contract.getCurrentAllocations();
    return allocations.map((a: bigint) => Number(a));
  }

  /**
   * Check if rebalancing is needed
   */
  async needsRebalancing(): Promise<boolean> {
    return this.contract.needsRebalancing();
  }

  /**
   * Get health factor for a given total supply
   */
  async getHealthFactor(totalSupply: bigint): Promise<number> {
    const factor = await this.contract.getHealthFactor(totalSupply);
    return Number(factor);
  }

  /**
   * Get detailed tier information
   */
  async getTierInfo(tierIndex: number): Promise<TierInfo> {
    if (tierIndex < 0 || tierIndex > 3) {
      throw new Error("Tier index must be between 0 and 3");
    }

    const [balances, targetAllocations, currentAllocations] = await Promise.all([
      this.getTierBalances(),
      this.getTargetAllocations(),
      this.getCurrentAllocations(),
    ]);

    return {
      index: tierIndex,
      name: TIER_NAMES[tierIndex],
      balance: balances[tierIndex],
      formattedBalance: formatUnits(balances[tierIndex], 6),
      targetAllocation: targetAllocations[tierIndex],
      currentAllocation: currentAllocations[tierIndex],
    };
  }

  /**
   * Get reserve asset address
   */
  async getReserveAsset(): Promise<string> {
    return this.contract.reserveAsset();
  }
}
