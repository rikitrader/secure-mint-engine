import { formatEther, formatUnits, parseEther, parseUnits } from "ethers";

/**
 * Format a token amount (18 decimals) to human-readable string
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  return formatUnits(amount, decimals);
}

/**
 * Parse a human-readable string to token amount (18 decimals)
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  return parseUnits(amount, decimals);
}

/**
 * Format a reserve asset amount (6 decimals) to human-readable string
 */
export function formatReserveAmount(amount: bigint): string {
  return formatUnits(amount, 6);
}

/**
 * Parse a human-readable string to reserve asset amount (6 decimals)
 */
export function parseReserveAmount(amount: string): bigint {
  return parseUnits(amount, 6);
}

/**
 * Format basis points to percentage string
 */
export function formatBasisPoints(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Format a timestamp to a human-readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Format seconds to a human-readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatLargeNumber(value: bigint, decimals: number = 18): string {
  const num = Number(formatUnits(value, decimals));

  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;

  return num.toFixed(2);
}

/**
 * Format health factor (basis points) to percentage
 */
export function formatHealthFactor(factor: bigint): string {
  const percentage = Number(factor) / 100;
  return `${percentage.toFixed(2)}%`;
}
