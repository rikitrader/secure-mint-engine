// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockChainlinkAggregator
 * @notice Mock Chainlink price feed for testing
 * @dev Implements minimal AggregatorV3Interface
 */
contract MockChainlinkAggregator {
    uint8 private _decimals;
    int256 private _latestAnswer;
    uint256 private _updatedAt;
    uint80 private _roundId;

    constructor(uint8 decimals_) {
        _decimals = decimals_;
        _latestAnswer = 1e8; // $1.00 default
        _updatedAt = block.timestamp;
        _roundId = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SETTERS (for testing)
    // ═══════════════════════════════════════════════════════════════════════════

    function setLatestAnswer(int256 answer) external {
        _latestAnswer = answer;
        _roundId++;
    }

    function setUpdatedAt(uint256 timestamp) external {
        _updatedAt = timestamp;
    }

    function setDecimals(uint8 decimals_) external {
        _decimals = decimals_;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AggregatorV3Interface
    // ═══════════════════════════════════════════════════════════════════════════

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external pure returns (string memory) {
        return "Mock Chainlink Aggregator";
    }

    function version() external pure returns (uint256) {
        return 4;
    }

    function getRoundData(uint80 roundId_)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (roundId_, _latestAnswer, _updatedAt, _updatedAt, roundId_);
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _latestAnswer, _updatedAt, _updatedAt, _roundId);
    }
}
