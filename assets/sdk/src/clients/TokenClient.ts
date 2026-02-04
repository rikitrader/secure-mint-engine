import { ethers, Contract, formatEther, parseEther } from "ethers";
import { SecureMintSDK } from "../SecureMintSDK";
import { TokenInfo, HolderInfo } from "../types/entities";
import { TransactionResult } from "../types/config";

// Minimal ABI for token operations
const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function burn(uint256 amount)",
  "function paused() view returns (bool)",
  "function guardian() view returns (address)",
  "function secureMintPolicy() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event SecureMint(address indexed to, uint256 amount, uint256 newTotalSupply)",
];

/**
 * Client for interacting with the BackedToken contract
 */
export class TokenClient {
  private sdk: SecureMintSDK;
  private contract: Contract;

  constructor(sdk: SecureMintSDK) {
    this.sdk = sdk;
    this.contract = new Contract(
      sdk.addresses.token,
      TOKEN_ABI,
      sdk.provider
    );
  }

  /**
   * Get comprehensive token information
   */
  async getInfo(): Promise<TokenInfo> {
    const [name, symbol, decimals, totalSupply, paused, guardian, secureMintPolicy] =
      await Promise.all([
        this.contract.name(),
        this.contract.symbol(),
        this.contract.decimals(),
        this.contract.totalSupply(),
        this.contract.paused(),
        this.contract.guardian(),
        this.contract.secureMintPolicy(),
      ]);

    return {
      address: this.sdk.addresses.token,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply,
      paused,
      guardian,
      secureMintPolicy,
    };
  }

  /**
   * Get token balance for an address
   */
  async balanceOf(address: string): Promise<bigint> {
    return this.contract.balanceOf(address);
  }

  /**
   * Get formatted balance (human readable)
   */
  async formattedBalanceOf(address: string): Promise<string> {
    const balance = await this.balanceOf(address);
    return formatEther(balance);
  }

  /**
   * Get allowance
   */
  async allowance(owner: string, spender: string): Promise<bigint> {
    return this.contract.allowance(owner, spender);
  }

  /**
   * Approve spender to spend tokens
   */
  async approve(
    spender: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.approve(spender, amount);
    const receipt = await tx.wait();

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status === 1 ? "success" : "failed",
    };
  }

  /**
   * Approve max amount (for convenience)
   */
  async approveMax(spender: string): Promise<TransactionResult> {
    return this.approve(spender, ethers.MaxUint256);
  }

  /**
   * Transfer tokens
   */
  async transfer(
    to: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.transfer(to, amount);
    const receipt = await tx.wait();

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status === 1 ? "success" : "failed",
    };
  }

  /**
   * Burn tokens
   */
  async burn(amount: bigint): Promise<TransactionResult> {
    const signer = this.sdk.getSigner();
    const connectedContract = this.contract.connect(signer) as Contract;

    const tx = await connectedContract.burn(amount);
    const receipt = await tx.wait();

    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status === 1 ? "success" : "failed",
    };
  }

  /**
   * Check if token is paused
   */
  async isPaused(): Promise<boolean> {
    return this.contract.paused();
  }

  /**
   * Get total supply
   */
  async totalSupply(): Promise<bigint> {
    return this.contract.totalSupply();
  }

  /**
   * Get formatted total supply
   */
  async formattedTotalSupply(): Promise<string> {
    const supply = await this.totalSupply();
    return formatEther(supply);
  }

  /**
   * Get holder information
   */
  async getHolderInfo(address: string): Promise<HolderInfo> {
    const [balance, isApprovedForRedemption] = await Promise.all([
      this.balanceOf(address),
      this.allowance(address, this.sdk.addresses.redemption).then(
        (allowance) => allowance >= balance
      ),
    ]);

    return {
      address,
      balance,
      formattedBalance: formatEther(balance),
      isApprovedForRedemption,
    };
  }
}
