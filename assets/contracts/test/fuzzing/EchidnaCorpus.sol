// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EchidnaCorpus
 * @notice Seed corpus for guided fuzzing
 * @dev Provides interesting initial transactions for Echidna
 */
contract EchidnaCorpus {
    // ═══════════════════════════════════════════════════════════════════════════════
    // INTERESTING VALUES FOR FUZZING
    // ═══════════════════════════════════════════════════════════════════════════════

    // Amount edge cases
    uint256 constant ZERO = 0;
    uint256 constant ONE = 1;
    uint256 constant MAX_UINT = type(uint256).max;
    uint256 constant MAX_UINT_MINUS_ONE = type(uint256).max - 1;

    // USDC amounts (6 decimals)
    uint256 constant ONE_USDC = 1e6;
    uint256 constant ONE_THOUSAND_USDC = 1_000e6;
    uint256 constant ONE_MILLION_USDC = 1_000_000e6;
    uint256 constant ONE_BILLION_USDC = 1_000_000_000e6;

    // Time values
    uint256 constant ONE_SECOND = 1;
    uint256 constant ONE_MINUTE = 60;
    uint256 constant ONE_HOUR = 3600;
    uint256 constant ONE_DAY = 86400;
    uint256 constant ONE_WEEK = 604800;
    uint256 constant ONE_YEAR = 31536000;

    // Epoch boundaries
    uint256 constant EPOCH_DURATION = 1 days;
    uint256 constant EPOCH_BOUNDARY = EPOCH_DURATION - 1;

    // Rate limit edges
    uint256 constant CAPACITY_MINUS_ONE = 100_000e6 - 1;
    uint256 constant CAPACITY_EXACT = 100_000e6;
    uint256 constant CAPACITY_PLUS_ONE = 100_000e6 + 1;

    // Interesting addresses
    address constant ZERO_ADDRESS = address(0);
    address constant ONE_ADDRESS = address(1);
    address constant DEAD_ADDRESS = address(0xdead);
    address constant MAX_ADDRESS = address(type(uint160).max);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED SEQUENCES
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Sequence: Mint up to capacity
     */
    function seed_mintToCapacity() external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](3);
        amounts[0] = 50_000e6;  // Half capacity
        amounts[1] = 30_000e6;  // Another chunk
        amounts[2] = 20_000e6;  // Exactly at capacity
    }

    /**
     * @notice Sequence: Exceed capacity
     */
    function seed_exceedCapacity() external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = 100_000e6; // Full capacity
        amounts[1] = 1;         // Should fail
    }

    /**
     * @notice Sequence: Drain backing
     */
    function seed_drainBacking() external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](5);
        amounts[0] = 200_000e6;
        amounts[1] = 200_000e6;
        amounts[2] = 200_000e6;
        amounts[3] = 200_000e6;
        amounts[4] = 200_001e6; // Should fail - exceeds 1M backing
    }

    /**
     * @notice Sequence: Oracle staleness
     */
    function seed_oracleStaleness() external pure returns (uint256[] memory timeDeltas) {
        timeDeltas = new uint256[](3);
        timeDeltas[0] = 3599;  // Just under threshold
        timeDeltas[1] = 3600;  // Exactly at threshold
        timeDeltas[2] = 3601;  // Just over threshold
    }

    /**
     * @notice Sequence: Emergency levels
     */
    function seed_emergencyLevels() external pure returns (uint8[] memory levels) {
        levels = new uint8[](5);
        levels[0] = 0; // NORMAL
        levels[1] = 1; // ELEVATED
        levels[2] = 2; // RESTRICTED
        levels[3] = 3; // EMERGENCY
        levels[4] = 4; // SHUTDOWN
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ATTACK PATTERNS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Pattern: Sandwich attack on backing
     */
    function seed_sandwichBacking() external pure returns (
        uint256 mintBefore,
        uint256 backingDrop,
        uint256 mintAfter
    ) {
        mintBefore = 500_000e6;  // Mint half backing
        backingDrop = 400_000e6; // Drop backing significantly
        mintAfter = 100_000e6;   // Try to mint more
    }

    /**
     * @notice Pattern: Flash loan simulation
     */
    function seed_flashLoanPattern() external pure returns (
        uint256[] memory actions
    ) {
        actions = new uint256[](4);
        actions[0] = 1_000_000e6; // "Borrow" 1M
        actions[1] = 1_000_000e6; // Mint 1M tokens
        actions[2] = 1_000_000e6; // Burn 1M tokens
        actions[3] = 1_000_000e6; // "Repay" 1M
    }

    /**
     * @notice Pattern: Epoch boundary attack
     */
    function seed_epochBoundary() external pure returns (
        uint256 mintAmount,
        uint256 timeToWait,
        uint256 mintAfterEpoch
    ) {
        mintAmount = 100_000e6;     // Max out current epoch
        timeToWait = EPOCH_DURATION; // Wait for new epoch
        mintAfterEpoch = 100_000e6; // Mint again in new epoch
    }
}
