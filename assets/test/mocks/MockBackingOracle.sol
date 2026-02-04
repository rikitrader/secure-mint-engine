// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockBackingOracle
 * @notice Mock oracle for testing SecureMintPolicy
 * @dev Allows manual control of all oracle parameters for testing edge cases
 */
contract MockBackingOracle {
    bool public healthy = true;
    uint256 public verifiedBacking;
    uint256 public lastUpdateTimestamp;
    bool public canMintResult = true;
    bool public depegged = false;
    uint256 public depegSurchargeRate = 0;

    constructor() {
        lastUpdateTimestamp = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SETTERS (for testing)
    // ═══════════════════════════════════════════════════════════════════════════

    function setHealthy(bool _healthy) external {
        healthy = _healthy;
    }

    function setVerifiedBacking(uint256 _backing) external {
        verifiedBacking = _backing;
    }

    function setCanMint(bool _canMint) external {
        canMintResult = _canMint;
    }

    function setLastUpdate(uint256 _timestamp) external {
        lastUpdateTimestamp = _timestamp;
    }

    function updateTimestamp() external {
        lastUpdateTimestamp = block.timestamp;
    }

    function setDepegged(bool _depegged) external {
        depegged = _depegged;
    }

    function setDepegSurchargeRate(uint256 _rate) external {
        depegSurchargeRate = _rate;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IBackingOracle INTERFACE
    // ═══════════════════════════════════════════════════════════════════════════

    function getVerifiedBacking() external view returns (uint256) {
        return verifiedBacking;
    }

    function isHealthy() external view returns (bool) {
        return healthy;
    }

    function lastUpdate() external view returns (uint256) {
        return lastUpdateTimestamp;
    }

    function getDataAge() external view returns (uint256) {
        return block.timestamp - lastUpdateTimestamp;
    }

    function getRequiredBacking(uint256 supply) external pure returns (uint256) {
        // 1:1 backing by default (assuming 18 decimal token, 6 decimal reserve)
        return supply / 1e12;
    }

    function canMint(uint256 currentSupply, uint256 mintAmount) external view returns (bool) {
        if (!healthy) return false;
        if (!canMintResult) return false;

        // Check if backing covers supply + mint
        uint256 newSupply = currentSupply + mintAmount;
        uint256 requiredBacking = newSupply / 1e12; // 18 -> 6 decimals

        return verifiedBacking >= requiredBacking;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADDITIONAL ORACLE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function isDepegged() external view returns (bool) {
        return depegged;
    }

    function getDepegSurchargeRate() external view returns (uint256) {
        return depegSurchargeRate;
    }

    function getPrice() external pure returns (uint256) {
        return 1e8; // $1.00 with 8 decimals
    }
}
