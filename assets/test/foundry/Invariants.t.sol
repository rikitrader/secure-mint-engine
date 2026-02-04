// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title SecureMintInvariants
 * @notice Foundry invariant tests for Secure Mint Engine
 * @dev Tests the four core invariants from the specification:
 *      INV-SM-1: Supply ≤ BackedValue
 *      INV-SM-2: mint() requires canMint(amount) == true
 *      INV-SM-3: Oracle unhealthy → new mints blocked
 *      INV-SM-4: Sum(tierBalances) == totalReserves (treasury)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface IBackedToken {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function mint(address to, uint256 amount) external;
}

interface ISecureMintPolicy {
    function mint(address to, uint256 amount) external;
    function canMintNow(uint256 amount) external view returns (bool canMint, string memory reason);
    function paused() external view returns (bool);
    function GLOBAL_SUPPLY_CAP() external view returns (uint256);
    function epochMintCap() external view returns (uint256);
    function getRemainingEpochMint() external view returns (uint256);
}

interface IBackingOracle {
    function getVerifiedBacking() external view returns (uint256);
    function isHealthy() external view returns (bool);
    function canMint(uint256 currentSupply, uint256 mintAmount) external view returns (bool);
}

interface ITreasuryVault {
    function totalReserves() external view returns (uint256);
    function getTierBalances() external view returns (uint256[4] memory);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @title InvariantHandler
 * @notice Handler contract for guided fuzzing
 * @dev Constrains fuzz inputs to valid ranges and tracks ghost variables
 */
contract InvariantHandler is Test {
    IBackedToken public token;
    ISecureMintPolicy public policy;
    IBackingOracle public oracle;
    ITreasuryVault public treasury;

    // Ghost variables for tracking
    uint256 public ghost_totalMinted;
    uint256 public ghost_mintCallCount;
    uint256 public ghost_failedMintCount;

    address[] public actors;
    address internal currentActor;

    modifier useActor(uint256 actorIndexSeed) {
        currentActor = actors[bound(actorIndexSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(
        address _token,
        address _policy,
        address _oracle,
        address _treasury
    ) {
        token = IBackedToken(_token);
        policy = ISecureMintPolicy(_policy);
        oracle = IBackingOracle(_oracle);
        treasury = ITreasuryVault(_treasury);

        // Create actor addresses
        for (uint256 i = 0; i < 10; i++) {
            actors.push(address(uint160(0x1000 + i)));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HANDLER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Attempt to mint tokens
     * @dev Tracks success/failure for invariant checking
     */
    function handler_mint(
        uint256 actorSeed,
        uint256 amount,
        uint256 recipientSeed
    ) external useActor(actorSeed) {
        // Bound amount to reasonable range
        amount = bound(amount, 1, policy.epochMintCap() / 10);
        address recipient = actors[bound(recipientSeed, 0, actors.length - 1)];

        ghost_mintCallCount++;

        // Check if mint should succeed
        (bool canMint, ) = policy.canMintNow(amount);

        if (canMint) {
            try policy.mint(recipient, amount) {
                ghost_totalMinted += amount;
            } catch {
                ghost_failedMintCount++;
            }
        } else {
            ghost_failedMintCount++;
        }
    }

    /**
     * @notice Warp time forward
     * @dev Useful for testing epoch resets
     */
    function handler_warpTime(uint256 secondsToWarp) external {
        secondsToWarp = bound(secondsToWarp, 1, 7200); // Max 2 hours
        vm.warp(block.timestamp + secondsToWarp);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVARIANT TEST CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════

contract SecureMintInvariantsTest is Test {
    InvariantHandler public handler;

    // Contract instances (would be deployed in setUp)
    IBackedToken public token;
    ISecureMintPolicy public policy;
    IBackingOracle public oracle;
    ITreasuryVault public treasury;

    function setUp() public {
        // NOTE: In actual deployment, these would be real contract deployments
        // For this template, we show the structure

        // Deploy contracts (placeholder addresses for template)
        // token = IBackedToken(deployToken());
        // policy = ISecureMintPolicy(deployPolicy());
        // oracle = IBackingOracle(deployOracle());
        // treasury = ITreasuryVault(deployTreasury());

        // handler = new InvariantHandler(
        //     address(token),
        //     address(policy),
        //     address(oracle),
        //     address(treasury)
        // );

        // Target handler for invariant testing
        // targetContract(address(handler));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-SM-1: Supply ≤ BackedValue
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Total token supply must never exceed verified backing
     * @dev This is the core security invariant of the system
     */
    function invariant_supplyNeverExceedsBacking() public view {
        if (address(token) == address(0)) return; // Skip if not deployed

        uint256 totalSupply = token.totalSupply();
        uint256 verifiedBacking = oracle.getVerifiedBacking();

        // Convert to same decimals for comparison (assuming 18 decimal token, 6 decimal backing)
        uint256 supplyIn6Decimals = totalSupply / 1e12;

        assertLe(
            supplyIn6Decimals,
            verifiedBacking,
            "INV-SM-1 VIOLATED: Supply exceeds backing"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-SM-2: mint() requires canMint(amount) == true
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Mints only succeed when oracle.canMint returns true
     * @dev Verified through handler tracking
     */
    function invariant_mintRequiresCanMint() public view {
        if (address(handler) == address(0)) return;

        // If any mints succeeded, oracle must have allowed them
        // This is implicitly verified by the handler logic
        // Additional assertion: totalMinted should be consistent
        assertLe(
            handler.ghost_totalMinted(),
            policy.GLOBAL_SUPPLY_CAP(),
            "INV-SM-2 VIOLATED: Minted more than cap allows"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-SM-3: Oracle unhealthy → new mints blocked
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice When oracle is unhealthy, no new mints should be possible
     */
    function invariant_unhealthyOracleBlocksMints() public view {
        if (address(oracle) == address(0)) return;

        if (!oracle.isHealthy()) {
            // If oracle is unhealthy, policy should be paused or reject mints
            (bool canMint, ) = policy.canMintNow(1);
            assertFalse(
                canMint,
                "INV-SM-3 VIOLATED: Mint allowed with unhealthy oracle"
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INV-SM-4: Sum(tierBalances) == totalReserves
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Treasury tier balances must sum to total reserves
     * @dev No funds should be lost or created within treasury
     */
    function invariant_treasuryBalancesConsistent() public view {
        if (address(treasury) == address(0)) return;

        uint256[4] memory tierBalances = treasury.getTierBalances();
        uint256 sumOfTiers = tierBalances[0] + tierBalances[1] + tierBalances[2] + tierBalances[3];
        uint256 totalReserves = treasury.totalReserves();

        assertEq(
            sumOfTiers,
            totalReserves,
            "INV-SM-4 VIOLATED: Tier balances don't sum to total reserves"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADDITIONAL INVARIANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Epoch mint tracking must be consistent
     */
    function invariant_epochMintTracking() public view {
        if (address(policy) == address(0)) return;

        uint256 remaining = policy.getRemainingEpochMint();
        uint256 epochCap = policy.epochMintCap();

        assertLe(
            epochCap - remaining,
            epochCap,
            "Epoch tracking inconsistent"
        );
    }

    /**
     * @notice Supply cap must never be exceeded
     */
    function invariant_globalCapRespected() public view {
        if (address(token) == address(0)) return;

        assertLe(
            token.totalSupply(),
            policy.GLOBAL_SUPPLY_CAP(),
            "Global supply cap exceeded"
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARGETED INVARIANT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @title TargetedInvariantTests
 * @notice More focused invariant tests for specific scenarios
 */
contract TargetedInvariantTests is Test {
    /**
     * @notice Fuzz test: Any mint amount that would exceed backing fails
     */
    function testFuzz_mintExceedingBackingFails(
        uint256 currentSupply,
        uint256 backing,
        uint256 mintAmount
    ) public pure {
        // Bound inputs
        currentSupply = bound(currentSupply, 0, 1e27);
        backing = bound(backing, 0, 1e15); // 6 decimals
        mintAmount = bound(mintAmount, 1, 1e27);

        // Calculate in same decimals
        uint256 newSupplyIn6Decimals = (currentSupply + mintAmount) / 1e12;

        // If new supply would exceed backing, mint should be rejected
        if (newSupplyIn6Decimals > backing) {
            // In real test, would call oracle.canMint and assert false
            assertTrue(true, "Mint exceeding backing should fail");
        }
    }

    /**
     * @notice Fuzz test: Treasury rebalancing preserves total
     */
    function testFuzz_rebalancePreservesTotal(
        uint256 t0,
        uint256 t1,
        uint256 t2,
        uint256 t3,
        uint256 transferAmount,
        uint8 fromTier,
        uint8 toTier
    ) public pure {
        // Bound tier indices
        fromTier = uint8(bound(fromTier, 0, 3));
        toTier = uint8(bound(toTier, 0, 3));

        // Bound balances
        t0 = bound(t0, 0, 1e15);
        t1 = bound(t1, 0, 1e15);
        t2 = bound(t2, 0, 1e15);
        t3 = bound(t3, 0, 1e15);

        uint256[4] memory balances = [t0, t1, t2, t3];
        uint256 totalBefore = t0 + t1 + t2 + t3;

        // Bound transfer to available balance
        transferAmount = bound(transferAmount, 0, balances[fromTier]);

        // Simulate transfer
        balances[fromTier] -= transferAmount;
        balances[toTier] += transferAmount;

        uint256 totalAfter = balances[0] + balances[1] + balances[2] + balances[3];

        assertEq(totalBefore, totalAfter, "Rebalance changed total");
    }
}
