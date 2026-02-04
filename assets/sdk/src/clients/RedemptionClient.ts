import { ethers, Contract, formatUnits, formatEther } from "ethers";
import { SecureMintSDK } from "../SecureMintSDK";
import { RedemptionRequest, RedemptionResult } from "../types/operations";
import { TransactionResult } from "../types/config";

// Minimal ABI for redemption operations
const REDEMPTION_ABI = [
  "function token() view returns (address)",
  "function reserveAsset() view returns (address)",
  "function treasury() view returns (address)",
  "function redemptionRequests(address) view returns (uint256 amount, uint256 unlockTime, bool pending)",
  "function calculateRedemptionOutput(uint256 amount) view returns (uint256)",
  "function getRedemptionStatus(address user) view returns (bool pending, uint256 amount, uint256 unlockTime, uint256 estimatedOutput)",
  "function requestRedemption(uint256 amount)",
  "function executeRedemption()",
  "function cancelRedemption()",
  "function paused() view returns (bool)",
  "function dailyLimit() view returns (uint256)",
  "function dailyRedeemed() view returns (uint256)",
  "event RedemptionRequested(address indexed user, uint256 amount, uint256 unlockTime)",
  "event RedemptionExecuted(address indexed user, uint256 tokenAmount, uint256 reserveAmount)",
  "event RedemptionCancelled(address indexed user, uint256 amount)",
];

/**
 * Client for interacting with the RedemptionEngine contract
 */
export class RedemptionClient {
  private sdk: SecureMintSDK;
  private contract: Contract;

  constructor(sdk: SecureMintSDK) {
    this.sdk = sdk;
    this.contract = new Contract(
      sdk.addresses.redemption,
      REDEMPTION_ABI,
      sdk.provider
    );
  }

  /**
   * Get redemption status for a user
   */
  async getStatus(userAddress: string): Promise<{
    pending: boolean;
    amount: bigint;
    unlockTime: number;
    estimatedOutput: bigint;
    canExecute: boolean;
  }> {
    const result = await this.contract.getRedemptionStatus(userAddress);

    const now = Math.floor(Date.now() / 1000);
    const canExecute = result.pending && Number(result.unlockTime) <= now;

    return {
      pending: result.pending,
      amount: result.amount,
      unlockTime: Number(result.unlockTime),
      estimatedOutput: result.estimatedOutput,
      canExecute,
    };
  }

  /**
   * Calculate output for a redemption amount
   */
  async calculateOutput(amount: bigint): Promise<bigint> {
    return this.contract.calculateRedemptionOutput(amount);
  }

  /**
   * Get formatted output calculation
   */
  async calculateFormattedOutput(amount: bigint): Promise<string> {
    const output = await this.calculateOutput(amount);
    return formatUnits(output, 6); // Reserve asset is 6 decimals (USDC)
  }

  /**
   * Request a redemption
   */
  async requestRedemption(amount: bigint): Promise<TransactionResult> {
    // Check if user already has pending redemption
    const signerAddress = await this.sdk.getSigner().getAddress();
    const status = await this.getStatus(signerAddress);

    if (status.pending) {
      throw new Error("You already have a pending redemption request");
    }

    // Check allowance
    const tokenAllowance = await this.sdk.token.allowance(
      signerAddress,
      this.sdk.addresses.redemption
    );

    if (tokenAllowance < amount) {
      throw new Error(
        "Insufficient token allowance. Please approve the redemption contract first."
      );
    }

    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.requestRedemption(amount);
    const receipt = await tx.wait();

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status === 1 ? "success" : "failed",
    };
  }

  /**
   * Execute a pending redemption
   */
  async executeRedemption(): Promise<RedemptionResult> {
    const signerAddress = await this.sdk.getSigner().getAddress();
    const status = await this.getStatus(signerAddress);

    if (!status.pending) {
      throw new Error("No pending redemption to execute");
    }

    if (!status.canExecute) {
      const waitTime = status.unlockTime - Math.floor(Date.now() / 1000);
      throw new Error(
        `Redemption not ready. Please wait ${Math.ceil(waitTime / 3600)} more hours.`
      );
    }

    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.executeRedemption();
    const receipt = await tx.wait();

    // Parse event
    const executedEvent = receipt.logs
      .map((log: any) => {
        try {
          return this.contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: any) => event?.name === "RedemptionExecuted");

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      tokenAmount: executedEvent?.args.tokenAmount || status.amount,
      reserveAmount: executedEvent?.args.reserveAmount || 0n,
    };
  }

  /**
   * Cancel a pending redemption
   */
  async cancelRedemption(): Promise<TransactionResult> {
    const signerAddress = await this.sdk.getSigner().getAddress();
    const status = await this.getStatus(signerAddress);

    if (!status.pending) {
      throw new Error("No pending redemption to cancel");
    }

    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.cancelRedemption();
    const receipt = await tx.wait();

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status === 1 ? "success" : "failed",
    };
  }

  /**
   * Check if redemption engine is paused
   */
  async isPaused(): Promise<boolean> {
    return this.contract.paused();
  }

  /**
   * Get daily redemption limit
   */
  async getDailyLimit(): Promise<bigint> {
    return this.contract.dailyLimit();
  }

  /**
   * Get amount redeemed today
   */
  async getDailyRedeemed(): Promise<bigint> {
    return this.contract.dailyRedeemed();
  }

  /**
   * Get remaining daily capacity
   */
  async getRemainingDailyCapacity(): Promise<bigint> {
    const [limit, redeemed] = await Promise.all([
      this.getDailyLimit(),
      this.getDailyRedeemed(),
    ]);

    return limit > redeemed ? limit - redeemed : 0n;
  }

  /**
   * Request redemption with auto-approval
   * Approves tokens if needed, then requests redemption
   */
  async requestRedemptionWithApproval(amount: bigint): Promise<TransactionResult> {
    const signerAddress = await this.sdk.getSigner().getAddress();
    const allowance = await this.sdk.token.allowance(
      signerAddress,
      this.sdk.addresses.redemption
    );

    if (allowance < amount) {
      await this.sdk.token.approve(this.sdk.addresses.redemption, amount);
    }

    return this.requestRedemption(amount);
  }
}
