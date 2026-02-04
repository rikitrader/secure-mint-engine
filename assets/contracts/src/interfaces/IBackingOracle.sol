// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBackingOracle
 * @author SecureMint Team
 * @notice Interface for the backing oracle that provides Proof-of-Reserve data
 * @dev The BackingOracle integrates with Chainlink's Proof-of-Reserve feeds to
 *      provide verified backing amounts for the minting policy.
 *
 * Key responsibilities:
 * 1. Aggregate backing data from Chainlink PoR feeds
 * 2. Enforce staleness thresholds for data freshness
 * 3. Validate attestation data integrity
 * 4. Provide minimum backing requirements
 *
 * Security considerations:
 * - Oracle data is only valid if within staleness threshold
 * - Attestation validation prevents manipulation
 * - Multiple data sources can be aggregated for redundancy
 */
interface IBackingOracle {
    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when backing data is updated
     * @param backing The new backing amount (6 decimals for USDC)
     * @param timestamp The timestamp of the update
     * @param source The source of the update (manual, chainlink, etc.)
     */
    event BackingUpdated(
        uint256 backing,
        uint256 timestamp,
        string source
    );

    /**
     * @notice Emitted when staleness threshold is changed
     * @param oldThreshold The previous threshold in seconds
     * @param newThreshold The new threshold in seconds
     */
    event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /**
     * @notice Emitted when minimum backing is changed
     * @param oldMinimum The previous minimum
     * @param newMinimum The new minimum
     */
    event MinimumBackingUpdated(uint256 oldMinimum, uint256 newMinimum);

    /**
     * @notice Emitted when attestation validation fails
     * @param reason The reason for failure
     */
    event AttestationValidationFailed(string reason);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Thrown when oracle data is stale
    error StaleOracleData();

    /// @notice Thrown when Chainlink feed returns invalid data
    error InvalidChainlinkData();

    /// @notice Thrown when attestation validation fails
    error InvalidAttestation();

    /// @notice Thrown when backing is below minimum
    error BackingBelowMinimum();

    /// @notice Thrown when address is zero
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get the latest backing amount and timestamp
     * @dev This is the primary function used by SecureMintPolicy
     *
     * Returns:
     * - backing: The verified backing amount in reserve asset decimals (6 for USDC)
     * - timestamp: The timestamp when this backing was last verified
     *
     * Note: Callers should verify timestamp freshness themselves for critical operations
     *
     * @return backing The current backing amount
     * @return timestamp The timestamp of the backing data
     */
    function latestBacking() external view returns (uint256 backing, uint256 timestamp);

    /**
     * @notice Get the staleness threshold
     * @dev Data older than this threshold should be considered stale
     * @return The threshold in seconds
     */
    function stalenessThreshold() external view returns (uint256);

    /**
     * @notice Get the minimum backing requirement
     * @dev System may refuse operations if backing falls below this
     * @return The minimum backing amount (6 decimals)
     */
    function minimumBacking() external view returns (uint256);

    /**
     * @notice Check if current data is stale
     * @return True if data is stale, false otherwise
     */
    function isStale() external view returns (bool);

    /**
     * @notice Check if current attestation is valid
     * @dev Validates cryptographic attestation if available
     * @return True if attestation is valid or not required
     */
    function isAttestationValid() external view returns (bool);

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHAINLINK INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get the Chainlink Proof-of-Reserve feed address
     * @return The address of the Chainlink aggregator
     */
    function PROOF_OF_RESERVE_FEED() external view returns (address);

    /**
     * @notice Force a refresh from Chainlink feed
     * @dev May be called by authorized updaters to sync data
     *
     * Requirements:
     * - Caller must have ORACLE_UPDATER_ROLE
     */
    function refreshFromChainlink() external;

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONFIGURATION (Admin only)
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update the staleness threshold
     * @dev A longer threshold provides more resilience but less freshness
     *
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     *
     * @param newThreshold The new threshold in seconds
     */
    function setStalenessThreshold(uint256 newThreshold) external;

    /**
     * @notice Update the minimum backing requirement
     *
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     *
     * @param newMinimum The new minimum backing amount
     */
    function setMinimumBacking(uint256 newMinimum) external;

    /**
     * @notice Manually update backing (for emergency/testing)
     * @dev Should only be used when Chainlink feed is unavailable
     *
     * Requirements:
     * - Caller must have ORACLE_UPDATER_ROLE
     * - newBacking must be >= minimumBacking
     *
     * @param newBacking The new backing amount
     */
    function manualUpdate(uint256 newBacking) external;
}
