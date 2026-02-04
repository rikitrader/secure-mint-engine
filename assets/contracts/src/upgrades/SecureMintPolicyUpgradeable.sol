// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SecureMintPolicyUpgradeable
 * @author SecureMint Team
 * @notice UUPS upgradeable version of SecureMintPolicy
 * @dev Implements oracle-gated minting with upgrade capability
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * INVARIANTS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INV-SM-1: totalSupply ≤ backing (at 1:1 ratio, adjusted for decimals)
 * INV-SM-2: epochMintedAmount ≤ epochCapacity
 * INV-SM-3: oracle timestamp must be within staleness threshold
 * INV-SM-4: system must not be paused for minting operations
 */
contract SecureMintPolicyUpgradeable is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ═══════════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════════

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant EPOCH_MANAGER_ROLE = keccak256("EPOCH_MANAGER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice The token contract
    address public token;

    /// @notice The oracle contract
    address public oracle;

    /// @notice Emergency pause contract
    address public emergencyPause;

    /// @notice Current epoch number
    uint256 public currentEpoch;

    /// @notice Duration of each epoch in seconds
    uint256 public epochDuration;

    /// @notice Maximum mintable amount per epoch
    uint256 public epochCapacity;

    /// @notice Amount minted in current epoch
    uint256 public epochMintedAmount;

    /// @notice Timestamp when current epoch started
    uint256 public epochStartTime;

    /// @notice Pending epoch capacity change
    uint256 public pendingEpochCapacity;

    /// @notice Time when pending capacity becomes effective
    uint256 public pendingCapacityEffectiveTime;

    /// @notice Timelock delay for epoch capacity changes
    uint256 public constant EPOCH_CAP_TIMELOCK = 24 hours;

    /// @notice Gap for future storage variables (50 slots)
    uint256[50] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event SecureMintExecuted(
        address indexed to,
        uint256 amount,
        uint256 backing,
        uint256 newSupply,
        uint256 oracleTimestamp
    );

    event EpochReset(uint256 indexed newEpoch, uint256 epochCapacity);

    event EpochCapChangeProposed(
        uint256 currentCap,
        uint256 newCap,
        uint256 effectiveTime
    );

    event EpochCapChangeExecuted(uint256 newCap);

    event Initialized(uint8 version);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    error InsufficientBacking(uint256 required, uint256 available);
    error EpochCapacityExceeded(uint256 requested, uint256 remaining);
    error OracleDataStale(uint256 lastUpdate, uint256 threshold);
    error SystemPaused();
    error AlertLevelTooHigh(uint8 current, uint8 maxAllowed);
    error ZeroAmount();
    error ZeroAddress();
    error PendingChangeNotReady();
    error NoPendingChange();

    // ═══════════════════════════════════════════════════════════════════════════════
    // INITIALIZER
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the upgradeable contract
     * @param _token The token contract address
     * @param _oracle The oracle contract address
     * @param _emergencyPause The emergency pause contract address
     * @param _epochDuration Duration of each epoch in seconds
     * @param _epochCapacity Maximum mintable per epoch
     * @param _admin The admin address
     */
    function initialize(
        address _token,
        address _oracle,
        address _emergencyPause,
        uint256 _epochDuration,
        uint256 _epochCapacity,
        address _admin
    ) public initializer {
        if (_token == address(0)) revert ZeroAddress();
        if (_oracle == address(0)) revert ZeroAddress();
        if (_emergencyPause == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(EPOCH_MANAGER_ROLE, _admin);

        token = _token;
        oracle = _oracle;
        emergencyPause = _emergencyPause;
        epochDuration = _epochDuration;
        epochCapacity = _epochCapacity;

        // Initialize first epoch
        currentEpoch = 1;
        epochStartTime = block.timestamp;
        epochMintedAmount = 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MINTING
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Executes a secure mint after validating all invariants
     * @param to Recipient address
     * @param amount Amount to mint (18 decimals)
     */
    function secureMint(
        address to,
        uint256 amount
    ) external nonReentrant onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Check emergency pause
        _checkAlertLevel();

        // Progress epoch if needed
        _progressEpochIfNeeded();

        // Check epoch capacity
        uint256 remaining = epochCapacity - epochMintedAmount;
        if (amount > remaining) {
            revert EpochCapacityExceeded(amount, remaining);
        }

        // Get oracle data and validate
        (uint256 backing, uint256 oracleTimestamp) = _getAndValidateOracle();

        // Get current supply
        uint256 currentSupply = _getTokenSupply();

        // Calculate new supply and validate backing (INV-SM-1)
        uint256 newSupply = currentSupply + amount;
        uint256 requiredBacking = _calculateRequiredBacking(newSupply);

        if (backing < requiredBacking) {
            revert InsufficientBacking(requiredBacking, backing);
        }

        // Update epoch state
        epochMintedAmount += amount;

        // Execute mint
        _executeMint(to, amount);

        emit SecureMintExecuted(to, amount, backing, newSupply, oracleTimestamp);
    }

    /**
     * @notice Returns the maximum amount that can be minted currently
     */
    function maxMintable() external view returns (uint256) {
        // Check if paused
        if (paused()) return 0;

        // Check alert level
        try IEmergencyPause(emergencyPause).currentAlertLevel() returns (
            uint8 level
        ) {
            if (level >= 3) return 0;
        } catch {
            return 0;
        }

        // Get oracle data
        (uint256 backing, uint256 timestamp) = IBackingOracle(oracle)
            .latestBacking();
        uint256 threshold = IBackingOracle(oracle).stalenessThreshold();

        if (block.timestamp - timestamp > threshold) return 0;

        // Get current supply
        uint256 currentSupply = _getTokenSupply();

        // Calculate max based on backing (with buffer)
        uint256 maxFromBacking = _calculateMaxFromBacking(backing, currentSupply);

        // Calculate epoch remaining
        uint256 epochRemaining = epochCapacity > epochMintedAmount
            ? epochCapacity - epochMintedAmount
            : 0;

        return maxFromBacking < epochRemaining ? maxFromBacking : epochRemaining;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Proposes a new epoch capacity (timelocked)
     * @param newCapacity The new capacity to set
     */
    function proposeEpochCapacity(
        uint256 newCapacity
    ) external onlyRole(EPOCH_MANAGER_ROLE) {
        pendingEpochCapacity = newCapacity;
        pendingCapacityEffectiveTime = block.timestamp + EPOCH_CAP_TIMELOCK;

        emit EpochCapChangeProposed(
            epochCapacity,
            newCapacity,
            pendingCapacityEffectiveTime
        );
    }

    /**
     * @notice Executes a pending epoch capacity change
     */
    function executeEpochCapacity()
        external
        onlyRole(EPOCH_MANAGER_ROLE)
    {
        if (pendingEpochCapacity == 0) revert NoPendingChange();
        if (block.timestamp < pendingCapacityEffectiveTime) {
            revert PendingChangeNotReady();
        }

        epochCapacity = pendingEpochCapacity;
        pendingEpochCapacity = 0;
        pendingCapacityEffectiveTime = 0;

        emit EpochCapChangeExecuted(epochCapacity);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function _checkAlertLevel() internal view {
        uint8 level = IEmergencyPause(emergencyPause).currentAlertLevel();
        if (level >= 3) {
            revert AlertLevelTooHigh(level, 2);
        }
    }

    function _progressEpochIfNeeded() internal {
        if (block.timestamp >= epochStartTime + epochDuration) {
            currentEpoch += 1;
            epochStartTime = block.timestamp;
            epochMintedAmount = 0;
            emit EpochReset(currentEpoch, epochCapacity);
        }
    }

    function _getAndValidateOracle()
        internal
        view
        returns (uint256 backing, uint256 timestamp)
    {
        (backing, timestamp) = IBackingOracle(oracle).latestBacking();
        uint256 threshold = IBackingOracle(oracle).stalenessThreshold();

        if (block.timestamp - timestamp > threshold) {
            revert OracleDataStale(timestamp, threshold);
        }
    }

    function _getTokenSupply() internal view returns (uint256) {
        return IMintableToken(token).totalSupply();
    }

    function _calculateRequiredBacking(
        uint256 supply
    ) internal pure returns (uint256) {
        // Convert 18 decimal supply to 6 decimal backing requirement
        // Add 1 for rounding (always round up)
        return (supply / 1e12) + 1;
    }

    function _calculateMaxFromBacking(
        uint256 backing,
        uint256 currentSupply
    ) internal pure returns (uint256) {
        // Convert backing (6 decimals) to token units (18 decimals)
        uint256 maxSupply = backing * 1e12;

        if (maxSupply <= currentSupply) return 0;
        return maxSupply - currentSupply;
    }

    function _executeMint(address to, uint256 amount) internal {
        IMintableToken(token).mint(to, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PAUSABLE
    // ═══════════════════════════════════════════════════════════════════════════════

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // UPGRADEABLE
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Authorizes an upgrade (UUPS pattern)
     * @dev Only accounts with UPGRADER_ROLE can upgrade
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @notice Returns the current implementation version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface IMintableToken {
    function mint(address to, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

interface IBackingOracle {
    function latestBacking()
        external
        view
        returns (uint256 backing, uint256 timestamp);
    function stalenessThreshold() external view returns (uint256);
}

interface IEmergencyPause {
    function currentAlertLevel() external view returns (uint8);
}
