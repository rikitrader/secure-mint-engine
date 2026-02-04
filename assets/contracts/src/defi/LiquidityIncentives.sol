// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LiquidityIncentives
 * @author SecureMint Team
 * @notice LP reward distribution for SecureMint liquidity providers
 * @dev Distributes rewards to LPs who provide liquidity for SMT/USDC pairs
 *
 * Features:
 * - Multiple pool support (Uniswap, Curve, etc.)
 * - Time-weighted reward distribution
 * - Boosted rewards for longer lock periods
 * - Referral bonuses
 * - Emergency withdrawal
 */
contract LiquidityIncentives is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════════

    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Reward token (can be SMT or other governance token)
    IERC20 public immutable rewardToken;

    /// @notice Pool information
    struct PoolInfo {
        IERC20 lpToken;              // LP token address
        uint256 allocPoint;          // Allocation points for this pool
        uint256 lastRewardTime;      // Last time rewards were distributed
        uint256 accRewardPerShare;   // Accumulated rewards per share (scaled by 1e12)
        uint256 totalStaked;         // Total LP tokens staked
        bool active;                 // Whether pool is active
    }

    /// @notice User stake information
    struct UserInfo {
        uint256 amount;              // LP tokens staked
        uint256 rewardDebt;          // Reward debt
        uint256 lockEndTime;         // Lock end time (0 = no lock)
        uint256 boostMultiplier;     // Boost multiplier (10000 = 1x)
        address referrer;            // Referrer address
        uint256 pendingRewards;      // Pending rewards to claim
    }

    /// @notice Lock tier for boost multipliers
    struct LockTier {
        uint256 duration;            // Lock duration in seconds
        uint256 boostBps;            // Boost in basis points (10000 = 1x, 15000 = 1.5x)
    }

    /// @notice All pools
    PoolInfo[] public pools;

    /// @notice User info per pool (poolId => user => info)
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    /// @notice Total allocation points
    uint256 public totalAllocPoint;

    /// @notice Rewards per second
    uint256 public rewardPerSecond;

    /// @notice Start time for rewards
    uint256 public startTime;

    /// @notice End time for rewards
    uint256 public endTime;

    /// @notice Lock tiers
    LockTier[] public lockTiers;

    /// @notice Referral bonus in basis points
    uint256 public referralBonusBps;

    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;

    /// @notice Total referral rewards paid
    uint256 public totalReferralRewards;

    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event PoolAdded(uint256 indexed poolId, address lpToken, uint256 allocPoint);
    event PoolUpdated(uint256 indexed poolId, uint256 allocPoint);
    event Deposited(uint256 indexed poolId, address indexed user, uint256 amount, uint256 lockDuration);
    event Withdrawn(uint256 indexed poolId, address indexed user, uint256 amount);
    event RewardsClaimed(uint256 indexed poolId, address indexed user, uint256 amount);
    event ReferralReward(address indexed referrer, address indexed user, uint256 amount);
    event EmergencyWithdraw(uint256 indexed poolId, address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    error InvalidPool();
    error PoolNotActive();
    error InsufficientBalance();
    error StillLocked();
    error InvalidLockTier();
    error SelfReferral();
    error AlreadyHasReferrer();
    error ZeroAmount();

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    constructor(
        address _rewardToken,
        uint256 _rewardPerSecond,
        uint256 _startTime
    ) {
        rewardToken = IERC20(_rewardToken);
        rewardPerSecond = _rewardPerSecond;
        startTime = _startTime;
        endTime = _startTime + 365 days; // 1 year default

        referralBonusBps = 500; // 5% referral bonus

        // Initialize lock tiers
        lockTiers.push(LockTier(0, 10000));           // No lock: 1x
        lockTiers.push(LockTier(30 days, 12000));     // 30 days: 1.2x
        lockTiers.push(LockTier(90 days, 15000));     // 90 days: 1.5x
        lockTiers.push(LockTier(180 days, 18000));    // 180 days: 1.8x
        lockTiers.push(LockTier(365 days, 25000));    // 365 days: 2.5x

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_MANAGER_ROLE, msg.sender);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // POOL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add a new LP pool
     * @param lpToken LP token address
     * @param allocPoint Allocation points
     */
    function addPool(
        address lpToken,
        uint256 allocPoint
    ) external onlyRole(POOL_MANAGER_ROLE) {
        totalAllocPoint += allocPoint;

        pools.push(PoolInfo({
            lpToken: IERC20(lpToken),
            allocPoint: allocPoint,
            lastRewardTime: block.timestamp > startTime ? block.timestamp : startTime,
            accRewardPerShare: 0,
            totalStaked: 0,
            active: true
        }));

        emit PoolAdded(pools.length - 1, lpToken, allocPoint);
    }

    /**
     * @notice Update pool allocation points
     * @param poolId Pool ID
     * @param allocPoint New allocation points
     */
    function setPoolAllocPoint(
        uint256 poolId,
        uint256 allocPoint
    ) external onlyRole(POOL_MANAGER_ROLE) {
        if (poolId >= pools.length) revert InvalidPool();

        _updatePool(poolId);

        totalAllocPoint = totalAllocPoint - pools[poolId].allocPoint + allocPoint;
        pools[poolId].allocPoint = allocPoint;

        emit PoolUpdated(poolId, allocPoint);
    }

    /**
     * @notice Activate/deactivate a pool
     */
    function setPoolActive(uint256 poolId, bool active) external onlyRole(POOL_MANAGER_ROLE) {
        if (poolId >= pools.length) revert InvalidPool();
        pools[poolId].active = active;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // STAKING
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit LP tokens
     * @param poolId Pool ID
     * @param amount Amount to deposit
     * @param lockTierIndex Lock tier index
     * @param referrer Referrer address (optional)
     */
    function deposit(
        uint256 poolId,
        uint256 amount,
        uint256 lockTierIndex,
        address referrer
    ) external nonReentrant whenNotPaused {
        if (poolId >= pools.length) revert InvalidPool();
        if (amount == 0) revert ZeroAmount();
        if (lockTierIndex >= lockTiers.length) revert InvalidLockTier();

        PoolInfo storage pool = pools[poolId];
        if (!pool.active) revert PoolNotActive();

        UserInfo storage user = userInfo[poolId][msg.sender];

        _updatePool(poolId);

        // Claim pending rewards if any
        if (user.amount > 0) {
            uint256 pending = _calculatePending(poolId, msg.sender);
            if (pending > 0) {
                user.pendingRewards += pending;
            }
        }

        // Set referrer (only once)
        if (referrer != address(0) && user.referrer == address(0)) {
            if (referrer == msg.sender) revert SelfReferral();
            user.referrer = referrer;
        }

        // Transfer LP tokens
        pool.lpToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update user info
        user.amount += amount;
        pool.totalStaked += amount;

        // Set lock and boost
        LockTier storage tier = lockTiers[lockTierIndex];
        if (tier.duration > 0) {
            uint256 newLockEnd = block.timestamp + tier.duration;
            if (newLockEnd > user.lockEndTime) {
                user.lockEndTime = newLockEnd;
                user.boostMultiplier = tier.boostBps;
            }
        } else if (user.boostMultiplier == 0) {
            user.boostMultiplier = 10000; // Default 1x
        }

        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;

        emit Deposited(poolId, msg.sender, amount, tier.duration);
    }

    /**
     * @notice Withdraw LP tokens
     * @param poolId Pool ID
     * @param amount Amount to withdraw
     */
    function withdraw(
        uint256 poolId,
        uint256 amount
    ) external nonReentrant {
        if (poolId >= pools.length) revert InvalidPool();

        PoolInfo storage pool = pools[poolId];
        UserInfo storage user = userInfo[poolId][msg.sender];

        if (user.amount < amount) revert InsufficientBalance();
        if (user.lockEndTime > block.timestamp) revert StillLocked();

        _updatePool(poolId);

        // Calculate and store pending rewards
        uint256 pending = _calculatePending(poolId, msg.sender);
        if (pending > 0) {
            user.pendingRewards += pending;
        }

        // Update balances
        user.amount -= amount;
        pool.totalStaked -= amount;

        // Reset boost if fully withdrawn
        if (user.amount == 0) {
            user.boostMultiplier = 0;
            user.lockEndTime = 0;
        }

        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;

        // Transfer LP tokens
        pool.lpToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(poolId, msg.sender, amount);
    }

    /**
     * @notice Claim pending rewards
     * @param poolId Pool ID
     */
    function claimRewards(uint256 poolId) external nonReentrant {
        if (poolId >= pools.length) revert InvalidPool();

        _updatePool(poolId);

        UserInfo storage user = userInfo[poolId][msg.sender];

        uint256 pending = _calculatePending(poolId, msg.sender) + user.pendingRewards;
        user.pendingRewards = 0;
        user.rewardDebt = (user.amount * pools[poolId].accRewardPerShare) / 1e12;

        if (pending > 0) {
            // Apply boost
            uint256 boostedReward = (pending * user.boostMultiplier) / 10000;

            // Transfer rewards
            _safeRewardTransfer(msg.sender, boostedReward);
            totalRewardsDistributed += boostedReward;

            // Pay referral bonus
            if (user.referrer != address(0)) {
                uint256 referralReward = (boostedReward * referralBonusBps) / 10000;
                _safeRewardTransfer(user.referrer, referralReward);
                totalReferralRewards += referralReward;
                emit ReferralReward(user.referrer, msg.sender, referralReward);
            }

            emit RewardsClaimed(poolId, msg.sender, boostedReward);
        }
    }

    /**
     * @notice Emergency withdraw without caring about rewards
     * @param poolId Pool ID
     */
    function emergencyWithdraw(uint256 poolId) external nonReentrant {
        if (poolId >= pools.length) revert InvalidPool();

        PoolInfo storage pool = pools[poolId];
        UserInfo storage user = userInfo[poolId][msg.sender];

        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        user.pendingRewards = 0;
        user.boostMultiplier = 0;
        user.lockEndTime = 0;

        pool.totalStaked -= amount;

        pool.lpToken.safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(poolId, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function poolLength() external view returns (uint256) {
        return pools.length;
    }

    function pendingReward(uint256 poolId, address account) external view returns (uint256) {
        if (poolId >= pools.length) return 0;

        PoolInfo storage pool = pools[poolId];
        UserInfo storage user = userInfo[poolId][account];

        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = pool.totalStaked;

        if (block.timestamp > pool.lastRewardTime && lpSupply != 0) {
            uint256 time = _getRewardTime(pool.lastRewardTime);
            uint256 reward = (time * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / lpSupply;
        }

        uint256 pending = ((user.amount * accRewardPerShare) / 1e12) - user.rewardDebt + user.pendingRewards;
        return (pending * user.boostMultiplier) / 10000;
    }

    function getUserInfo(uint256 poolId, address account) external view returns (
        uint256 amount,
        uint256 rewardDebt,
        uint256 lockEndTime,
        uint256 boostMultiplier,
        address referrer
    ) {
        UserInfo storage user = userInfo[poolId][account];
        return (user.amount, user.rewardDebt, user.lockEndTime, user.boostMultiplier, user.referrer);
    }

    function getLockTier(uint256 index) external view returns (uint256 duration, uint256 boostBps) {
        if (index >= lockTiers.length) revert InvalidLockTier();
        LockTier storage tier = lockTiers[index];
        return (tier.duration, tier.boostBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function setRewardPerSecond(uint256 _rewardPerSecond) external onlyRole(REWARD_DISTRIBUTOR_ROLE) {
        // Update all pools first
        for (uint256 i = 0; i < pools.length; i++) {
            _updatePool(i);
        }

        emit RewardRateUpdated(rewardPerSecond, _rewardPerSecond);
        rewardPerSecond = _rewardPerSecond;
    }

    function setEndTime(uint256 _endTime) external onlyRole(POOL_MANAGER_ROLE) {
        require(_endTime > block.timestamp, "Invalid end time");
        endTime = _endTime;
    }

    function setReferralBonus(uint256 _bps) external onlyRole(POOL_MANAGER_ROLE) {
        require(_bps <= 1000, "Too high"); // Max 10%
        referralBonusBps = _bps;
    }

    function addLockTier(uint256 duration, uint256 boostBps) external onlyRole(POOL_MANAGER_ROLE) {
        lockTiers.push(LockTier(duration, boostBps));
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function _updatePool(uint256 poolId) internal {
        PoolInfo storage pool = pools[poolId];

        if (block.timestamp <= pool.lastRewardTime) {
            return;
        }

        uint256 lpSupply = pool.totalStaked;
        if (lpSupply == 0 || totalAllocPoint == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }

        uint256 time = _getRewardTime(pool.lastRewardTime);
        uint256 reward = (time * rewardPerSecond * pool.allocPoint) / totalAllocPoint;

        pool.accRewardPerShare += (reward * 1e12) / lpSupply;
        pool.lastRewardTime = block.timestamp;
    }

    function _calculatePending(uint256 poolId, address account) internal view returns (uint256) {
        PoolInfo storage pool = pools[poolId];
        UserInfo storage user = userInfo[poolId][account];

        return ((user.amount * pool.accRewardPerShare) / 1e12) - user.rewardDebt;
    }

    function _getRewardTime(uint256 from) internal view returns (uint256) {
        uint256 to = block.timestamp < endTime ? block.timestamp : endTime;
        return from < to ? to - from : 0;
    }

    function _safeRewardTransfer(address to, uint256 amount) internal {
        uint256 balance = rewardToken.balanceOf(address(this));
        if (amount > balance) {
            amount = balance;
        }
        if (amount > 0) {
            rewardToken.safeTransfer(to, amount);
        }
    }
}
