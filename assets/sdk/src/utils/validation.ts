import { ethers } from "ethers";

/**
 * Validate an Ethereum address
 */
export function validateAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validate and checksum an address
 */
export function checksumAddress(address: string): string {
  if (!validateAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return ethers.getAddress(address);
}

/**
 * Check if a mint amount is valid
 */
export function isValidMintAmount(amount: bigint, maxMintable: bigint): boolean {
  return amount > 0n && amount <= maxMintable;
}

/**
 * Check if a redemption amount is valid
 */
export function isValidRedemptionAmount(
  amount: bigint,
  balance: bigint,
  minRedemption: bigint = BigInt("100000000000000000000") // 100 tokens
): boolean {
  return amount >= minRedemption && amount <= balance;
}

/**
 * Validate basis points (0-10000)
 */
export function isValidBasisPoints(bps: number): boolean {
  return Number.isInteger(bps) && bps >= 0 && bps <= 10000;
}

/**
 * Validate allocations sum to 10000 basis points
 */
export function validateAllocations(allocations: number[]): boolean {
  if (allocations.length !== 4) return false;
  if (!allocations.every(isValidBasisPoints)) return false;

  const sum = allocations.reduce((a, b) => a + b, 0);
  return sum === 10000;
}

/**
 * Validate tier index (0-3)
 */
export function isValidTierIndex(tier: number): boolean {
  return Number.isInteger(tier) && tier >= 0 && tier <= 3;
}

/**
 * Check if oracle data is fresh
 */
export function isOracleDataFresh(
  dataAge: number,
  maxAge: number = 3600
): boolean {
  return dataAge <= maxAge;
}

/**
 * Validate health factor is acceptable
 */
export function isHealthyBackingRatio(
  healthFactor: bigint,
  minRatio: bigint = 10000n // 100%
): boolean {
  return healthFactor >= minRatio;
}

/**
 * Validate a bytes32 value
 */
export function isValidBytes32(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * Validate a transaction hash
 */
export function isValidTxHash(hash: string): boolean {
  return isValidBytes32(hash);
}
