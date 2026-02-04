// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISecureMintPolicy
 * @author SecureMint Team
 * @notice Interface for the oracle-gated secure minting policy
 * @dev Defines the external functions for SecureMintPolicy contract
 *
 * The SecureMintPolicy is the core gatekeeper for token minting operations.
 * It enforces four critical invariants:
 *
 * 1. INV-SM-1: Supply ≤ Backing - Tokens can only be minted if oracle-reported
 *    backing is sufficient to cover the new total supply
 *
 * 2. INV-SM-2: Epoch Rate Limiting - Each epoch has a maximum mint capacity
 *    that cannot be exceeded
 *
 * 3. INV-SM-3: Oracle Freshness - Oracle data must be within the staleness
 *    threshold to be considered valid
 *
 * 4. INV-SM-4: System State - Minting is blocked when system is paused or
 *    alert level is EMERGENCY (3) or higher
 */
interface ISecureMintPolicy {
    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when tokens are successfully minted through secure mint
     * @param to The recipient of the minted tokens
     * @param amount The amount of tokens minted (18 decimals)
     * @param backing The oracle-reported backing at time of mint (6 decimals)
     * @param newSupply The new total supply after minting (18 decimals)
     * @param oracleTimestamp The timestamp of the oracle data used
     */
    event SecureMintExecuted(
        address indexed to,
        uint256 amount,
        uint256 backing,
        uint256 newSupply,
        uint256 oracleTimestamp
    );

    /**
     * @notice Emitted when a new epoch begins
     * @param newEpoch The new epoch number
     * @param epochCapacity The minting capacity for this epoch
     */
    event EpochReset(uint256 indexed newEpoch, uint256 epochCapacity);

    /**
     * @notice Emitted when an epoch capacity change is proposed
     * @param currentCap The current epoch capacity
     * @param newCap The proposed new capacity
     * @param effectiveTime When the change will take effect
     */
    event EpochCapChangeProposed(
        uint256 currentCap,
        uint256 newCap,
        uint256 effectiveTime
    );

    /**
     * @notice Emitted when an epoch capacity change is executed
     * @param newCap The new epoch capacity
     */
    event EpochCapChangeExecuted(uint256 newCap);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Thrown when backing is insufficient for the requested mint
     * @param required The required backing amount (6 decimals)
     * @param available The available backing amount (6 decimals)
     */
    error InsufficientBacking(uint256 required, uint256 available);

    /**
     * @notice Thrown when epoch capacity would be exceeded
     * @param requested The requested mint amount
     * @param remaining The remaining epoch capacity
     */
    error EpochCapacityExceeded(uint256 requested, uint256 remaining);

    /**
     * @notice Thrown when oracle data is stale
     * @param lastUpdate The timestamp of the last oracle update
     * @param threshold The maximum allowed age for oracle data
     */
    error OracleDataStale(uint256 lastUpdate, uint256 threshold);

    /// @notice Thrown when system is in paused state
    error SystemPaused();

    /**
     * @notice Thrown when alert level is too high for operations
     * @param current The current alert level
     * @param maxAllowed The maximum allowed alert level
     */
    error AlertLevelTooHigh(uint8 current, uint8 maxAllowed);

    /// @notice Thrown when amount is zero
    error ZeroAmount();

    /// @notice Thrown when address is zero
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════════
    // MINTING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Execute a secure mint operation
     * @dev Validates all invariants before minting:
     *      - System not paused
     *      - Alert level < EMERGENCY
     *      - Oracle data not stale
     *      - Backing sufficient for new supply
     *      - Epoch capacity not exceeded
     *
     * Requirements:
     * - Caller must have MINTER_ROLE
     * - `to` cannot be zero address
     * - `amount` must be > 0
     *
     * @param to The recipient address for minted tokens
     * @param amount The amount to mint (18 decimals)
     */
    function secureMint(address to, uint256 amount) external;

    /**
     * @notice Calculate the maximum amount that can be minted currently
     * @dev Returns 0 if:
     *      - System is paused
     *      - Alert level >= EMERGENCY
     *      - Oracle data is stale
     *      - No backing available
     *
     * @return The maximum mintable amount (18 decimals)
     */
    function maxMintable() external view returns (uint256);

    // ═══════════════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Propose a new epoch capacity (timelocked)
     * @dev Changes are subject to EPOCH_CAP_TIMELOCK delay
     *
     * Requirements:
     * - Caller must have EPOCH_MANAGER_ROLE
     *
     * @param newCapacity The new capacity to set (18 decimals)
     */
    function proposeEpochCapacity(uint256 newCapacity) external;

    /**
     * @notice Execute a pending epoch capacity change
     * @dev Requires timelock period to have elapsed
     *
     * Requirements:
     * - Caller must have EPOCH_MANAGER_ROLE
     * - A pending change must exist
     * - Timelock period must have elapsed
     */
    function executeEpochCapacity() external;

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice The token contract being managed
    function token() external view returns (address);

    /// @notice The oracle contract providing backing data
    function oracle() external view returns (address);

    /// @notice The emergency pause contract
    function emergencyPause() external view returns (address);

    /// @notice Current epoch number (increments each epoch)
    function currentEpoch() external view returns (uint256);

    /// @notice Duration of each epoch in seconds
    function epochDuration() external view returns (uint256);

    /// @notice Maximum tokens that can be minted per epoch
    function epochCapacity() external view returns (uint256);

    /// @notice Amount minted in the current epoch
    function epochMintedAmount() external view returns (uint256);

    /// @notice Timestamp when current epoch started
    function epochStartTime() external view returns (uint256);

    /// @notice Pending epoch capacity change (0 if none)
    function pendingEpochCapacity() external view returns (uint256);

    /// @notice Time when pending capacity becomes effective
    function pendingCapacityEffectiveTime() external view returns (uint256);

    // ═══════════════════════════════════════════════════════════════════════════════
    // PAUSABLE
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Pause all minting operations
     * @dev Requirements: Caller must have PAUSER_ROLE
     */
    function pause() external;

    /**
     * @notice Unpause minting operations
     * @dev Requirements: Caller must have PAUSER_ROLE
     */
    function unpause() external;

    /// @notice Check if the contract is paused
    function paused() external view returns (bool);
}
