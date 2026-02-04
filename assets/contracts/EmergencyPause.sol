// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EmergencyPause
 * @notice 4-level circuit breaker system for protocol emergencies
 * @dev Implements the EmergencyShutdownArchitecture from SecureMintEngine
 *
 * PAUSE LEVELS:
 * - Level 0: NORMAL       - All operations active
 * - Level 1: ELEVATED     - Enhanced monitoring, rate limits reduced
 * - Level 2: RESTRICTED   - Minting paused, burns/redemptions allowed
 * - Level 3: EMERGENCY    - All operations paused except emergency withdrawals
 * - Level 4: SHUTDOWN     - Full protocol shutdown, recovery mode only
 *
 * AUTO-TRIGGERS:
 * - Oracle unhealthy → Level 2
 * - Reserve mismatch → Level 3
 * - Invariant breach → Level 4
 *
 * RECOVERY:
 * - Level 1-2: Guardian can unpause after conditions resolved
 * - Level 3-4: Requires governance vote + timelock
 */
contract EmergencyPause is AccessControl, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // ENUMS
    // ═══════════════════════════════════════════════════════════════════════════

    enum PauseLevel {
        NORMAL,      // 0 - All operations active
        ELEVATED,    // 1 - Enhanced monitoring
        RESTRICTED,  // 2 - Minting paused
        EMERGENCY,   // 3 - All ops paused except emergency
        SHUTDOWN     // 4 - Full shutdown
    }

    enum TriggerReason {
        MANUAL,              // 0 - Manual guardian action
        ORACLE_UNHEALTHY,    // 1 - Oracle data unhealthy
        ORACLE_STALE,        // 2 - Oracle data stale
        RESERVE_MISMATCH,    // 3 - Reserves below supply
        INVARIANT_BREACH,    // 4 - Formal invariant violated
        EXPLOIT_DETECTED,    // 5 - Potential exploit detected
        GOVERNANCE_VOTE,     // 6 - Governance decision
        RATE_LIMIT_HIT,      // 7 - Rate limits exhausted
        PRICE_DEVIATION,     // 8 - Abnormal price movement
        BRIDGE_FAILURE       // 9 - Cross-chain bridge issue
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Current pause level
    PauseLevel public currentLevel;

    /// @notice Timestamp when current level was set
    uint256 public levelSetAt;

    /// @notice Reason for current pause level
    TriggerReason public currentReason;

    /// @notice Additional details about the trigger
    string public triggerDetails;

    /// @notice Timelock for recovery from Level 3+
    uint256 public constant RECOVERY_TIMELOCK = 24 hours;

    /// @notice Pending recovery request
    struct RecoveryRequest {
        PauseLevel targetLevel;
        uint256 executeAfter;
        bool pending;
        address requestedBy;
    }
    RecoveryRequest public pendingRecovery;

    /// @notice Registered contract addresses that receive pause signals
    mapping(address => bool) public registeredContracts;
    address[] public contractList;

    /// @notice Auto-trigger thresholds
    uint256 public oracleStalenessThreshold = 1 hours;
    uint256 public priceDeviationThreshold = 500; // 5% in basis points
    uint256 public reserveDeficitThreshold = 0; // Any deficit triggers

    /// @notice Level escalation history
    struct LevelChange {
        PauseLevel fromLevel;
        PauseLevel toLevel;
        TriggerReason reason;
        address triggeredBy;
        uint256 timestamp;
        string details;
    }
    LevelChange[] public levelHistory;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event LevelChanged(
        PauseLevel indexed fromLevel,
        PauseLevel indexed toLevel,
        TriggerReason indexed reason,
        address triggeredBy,
        string details
    );

    event RecoveryRequested(
        PauseLevel targetLevel,
        uint256 executeAfter,
        address requestedBy
    );

    event RecoveryExecuted(PauseLevel newLevel, address executedBy);
    event RecoveryCancelled(address cancelledBy);

    event ContractRegistered(address indexed contractAddress);
    event ContractUnregistered(address indexed contractAddress);

    event ThresholdUpdated(string thresholdType, uint256 oldValue, uint256 newValue);

    event AutoTriggerFired(
        TriggerReason reason,
        PauseLevel newLevel,
        string details
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidLevelTransition();
    error RecoveryTimelockNotReady();
    error NoPendingRecovery();
    error RecoveryAlreadyPending();
    error ContractAlreadyRegistered();
    error ContractNotRegistered();
    error CannotEscalateToLowerLevel();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
        _grantRole(MONITOR_ROLE, _admin);

        currentLevel = PauseLevel.NORMAL;
        levelSetAt = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LEVEL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Escalate pause level (guardian can escalate, never de-escalate without process)
     * @param newLevel Target level (must be higher than current)
     * @param reason Reason for escalation
     * @param details Additional details
     */
    function escalateLevel(
        PauseLevel newLevel,
        TriggerReason reason,
        string calldata details
    ) external onlyRole(GUARDIAN_ROLE) {
        if (newLevel <= currentLevel) revert CannotEscalateToLowerLevel();

        _setLevel(newLevel, reason, details);
    }

    /**
     * @notice Direct set to Level 1 (ELEVATED) - Guardian can do this freely
     */
    function setElevated(string calldata details) external onlyRole(GUARDIAN_ROLE) {
        if (currentLevel >= PauseLevel.ELEVATED) revert InvalidLevelTransition();
        _setLevel(PauseLevel.ELEVATED, TriggerReason.MANUAL, details);
    }

    /**
     * @notice Direct set to Level 2 (RESTRICTED) - Minting paused
     */
    function setRestricted(string calldata details) external onlyRole(GUARDIAN_ROLE) {
        if (currentLevel >= PauseLevel.RESTRICTED) revert InvalidLevelTransition();
        _setLevel(PauseLevel.RESTRICTED, TriggerReason.MANUAL, details);
    }

    /**
     * @notice Direct set to Level 3 (EMERGENCY) - All ops paused
     */
    function setEmergency(string calldata details) external onlyRole(GUARDIAN_ROLE) {
        if (currentLevel >= PauseLevel.EMERGENCY) revert InvalidLevelTransition();
        _setLevel(PauseLevel.EMERGENCY, TriggerReason.MANUAL, details);
    }

    /**
     * @notice Direct set to Level 4 (SHUTDOWN) - Full shutdown
     */
    function setShutdown(string calldata details) external onlyRole(GUARDIAN_ROLE) {
        if (currentLevel >= PauseLevel.SHUTDOWN) revert InvalidLevelTransition();
        _setLevel(PauseLevel.SHUTDOWN, TriggerReason.MANUAL, details);
    }

    /**
     * @notice Return to NORMAL from ELEVATED only - no timelock needed
     */
    function returnToNormalFromElevated() external onlyRole(GUARDIAN_ROLE) {
        if (currentLevel != PauseLevel.ELEVATED) revert InvalidLevelTransition();
        _setLevel(PauseLevel.NORMAL, TriggerReason.MANUAL, "Returned to normal from elevated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTO-TRIGGER FUNCTIONS (Called by monitors/keepers)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Auto-trigger on oracle unhealthy
     * @param details Oracle status details
     */
    function triggerOracleUnhealthy(string calldata details) external onlyRole(MONITOR_ROLE) {
        if (currentLevel < PauseLevel.RESTRICTED) {
            _setLevel(PauseLevel.RESTRICTED, TriggerReason.ORACLE_UNHEALTHY, details);
            emit AutoTriggerFired(TriggerReason.ORACLE_UNHEALTHY, PauseLevel.RESTRICTED, details);
        }
    }

    /**
     * @notice Auto-trigger on oracle stale
     * @param staleness Current staleness in seconds
     */
    function triggerOracleStale(uint256 staleness) external onlyRole(MONITOR_ROLE) {
        if (staleness >= oracleStalenessThreshold && currentLevel < PauseLevel.RESTRICTED) {
            string memory details = string(abi.encodePacked("Oracle stale: ", _uint2str(staleness), "s"));
            _setLevel(PauseLevel.RESTRICTED, TriggerReason.ORACLE_STALE, details);
            emit AutoTriggerFired(TriggerReason.ORACLE_STALE, PauseLevel.RESTRICTED, details);
        }
    }

    /**
     * @notice Auto-trigger on reserve mismatch
     * @param reserves Current reserves
     * @param supply Current supply
     */
    function triggerReserveMismatch(uint256 reserves, uint256 supply) external onlyRole(MONITOR_ROLE) {
        if (reserves < supply && currentLevel < PauseLevel.EMERGENCY) {
            string memory details = string(abi.encodePacked(
                "Reserves: ", _uint2str(reserves), " < Supply: ", _uint2str(supply)
            ));
            _setLevel(PauseLevel.EMERGENCY, TriggerReason.RESERVE_MISMATCH, details);
            emit AutoTriggerFired(TriggerReason.RESERVE_MISMATCH, PauseLevel.EMERGENCY, details);
        }
    }

    /**
     * @notice Auto-trigger on invariant breach
     * @param invariantId ID of breached invariant
     * @param details Breach details
     */
    function triggerInvariantBreach(
        string calldata invariantId,
        string calldata details
    ) external onlyRole(MONITOR_ROLE) {
        if (currentLevel < PauseLevel.SHUTDOWN) {
            string memory fullDetails = string(abi.encodePacked("Invariant ", invariantId, ": ", details));
            _setLevel(PauseLevel.SHUTDOWN, TriggerReason.INVARIANT_BREACH, fullDetails);
            emit AutoTriggerFired(TriggerReason.INVARIANT_BREACH, PauseLevel.SHUTDOWN, fullDetails);
        }
    }

    /**
     * @notice Auto-trigger on price deviation
     * @param deviation Current deviation in basis points
     */
    function triggerPriceDeviation(uint256 deviation) external onlyRole(MONITOR_ROLE) {
        if (deviation >= priceDeviationThreshold && currentLevel < PauseLevel.ELEVATED) {
            string memory details = string(abi.encodePacked("Price deviation: ", _uint2str(deviation), " bps"));
            _setLevel(PauseLevel.ELEVATED, TriggerReason.PRICE_DEVIATION, details);
            emit AutoTriggerFired(TriggerReason.PRICE_DEVIATION, PauseLevel.ELEVATED, details);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RECOVERY (TIMELOCKED FOR LEVEL 2+)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Request recovery to a lower level (timelocked for Level 2+)
     * @param targetLevel Target level to recover to
     */
    function requestRecovery(PauseLevel targetLevel) external onlyRole(GOVERNOR_ROLE) {
        if (pendingRecovery.pending) revert RecoveryAlreadyPending();
        if (targetLevel >= currentLevel) revert InvalidLevelTransition();

        // Level 2+ recovery requires timelock
        uint256 timelock = currentLevel >= PauseLevel.RESTRICTED ? RECOVERY_TIMELOCK : 0;

        pendingRecovery = RecoveryRequest({
            targetLevel: targetLevel,
            executeAfter: block.timestamp + timelock,
            pending: true,
            requestedBy: msg.sender
        });

        emit RecoveryRequested(targetLevel, pendingRecovery.executeAfter, msg.sender);
    }

    /**
     * @notice Execute pending recovery after timelock
     */
    function executeRecovery() external onlyRole(GOVERNOR_ROLE) {
        if (!pendingRecovery.pending) revert NoPendingRecovery();
        if (block.timestamp < pendingRecovery.executeAfter) revert RecoveryTimelockNotReady();

        PauseLevel targetLevel = pendingRecovery.targetLevel;
        delete pendingRecovery;

        _setLevel(targetLevel, TriggerReason.GOVERNANCE_VOTE, "Recovery executed via governance");

        emit RecoveryExecuted(targetLevel, msg.sender);
    }

    /**
     * @notice Cancel pending recovery
     */
    function cancelRecovery() external onlyRole(GOVERNOR_ROLE) {
        if (!pendingRecovery.pending) revert NoPendingRecovery();
        delete pendingRecovery;
        emit RecoveryCancelled(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTRACT REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a contract to receive pause signals
     * @param contractAddress Address to register
     */
    function registerContract(address contractAddress) external onlyRole(GOVERNOR_ROLE) {
        if (contractAddress == address(0)) revert ZeroAddress();
        if (registeredContracts[contractAddress]) revert ContractAlreadyRegistered();

        registeredContracts[contractAddress] = true;
        contractList.push(contractAddress);

        emit ContractRegistered(contractAddress);
    }

    /**
     * @notice Unregister a contract
     * @param contractAddress Address to unregister
     */
    function unregisterContract(address contractAddress) external onlyRole(GOVERNOR_ROLE) {
        if (!registeredContracts[contractAddress]) revert ContractNotRegistered();

        registeredContracts[contractAddress] = false;

        // Remove from array (swap and pop)
        for (uint256 i = 0; i < contractList.length; i++) {
            if (contractList[i] == contractAddress) {
                contractList[i] = contractList[contractList.length - 1];
                contractList.pop();
                break;
            }
        }

        emit ContractUnregistered(contractAddress);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // THRESHOLD CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    function setOracleStalenessThreshold(uint256 _threshold) external onlyRole(GOVERNOR_ROLE) {
        emit ThresholdUpdated("oracleStaleness", oracleStalenessThreshold, _threshold);
        oracleStalenessThreshold = _threshold;
    }

    function setPriceDeviationThreshold(uint256 _threshold) external onlyRole(GOVERNOR_ROLE) {
        emit ThresholdUpdated("priceDeviation", priceDeviationThreshold, _threshold);
        priceDeviationThreshold = _threshold;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    function _setLevel(
        PauseLevel newLevel,
        TriggerReason reason,
        string memory details
    ) internal {
        PauseLevel oldLevel = currentLevel;

        levelHistory.push(LevelChange({
            fromLevel: oldLevel,
            toLevel: newLevel,
            reason: reason,
            triggeredBy: msg.sender,
            timestamp: block.timestamp,
            details: details
        }));

        currentLevel = newLevel;
        levelSetAt = block.timestamp;
        currentReason = reason;
        triggerDetails = details;

        emit LevelChanged(oldLevel, newLevel, reason, msg.sender, details);
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if minting is allowed at current level
     */
    function isMintingAllowed() external view returns (bool) {
        return currentLevel < PauseLevel.RESTRICTED;
    }

    /**
     * @notice Check if burning is allowed at current level
     */
    function isBurningAllowed() external view returns (bool) {
        return currentLevel < PauseLevel.EMERGENCY;
    }

    /**
     * @notice Check if transfers are allowed at current level
     */
    function isTransferAllowed() external view returns (bool) {
        return currentLevel < PauseLevel.EMERGENCY;
    }

    /**
     * @notice Check if all operations are paused
     */
    function isFullyPaused() external view returns (bool) {
        return currentLevel >= PauseLevel.EMERGENCY;
    }

    /**
     * @notice Get current status
     */
    function getStatus() external view returns (
        PauseLevel level,
        TriggerReason reason,
        string memory details,
        uint256 setAt,
        bool mintingAllowed,
        bool burningAllowed,
        bool transfersAllowed
    ) {
        return (
            currentLevel,
            currentReason,
            triggerDetails,
            levelSetAt,
            this.isMintingAllowed(),
            this.isBurningAllowed(),
            this.isTransferAllowed()
        );
    }

    /**
     * @notice Get level history length
     */
    function getLevelHistoryLength() external view returns (uint256) {
        return levelHistory.length;
    }

    /**
     * @notice Get level change at index
     */
    function getLevelChange(uint256 index) external view returns (LevelChange memory) {
        return levelHistory[index];
    }

    /**
     * @notice Get all registered contracts
     */
    function getRegisteredContracts() external view returns (address[] memory) {
        return contractList;
    }
}
