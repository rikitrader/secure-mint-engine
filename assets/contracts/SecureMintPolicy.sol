// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBackingOracle.sol";

/**
 * @title SecureMintPolicy
 * @notice Oracle-gated secure minting policy contract
 * @dev Implements the SecureMintEngine specification with all required controls
 *
 * MINTING IS ALLOWED IFF ALL CONDITIONS HOLD:
 * 1) Verified backing exists
 * 2) Backing >= post-mint totalSupply (or required collateral ratio)
 * 3) Oracle feeds are healthy (not stale, not deviated)
 * 4) Mint amount <= rate limit
 * 5) Mint amount <= global cap
 * 6) Contract is NOT paused
 *
 * IF ANY CONDITION FAILS → mint() MUST revert
 */
contract SecureMintPolicy is Pausable, ReentrancyGuard, AccessControl {
    // ═══════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice The backed token this policy controls
    IBackedToken public immutable token;

    /// @notice The backing oracle (PoR or collateral oracle)
    IBackingOracle public backingOracle;

    /// @notice Global supply cap - max total supply ever
    uint256 public immutable GLOBAL_SUPPLY_CAP;

    /// @notice Per-epoch mint cap
    uint256 public epochMintCap;

    /// @notice Epoch duration in seconds
    uint256 public constant EPOCH_DURATION = 1 hours;

    /// @notice Maximum oracle data age in seconds
    uint256 public maxOracleAge;

    /// @notice Timelock duration for parameter changes
    uint256 public constant TIMELOCK_DURATION = 48 hours;

    /// @notice Current epoch minted amount
    uint256 public currentEpochMinted;

    /// @notice Timestamp of current epoch start
    uint256 public epochStartTime;

    // ═══════════════════════════════════════════════════════════════════════
    // TIMELOCK STATE
    // ═══════════════════════════════════════════════════════════════════════

    struct PendingChange {
        uint256 newValue;
        uint256 executeAfter;
        bool pending;
    }

    mapping(bytes32 => PendingChange) public pendingChanges;

    bytes32 public constant CHANGE_EPOCH_CAP = keccak256("CHANGE_EPOCH_CAP");
    bytes32 public constant CHANGE_ORACLE = keccak256("CHANGE_ORACLE");
    bytes32 public constant CHANGE_MAX_ORACLE_AGE = keccak256("CHANGE_MAX_ORACLE_AGE");

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event SecureMintExecuted(
        address indexed to,
        uint256 amount,
        uint256 backingAtMint,
        uint256 newTotalSupply,
        uint256 oracleTimestamp
    );

    event EmergencyPause(address indexed triggeredBy, string reason);
    event OracleHealthFailure(uint256 dataAge, bool isHealthy);
    event BackingInsufficient(uint256 backing, uint256 required);
    event EpochCapExceeded(uint256 requested, uint256 remaining);

    event ChangeProposed(bytes32 indexed changeType, uint256 newValue, uint256 executeAfter);
    event ChangeExecuted(bytes32 indexed changeType, uint256 newValue);
    event ChangeCancelled(bytes32 indexed changeType);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error OracleUnhealthy();
    error OracleStale();
    error InsufficientBacking();
    error GlobalCapExceeded();
    error EpochCapExceeded();
    error ZeroAmount();
    error ZeroAddress();
    error TimelockNotReady();
    error NoChangePending();
    error ChangeAlreadyPending();

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the SecureMintPolicy
     * @param _token Address of the BackedToken
     * @param _oracle Address of the backing oracle
     * @param _globalCap Maximum total supply (immutable)
     * @param _epochCap Per-epoch mint cap
     * @param _maxOracleAge Maximum acceptable oracle data age
     * @param _admin Initial admin address (should be multisig)
     */
    constructor(
        address _token,
        address _oracle,
        uint256 _globalCap,
        uint256 _epochCap,
        uint256 _maxOracleAge,
        address _admin
    ) {
        if (_token == address(0)) revert ZeroAddress();
        if (_oracle == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        token = IBackedToken(_token);
        backingOracle = IBackingOracle(_oracle);
        GLOBAL_SUPPLY_CAP = _globalCap;
        epochMintCap = _epochCap;
        maxOracleAge = _maxOracleAge;
        epochStartTime = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MINT FUNCTION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Mint tokens with full backing verification
     * @dev Enforces ALL SecureMintEngine invariants
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(MINTER_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        // ─────────────────────────────────────────────────────────────────
        // CHECK 1: Oracle health
        // ─────────────────────────────────────────────────────────────────
        if (!backingOracle.isHealthy()) {
            emit OracleHealthFailure(backingOracle.getDataAge(), false);
            _triggerEmergencyPause("Oracle unhealthy");
            revert OracleUnhealthy();
        }

        // ─────────────────────────────────────────────────────────────────
        // CHECK 2: Oracle staleness
        // ─────────────────────────────────────────────────────────────────
        uint256 dataAge = backingOracle.getDataAge();
        if (dataAge > maxOracleAge) {
            emit OracleHealthFailure(dataAge, true);
            _triggerEmergencyPause("Oracle stale");
            revert OracleStale();
        }

        // ─────────────────────────────────────────────────────────────────
        // CHECK 3: Backing verification
        // ─────────────────────────────────────────────────────────────────
        uint256 currentSupply = token.totalSupply();
        uint256 postMintSupply = currentSupply + amount;

        if (!backingOracle.canMint(currentSupply, amount)) {
            uint256 backing = backingOracle.getVerifiedBacking();
            uint256 required = backingOracle.getRequiredBacking(postMintSupply);
            emit BackingInsufficient(backing, required);
            revert InsufficientBacking();
        }

        // ─────────────────────────────────────────────────────────────────
        // CHECK 4: Global cap
        // ─────────────────────────────────────────────────────────────────
        if (postMintSupply > GLOBAL_SUPPLY_CAP) {
            revert GlobalCapExceeded();
        }

        // ─────────────────────────────────────────────────────────────────
        // CHECK 5: Epoch rate limit
        // ─────────────────────────────────────────────────────────────────
        _checkAndUpdateEpoch();

        if (currentEpochMinted + amount > epochMintCap) {
            emit EpochCapExceeded(amount, epochMintCap - currentEpochMinted);
            revert EpochCapExceeded();
        }

        // ─────────────────────────────────────────────────────────────────
        // EXECUTE MINT
        // ─────────────────────────────────────────────────────────────────
        currentEpochMinted += amount;

        uint256 backingAtMint = backingOracle.getVerifiedBacking();
        uint256 oracleTimestamp = backingOracle.lastUpdate();

        token.mint(to, amount);

        emit SecureMintExecuted(
            to,
            amount,
            backingAtMint,
            postMintSupply,
            oracleTimestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    function _checkAndUpdateEpoch() internal {
        if (block.timestamp >= epochStartTime + EPOCH_DURATION) {
            epochStartTime = block.timestamp;
            currentEpochMinted = 0;
        }
    }

    /**
     * @notice Get remaining mintable amount in current epoch
     */
    function getRemainingEpochMint() external view returns (uint256) {
        if (block.timestamp >= epochStartTime + EPOCH_DURATION) {
            return epochMintCap;
        }
        return epochMintCap > currentEpochMinted ? epochMintCap - currentEpochMinted : 0;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Pause minting - callable by guardian
     */
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, "Manual pause");
    }

    /**
     * @notice Unpause minting - callable by guardian
     */
    function unpause() external onlyRole(GUARDIAN_ROLE) {
        // Verify oracle is healthy before unpausing
        require(backingOracle.isHealthy(), "Cannot unpause: oracle unhealthy");
        require(backingOracle.getDataAge() <= maxOracleAge, "Cannot unpause: oracle stale");
        _unpause();
    }

    function _triggerEmergencyPause(string memory reason) internal {
        if (!paused()) {
            _pause();
            emit EmergencyPause(address(this), reason);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TIMELOCKED PARAMETER CHANGES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Propose a change to epoch mint cap
     */
    function proposeEpochCapChange(uint256 newCap) external onlyRole(GOVERNOR_ROLE) {
        _proposeChange(CHANGE_EPOCH_CAP, newCap);
    }

    /**
     * @notice Execute epoch cap change after timelock
     */
    function executeEpochCapChange() external onlyRole(GOVERNOR_ROLE) {
        uint256 newCap = _executeChange(CHANGE_EPOCH_CAP);
        epochMintCap = newCap;
    }

    /**
     * @notice Propose a change to max oracle age
     */
    function proposeMaxOracleAgeChange(uint256 newAge) external onlyRole(GOVERNOR_ROLE) {
        _proposeChange(CHANGE_MAX_ORACLE_AGE, newAge);
    }

    /**
     * @notice Execute max oracle age change after timelock
     */
    function executeMaxOracleAgeChange() external onlyRole(GOVERNOR_ROLE) {
        uint256 newAge = _executeChange(CHANGE_MAX_ORACLE_AGE);
        maxOracleAge = newAge;
    }

    /**
     * @notice Cancel any pending change
     */
    function cancelChange(bytes32 changeType) external onlyRole(GOVERNOR_ROLE) {
        if (!pendingChanges[changeType].pending) revert NoChangePending();
        delete pendingChanges[changeType];
        emit ChangeCancelled(changeType);
    }

    function _proposeChange(bytes32 changeType, uint256 newValue) internal {
        if (pendingChanges[changeType].pending) revert ChangeAlreadyPending();

        uint256 executeAfter = block.timestamp + TIMELOCK_DURATION;
        pendingChanges[changeType] = PendingChange({
            newValue: newValue,
            executeAfter: executeAfter,
            pending: true
        });

        emit ChangeProposed(changeType, newValue, executeAfter);
    }

    function _executeChange(bytes32 changeType) internal returns (uint256) {
        PendingChange storage change = pendingChanges[changeType];
        if (!change.pending) revert NoChangePending();
        if (block.timestamp < change.executeAfter) revert TimelockNotReady();

        uint256 newValue = change.newValue;
        delete pendingChanges[changeType];

        emit ChangeExecuted(changeType, newValue);
        return newValue;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if minting is currently possible
     */
    function canMintNow(uint256 amount) external view returns (bool, string memory) {
        if (paused()) return (false, "Paused");
        if (!backingOracle.isHealthy()) return (false, "Oracle unhealthy");
        if (backingOracle.getDataAge() > maxOracleAge) return (false, "Oracle stale");
        if (token.totalSupply() + amount > GLOBAL_SUPPLY_CAP) return (false, "Global cap exceeded");
        if (!backingOracle.canMint(token.totalSupply(), amount)) return (false, "Insufficient backing");

        // Check epoch (simplified for view)
        uint256 remaining = this.getRemainingEpochMint();
        if (amount > remaining) return (false, "Epoch cap exceeded");

        return (true, "");
    }

    /**
     * @notice Get all current limits and status
     */
    function getStatus() external view returns (
        bool isPaused,
        bool oracleHealthy,
        uint256 oracleAge,
        uint256 currentBacking,
        uint256 totalSupply,
        uint256 globalCap,
        uint256 epochRemaining
    ) {
        return (
            paused(),
            backingOracle.isHealthy(),
            backingOracle.getDataAge(),
            backingOracle.getVerifiedBacking(),
            token.totalSupply(),
            GLOBAL_SUPPLY_CAP,
            this.getRemainingEpochMint()
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE FOR BACKED TOKEN
// ═══════════════════════════════════════════════════════════════════════════

interface IBackedToken {
    function mint(address to, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}
