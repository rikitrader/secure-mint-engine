// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SecureMintBridge
 * @author SecureMint Team
 * @notice Cross-chain bridge for SecureMint tokens
 * @dev Implements lock-and-mint / burn-and-unlock pattern with validator consensus
 *
 * Architecture:
 * - Source Chain: Lock tokens → emit event → validators sign
 * - Destination Chain: Verify signatures → mint wrapped tokens
 *
 * Security:
 * - Multi-sig validation (M of N validators)
 * - Nonce tracking prevents replay attacks
 * - Rate limiting prevents rapid outflows
 * - Emergency pause capability
 */
contract SecureMintBridge is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════════

    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice The SecureMint token on this chain
    IERC20 public immutable token;

    /// @notice Chain ID of this chain
    uint256 public immutable chainId;

    /// @notice Whether this is the canonical chain (tokens locked) or L2 (tokens minted)
    bool public immutable isCanonicalChain;

    /// @notice Minimum number of validator signatures required
    uint256 public validatorThreshold;

    /// @notice Total number of validators
    uint256 public validatorCount;

    /// @notice Mapping of validator addresses
    mapping(address => bool) public isValidator;

    /// @notice Mapping of supported destination chains
    mapping(uint256 => bool) public supportedChains;

    /// @notice Nonce for outbound transfers (prevents replay)
    uint256 public outboundNonce;

    /// @notice Processed inbound transfer nonces (chainId => nonce => processed)
    mapping(uint256 => mapping(uint256 => bool)) public processedNonces;

    /// @notice Daily transfer limits per chain
    mapping(uint256 => uint256) public dailyLimits;

    /// @notice Daily transfer amounts (chainId => day => amount)
    mapping(uint256 => mapping(uint256 => uint256)) public dailyAmounts;

    /// @notice Minimum transfer amount
    uint256 public minTransferAmount;

    /// @notice Maximum transfer amount per transaction
    uint256 public maxTransferAmount;

    /// @notice Bridge fee in basis points (100 = 1%)
    uint256 public bridgeFee;

    /// @notice Fee recipient
    address public feeRecipient;

    /// @notice Pending transfers awaiting execution
    mapping(bytes32 => PendingTransfer) public pendingTransfers;

    // ═══════════════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════════════

    struct PendingTransfer {
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChain;
        uint256 destChain;
        uint256 nonce;
        uint256 timestamp;
        bool executed;
        uint256 signatureCount;
        mapping(address => bool) hasValidated;
    }

    struct TransferMessage {
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChain;
        uint256 destChain;
        uint256 nonce;
        uint256 deadline;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChain,
        uint256 destChain,
        uint256 nonce
    );

    event TransferValidated(
        bytes32 indexed transferId,
        address indexed validator,
        uint256 signatureCount
    );

    event TransferExecuted(
        bytes32 indexed transferId,
        address indexed recipient,
        uint256 amount
    );

    event TransferCancelled(
        bytes32 indexed transferId,
        string reason
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ChainSupported(uint256 indexed chainId, bool supported);
    event LimitUpdated(uint256 indexed chainId, uint256 newLimit);

    // ═══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    error UnsupportedChain(uint256 chainId);
    error InvalidAmount(uint256 amount);
    error DailyLimitExceeded(uint256 requested, uint256 remaining);
    error AlreadyProcessed(uint256 nonce);
    error InvalidSignature();
    error InsufficientSignatures(uint256 have, uint256 need);
    error TransferExpired();
    error AlreadyValidated();
    error TransferNotFound();
    error CannotBridgeToSameChain();

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    constructor(
        address _token,
        bool _isCanonicalChain,
        uint256 _validatorThreshold,
        address _feeRecipient
    ) {
        token = IERC20(_token);
        chainId = block.chainid;
        isCanonicalChain = _isCanonicalChain;
        validatorThreshold = _validatorThreshold;
        feeRecipient = _feeRecipient;

        minTransferAmount = 100e6; // 100 USDC minimum
        maxTransferAmount = 1_000_000e6; // 1M USDC maximum
        bridgeFee = 10; // 0.1%

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // BRIDGE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initiate a cross-chain transfer
     * @param recipient Recipient address on destination chain
     * @param amount Amount to transfer
     * @param destChain Destination chain ID
     * @return transferId Unique transfer identifier
     */
    function initiateTransfer(
        address recipient,
        uint256 amount,
        uint256 destChain
    ) external nonReentrant whenNotPaused returns (bytes32 transferId) {
        // Validations
        if (destChain == chainId) revert CannotBridgeToSameChain();
        if (!supportedChains[destChain]) revert UnsupportedChain(destChain);
        if (amount < minTransferAmount || amount > maxTransferAmount) {
            revert InvalidAmount(amount);
        }

        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        uint256 remaining = dailyLimits[destChain] - dailyAmounts[destChain][today];
        if (amount > remaining) revert DailyLimitExceeded(amount, remaining);

        // Update daily amount
        dailyAmounts[destChain][today] += amount;

        // Calculate fee
        uint256 fee = (amount * bridgeFee) / 10000;
        uint256 netAmount = amount - fee;

        // Lock or burn tokens
        if (isCanonicalChain) {
            // Lock tokens on canonical chain
            token.safeTransferFrom(msg.sender, address(this), amount);
        } else {
            // Burn tokens on L2
            // Assumes token has burn function accessible to bridge
            token.safeTransferFrom(msg.sender, address(this), amount);
            // ISecureMintToken(address(token)).burn(address(this), amount);
        }

        // Transfer fee
        if (fee > 0) {
            token.safeTransfer(feeRecipient, fee);
        }

        // Generate transfer ID
        uint256 nonce = ++outboundNonce;
        transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                netAmount,
                chainId,
                destChain,
                nonce
            )
        );

        // Store pending transfer
        PendingTransfer storage pt = pendingTransfers[transferId];
        pt.sender = msg.sender;
        pt.recipient = recipient;
        pt.amount = netAmount;
        pt.sourceChain = chainId;
        pt.destChain = destChain;
        pt.nonce = nonce;
        pt.timestamp = block.timestamp;

        emit TransferInitiated(
            transferId,
            msg.sender,
            recipient,
            netAmount,
            chainId,
            destChain,
            nonce
        );
    }

    /**
     * @notice Validate an incoming transfer (validator only)
     * @param transferId Transfer identifier
     * @param message Original transfer message
     * @param signature Validator signature
     */
    function validateTransfer(
        bytes32 transferId,
        TransferMessage calldata message,
        bytes calldata signature
    ) external onlyRole(VALIDATOR_ROLE) whenNotPaused {
        // Verify transfer ID matches message
        bytes32 computedId = keccak256(
            abi.encodePacked(
                message.sender,
                message.recipient,
                message.amount,
                message.sourceChain,
                message.destChain,
                message.nonce
            )
        );
        if (computedId != transferId) revert TransferNotFound();

        // Verify destination is this chain
        if (message.destChain != chainId) revert UnsupportedChain(message.destChain);

        // Check deadline
        if (block.timestamp > message.deadline) revert TransferExpired();

        // Check not already processed
        if (processedNonces[message.sourceChain][message.nonce]) {
            revert AlreadyProcessed(message.nonce);
        }

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                transferId
            )
        );
        address signer = ECDSA.recover(messageHash, signature);
        if (!isValidator[signer]) revert InvalidSignature();

        // Get or create pending transfer
        PendingTransfer storage pt = pendingTransfers[transferId];
        if (pt.timestamp == 0) {
            pt.sender = message.sender;
            pt.recipient = message.recipient;
            pt.amount = message.amount;
            pt.sourceChain = message.sourceChain;
            pt.destChain = message.destChain;
            pt.nonce = message.nonce;
            pt.timestamp = block.timestamp;
        }

        // Check validator hasn't already validated
        if (pt.hasValidated[msg.sender]) revert AlreadyValidated();
        pt.hasValidated[msg.sender] = true;
        pt.signatureCount++;

        emit TransferValidated(transferId, msg.sender, pt.signatureCount);

        // Execute if threshold reached
        if (pt.signatureCount >= validatorThreshold && !pt.executed) {
            _executeTransfer(transferId, pt);
        }
    }

    /**
     * @notice Execute a validated transfer
     * @param transferId Transfer identifier
     */
    function executeTransfer(bytes32 transferId) external nonReentrant whenNotPaused {
        PendingTransfer storage pt = pendingTransfers[transferId];

        if (pt.timestamp == 0) revert TransferNotFound();
        if (pt.executed) revert AlreadyProcessed(pt.nonce);
        if (pt.signatureCount < validatorThreshold) {
            revert InsufficientSignatures(pt.signatureCount, validatorThreshold);
        }

        _executeTransfer(transferId, pt);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function addValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isValidator[validator], "Already validator");
        isValidator[validator] = true;
        validatorCount++;
        _grantRole(VALIDATOR_ROLE, validator);
        emit ValidatorAdded(validator);
    }

    function removeValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isValidator[validator], "Not validator");
        require(validatorCount > validatorThreshold, "Would break threshold");
        isValidator[validator] = false;
        validatorCount--;
        _revokeRole(VALIDATOR_ROLE, validator);
        emit ValidatorRemoved(validator);
    }

    function setThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newThreshold > 0 && newThreshold <= validatorCount, "Invalid threshold");
        emit ThresholdUpdated(validatorThreshold, newThreshold);
        validatorThreshold = newThreshold;
    }

    function setSupportedChain(uint256 _chainId, bool supported) external onlyRole(OPERATOR_ROLE) {
        supportedChains[_chainId] = supported;
        emit ChainSupported(_chainId, supported);
    }

    function setDailyLimit(uint256 _chainId, uint256 limit) external onlyRole(OPERATOR_ROLE) {
        dailyLimits[_chainId] = limit;
        emit LimitUpdated(_chainId, limit);
    }

    function setTransferLimits(uint256 _min, uint256 _max) external onlyRole(OPERATOR_ROLE) {
        minTransferAmount = _min;
        maxTransferAmount = _max;
    }

    function setBridgeFee(uint256 _fee) external onlyRole(OPERATOR_ROLE) {
        require(_fee <= 100, "Fee too high"); // Max 1%
        bridgeFee = _fee;
    }

    function setFeeRecipient(address _recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "Invalid recipient");
        feeRecipient = _recipient;
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function getRemainingDailyLimit(uint256 _chainId) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        uint256 used = dailyAmounts[_chainId][today];
        uint256 limit = dailyLimits[_chainId];
        return used >= limit ? 0 : limit - used;
    }

    function getTransferStatus(bytes32 transferId) external view returns (
        bool exists,
        bool executed,
        uint256 signatureCount,
        uint256 threshold
    ) {
        PendingTransfer storage pt = pendingTransfers[transferId];
        return (
            pt.timestamp > 0,
            pt.executed,
            pt.signatureCount,
            validatorThreshold
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function _executeTransfer(bytes32 transferId, PendingTransfer storage pt) internal {
        pt.executed = true;
        processedNonces[pt.sourceChain][pt.nonce] = true;

        if (isCanonicalChain) {
            // Unlock tokens on canonical chain
            token.safeTransfer(pt.recipient, pt.amount);
        } else {
            // Mint tokens on L2
            // ISecureMintToken(address(token)).mint(pt.recipient, pt.amount);
            token.safeTransfer(pt.recipient, pt.amount);
        }

        emit TransferExecuted(transferId, pt.recipient, pt.amount);
    }
}
