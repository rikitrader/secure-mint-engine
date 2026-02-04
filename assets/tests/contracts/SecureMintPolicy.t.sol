// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/src/SecureMintPolicy.sol";
import "../../contracts/src/SecureMintToken.sol";
import "../../contracts/src/BackingOracle.sol";
import "../../contracts/src/EmergencyPause.sol";

/**
 * @title SecureMintPolicy Unit Tests
 * @notice Comprehensive tests for the SecureMintPolicy contract
 */
contract SecureMintPolicyTest is Test {
    SecureMintPolicy public policy;
    SecureMintToken public token;
    BackingOracle public oracle;
    EmergencyPause public emergencyPause;

    address public admin = address(1);
    address public operator = address(2);
    address public user = address(3);
    address public treasury = address(4);

    uint256 public constant EPOCH_CAPACITY = 1_000_000 * 1e6; // 1M tokens
    uint256 public constant EPOCH_DURATION = 1 hours;
    uint256 public constant INITIAL_BACKING = 10_000_000 * 1e6; // 10M backing

    event Minted(address indexed recipient, uint256 amount, uint256 newTotalSupply);
    event EpochReset(uint256 newEpoch, uint256 capacity);
    event CapacityUpdated(uint256 oldCapacity, uint256 newCapacity);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy contracts
        token = new SecureMintToken("SecureMint USD", "smUSD");
        oracle = new BackingOracle(address(0), 3600);
        emergencyPause = new EmergencyPause();

        // Deploy policy
        policy = new SecureMintPolicy(
            address(token),
            address(oracle),
            treasury,
            address(emergencyPause),
            EPOCH_CAPACITY,
            EPOCH_DURATION
        );

        // Configure permissions
        token.grantRole(token.MINTER_ROLE(), address(policy));
        oracle.grantRole(oracle.OPERATOR_ROLE(), operator);
        policy.grantRole(policy.OPERATOR_ROLE(), operator);

        // Set initial backing
        vm.stopPrank();
        vm.prank(operator);
        oracle.updateBacking(INITIAL_BACKING);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialization() public {
        assertEq(address(policy.token()), address(token));
        assertEq(address(policy.oracle()), address(oracle));
        assertEq(policy.epochCapacity(), EPOCH_CAPACITY);
        assertEq(policy.epochDuration(), EPOCH_DURATION);
    }

    function test_revertOnZeroAddresses() public {
        vm.expectRevert("Invalid token address");
        new SecureMintPolicy(
            address(0),
            address(oracle),
            treasury,
            address(emergencyPause),
            EPOCH_CAPACITY,
            EPOCH_DURATION
        );

        vm.expectRevert("Invalid oracle address");
        new SecureMintPolicy(
            address(token),
            address(0),
            treasury,
            address(emergencyPause),
            EPOCH_CAPACITY,
            EPOCH_DURATION
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MINT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint() public {
        uint256 amount = 100_000 * 1e6; // 100K tokens

        vm.prank(operator);
        policy.mint(user, amount);

        assertEq(token.balanceOf(user), amount);
        assertEq(token.totalSupply(), amount);
        assertEq(policy.epochMintedAmount(), amount);
    }

    function test_mintEmitsEvent() public {
        uint256 amount = 100_000 * 1e6;

        vm.expectEmit(true, false, false, true);
        emit Minted(user, amount, amount);

        vm.prank(operator);
        policy.mint(user, amount);
    }

    function test_mintUpToCapacity() public {
        vm.startPrank(operator);

        // Mint exactly to capacity
        policy.mint(user, EPOCH_CAPACITY);

        assertEq(policy.epochMintedAmount(), EPOCH_CAPACITY);
        vm.stopPrank();
    }

    function test_revertMintExceedsCapacity() public {
        vm.prank(operator);
        vm.expectRevert("Exceeds epoch capacity");
        policy.mint(user, EPOCH_CAPACITY + 1);
    }

    function test_revertMintExceedsBacking() public {
        // Update backing to be less than requested mint
        vm.prank(operator);
        oracle.updateBacking(50_000 * 1e6); // 50K backing

        vm.prank(operator);
        vm.expectRevert("Insufficient backing");
        policy.mint(user, 100_000 * 1e6); // Try to mint 100K
    }

    function test_revertMintWhenPaused() public {
        vm.prank(admin);
        emergencyPause.setLevel(2); // High alert

        vm.prank(operator);
        vm.expectRevert("Minting paused");
        policy.mint(user, 100_000 * 1e6);
    }

    function test_revertMintToZeroAddress() public {
        vm.prank(operator);
        vm.expectRevert("Invalid recipient");
        policy.mint(address(0), 100_000 * 1e6);
    }

    function test_revertMintZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert("Amount must be positive");
        policy.mint(user, 0);
    }

    function test_mintOnlyOperator() public {
        vm.prank(user);
        vm.expectRevert();
        policy.mint(user, 100_000 * 1e6);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EPOCH TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_epochReset() public {
        // Mint some tokens
        vm.prank(operator);
        policy.mint(user, 500_000 * 1e6);

        // Fast forward past epoch
        vm.warp(block.timestamp + EPOCH_DURATION + 1);

        // Mint again should reset epoch
        vm.prank(operator);
        policy.mint(user, 100_000 * 1e6);

        // Epoch minted should be just the new amount
        assertEq(policy.epochMintedAmount(), 100_000 * 1e6);
    }

    function test_epochResetEmitsEvent() public {
        vm.prank(operator);
        policy.mint(user, 500_000 * 1e6);

        vm.warp(block.timestamp + EPOCH_DURATION + 1);

        vm.expectEmit(false, false, false, true);
        emit EpochReset(policy.currentEpoch() + 1, EPOCH_CAPACITY);

        vm.prank(operator);
        policy.mint(user, 100_000 * 1e6);
    }

    function test_multipleEpochsAccumulate() public {
        vm.startPrank(operator);

        // Epoch 1: Mint 500K
        policy.mint(user, 500_000 * 1e6);
        assertEq(token.totalSupply(), 500_000 * 1e6);

        // Epoch 2: Mint another 500K
        vm.warp(block.timestamp + EPOCH_DURATION + 1);
        policy.mint(user, 500_000 * 1e6);
        assertEq(token.totalSupply(), 1_000_000 * 1e6);

        // Epoch 3: Mint another 500K
        vm.warp(block.timestamp + EPOCH_DURATION + 1);
        policy.mint(user, 500_000 * 1e6);
        assertEq(token.totalSupply(), 1_500_000 * 1e6);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_invariant_totalSupplyNeverExceedsBacking() public {
        // This is a critical invariant
        vm.startPrank(operator);

        // Mint to capacity
        policy.mint(user, EPOCH_CAPACITY);

        // Verify invariant
        uint256 totalSupply = token.totalSupply();
        uint256 backing = oracle.getLatestBacking();

        assertTrue(totalSupply <= backing, "INV-SM-1 violated: totalSupply > backing");
        vm.stopPrank();
    }

    function test_invariant_epochMintedNeverExceedsCapacity() public {
        vm.startPrank(operator);

        // Try multiple mints within epoch
        policy.mint(user, 300_000 * 1e6);
        policy.mint(user, 300_000 * 1e6);
        policy.mint(user, 300_000 * 1e6);

        // Verify invariant
        assertTrue(
            policy.epochMintedAmount() <= policy.epochCapacity(),
            "INV-SM-2 violated: epochMinted > epochCapacity"
        );

        // This should fail
        vm.expectRevert("Exceeds epoch capacity");
        policy.mint(user, 200_000 * 1e6);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_updateCapacity() public {
        uint256 newCapacity = 2_000_000 * 1e6;

        vm.expectEmit(false, false, false, true);
        emit CapacityUpdated(EPOCH_CAPACITY, newCapacity);

        vm.prank(admin);
        policy.setEpochCapacity(newCapacity);

        assertEq(policy.epochCapacity(), newCapacity);
    }

    function test_revertUpdateCapacityNotAdmin() public {
        vm.prank(operator);
        vm.expectRevert();
        policy.setEpochCapacity(2_000_000 * 1e6);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_mintAmount(uint256 amount) public {
        // Bound to valid range
        amount = bound(amount, 1, EPOCH_CAPACITY);

        // Ensure backing is sufficient
        vm.prank(operator);
        oracle.updateBacking(amount * 2);

        vm.prank(operator);
        policy.mint(user, amount);

        assertEq(token.balanceOf(user), amount);
        assertTrue(token.totalSupply() <= oracle.getLatestBacking());
    }

    function testFuzz_multipleMints(uint256[] memory amounts) public {
        vm.assume(amounts.length > 0 && amounts.length <= 10);

        uint256 totalMinted = 0;

        vm.startPrank(operator);
        oracle.updateBacking(INITIAL_BACKING);

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = bound(amounts[i], 1, 100_000 * 1e6);

            // Check if we can mint
            if (totalMinted + amount <= EPOCH_CAPACITY && totalMinted + amount <= INITIAL_BACKING) {
                policy.mint(user, amount);
                totalMinted += amount;
            }
        }

        assertEq(token.totalSupply(), totalMinted);
        assertTrue(totalMinted <= INITIAL_BACKING);

        vm.stopPrank();
    }
}
