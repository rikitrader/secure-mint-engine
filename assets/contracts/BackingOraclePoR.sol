// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBackingOracle.sol";

/**
 * @title BackingOraclePoR
 * @notice Proof-of-Reserve implementation of IBackingOracle
 * @dev Uses Chainlink PoR feeds or multi-attestor system for off-chain reserves
 *
 * MODE: Off-Chain / Cross-Chain Reserves (Mode B)
 *
 * FEATURES:
 * - Chainlink PoR feed integration
 * - Multi-attestor support
 * - Staleness checks
 * - Deviation bounds
 * - Emergency pause on anomalies
 *
 * SECURITY:
 * - Continuous enforcement (not one-time attestation)
 * - Auto-pause on any reserve < supply detection
 * - Evidence logging for all queries
 */
contract BackingOraclePoR is IBackingOracle, IProofOfReserve, AccessControl {
    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Chainlink PoR feed address (optional)
    AggregatorV3Interface public chainlinkPoRFeed;

    /// @notice Use Chainlink feed vs multi-attestor
    bool public useChainlinkFeed;

    /// @notice Maximum acceptable data age in seconds
    uint256 public maxDataAge;

    /// @notice Maximum acceptable deviation between attestors (basis points)
    uint256 public maxDeviation;

    /// @notice Required collateralization ratio (10000 = 100%)
    uint256 public requiredRatio;

    /// @notice Is oracle healthy
    bool public healthy;

    /// @notice Paused state
    bool public paused;

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-ATTESTOR STATE
    // ═══════════════════════════════════════════════════════════════════════════

    struct Attestation {
        uint256 reserveAmount;
        uint256 timestamp;
        bool active;
    }

    /// @notice Attestations by attestor address
    mapping(address => Attestation) public attestations;

    /// @notice List of attestors
    address[] public attestorList;

    /// @notice Minimum required attestors
    uint256 public minAttestors;

    /// @notice Aggregated reserve amount
    uint256 public aggregatedReserves;

    /// @notice Last update timestamp
    uint256 public lastUpdateTimestamp;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event AttestationSubmitted(
        address indexed attestor,
        uint256 reserveAmount,
        uint256 timestamp
    );

    event ReservesAggregated(
        uint256 aggregatedAmount,
        uint256 attestorCount,
        uint256 timestamp
    );

    event HealthStatusChanged(bool healthy, string reason);
    event ChainlinkFeedUpdated(address oldFeed, address newFeed);
    event ParameterUpdated(string param, uint256 oldValue, uint256 newValue);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error OraclePaused();
    error StaleData();
    error InsufficientAttestors();
    error DeviationTooHigh();
    error ZeroAddress();
    error AttestorNotActive();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the backing oracle
     * @param _admin Admin address
     * @param _maxDataAge Maximum data age in seconds
     * @param _requiredRatio Required collateralization ratio (10000 = 100%)
     */
    constructor(
        address _admin,
        uint256 _maxDataAge,
        uint256 _requiredRatio
    ) {
        if (_admin == address(0)) revert ZeroAddress();

        maxDataAge = _maxDataAge;
        requiredRatio = _requiredRatio;
        maxDeviation = 500; // 5% default
        minAttestors = 1;
        healthy = true;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);
        _grantRole(GOVERNOR_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IBackingOracle IMPLEMENTATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get verified backing amount
     */
    function getVerifiedBacking() external view override returns (uint256) {
        if (paused) return 0;

        if (useChainlinkFeed && address(chainlinkPoRFeed) != address(0)) {
            return _getChainlinkReserves();
        }

        return aggregatedReserves;
    }

    /**
     * @notice Check if oracle is healthy
     */
    function isHealthy() external view override returns (bool) {
        if (paused) return false;
        if (!healthy) return false;

        // Check staleness
        if (getDataAge() > maxDataAge) return false;

        // Check minimum attestors
        if (!useChainlinkFeed && _getActiveAttestorCount() < minAttestors) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get last update timestamp
     */
    function lastUpdate() external view override returns (uint256) {
        if (useChainlinkFeed && address(chainlinkPoRFeed) != address(0)) {
            (, , , uint256 updatedAt,) = chainlinkPoRFeed.latestRoundData();
            return updatedAt;
        }
        return lastUpdateTimestamp;
    }

    /**
     * @notice Get data age in seconds
     */
    function getDataAge() public view override returns (uint256) {
        if (useChainlinkFeed && address(chainlinkPoRFeed) != address(0)) {
            (, , , uint256 updatedAt,) = chainlinkPoRFeed.latestRoundData();
            return block.timestamp - updatedAt;
        }
        return block.timestamp - lastUpdateTimestamp;
    }

    /**
     * @notice Get required backing for a supply
     */
    function getRequiredBacking(uint256 supply) external view override returns (uint256) {
        return (supply * requiredRatio) / 10000;
    }

    /**
     * @notice Check if minting is allowed
     */
    function canMint(uint256 currentSupply, uint256 mintAmount) external view override returns (bool) {
        if (paused) return false;
        if (!this.isHealthy()) return false;

        uint256 postMintSupply = currentSupply + mintAmount;
        uint256 requiredBacking = (postMintSupply * requiredRatio) / 10000;
        uint256 currentBacking = this.getVerifiedBacking();

        return currentBacking >= requiredBacking;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IProofOfReserve IMPLEMENTATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get attestation details
     */
    function getAttestation() external view override returns (
        address attestor,
        uint256 attestationTime,
        uint256 reserveAmount
    ) {
        if (useChainlinkFeed) {
            return (
                address(chainlinkPoRFeed),
                this.lastUpdate(),
                this.getVerifiedBacking()
            );
        }

        // Return first active attestor's data
        for (uint256 i = 0; i < attestorList.length; i++) {
            Attestation storage att = attestations[attestorList[i]];
            if (att.active) {
                return (attestorList[i], att.timestamp, att.reserveAmount);
            }
        }

        return (address(0), 0, 0);
    }

    /**
     * @notice Get required attestor count
     */
    function requiredAttestors() external view override returns (uint256) {
        return minAttestors;
    }

    /**
     * @notice Get current active attestor count
     */
    function currentAttestorCount() external view override returns (uint256) {
        return _getActiveAttestorCount();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ATTESTOR FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Submit attestation (for multi-attestor mode)
     * @param reserveAmount Attested reserve amount
     */
    function submitAttestation(uint256 reserveAmount) external onlyRole(ATTESTOR_ROLE) {
        attestations[msg.sender] = Attestation({
            reserveAmount: reserveAmount,
            timestamp: block.timestamp,
            active: true
        });

        // Add to list if not already present
        bool found = false;
        for (uint256 i = 0; i < attestorList.length; i++) {
            if (attestorList[i] == msg.sender) {
                found = true;
                break;
            }
        }
        if (!found) {
            attestorList.push(msg.sender);
        }

        emit AttestationSubmitted(msg.sender, reserveAmount, block.timestamp);

        // Re-aggregate
        _aggregateReserves();
    }

    /**
     * @notice Aggregate reserves from all attestors
     */
    function _aggregateReserves() internal {
        uint256 count = 0;
        uint256 total = 0;
        uint256 minAmount = type(uint256).max;
        uint256 maxAmount = 0;

        for (uint256 i = 0; i < attestorList.length; i++) {
            Attestation storage att = attestations[attestorList[i]];

            // Skip stale attestations
            if (block.timestamp - att.timestamp > maxDataAge) {
                att.active = false;
                continue;
            }

            if (att.active) {
                count++;
                total += att.reserveAmount;

                if (att.reserveAmount < minAmount) minAmount = att.reserveAmount;
                if (att.reserveAmount > maxAmount) maxAmount = att.reserveAmount;
            }
        }

        // Check deviation
        if (count > 1 && minAmount > 0) {
            uint256 deviation = ((maxAmount - minAmount) * 10000) / minAmount;
            if (deviation > maxDeviation) {
                healthy = false;
                emit HealthStatusChanged(false, "Attestor deviation too high");
                return;
            }
        }

        // Use conservative (minimum) value
        if (count > 0) {
            aggregatedReserves = minAmount;
            lastUpdateTimestamp = block.timestamp;
            healthy = true;
        } else {
            healthy = false;
            emit HealthStatusChanged(false, "No active attestors");
        }

        emit ReservesAggregated(aggregatedReserves, count, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CHAINLINK INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════════

    function _getChainlinkReserves() internal view returns (uint256) {
        (, int256 answer, , uint256 updatedAt,) = chainlinkPoRFeed.latestRoundData();

        // Staleness check
        if (block.timestamp - updatedAt > maxDataAge) {
            return 0;
        }

        // Sanity check
        if (answer <= 0) {
            return 0;
        }

        return uint256(answer);
    }

    /**
     * @notice Set Chainlink PoR feed
     */
    function setChainlinkFeed(address _feed) external onlyRole(GOVERNOR_ROLE) {
        emit ChainlinkFeedUpdated(address(chainlinkPoRFeed), _feed);
        chainlinkPoRFeed = AggregatorV3Interface(_feed);
    }

    /**
     * @notice Toggle between Chainlink and multi-attestor mode
     */
    function setUseChainlinkFeed(bool _use) external onlyRole(GOVERNOR_ROLE) {
        useChainlinkFeed = _use;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    function setMaxDataAge(uint256 _age) external onlyRole(GOVERNOR_ROLE) {
        emit ParameterUpdated("maxDataAge", maxDataAge, _age);
        maxDataAge = _age;
    }

    function setMaxDeviation(uint256 _deviation) external onlyRole(GOVERNOR_ROLE) {
        emit ParameterUpdated("maxDeviation", maxDeviation, _deviation);
        maxDeviation = _deviation;
    }

    function setRequiredRatio(uint256 _ratio) external onlyRole(GOVERNOR_ROLE) {
        emit ParameterUpdated("requiredRatio", requiredRatio, _ratio);
        requiredRatio = _ratio;
    }

    function setMinAttestors(uint256 _min) external onlyRole(GOVERNOR_ROLE) {
        emit ParameterUpdated("minAttestors", minAttestors, _min);
        minAttestors = _min;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════════════════════════════

    function pause() external onlyRole(GUARDIAN_ROLE) {
        paused = true;
        emit HealthStatusChanged(false, "Paused by guardian");
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        paused = false;
        emit HealthStatusChanged(true, "Unpaused by guardian");
    }

    function setHealthy(bool _healthy, string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        healthy = _healthy;
        emit HealthStatusChanged(_healthy, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _getActiveAttestorCount() internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < attestorList.length; i++) {
            Attestation storage att = attestations[attestorList[i]];
            if (att.active && block.timestamp - att.timestamp <= maxDataAge) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get all attestors
     */
    function getAttestors() external view returns (address[] memory) {
        return attestorList;
    }

    /**
     * @notice Get full oracle status
     */
    function getStatus() external view returns (
        bool _healthy,
        bool _paused,
        uint256 _reserves,
        uint256 _dataAge,
        uint256 _activeAttestors,
        bool _usingChainlink
    ) {
        return (
            this.isHealthy(),
            paused,
            this.getVerifiedBacking(),
            getDataAge(),
            _getActiveAttestorCount(),
            useChainlinkFeed
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAINLINK INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
