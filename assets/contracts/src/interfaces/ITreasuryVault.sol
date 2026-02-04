// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITreasuryVault
 * @author SecureMint Team
 * @notice Interface for the multi-tier treasury reserve management system
 * @dev The TreasuryVault manages reserves across four tiers with different
 *      liquidity and risk profiles:
 *
 * Tier 0 - HOT (Instant):   High liquidity, instant access
 *                           Typically 10% of reserves
 *                           Used for immediate redemptions
 *
 * Tier 1 - WARM (24h):      Medium liquidity, 24-hour access
 *                           Typically 20% of reserves
 *                           Used for standard redemptions
 *
 * Tier 2 - COLD (7d):       Low liquidity, 7-day access
 *                           Typically 50% of reserves
 *                           Yield-generating strategies
 *
 * Tier 3 - RWA (30d):       Illiquid, 30-day access
 *                           Typically 20% of reserves
 *                           Real-world asset backing
 *
 * The system automatically rebalances between tiers based on:
 * - Redemption patterns
 * - Target allocations
 * - Governance decisions
 */
interface ITreasuryVault {
    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when reserves are deposited
     * @param from The depositor address
     * @param amount The amount deposited
     * @param tier The tier receiving the deposit
     */
    event Deposit(address indexed from, uint256 amount, uint8 tier);

    /**
     * @notice Emitted when reserves are withdrawn
     * @param to The recipient address
     * @param amount The amount withdrawn
     * @param tier The tier from which funds were withdrawn
     * @param reason The reason for withdrawal
     */
    event Withdrawal(
        address indexed to,
        uint256 amount,
        uint8 tier,
        string reason
    );

    /**
     * @notice Emitted when reserves are moved between tiers
     * @param fromTier The source tier
     * @param toTier The destination tier
     * @param amount The amount transferred
     */
    event TierTransfer(uint8 fromTier, uint8 toTier, uint256 amount);

    /**
     * @notice Emitted when automatic rebalancing occurs
     * @param oldBalances The balances before rebalancing [tier0, tier1, tier2, tier3]
     * @param newBalances The balances after rebalancing
     */
    event Rebalanced(uint256[4] oldBalances, uint256[4] newBalances);

    /**
     * @notice Emitted when a new allocation is proposed
     * @param newAllocations The proposed allocations in basis points
     * @param effectiveTime When the allocation will take effect
     */
    event AllocationProposed(uint256[4] newAllocations, uint256 effectiveTime);

    /**
     * @notice Emitted when allocation change is executed
     * @param newAllocations The new allocations
     */
    event AllocationExecuted(uint256[4] newAllocations);

    /**
     * @notice Emitted on emergency withdrawal
     * @param to The recipient
     * @param amount The amount withdrawn
     * @param reason The emergency reason
     */
    event EmergencyWithdrawal(
        address indexed to,
        uint256 amount,
        string reason
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Thrown when tier balance is insufficient
    error InsufficientTierBalance(uint8 tier, uint256 requested, uint256 available);

    /// @notice Thrown when allocations don't sum to 100%
    error InvalidAllocationSum();

    /// @notice Thrown when tier index is invalid
    error InvalidTier(uint8 tier);

    /// @notice Thrown when cooldown hasn't elapsed for tier access
    error TierCooldownNotElapsed(uint8 tier, uint256 remaining);

    /// @notice Thrown when rebalance would violate constraints
    error RebalanceConstraintViolation();

    // ═══════════════════════════════════════════════════════════════════════════════
    // DEPOSIT/WITHDRAWAL
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit reserves into the treasury
     * @param amount The amount to deposit (6 decimals)
     * @param tier The tier to deposit into (0-3)
     *
     * Requirements:
     * - Caller must have approved treasury for transfer
     * - tier must be valid (0-3)
     */
    function deposit(uint256 amount, uint8 tier) external;

    /**
     * @notice Withdraw reserves from the treasury
     * @param to The recipient address
     * @param amount The amount to withdraw
     * @param tier The tier to withdraw from
     * @param reason The reason for withdrawal
     *
     * Requirements:
     * - Caller must have TREASURY_MANAGER_ROLE or be redemption engine
     * - Sufficient balance in tier
     * - Cooldown elapsed for tier (if applicable)
     */
    function withdraw(
        address to,
        uint256 amount,
        uint8 tier,
        string calldata reason
    ) external;

    /**
     * @notice Emergency withdrawal bypassing normal restrictions
     * @param to The recipient address
     * @param amount The amount to withdraw
     * @param reason The emergency reason
     *
     * Requirements:
     * - Caller must have GUARDIAN_ROLE
     * - System must be in EMERGENCY or SHUTDOWN mode
     */
    function emergencyWithdraw(
        address to,
        uint256 amount,
        string calldata reason
    ) external;

    // ═══════════════════════════════════════════════════════════════════════════════
    // TIER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Transfer funds between tiers
     * @param fromTier The source tier
     * @param toTier The destination tier
     * @param amount The amount to transfer
     *
     * Requirements:
     * - Caller must have TREASURY_MANAGER_ROLE
     * - Sufficient balance in source tier
     */
    function transferBetweenTiers(
        uint8 fromTier,
        uint8 toTier,
        uint256 amount
    ) external;

    /**
     * @notice Trigger automatic rebalancing based on target allocations
     *
     * Requirements:
     * - Caller must have TREASURY_MANAGER_ROLE
     */
    function rebalance() external;

    /**
     * @notice Propose new tier allocations (timelocked)
     * @param newAllocations The new allocations in basis points [tier0, tier1, tier2, tier3]
     *
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * - Allocations must sum to 10000 (100%)
     */
    function proposeAllocation(uint256[4] calldata newAllocations) external;

    /**
     * @notice Execute a pending allocation change
     *
     * Requirements:
     * - A pending allocation must exist
     * - Timelock period must have elapsed
     */
    function executeAllocation() external;

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice The reserve asset (e.g., USDC)
    function reserveAsset() external view returns (address);

    /// @notice Total reserves across all tiers
    function totalReserves() external view returns (uint256);

    /**
     * @notice Get balance of a specific tier
     * @param tier The tier (0-3)
     * @return The balance in the tier
     */
    function tierBalance(uint8 tier) external view returns (uint256);

    /**
     * @notice Get target allocation for a tier
     * @param tier The tier (0-3)
     * @return The allocation in basis points (e.g., 1000 = 10%)
     */
    function tierAllocation(uint8 tier) external view returns (uint256);

    /**
     * @notice Get cooldown period for a tier
     * @param tier The tier (0-3)
     * @return The cooldown in seconds
     */
    function tierCooldown(uint8 tier) external view returns (uint256);

    /**
     * @notice Get timestamp of last rebalance
     * @return The timestamp
     */
    function lastRebalanceTime() external view returns (uint256);

    /**
     * @notice Get all tier balances
     * @return balances Array of [tier0, tier1, tier2, tier3] balances
     */
    function getAllBalances() external view returns (uint256[4] memory balances);

    /**
     * @notice Get all tier allocations
     * @return allocations Array of [tier0, tier1, tier2, tier3] allocations in basis points
     */
    function getAllAllocations() external view returns (uint256[4] memory allocations);

    /**
     * @notice Calculate amount available for immediate withdrawal
     * @return The instantly withdrawable amount (tier 0 + any unlocked funds)
     */
    function availableForRedemption() external view returns (uint256);
}
