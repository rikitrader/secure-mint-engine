// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title RedemptionEngine
 * @notice Burn-to-redeem mechanism for backed tokens
 * @dev Implements the redemption flow as specified in SecureMintEngine
 *
 * REDEMPTION PROCESS:
 * 1. User calls redeem(amount)
 * 2. Engine verifies reserves are available
 * 3. Backed tokens are burned
 * 4. Reserve asset is transferred to user (minus fees)
 *
 * FEES:
 * - Base redemption fee: configurable (default 0.1%)
 * - Depeg surcharge: additional fee when price < $1 (incentivizes arbitrage)
 *
 * RATE LIMITS:
 * - Per-epoch redemption cap (prevents bank run)
 * - Per-user limits (optional)
 *
 * QUEUE SYSTEM:
 * - For large redemptions, implements queue to ensure orderly processing
 * - Queue processed FIFO
 */
contract RedemptionEngine is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant EPOCH_DURATION = 1 hours;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The backed token that can be redeemed
    IERC20 public immutable backedToken;

    /// @notice The reserve asset given upon redemption
    IERC20 public immutable reserveAsset;

    /// @notice Treasury vault holding reserves
    address public treasuryVault;

    /// @notice Base redemption fee in basis points (e.g., 10 = 0.1%)
    uint256 public baseFee;

    /// @notice Depeg surcharge multiplier when price < target
    uint256 public depegSurchargeRate;

    /// @notice Fee recipient address
    address public feeRecipient;

    /// @notice Per-epoch redemption cap
    uint256 public epochRedemptionCap;

    /// @notice Current epoch start timestamp
    uint256 public epochStartTime;

    /// @notice Amount redeemed in current epoch
    uint256 public currentEpochRedeemed;

    /// @notice Minimum redemption amount
    uint256 public minRedemption;

    /// @notice Maximum single redemption (larger goes to queue)
    uint256 public maxInstantRedemption;

    /// @notice Oracle for price data (for depeg surcharge)
    address public priceOracle;

    /// @notice Target price in reserve asset units (e.g., 1e6 for $1 USDC)
    uint256 public targetPrice;

    // ═══════════════════════════════════════════════════════════════════════════
    // QUEUE SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    struct RedemptionRequest {
        address redeemer;
        uint256 amount;
        uint256 requestedAt;
        uint256 fee;
        bool processed;
        bool cancelled;
    }

    /// @notice Queue of pending redemption requests
    RedemptionRequest[] public redemptionQueue;

    /// @notice Next request to process in queue
    uint256 public queueHead;

    /// @notice User's pending redemption amounts
    mapping(address => uint256) public pendingRedemptions;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event InstantRedemption(
        address indexed redeemer,
        uint256 amountBurned,
        uint256 amountReceived,
        uint256 fee
    );

    event RedemptionQueued(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 amount,
        uint256 estimatedFee
    );

    event RedemptionProcessed(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 amountReceived,
        uint256 fee
    );

    event RedemptionCancelled(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 amount
    );

    event FeeUpdated(string feeType, uint256 oldValue, uint256 newValue);
    event LimitUpdated(string limitType, uint256 oldValue, uint256 newValue);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error ZeroAmount();
    error BelowMinimum();
    error EpochCapExceeded();
    error InsufficientReserves();
    error RequestNotFound();
    error RequestAlreadyProcessed();
    error NotRequestOwner();
    error QueueEmpty();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the RedemptionEngine
     * @param _backedToken Address of the backed token
     * @param _reserveAsset Address of the reserve asset
     * @param _treasuryVault Address of the treasury vault
     * @param _admin Admin address
     */
    constructor(
        address _backedToken,
        address _reserveAsset,
        address _treasuryVault,
        address _admin
    ) {
        if (_backedToken == address(0)) revert ZeroAddress();
        if (_reserveAsset == address(0)) revert ZeroAddress();
        if (_treasuryVault == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        backedToken = IERC20(_backedToken);
        reserveAsset = IERC20(_reserveAsset);
        treasuryVault = _treasuryVault;

        // Default values
        baseFee = 10; // 0.1%
        depegSurchargeRate = 0; // No surcharge by default
        feeRecipient = _treasuryVault;
        epochRedemptionCap = type(uint256).max; // No cap by default
        minRedemption = 1e6; // $1 minimum
        maxInstantRedemption = 100000e6; // $100k instant max
        targetPrice = 1e6; // $1.00 in 6 decimals

        epochStartTime = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _treasuryVault);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INSTANT REDEMPTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Instantly redeem backed tokens for reserve asset
     * @param amount Amount of backed tokens to redeem
     */
    function redeem(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (amount < minRedemption) revert BelowMinimum();

        // For large redemptions, queue instead
        if (amount > maxInstantRedemption) {
            _queueRedemption(msg.sender, amount);
            return;
        }

        _processInstantRedemption(msg.sender, amount);
    }

    /**
     * @notice Process instant redemption
     */
    function _processInstantRedemption(address redeemer, uint256 amount) internal {
        // Check epoch cap
        _checkAndUpdateEpoch();
        if (currentEpochRedeemed + amount > epochRedemptionCap) revert EpochCapExceeded();

        // Calculate fee
        uint256 fee = _calculateFee(amount);
        uint256 amountAfterFee = amount - fee;

        // Check reserves
        uint256 reserveBalance = reserveAsset.balanceOf(treasuryVault);
        if (reserveBalance < amountAfterFee) revert InsufficientReserves();

        // Update state
        currentEpochRedeemed += amount;

        // Burn backed tokens from user
        // Note: User must have approved this contract
        backedToken.safeTransferFrom(redeemer, address(this), amount);
        // Burn the tokens (assuming BackedToken is burnable)
        IBurnable(address(backedToken)).burn(amount);

        // Transfer reserves from treasury to user
        reserveAsset.safeTransferFrom(treasuryVault, redeemer, amountAfterFee);

        // Transfer fee to fee recipient
        if (fee > 0) {
            reserveAsset.safeTransferFrom(treasuryVault, feeRecipient, fee);
        }

        emit InstantRedemption(redeemer, amount, amountAfterFee, fee);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // QUEUE SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Queue a redemption request
     */
    function _queueRedemption(address redeemer, uint256 amount) internal {
        uint256 estimatedFee = _calculateFee(amount);

        // Transfer tokens to this contract (held until processed)
        backedToken.safeTransferFrom(redeemer, address(this), amount);

        redemptionQueue.push(RedemptionRequest({
            redeemer: redeemer,
            amount: amount,
            requestedAt: block.timestamp,
            fee: estimatedFee,
            processed: false,
            cancelled: false
        }));

        pendingRedemptions[redeemer] += amount;

        emit RedemptionQueued(redemptionQueue.length - 1, redeemer, amount, estimatedFee);
    }

    /**
     * @notice Process the next request in queue (callable by treasury)
     */
    function processNextInQueue() external nonReentrant onlyRole(TREASURY_ROLE) {
        if (queueHead >= redemptionQueue.length) revert QueueEmpty();

        RedemptionRequest storage request = redemptionQueue[queueHead];

        // Skip cancelled requests
        while (request.cancelled && queueHead < redemptionQueue.length) {
            queueHead++;
            if (queueHead < redemptionQueue.length) {
                request = redemptionQueue[queueHead];
            }
        }

        if (queueHead >= redemptionQueue.length) revert QueueEmpty();
        if (request.processed) revert RequestAlreadyProcessed();

        // Calculate final fee (may differ from estimate due to price changes)
        uint256 fee = _calculateFee(request.amount);
        uint256 amountAfterFee = request.amount - fee;

        // Check reserves
        uint256 reserveBalance = reserveAsset.balanceOf(treasuryVault);
        if (reserveBalance < amountAfterFee) revert InsufficientReserves();

        // Mark as processed
        request.processed = true;
        request.fee = fee;
        pendingRedemptions[request.redeemer] -= request.amount;

        // Burn the held tokens
        IBurnable(address(backedToken)).burn(request.amount);

        // Transfer reserves
        reserveAsset.safeTransferFrom(treasuryVault, request.redeemer, amountAfterFee);

        if (fee > 0) {
            reserveAsset.safeTransferFrom(treasuryVault, feeRecipient, fee);
        }

        emit RedemptionProcessed(queueHead, request.redeemer, amountAfterFee, fee);

        queueHead++;
    }

    /**
     * @notice Cancel a pending redemption request
     * @param requestId Request ID to cancel
     */
    function cancelRedemption(uint256 requestId) external nonReentrant {
        if (requestId >= redemptionQueue.length) revert RequestNotFound();

        RedemptionRequest storage request = redemptionQueue[requestId];

        if (request.redeemer != msg.sender) revert NotRequestOwner();
        if (request.processed) revert RequestAlreadyProcessed();
        if (request.cancelled) revert RequestAlreadyProcessed();

        request.cancelled = true;
        pendingRedemptions[msg.sender] -= request.amount;

        // Return tokens to user
        backedToken.safeTransfer(msg.sender, request.amount);

        emit RedemptionCancelled(requestId, msg.sender, request.amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FEE CALCULATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate redemption fee
     * @param amount Amount being redeemed
     * @return fee Total fee amount
     */
    function _calculateFee(uint256 amount) internal view returns (uint256 fee) {
        // Base fee
        fee = (amount * baseFee) / BASIS_POINTS;

        // Add depeg surcharge if price is below target
        if (priceOracle != address(0) && depegSurchargeRate > 0) {
            uint256 currentPrice = IPriceOracle(priceOracle).getPrice();
            if (currentPrice < targetPrice) {
                // Surcharge proportional to depeg
                uint256 depegBps = ((targetPrice - currentPrice) * BASIS_POINTS) / targetPrice;
                uint256 surcharge = (amount * depegBps * depegSurchargeRate) / (BASIS_POINTS * BASIS_POINTS);
                fee += surcharge;
            }
        }
    }

    /**
     * @notice Get fee quote for a redemption amount
     */
    function getFeeQuote(uint256 amount) external view returns (uint256 fee, uint256 amountAfterFee) {
        fee = _calculateFee(amount);
        amountAfterFee = amount - fee;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function _checkAndUpdateEpoch() internal {
        if (block.timestamp >= epochStartTime + EPOCH_DURATION) {
            epochStartTime = block.timestamp;
            currentEpochRedeemed = 0;
        }
    }

    /**
     * @notice Get remaining redemption capacity in current epoch
     */
    function getRemainingEpochCapacity() external view returns (uint256) {
        if (block.timestamp >= epochStartTime + EPOCH_DURATION) {
            return epochRedemptionCap;
        }
        return epochRedemptionCap > currentEpochRedeemed
            ? epochRedemptionCap - currentEpochRedeemed
            : 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    function setBaseFee(uint256 _fee) external onlyRole(GOVERNOR_ROLE) {
        emit FeeUpdated("baseFee", baseFee, _fee);
        baseFee = _fee;
    }

    function setDepegSurchargeRate(uint256 _rate) external onlyRole(GOVERNOR_ROLE) {
        emit FeeUpdated("depegSurchargeRate", depegSurchargeRate, _rate);
        depegSurchargeRate = _rate;
    }

    function setFeeRecipient(address _recipient) external onlyRole(GOVERNOR_ROLE) {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
    }

    function setEpochRedemptionCap(uint256 _cap) external onlyRole(GOVERNOR_ROLE) {
        emit LimitUpdated("epochRedemptionCap", epochRedemptionCap, _cap);
        epochRedemptionCap = _cap;
    }

    function setMinRedemption(uint256 _min) external onlyRole(GOVERNOR_ROLE) {
        emit LimitUpdated("minRedemption", minRedemption, _min);
        minRedemption = _min;
    }

    function setMaxInstantRedemption(uint256 _max) external onlyRole(GOVERNOR_ROLE) {
        emit LimitUpdated("maxInstantRedemption", maxInstantRedemption, _max);
        maxInstantRedemption = _max;
    }

    function setTreasuryVault(address _vault) external onlyRole(GOVERNOR_ROLE) {
        if (_vault == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasuryVault, _vault);
        treasuryVault = _vault;
    }

    function setPriceOracle(address _oracle) external onlyRole(GOVERNOR_ROLE) {
        priceOracle = _oracle;
    }

    function setTargetPrice(uint256 _price) external onlyRole(GOVERNOR_ROLE) {
        targetPrice = _price;
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
     * @notice Get queue length
     */
    function getQueueLength() external view returns (uint256) {
        return redemptionQueue.length;
    }

    /**
     * @notice Get pending queue length (unprocessed)
     */
    function getPendingQueueLength() external view returns (uint256) {
        uint256 pending = 0;
        for (uint256 i = queueHead; i < redemptionQueue.length; i++) {
            if (!redemptionQueue[i].processed && !redemptionQueue[i].cancelled) {
                pending++;
            }
        }
        return pending;
    }

    /**
     * @notice Get redemption request details
     */
    function getRequest(uint256 requestId) external view returns (RedemptionRequest memory) {
        return redemptionQueue[requestId];
    }

    /**
     * @notice Get full status
     */
    function getStatus() external view returns (
        uint256 _epochRedemptionCap,
        uint256 _currentEpochRedeemed,
        uint256 _remainingCapacity,
        uint256 _queueLength,
        uint256 _pendingInQueue,
        bool _isPaused
    ) {
        return (
            epochRedemptionCap,
            currentEpochRedeemed,
            this.getRemainingEpochCapacity(),
            redemptionQueue.length,
            this.getPendingQueueLength(),
            paused()
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface IBurnable {
    function burn(uint256 amount) external;
}

interface IPriceOracle {
    function getPrice() external view returns (uint256);
}
