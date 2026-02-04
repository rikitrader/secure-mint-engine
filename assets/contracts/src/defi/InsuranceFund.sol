// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title InsuranceFund
 * @author SecureMint Team
 * @notice Insurance pool for depeg protection and slashing coverage
 * @dev Provides a safety net for users in case of backing failures or protocol issues
 *
 * Coverage Types:
 * 1. Depeg Protection: Covers losses when token trades below backing
 * 2. Slashing Coverage: Covers losses from validator misbehavior
 * 3. Oracle Failure: Covers losses from oracle manipulation/failure
 * 4. Smart Contract Risk: Covers losses from contract bugs
 *
 * Funding Sources:
 * - Protocol fees (% of mint/redeem fees)
 * - Staking rewards
 * - Direct contributions
 * - Yield from treasury allocation
 */
contract InsuranceFund is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════════

    bytes32 public constant CLAIMS_ADMIN_ROLE = keccak256("CLAIMS_ADMIN_ROLE");
    bytes32 public constant FUND_MANAGER_ROLE = keccak256("FUND_MANAGER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Reserve asset (e.g., USDC)
    IERC20 public immutable reserveAsset;

    /// @notice SecureMint token
    IERC20 public immutable secureMintToken;

    /// @notice Total fund balance
    uint256 public totalFundBalance;

    /// @notice Total claims paid out
    uint256 public totalClaimsPaid;

    /// @notice Coverage types
    enum CoverageType {
        DEPEG,
        SLASHING,
        ORACLE_FAILURE,
        SMART_CONTRACT
    }

    /// @notice Coverage parameters
    struct CoverageParams {
        bool active;
        uint256 maxCoverage;          // Maximum payout per claim
        uint256 deductibleBps;        // Deductible in basis points
        uint256 coverageRatioBps;     // Coverage ratio (e.g., 9000 = 90%)
        uint256 cooldownPeriod;       // Time between claims
        uint256 totalAllocated;       // Total allocated to this coverage
        uint256 totalClaimed;         // Total claimed from this coverage
    }

    /// @notice Coverage parameters by type
    mapping(CoverageType => CoverageParams) public coverageParams;

    /// @notice Claim struct
    struct Claim {
        address claimant;
        CoverageType coverageType;
        uint256 lossAmount;
        uint256 claimAmount;
        uint256 submittedAt;
        uint256 processedAt;
        ClaimStatus status;
        string evidence;
        string resolution;
    }

    /// @notice Claim status
    enum ClaimStatus {
        PENDING,
        APPROVED,
        REJECTED,
        PAID
    }

    /// @notice All claims
    Claim[] public claims;

    /// @notice User claim history (user => claim IDs)
    mapping(address => uint256[]) public userClaims;

    /// @notice Last claim time per user per coverage type
    mapping(address => mapping(CoverageType => uint256)) public lastClaimTime;

    /// @notice Contribution tracking
    mapping(address => uint256) public contributions;
    uint256 public totalContributions;

    /// @notice Minimum claim amount
    uint256 public minClaimAmount;

    /// @notice Claims assessment period
    uint256 public assessmentPeriod;

    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event FundDeposited(address indexed from, uint256 amount, string source);
    event FundWithdrawn(address indexed to, uint256 amount, string reason);

    event ClaimSubmitted(
        uint256 indexed claimId,
        address indexed claimant,
        CoverageType coverageType,
        uint256 lossAmount
    );
    event ClaimAssessed(uint256 indexed claimId, ClaimStatus status, string resolution);
    event ClaimPaid(uint256 indexed claimId, address indexed claimant, uint256 amount);

    event CoverageUpdated(CoverageType coverageType, uint256 maxCoverage, uint256 coverageRatio);
    event CoverageAllocated(CoverageType coverageType, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    error CoverageNotActive();
    error AmountTooLow();
    error AmountTooHigh();
    error ClaimCooldownActive();
    error InvalidClaimId();
    error ClaimNotPending();
    error InsufficientFunds();
    error ClaimAlreadyPaid();

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    constructor(
        address _reserveAsset,
        address _secureMintToken
    ) {
        reserveAsset = IERC20(_reserveAsset);
        secureMintToken = IERC20(_secureMintToken);

        minClaimAmount = 100e6; // 100 USDC
        assessmentPeriod = 7 days;

        // Initialize coverage types
        _initializeCoverage(CoverageType.DEPEG, 1_000_000e6, 500, 9000, 30 days);
        _initializeCoverage(CoverageType.SLASHING, 500_000e6, 1000, 8000, 7 days);
        _initializeCoverage(CoverageType.ORACLE_FAILURE, 500_000e6, 500, 9500, 14 days);
        _initializeCoverage(CoverageType.SMART_CONTRACT, 2_000_000e6, 0, 10000, 90 days);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CLAIMS_ADMIN_ROLE, msg.sender);
        _grantRole(FUND_MANAGER_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // FUND MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit funds into the insurance pool
     * @param amount Amount to deposit
     * @param source Description of fund source
     */
    function deposit(uint256 amount, string calldata source) external nonReentrant {
        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);

        totalFundBalance += amount;
        contributions[msg.sender] += amount;
        totalContributions += amount;

        emit FundDeposited(msg.sender, amount, source);
    }

    /**
     * @notice Deposit fees from protocol
     * @param amount Fee amount
     */
    function depositProtocolFees(uint256 amount) external nonReentrant {
        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);
        totalFundBalance += amount;

        emit FundDeposited(msg.sender, amount, "protocol_fees");
    }

    /**
     * @notice Allocate funds to a coverage type
     * @param coverageType Coverage type
     * @param amount Amount to allocate
     */
    function allocateToCoverage(
        CoverageType coverageType,
        uint256 amount
    ) external onlyRole(FUND_MANAGER_ROLE) {
        require(amount <= totalFundBalance, "Insufficient balance");

        coverageParams[coverageType].totalAllocated += amount;
        emit CoverageAllocated(coverageType, amount);
    }

    /**
     * @notice Withdraw excess funds (admin only)
     * @param to Recipient
     * @param amount Amount to withdraw
     * @param reason Reason for withdrawal
     */
    function withdraw(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        // Ensure minimum coverage is maintained
        uint256 minRequired = _calculateMinimumFund();
        require(totalFundBalance - amount >= minRequired, "Would breach minimum");

        totalFundBalance -= amount;
        reserveAsset.safeTransfer(to, amount);

        emit FundWithdrawn(to, amount, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CLAIMS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Submit a claim
     * @param coverageType Type of coverage
     * @param lossAmount Amount of loss
     * @param evidence Evidence/description of the loss
     * @return claimId Claim identifier
     */
    function submitClaim(
        CoverageType coverageType,
        uint256 lossAmount,
        string calldata evidence
    ) external nonReentrant whenNotPaused returns (uint256 claimId) {
        CoverageParams storage params = coverageParams[coverageType];

        if (!params.active) revert CoverageNotActive();
        if (lossAmount < minClaimAmount) revert AmountTooLow();
        if (lossAmount > params.maxCoverage) revert AmountTooHigh();

        // Check cooldown
        uint256 lastClaim = lastClaimTime[msg.sender][coverageType];
        if (block.timestamp < lastClaim + params.cooldownPeriod) {
            revert ClaimCooldownActive();
        }

        // Calculate claim amount (after deductible and coverage ratio)
        uint256 afterDeductible = lossAmount - (lossAmount * params.deductibleBps / 10000);
        uint256 claimAmount = afterDeductible * params.coverageRatioBps / 10000;

        // Create claim
        claimId = claims.length;
        claims.push(Claim({
            claimant: msg.sender,
            coverageType: coverageType,
            lossAmount: lossAmount,
            claimAmount: claimAmount,
            submittedAt: block.timestamp,
            processedAt: 0,
            status: ClaimStatus.PENDING,
            evidence: evidence,
            resolution: ""
        }));

        userClaims[msg.sender].push(claimId);
        lastClaimTime[msg.sender][coverageType] = block.timestamp;

        emit ClaimSubmitted(claimId, msg.sender, coverageType, lossAmount);
    }

    /**
     * @notice Assess a claim (claims admin only)
     * @param claimId Claim ID
     * @param approved Whether to approve the claim
     * @param resolution Resolution description
     */
    function assessClaim(
        uint256 claimId,
        bool approved,
        string calldata resolution
    ) external onlyRole(CLAIMS_ADMIN_ROLE) {
        if (claimId >= claims.length) revert InvalidClaimId();

        Claim storage claim = claims[claimId];
        if (claim.status != ClaimStatus.PENDING) revert ClaimNotPending();

        claim.processedAt = block.timestamp;
        claim.resolution = resolution;
        claim.status = approved ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;

        emit ClaimAssessed(claimId, claim.status, resolution);
    }

    /**
     * @notice Pay an approved claim
     * @param claimId Claim ID
     */
    function payClaim(uint256 claimId) external nonReentrant onlyRole(CLAIMS_ADMIN_ROLE) {
        if (claimId >= claims.length) revert InvalidClaimId();

        Claim storage claim = claims[claimId];
        if (claim.status != ClaimStatus.APPROVED) revert ClaimNotPending();
        if (claim.claimAmount > totalFundBalance) revert InsufficientFunds();

        claim.status = ClaimStatus.PAID;
        totalFundBalance -= claim.claimAmount;
        totalClaimsPaid += claim.claimAmount;
        coverageParams[claim.coverageType].totalClaimed += claim.claimAmount;

        reserveAsset.safeTransfer(claim.claimant, claim.claimAmount);

        emit ClaimPaid(claimId, claim.claimant, claim.claimAmount);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // COVERAGE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update coverage parameters
     */
    function updateCoverage(
        CoverageType coverageType,
        bool active,
        uint256 maxCoverage,
        uint256 deductibleBps,
        uint256 coverageRatioBps,
        uint256 cooldownPeriod
    ) external onlyRole(FUND_MANAGER_ROLE) {
        require(coverageRatioBps <= 10000, "Invalid ratio");
        require(deductibleBps <= 5000, "Deductible too high");

        CoverageParams storage params = coverageParams[coverageType];
        params.active = active;
        params.maxCoverage = maxCoverage;
        params.deductibleBps = deductibleBps;
        params.coverageRatioBps = coverageRatioBps;
        params.cooldownPeriod = cooldownPeriod;

        emit CoverageUpdated(coverageType, maxCoverage, coverageRatioBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function getClaim(uint256 claimId) external view returns (
        address claimant,
        CoverageType coverageType,
        uint256 lossAmount,
        uint256 claimAmount,
        uint256 submittedAt,
        uint256 processedAt,
        ClaimStatus status
    ) {
        if (claimId >= claims.length) revert InvalidClaimId();
        Claim storage claim = claims[claimId];
        return (
            claim.claimant,
            claim.coverageType,
            claim.lossAmount,
            claim.claimAmount,
            claim.submittedAt,
            claim.processedAt,
            claim.status
        );
    }

    function getUserClaims(address user) external view returns (uint256[] memory) {
        return userClaims[user];
    }

    function getClaimsCount() external view returns (uint256) {
        return claims.length;
    }

    function getCoverageAvailable(CoverageType coverageType) external view returns (uint256) {
        CoverageParams storage params = coverageParams[coverageType];
        uint256 remaining = params.totalAllocated - params.totalClaimed;
        return remaining < totalFundBalance ? remaining : totalFundBalance;
    }

    function canSubmitClaim(
        address user,
        CoverageType coverageType
    ) external view returns (bool, string memory) {
        CoverageParams storage params = coverageParams[coverageType];

        if (!params.active) return (false, "Coverage not active");

        uint256 lastClaim = lastClaimTime[user][coverageType];
        if (block.timestamp < lastClaim + params.cooldownPeriod) {
            return (false, "Cooldown active");
        }

        return (true, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function _initializeCoverage(
        CoverageType coverageType,
        uint256 maxCoverage,
        uint256 deductibleBps,
        uint256 coverageRatioBps,
        uint256 cooldownPeriod
    ) internal {
        coverageParams[coverageType] = CoverageParams({
            active: true,
            maxCoverage: maxCoverage,
            deductibleBps: deductibleBps,
            coverageRatioBps: coverageRatioBps,
            cooldownPeriod: cooldownPeriod,
            totalAllocated: 0,
            totalClaimed: 0
        });
    }

    function _calculateMinimumFund() internal view returns (uint256) {
        // Minimum fund should cover at least 10% of total coverage
        uint256 totalMaxCoverage = 0;
        for (uint8 i = 0; i <= uint8(CoverageType.SMART_CONTRACT); i++) {
            totalMaxCoverage += coverageParams[CoverageType(i)].maxCoverage;
        }
        return totalMaxCoverage / 10;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setMinClaimAmount(uint256 amount) external onlyRole(FUND_MANAGER_ROLE) {
        minClaimAmount = amount;
    }

    function setAssessmentPeriod(uint256 period) external onlyRole(FUND_MANAGER_ROLE) {
        assessmentPeriod = period;
    }
}
