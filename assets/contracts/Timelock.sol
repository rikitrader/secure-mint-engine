// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title Timelock
 * @notice Timelock controller for governance actions in the SecureMintEngine
 * @dev Extends OpenZeppelin's TimelockController with protocol-specific defaults
 *
 * TIMELOCK DURATIONS (configurable):
 * - Standard operations: 48 hours
 * - Critical operations: 72 hours
 * - Emergency operations: 24 hours (guardian-initiated)
 *
 * PROTECTED ACTIONS (must go through timelock):
 * - Global supply cap changes
 * - Epoch mint cap changes
 * - Oracle address changes
 * - Role changes
 * - Pause authority changes
 * - Reserve allocation changes
 */
contract Timelock is TimelockController {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Standard delay for normal governance operations
    uint256 public constant STANDARD_DELAY = 48 hours;

    /// @notice Extended delay for critical operations
    uint256 public constant CRITICAL_DELAY = 72 hours;

    /// @notice Reduced delay for emergency operations (guardian-only)
    uint256 public constant EMERGENCY_DELAY = 24 hours;

    // ═══════════════════════════════════════════════════════════════════════════
    // OPERATION CATEGORIES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mapping of function selectors to their required delay category
    mapping(bytes4 => DelayCategory) public operationDelays;

    enum DelayCategory {
        STANDARD,   // 48 hours
        CRITICAL,   // 72 hours
        EMERGENCY   // 24 hours (guardian-only)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event OperationCategorySet(bytes4 indexed selector, DelayCategory category);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the timelock
     * @param minDelay Minimum delay for operations (should be STANDARD_DELAY)
     * @param proposers Array of addresses that can propose operations
     * @param executors Array of addresses that can execute operations
     * @param admin Admin address (can grant/revoke roles)
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        // Set default operation categories
        _setDefaultCategories();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CATEGORY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set delay category for a function selector
     * @param selector Function selector (e.g., bytes4(keccak256("setGlobalCap(uint256)")))
     * @param category Delay category
     */
    function setOperationCategory(
        bytes4 selector,
        DelayCategory category
    ) external onlyRole(TIMELOCK_ADMIN_ROLE) {
        operationDelays[selector] = category;
        emit OperationCategorySet(selector, category);
    }

    /**
     * @notice Get the required delay for a function selector
     * @param selector Function selector
     * @return delay Required delay in seconds
     */
    function getRequiredDelay(bytes4 selector) external view returns (uint256 delay) {
        DelayCategory category = operationDelays[selector];

        if (category == DelayCategory.CRITICAL) {
            return CRITICAL_DELAY;
        } else if (category == DelayCategory.EMERGENCY) {
            return EMERGENCY_DELAY;
        } else {
            return STANDARD_DELAY;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set default operation categories
     * @dev Called during construction
     */
    function _setDefaultCategories() internal {
        // Critical operations (72 hours)
        // Global supply cap changes
        operationDelays[bytes4(keccak256("setGlobalCap(uint256)"))] = DelayCategory.CRITICAL;

        // Oracle changes
        operationDelays[bytes4(keccak256("setOracle(address)"))] = DelayCategory.CRITICAL;
        operationDelays[bytes4(keccak256("setBackingOracle(address)"))] = DelayCategory.CRITICAL;

        // Role changes
        operationDelays[bytes4(keccak256("grantRole(bytes32,address)"))] = DelayCategory.CRITICAL;
        operationDelays[bytes4(keccak256("revokeRole(bytes32,address)"))] = DelayCategory.CRITICAL;

        // Standard operations (48 hours)
        // Rate limit changes
        operationDelays[bytes4(keccak256("setEpochCap(uint256)"))] = DelayCategory.STANDARD;
        operationDelays[bytes4(keccak256("setRateLimit(uint256)"))] = DelayCategory.STANDARD;

        // Allocation changes
        operationDelays[bytes4(keccak256("proposeAllocation(uint256[4])"))] = DelayCategory.STANDARD;

        // Threshold changes
        operationDelays[bytes4(keccak256("setMaxOracleAge(uint256)"))] = DelayCategory.STANDARD;
        operationDelays[bytes4(keccak256("setDeviationThreshold(uint256)"))] = DelayCategory.STANDARD;

        // Emergency operations (24 hours)
        // Recovery from pause
        operationDelays[bytes4(keccak256("unpause()"))] = DelayCategory.EMERGENCY;
        operationDelays[bytes4(keccak256("requestRecovery(uint8)"))] = DelayCategory.EMERGENCY;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get all delay constants
     */
    function getDelayConstants() external pure returns (
        uint256 standard,
        uint256 critical,
        uint256 emergency
    ) {
        return (STANDARD_DELAY, CRITICAL_DELAY, EMERGENCY_DELAY);
    }
}
