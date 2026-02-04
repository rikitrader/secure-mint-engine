// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEmergencyPause
 * @author SecureMint Team
 * @notice Interface for the multi-level emergency pause system
 * @dev Implements a 5-level alert system that progressively restricts operations:
 *
 * Level 0 - NORMAL:      All operations permitted
 * Level 1 - ELEVATED:    Increased monitoring, rate limits may apply
 * Level 2 - RESTRICTED:  Minting restricted, large redemptions delayed
 * Level 3 - EMERGENCY:   All user operations paused, governance only
 * Level 4 - SHUTDOWN:    Complete system halt, emergency recovery mode
 *
 * The system supports:
 * - Manual escalation by authorized roles (PAUSER_ROLE, GUARDIAN_ROLE)
 * - Automatic triggers based on predefined conditions
 * - Time-based auto-recovery for lower levels
 * - Guardian override for immediate response
 */
interface IEmergencyPause {
    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when alert level changes
     * @param previousLevel The previous alert level
     * @param newLevel The new alert level
     * @param changedBy The address that triggered the change
     * @param reason Human-readable reason for the change
     */
    event AlertLevelChanged(
        uint8 previousLevel,
        uint8 newLevel,
        address indexed changedBy,
        string reason
    );

    /**
     * @notice Emitted when a new trigger condition is registered
     * @param condition The condition identifier
     * @param level The alert level to trigger
     */
    event TriggerRegistered(bytes32 indexed condition, uint8 level);

    /**
     * @notice Emitted when a trigger condition is met
     * @param condition The condition that was triggered
     * @param newLevel The resulting alert level
     */
    event TriggerConditionMet(bytes32 indexed condition, uint8 newLevel);

    /**
     * @notice Emitted when auto-recovery occurs
     * @param previousLevel The level before recovery
     * @param newLevel The level after recovery
     */
    event AutoRecovery(uint8 previousLevel, uint8 newLevel);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Thrown when trying to set an invalid alert level
    error InvalidAlertLevel();

    /// @notice Thrown when operation is blocked at current alert level
    error OperationBlockedAtLevel(uint8 currentLevel, uint8 requiredMaxLevel);

    /// @notice Thrown when cooldown period hasn't elapsed
    error CooldownNotElapsed();

    /// @notice Thrown when trying to decrease level without authorization
    error UnauthorizedLevelDecrease();

    // ═══════════════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get the current alert level
     * @return The current alert level (0-4)
     */
    function currentAlertLevel() external view returns (uint8);

    /**
     * @notice Check if a specific operation is allowed at current level
     * @param operation The operation identifier (e.g., keccak256("MINT"))
     * @return True if operation is allowed
     */
    function isOperationAllowed(bytes32 operation) external view returns (bool);

    /**
     * @notice Set the alert level
     * @dev Different roles have different permissions:
     *      - PAUSER_ROLE: Can set levels 0-2
     *      - GUARDIAN_ROLE: Can set any level
     *      - Governance: Can set any level with timelock
     *
     * @param newLevel The new alert level (0-4)
     * @param reason Human-readable reason for the change
     */
    function setAlertLevel(uint8 newLevel, string calldata reason) external;

    /**
     * @notice Emergency escalation to EMERGENCY level
     * @dev Callable by GUARDIAN_ROLE without timelock
     * @param reason The reason for emergency escalation
     */
    function emergencyEscalate(string calldata reason) external;

    /**
     * @notice Trigger system shutdown
     * @dev Only callable by multi-sig or after governance vote
     * @param reason The reason for shutdown
     */
    function shutdown(string calldata reason) external;

    // ═══════════════════════════════════════════════════════════════════════════════
    // TRIGGER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register an automatic trigger condition
     * @param condition The condition identifier
     * @param targetLevel The level to trigger when condition is met
     *
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     */
    function registerTrigger(bytes32 condition, uint8 targetLevel) external;

    /**
     * @notice Fire a registered trigger
     * @dev Can be called by automated monitoring systems
     * @param condition The condition that was triggered
     *
     * Requirements:
     * - Caller must have TRIGGER_ROLE
     * - Condition must be registered
     */
    function fireTrigger(bytes32 condition) external;

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get timestamp of last level change
     * @return The timestamp
     */
    function lastLevelChange() external view returns (uint256);

    /**
     * @notice Check if minting is allowed
     * @return True if minting is allowed at current level
     */
    function canMint() external view returns (bool);

    /**
     * @notice Check if redemptions are allowed
     * @return True if redemptions are allowed at current level
     */
    function canRedeem() external view returns (bool);

    /**
     * @notice Check if transfers are allowed
     * @return True if transfers are allowed at current level
     */
    function canTransfer() external view returns (bool);

    /**
     * @notice Check if governance actions are allowed
     * @return True if governance is allowed at current level
     */
    function canGovernance() external view returns (bool);

    /**
     * @notice Get the cooldown period between level changes
     * @return The cooldown in seconds
     */
    function levelChangeCooldown() external view returns (uint256);
}
