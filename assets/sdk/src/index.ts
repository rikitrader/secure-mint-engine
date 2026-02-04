/**
 * Secure Mint Engine SDK
 *
 * TypeScript SDK for interacting with oracle-gated secure minting contracts.
 * Provides type-safe interfaces for minting, redemption, treasury, and oracle operations.
 */

export { SecureMintSDK } from "./SecureMintSDK";
export { TokenClient } from "./clients/TokenClient";
export { PolicyClient } from "./clients/PolicyClient";
export { OracleClient } from "./clients/OracleClient";
export { TreasuryClient } from "./clients/TreasuryClient";
export { RedemptionClient } from "./clients/RedemptionClient";

// Types
export type {
  SDKConfig,
  ContractAddresses,
  TransactionOptions,
  TransactionResult,
} from "./types/config";

export type {
  MintRequest,
  MintResult,
  RedemptionRequest,
  RedemptionResult,
  OracleStatus,
  TreasuryStatus,
  SystemStatus,
} from "./types/operations";

export type {
  TokenInfo,
  HolderInfo,
  AllocationInfo,
  TierInfo,
} from "./types/entities";

// Constants
export {
  SUPPORTED_CHAINS,
  DEFAULT_ADDRESSES,
  ROLE_HASHES,
} from "./constants";

// Utilities
export { formatTokenAmount, parseTokenAmount } from "./utils/formatting";
export { validateAddress, isValidMintAmount } from "./utils/validation";
