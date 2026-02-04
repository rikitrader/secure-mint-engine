// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TreasuryVault
 * @notice Multi-tier reserve management system for backed tokens
 * @dev Implements 4-tier reserve architecture as specified in SecureMintEngine
 *
 * TIER STRUCTURE:
 * - Tier 0 (HOT):   5-10%  - Immediate liquidity, protocol multisig
 * - Tier 1 (WARM):  15-25% - Hours liquidity, DeFi yield (Aave/Compound)
 * - Tier 2 (COLD):  50-60% - Days liquidity, hardware wallet multisig
 * - Tier 3 (RWA):   10-20% - Weeks liquidity, tokenized T-Bills
 *
 * SECURITY:
 * - All withdrawals require appropriate role
 * - Emergency withdrawals require guardian approval
 * - Tier allocations are governance-controlled with timelocks
 */
contract TreasuryVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant TREASURY_ADMIN_ROLE = keccak256("TREASURY_ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant TIMELOCK_DURATION = 48 hours;

    uint8 public constant TIER_HOT = 0;
    uint8 public constant TIER_WARM = 1;
    uint8 public constant TIER_COLD = 2;
    uint8 public constant TIER_RWA = 3;
    uint8 public constant NUM_TIERS = 4;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Reserve asset (e.g., USDC, USDT)
    IERC20 public immutable reserveAsset;

    /// @notice Target allocation per tier in basis points (sum must equal 10000)
    uint256[4] public targetAllocations;

    /// @notice Actual balances per tier
    uint256[4] public tierBalances;

    /// @notice Total reserves across all tiers
    uint256 public totalReserves;

    /// @notice Deviation tolerance before rebalancing is triggered (basis points)
    uint256 public rebalanceThreshold;

    /// @notice External vault addresses for Tier 1 (yield) and Tier 3 (RWA)
    address public tier1YieldVault;
    address public tier3RWAVault;

    /// @notice Cold storage multisig for Tier 2
    address public tier2ColdStorage;

    /// @notice Pending allocation changes (timelocked)
    struct PendingAllocation {
        uint256[4] newAllocations;
        uint256 executeAfter;
        bool pending;
    }
    PendingAllocation public pendingAllocation;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event Deposit(address indexed from, uint256 amount, uint8 tier);
    event Withdrawal(address indexed to, uint256 amount, uint8 tier, string reason);
    event TierTransfer(uint8 fromTier, uint8 toTier, uint256 amount);
    event Rebalanced(uint256[4] newBalances);
    event AllocationProposed(uint256[4] newAllocations, uint256 executeAfter);
    event AllocationExecuted(uint256[4] newAllocations);
    event AllocationCancelled();
    event ExternalVaultUpdated(string vaultType, address oldAddress, address newAddress);
    event EmergencyWithdrawal(address indexed to, uint256 amount, string reason);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidTier();
    error InvalidAllocation();
    error InsufficientBalance();
    error TimelockNotReady();
    error NoPendingChange();
    error ChangeAlreadyPending();
    error ZeroAddress();
    error ZeroAmount();
    error AllocationSumInvalid();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the TreasuryVault
     * @param _reserveAsset Address of the reserve asset (e.g., USDC)
     * @param _admin Initial admin address (should be multisig)
     * @param _initialAllocations Initial target allocations per tier [T0, T1, T2, T3]
     */
    constructor(
        address _reserveAsset,
        address _admin,
        uint256[4] memory _initialAllocations
    ) {
        if (_reserveAsset == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        // Validate allocations sum to 100%
        uint256 sum;
        for (uint8 i = 0; i < NUM_TIERS; i++) {
            sum += _initialAllocations[i];
        }
        if (sum != BASIS_POINTS) revert AllocationSumInvalid();

        reserveAsset = IERC20(_reserveAsset);
        targetAllocations = _initialAllocations;
        rebalanceThreshold = 500; // 5% default

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(TREASURY_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
        _grantRole(REBALANCER_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEPOSIT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit reserves into a specific tier
     * @param amount Amount to deposit
     * @param tier Target tier (0-3)
     */
    function deposit(uint256 amount, uint8 tier)
        external
        nonReentrant
        whenNotPaused
        onlyRole(TREASURY_ADMIN_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (tier >= NUM_TIERS) revert InvalidTier();

        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);

        tierBalances[tier] += amount;
        totalReserves += amount;

        emit Deposit(msg.sender, amount, tier);
    }

    /**
     * @notice Deposit reserves and auto-distribute according to target allocations
     * @param amount Total amount to deposit
     */
    function depositDistributed(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(TREASURY_ADMIN_ROLE)
    {
        if (amount == 0) revert ZeroAmount();

        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);

        // Distribute according to target allocations
        for (uint8 i = 0; i < NUM_TIERS; i++) {
            uint256 tierAmount = (amount * targetAllocations[i]) / BASIS_POINTS;
            tierBalances[i] += tierAmount;
            emit Deposit(msg.sender, tierAmount, i);
        }

        totalReserves += amount;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WITHDRAWAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Withdraw reserves from a specific tier
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @param tier Source tier
     * @param reason Reason for withdrawal (logged)
     */
    function withdraw(address to, uint256 amount, uint8 tier, string calldata reason)
        external
        nonReentrant
        whenNotPaused
        onlyRole(TREASURY_ADMIN_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (tier >= NUM_TIERS) revert InvalidTier();
        if (tierBalances[tier] < amount) revert InsufficientBalance();

        tierBalances[tier] -= amount;
        totalReserves -= amount;

        reserveAsset.safeTransfer(to, amount);

        emit Withdrawal(to, amount, tier, reason);
    }

    /**
     * @notice Emergency withdrawal - bypasses normal controls
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @param reason Emergency reason
     */
    function emergencyWithdraw(address to, uint256 amount, string calldata reason)
        external
        nonReentrant
        onlyRole(GUARDIAN_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = reserveAsset.balanceOf(address(this));
        if (available < amount) revert InsufficientBalance();

        // Deduct from tiers proportionally
        uint256 remaining = amount;
        for (uint8 i = 0; i < NUM_TIERS && remaining > 0; i++) {
            uint256 deduct = tierBalances[i] < remaining ? tierBalances[i] : remaining;
            tierBalances[i] -= deduct;
            remaining -= deduct;
        }
        totalReserves -= amount;

        reserveAsset.safeTransfer(to, amount);

        emit EmergencyWithdrawal(to, amount, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REBALANCING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Transfer reserves between tiers
     * @param fromTier Source tier
     * @param toTier Destination tier
     * @param amount Amount to transfer
     */
    function transferBetweenTiers(uint8 fromTier, uint8 toTier, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRole(REBALANCER_ROLE)
    {
        if (fromTier >= NUM_TIERS || toTier >= NUM_TIERS) revert InvalidTier();
        if (fromTier == toTier) revert InvalidTier();
        if (amount == 0) revert ZeroAmount();
        if (tierBalances[fromTier] < amount) revert InsufficientBalance();

        tierBalances[fromTier] -= amount;
        tierBalances[toTier] += amount;

        emit TierTransfer(fromTier, toTier, amount);
    }

    /**
     * @notice Rebalance all tiers to match target allocations
     */
    function rebalance() external nonReentrant whenNotPaused onlyRole(REBALANCER_ROLE) {
        uint256[4] memory targetBalances;

        // Calculate target balances
        for (uint8 i = 0; i < NUM_TIERS; i++) {
            targetBalances[i] = (totalReserves * targetAllocations[i]) / BASIS_POINTS;
        }

        // Rebalance: move from over-allocated to under-allocated
        for (uint8 from = 0; from < NUM_TIERS; from++) {
            if (tierBalances[from] > targetBalances[from]) {
                uint256 excess = tierBalances[from] - targetBalances[from];

                for (uint8 to = 0; to < NUM_TIERS && excess > 0; to++) {
                    if (tierBalances[to] < targetBalances[to]) {
                        uint256 deficit = targetBalances[to] - tierBalances[to];
                        uint256 transfer = excess < deficit ? excess : deficit;

                        tierBalances[from] -= transfer;
                        tierBalances[to] += transfer;
                        excess -= transfer;

                        emit TierTransfer(from, to, transfer);
                    }
                }
            }
        }

        emit Rebalanced(tierBalances);
    }

    /**
     * @notice Check if rebalancing is needed
     * @return needed True if any tier deviates beyond threshold
     */
    function needsRebalancing() external view returns (bool needed) {
        if (totalReserves == 0) return false;

        for (uint8 i = 0; i < NUM_TIERS; i++) {
            uint256 targetBalance = (totalReserves * targetAllocations[i]) / BASIS_POINTS;
            uint256 actualBalance = tierBalances[i];

            uint256 deviation;
            if (actualBalance > targetBalance) {
                deviation = ((actualBalance - targetBalance) * BASIS_POINTS) / totalReserves;
            } else {
                deviation = ((targetBalance - actualBalance) * BASIS_POINTS) / totalReserves;
            }

            if (deviation > rebalanceThreshold) {
                return true;
            }
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ALLOCATION MANAGEMENT (TIMELOCKED)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Propose new target allocations (timelocked)
     * @param newAllocations New allocations [T0, T1, T2, T3] in basis points
     */
    function proposeAllocation(uint256[4] calldata newAllocations)
        external
        onlyRole(GOVERNOR_ROLE)
    {
        if (pendingAllocation.pending) revert ChangeAlreadyPending();

        // Validate sum
        uint256 sum;
        for (uint8 i = 0; i < NUM_TIERS; i++) {
            sum += newAllocations[i];
        }
        if (sum != BASIS_POINTS) revert AllocationSumInvalid();

        pendingAllocation = PendingAllocation({
            newAllocations: newAllocations,
            executeAfter: block.timestamp + TIMELOCK_DURATION,
            pending: true
        });

        emit AllocationProposed(newAllocations, pendingAllocation.executeAfter);
    }

    /**
     * @notice Execute pending allocation change after timelock
     */
    function executeAllocation() external onlyRole(GOVERNOR_ROLE) {
        if (!pendingAllocation.pending) revert NoPendingChange();
        if (block.timestamp < pendingAllocation.executeAfter) revert TimelockNotReady();

        targetAllocations = pendingAllocation.newAllocations;
        delete pendingAllocation;

        emit AllocationExecuted(targetAllocations);
    }

    /**
     * @notice Cancel pending allocation change
     */
    function cancelAllocation() external onlyRole(GOVERNOR_ROLE) {
        if (!pendingAllocation.pending) revert NoPendingChange();
        delete pendingAllocation;
        emit AllocationCancelled();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXTERNAL VAULT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set the Tier 1 yield vault address
     * @param _vault New vault address
     */
    function setTier1YieldVault(address _vault) external onlyRole(GOVERNOR_ROLE) {
        emit ExternalVaultUpdated("Tier1Yield", tier1YieldVault, _vault);
        tier1YieldVault = _vault;
    }

    /**
     * @notice Set the Tier 2 cold storage address
     * @param _coldStorage New cold storage address
     */
    function setTier2ColdStorage(address _coldStorage) external onlyRole(GOVERNOR_ROLE) {
        emit ExternalVaultUpdated("Tier2Cold", tier2ColdStorage, _coldStorage);
        tier2ColdStorage = _coldStorage;
    }

    /**
     * @notice Set the Tier 3 RWA vault address
     * @param _vault New RWA vault address
     */
    function setTier3RWAVault(address _vault) external onlyRole(GOVERNOR_ROLE) {
        emit ExternalVaultUpdated("Tier3RWA", tier3RWAVault, _vault);
        tier3RWAVault = _vault;
    }

    /**
     * @notice Set the rebalance threshold
     * @param _threshold New threshold in basis points
     */
    function setRebalanceThreshold(uint256 _threshold) external onlyRole(GOVERNOR_ROLE) {
        rebalanceThreshold = _threshold;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAUSE CONTROLS
    // ═══════════════════════════════════════════════════════════════════════════

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get current allocation percentages per tier
     * @return allocations Current allocations in basis points
     */
    function getCurrentAllocations() external view returns (uint256[4] memory allocations) {
        if (totalReserves == 0) return allocations;

        for (uint8 i = 0; i < NUM_TIERS; i++) {
            allocations[i] = (tierBalances[i] * BASIS_POINTS) / totalReserves;
        }
    }

    /**
     * @notice Get all tier balances
     * @return balances Array of tier balances
     */
    function getTierBalances() external view returns (uint256[4] memory balances) {
        return tierBalances;
    }

    /**
     * @notice Get target allocations
     * @return allocations Array of target allocations
     */
    function getTargetAllocations() external view returns (uint256[4] memory allocations) {
        return targetAllocations;
    }

    /**
     * @notice Get health factor (total reserves / expected backing)
     * @param expectedBacking The expected backing amount
     * @return healthFactor Health factor in basis points (10000 = 100%)
     */
    function getHealthFactor(uint256 expectedBacking) external view returns (uint256 healthFactor) {
        if (expectedBacking == 0) return BASIS_POINTS;
        return (totalReserves * BASIS_POINTS) / expectedBacking;
    }

    /**
     * @notice Get full treasury status
     */
    function getStatus() external view returns (
        uint256 _totalReserves,
        uint256[4] memory _tierBalances,
        uint256[4] memory _targetAllocations,
        uint256[4] memory _currentAllocations,
        bool _needsRebalancing,
        bool _isPaused
    ) {
        _totalReserves = totalReserves;
        _tierBalances = tierBalances;
        _targetAllocations = targetAllocations;

        if (totalReserves > 0) {
            for (uint8 i = 0; i < NUM_TIERS; i++) {
                _currentAllocations[i] = (tierBalances[i] * BASIS_POINTS) / totalReserves;
            }
        }

        _needsRebalancing = this.needsRebalancing();
        _isPaused = paused();
    }
}
