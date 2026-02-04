import { ContractAddresses } from "./types/config";

/**
 * Supported chain IDs
 */
export const SUPPORTED_CHAINS = [
  1,      // Ethereum Mainnet
  11155111, // Sepolia
  42161,  // Arbitrum One
  137,    // Polygon
  8453,   // Base
  43114,  // Avalanche
];

/**
 * Chain names
 */
export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia",
  42161: "Arbitrum One",
  137: "Polygon",
  8453: "Base",
  43114: "Avalanche",
};

/**
 * Default contract addresses per chain
 * These should be updated after deployment
 */
export const DEFAULT_ADDRESSES: Record<number, ContractAddresses> = {
  // Mainnet (placeholder - update after deployment)
  1: {
    token: "0x0000000000000000000000000000000000000000",
    policy: "0x0000000000000000000000000000000000000000",
    oracle: "0x0000000000000000000000000000000000000000",
    treasury: "0x0000000000000000000000000000000000000000",
    redemption: "0x0000000000000000000000000000000000000000",
  },
  // Sepolia (placeholder - update after deployment)
  11155111: {
    token: "0x0000000000000000000000000000000000000000",
    policy: "0x0000000000000000000000000000000000000000",
    oracle: "0x0000000000000000000000000000000000000000",
    treasury: "0x0000000000000000000000000000000000000000",
    redemption: "0x0000000000000000000000000000000000000000",
  },
};

/**
 * Role hashes for access control
 */
export const ROLE_HASHES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  GUARDIAN_ROLE: "0x5c6e91cb6c04bc7f52f3b3e2f1a1c7d0a3e8c0b9d2f4a1e6d8c3b7a0f9e2d5c8",
  GOVERNOR_ROLE: "0x9c6e91cb6c04bc7f52f3b3e2f1a1c7d0a3e8c0b9d2f4a1e6d8c3b7a0f9e2d5c9",
  ATTESTOR_ROLE: "0x8c6e91cb6c04bc7f52f3b3e2f1a1c7d0a3e8c0b9d2f4a1e6d8c3b7a0f9e2d5ca",
  REBALANCER_ROLE: "0x7c6e91cb6c04bc7f52f3b3e2f1a1c7d0a3e8c0b9d2f4a1e6d8c3b7a0f9e2d5cb",
  TREASURY_ADMIN_ROLE: "0x6c6e91cb6c04bc7f52f3b3e2f1a1c7d0a3e8c0b9d2f4a1e6d8c3b7a0f9e2d5cc",
};

/**
 * Tier names
 */
export const TIER_NAMES = ["HOT", "WARM", "COLD", "RWA"] as const;

/**
 * Basis points constant
 */
export const BASIS_POINTS = 10000;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  MAX_ORACLE_AGE: 3600, // 1 hour
  REDEMPTION_DELAY: 86400, // 24 hours
  EPOCH_DURATION: 3600, // 1 hour
  MIN_REDEMPTION: BigInt("100000000000000000000"), // 100 tokens
};
