import { ethers, Contract, formatEther, parseEther } from "ethers";
import { SecureMintSDK } from "../SecureMintSDK";
import { MintRequest, MintResult } from "../types/operations";
import { TransactionResult } from "../types/config";

// Minimal ABI for policy operations
const POLICY_ABI = [
  "function token() view returns (address)",
  "function oracle() view returns (address)",
  "function GLOBAL_SUPPLY_CAP() view returns (uint256)",
  "function epochMintCap() view returns (uint256)",
  "function maxOracleAge() view returns (uint256)",
  "function getRemainingEpochMint() view returns (uint256)",
  "function canMintNow(uint256 amount) view returns (bool canMint, string reason)",
  "function getStatus() view returns (bool isPaused, bool oracleHealthy, uint256 globalCap, uint256 epochCap, uint256 remainingEpoch, uint256 totalSupply)",
  "function mint(address to, uint256 amount)",
  "function paused() view returns (bool)",
  "event SecureMintExecuted(address indexed to, uint256 amount, uint256 backing, uint256 newSupply, uint256 oracleTimestamp)",
];

/**
 * Client for interacting with the SecureMintPolicy contract
 */
export class PolicyClient {
  private sdk: SecureMintSDK;
  private contract: Contract;

  constructor(sdk: SecureMintSDK) {
    this.sdk = sdk;
    this.contract = new Contract(
      sdk.addresses.policy,
      POLICY_ABI,
      sdk.provider
    );
  }

  /**
   * Get policy status
   */
  async getStatus(): Promise<{
    paused: boolean;
    oracleHealthy: boolean;
    globalCap: bigint;
    epochCap: bigint;
    remainingEpochMint: bigint;
    totalSupply: bigint;
  }> {
    const result = await this.contract.getStatus();

    return {
      paused: result.isPaused,
      oracleHealthy: result.oracleHealthy,
      globalCap: result.globalCap,
      epochCap: result.epochCap,
      remainingEpochMint: result.remainingEpoch,
      totalSupply: result.totalSupply,
    };
  }

  /**
   * Check if a specific amount can be minted
   */
  async canMint(amount: bigint): Promise<{ canMint: boolean; reason: string }> {
    const [canMint, reason] = await this.contract.canMintNow(amount);
    return { canMint, reason };
  }

  /**
   * Get remaining epoch mint capacity
   */
  async getRemainingEpochMint(): Promise<bigint> {
    return this.contract.getRemainingEpochMint();
  }

  /**
   * Get global supply cap
   */
  async getGlobalSupplyCap(): Promise<bigint> {
    return this.contract.GLOBAL_SUPPLY_CAP();
  }

  /**
   * Get epoch mint cap
   */
  async getEpochMintCap(): Promise<bigint> {
    return this.contract.epochMintCap();
  }

  /**
   * Check if policy is paused
   */
  async isPaused(): Promise<boolean> {
    return this.contract.paused();
  }

  /**
   * Execute a mint operation
   *
   * @param request - Mint request details
   * @returns Mint result with transaction details
   * @throws If minting conditions are not met
   */
  async mint(request: MintRequest): Promise<MintResult> {
    // Pre-flight check
    const { canMint, reason } = await this.canMint(request.amount);
    if (!canMint) {
      throw new Error(`Cannot mint: ${reason}`);
    }

    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.mint(request.recipient, request.amount);
    const receipt = await tx.wait();

    // Parse mint event
    const mintEvent = receipt.logs
      .map((log: any) => {
        try {
          return this.contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: any) => event?.name === "SecureMintExecuted");

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      recipient: request.recipient,
      amount: request.amount,
      backingAtMint: mintEvent?.args.backing || 0n,
      newTotalSupply: mintEvent?.args.newSupply || 0n,
      oracleTimestamp: mintEvent?.args.oracleTimestamp || 0n,
    };
  }

  /**
   * Simulate a mint to estimate gas
   */
  async estimateMintGas(request: MintRequest): Promise<bigint> {
    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    return connectedContract.mint.estimateGas(request.recipient, request.amount);
  }

  /**
   * Get maximum mintable amount right now
   */
  async getMaxMintable(): Promise<bigint> {
    const status = await this.getStatus();

    if (status.paused || !status.oracleHealthy) {
      return 0n;
    }

    // Get backing available
    const oracleStatus = await this.sdk.oracle.getStatus();
    const backingInTokenDecimals = oracleStatus.verifiedBacking * 10n ** 12n; // 6 -> 18 decimals

    // Available = backing - current supply
    const backingAvailable = backingInTokenDecimals > status.totalSupply
      ? backingInTokenDecimals - status.totalSupply
      : 0n;

    // Also consider epoch limit
    const epochRemaining = status.remainingEpochMint;

    // Also consider global cap
    const globalRemaining = status.globalCap > status.totalSupply
      ? status.globalCap - status.totalSupply
      : 0n;

    // Return minimum of all constraints
    let maxMintable = backingAvailable;
    if (epochRemaining < maxMintable) maxMintable = epochRemaining;
    if (globalRemaining < maxMintable) maxMintable = globalRemaining;

    return maxMintable;
  }
}
