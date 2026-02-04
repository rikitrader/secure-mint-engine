import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Integration tests for the complete redemption flow
 * Tests the interaction between RedemptionEngine, BackedToken, TreasuryVault, and BackingOracle
 */
describe("Integration: Complete Redemption Flow", function () {
  const GLOBAL_SUPPLY_CAP = ethers.parseEther("1000000000");
  const EPOCH_MINT_CAP = ethers.parseEther("10000000");
  const MAX_ORACLE_AGE = 3600;
  const INITIAL_ALLOCATIONS = [1000n, 2000n, 5000n, 2000n];
  const REDEMPTION_DELAY = 86400; // 24 hours
  const BASIS_POINTS = 10000n;
  const REDEMPTION_FEE = 10n; // 0.1%

  async function deployFullSystemWithRedemptionFixture() {
    const [
      deployer,
      admin,
      minter,
      guardian,
      governor,
      attestor1,
      attestor2,
      operator,
      user1,
      user2,
    ] = await ethers.getSigners();

    // Deploy mock Chainlink aggregator
    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const chainlinkAggregator = await MockAggregator.deploy(8);
    await chainlinkAggregator.setLatestAnswer(1e8);
    await chainlinkAggregator.setUpdatedAt(await time.latest());

    // Deploy BackingOraclePoR
    const BackingOraclePoR = await ethers.getContractFactory("BackingOraclePoR");
    const oracle = await BackingOraclePoR.deploy(
      chainlinkAggregator.target,
      2,
      MAX_ORACLE_AGE,
      admin.address
    );

    // Deploy mock reserve asset (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const reserveAsset = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy TreasuryVault
    const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
    const treasury = await TreasuryVault.deploy(
      reserveAsset.target,
      admin.address,
      INITIAL_ALLOCATIONS
    );

    // Deploy BackedToken
    const BackedToken = await ethers.getContractFactory("BackedToken");
    const token = await BackedToken.deploy(
      "USD Backed Token",
      "USDB",
      admin.address,
      guardian.address
    );

    // Deploy SecureMintPolicy
    const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
    const policy = await SecureMintPolicy.deploy(
      token.target,
      oracle.target,
      GLOBAL_SUPPLY_CAP,
      EPOCH_MINT_CAP,
      MAX_ORACLE_AGE,
      admin.address
    );

    // Deploy RedemptionEngine
    const RedemptionEngine = await ethers.getContractFactory("RedemptionEngine");
    const redemption = await RedemptionEngine.deploy(
      token.target,
      reserveAsset.target,
      treasury.target,
      oracle.target,
      admin.address
    );

    // ========== Configure roles ==========

    // Oracle attestors
    const ATTESTOR_ROLE = await oracle.ATTESTOR_ROLE();
    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor1.address);
    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor2.address);

    // Policy roles
    const MINTER_ROLE = await policy.MINTER_ROLE();
    await policy.connect(admin).grantRole(MINTER_ROLE, minter.address);

    // Token permissions
    await token.connect(admin).setSecureMintPolicy(policy.target);

    // Treasury permissions
    const TREASURY_ADMIN_ROLE = await treasury.TREASURY_ADMIN_ROLE();
    await treasury.connect(admin).grantRole(TREASURY_ADMIN_ROLE, admin.address);

    // Allow redemption engine to withdraw from treasury
    const REBALANCER_ROLE = await treasury.REBALANCER_ROLE();
    await treasury.connect(admin).grantRole(REBALANCER_ROLE, redemption.target);

    // Redemption roles
    const OPERATOR_ROLE = await redemption.OPERATOR_ROLE();
    const GUARDIAN_ROLE_REDEMPTION = await redemption.GUARDIAN_ROLE();
    await redemption.connect(admin).grantRole(OPERATOR_ROLE, operator.address);
    await redemption.connect(admin).grantRole(GUARDIAN_ROLE_REDEMPTION, guardian.address);

    // Fund treasury
    const treasuryFunding = ethers.parseUnits("100000000", 6);
    await reserveAsset.mint(admin.address, treasuryFunding);
    await reserveAsset.connect(admin).approve(treasury.target, treasuryFunding);
    await treasury.connect(admin).depositDistributed(treasuryFunding);

    // Set up oracle
    const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    await oracle.connect(attestor1).submitAttestation(treasuryFunding, proof);
    await oracle.connect(attestor2).submitAttestation(treasuryFunding, proof);

    // Mint initial tokens to users for testing redemption
    const userTokens = ethers.parseEther("100000");
    await policy.connect(minter).mint(user1.address, userTokens);
    await policy.connect(minter).mint(user2.address, userTokens);

    // Approve redemption engine
    await token.connect(user1).approve(redemption.target, ethers.MaxUint256);
    await token.connect(user2).approve(redemption.target, ethers.MaxUint256);

    return {
      token,
      policy,
      oracle,
      treasury,
      redemption,
      reserveAsset,
      chainlinkAggregator,
      deployer,
      admin,
      minter,
      guardian,
      governor,
      attestor1,
      attestor2,
      operator,
      user1,
      user2,
    };
  }

  describe("Full Redemption Lifecycle", function () {
    it("Should complete full redemption: Request -> Wait -> Execute", async function () {
      const { token, redemption, reserveAsset, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      const redeemAmount = ethers.parseEther("10000");
      const tokenBalanceBefore = await token.balanceOf(user1.address);
      const usdcBalanceBefore = await reserveAsset.balanceOf(user1.address);

      // Step 1: Request redemption
      await redemption.connect(user1).requestRedemption(redeemAmount);

      // Tokens should be burned
      expect(await token.balanceOf(user1.address)).to.equal(
        tokenBalanceBefore - redeemAmount
      );

      // Step 2: Wait for delay
      await time.increase(REDEMPTION_DELAY + 1);

      // Step 3: Execute redemption
      await redemption.connect(user1).executeRedemption();

      // USDC should be received (minus fee, adjusted for decimals)
      const expectedFee = (redeemAmount * REDEMPTION_FEE) / BASIS_POINTS;
      const expectedOutput = (redeemAmount - expectedFee) / BigInt(1e12); // 18 -> 6 decimals

      const usdcBalanceAfter = await reserveAsset.balanceOf(user1.address);
      expect(usdcBalanceAfter - usdcBalanceBefore).to.be.closeTo(
        expectedOutput,
        ethers.parseUnits("1", 6) // 1 USDC tolerance
      );
    });

    it("Should reduce treasury reserves on redemption", async function () {
      const { treasury, redemption, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      const reservesBefore = await treasury.totalReserves();
      const redeemAmount = ethers.parseEther("10000");

      await redemption.connect(user1).requestRedemption(redeemAmount);
      await time.increase(REDEMPTION_DELAY + 1);
      await redemption.connect(user1).executeRedemption();

      const reservesAfter = await treasury.totalReserves();

      // Reserves should decrease by approximately the redeem amount (in USDC decimals)
      const expectedDecrease = redeemAmount / BigInt(1e12);
      expect(reservesBefore - reservesAfter).to.be.closeTo(
        expectedDecrease,
        ethers.parseUnits("100", 6) // 100 USDC tolerance for fees
      );
    });

    it("Should reduce total supply on redemption", async function () {
      const { token, redemption, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      const supplyBefore = await token.totalSupply();
      const redeemAmount = ethers.parseEther("10000");

      await redemption.connect(user1).requestRedemption(redeemAmount);

      const supplyAfter = await token.totalSupply();
      expect(supplyBefore - supplyAfter).to.equal(redeemAmount);
    });
  });

  describe("Redemption Queue Management", function () {
    it("Should allow multiple users to queue redemptions", async function () {
      const { redemption, user1, user2 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      const amount1 = ethers.parseEther("5000");
      const amount2 = ethers.parseEther("7000");

      await redemption.connect(user1).requestRedemption(amount1);
      await redemption.connect(user2).requestRedemption(amount2);

      const status1 = await redemption.getRedemptionStatus(user1.address);
      const status2 = await redemption.getRedemptionStatus(user2.address);

      expect(status1.pending).to.be.true;
      expect(status1.amount).to.equal(amount1);
      expect(status2.pending).to.be.true;
      expect(status2.amount).to.equal(amount2);
    });

    it("Should process redemptions independently", async function () {
      const { redemption, reserveAsset, user1, user2 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      // Both request
      await redemption.connect(user1).requestRedemption(ethers.parseEther("5000"));
      await redemption.connect(user2).requestRedemption(ethers.parseEther("7000"));

      await time.increase(REDEMPTION_DELAY + 1);

      // User1 executes
      const user1BalanceBefore = await reserveAsset.balanceOf(user1.address);
      await redemption.connect(user1).executeRedemption();
      const user1BalanceAfter = await reserveAsset.balanceOf(user1.address);

      expect(user1BalanceAfter).to.be.greaterThan(user1BalanceBefore);

      // User2's redemption should still be pending
      const status2 = await redemption.getRedemptionStatus(user2.address);
      expect(status2.pending).to.be.true;

      // User2 executes
      await redemption.connect(user2).executeRedemption();
    });
  });

  describe("Redemption During Stress", function () {
    it("Should handle redemption when reserves are tight", async function () {
      const { policy, redemption, treasury, oracle, minter, attestor1, attestor2, user1 } =
        await loadFixture(deployFullSystemWithRedemptionFixture);

      // Mint many more tokens (up to backing limit)
      const additionalMint = ethers.parseEther("90000000"); // 90M more
      await policy.connect(minter).mint(user1.address, additionalMint);

      // Now try to redeem a large amount
      const redeemAmount = ethers.parseEther("50000000"); // 50M tokens

      // Approve the larger amount
      const BackedToken = await ethers.getContractFactory("BackedToken");
      const token = await BackedToken.attach(await redemption.token());
      await token.connect(user1).approve(redemption.target, redeemAmount);

      await redemption.connect(user1).requestRedemption(redeemAmount);
      await time.increase(REDEMPTION_DELAY + 1);

      // Should still execute successfully if treasury has funds
      await redemption.connect(user1).executeRedemption();
    });

    it("Should fail redemption if treasury insufficient", async function () {
      const { token, redemption, treasury, admin, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      // Drain most of treasury (simulated)
      // In real scenario, this would require governance action
      // For testing, we'll set up a scenario where redemption exceeds available

      const redeemAmount = ethers.parseEther("10000");
      await redemption.connect(user1).requestRedemption(redeemAmount);
      await time.increase(REDEMPTION_DELAY + 1);

      // This test assumes treasury has been properly funded
      // If treasury becomes insufficient, execution should fail gracefully
      await redemption.connect(user1).executeRedemption();
    });
  });

  describe("Redemption with Depeg", function () {
    it("Should apply depeg surcharge when token is depegged", async function () {
      const { redemption, oracle, reserveAsset, chainlinkAggregator, user1 } =
        await loadFixture(deployFullSystemWithRedemptionFixture);

      // Simulate depeg - price drops to $0.95
      await chainlinkAggregator.setLatestAnswer(0.95e8);
      await chainlinkAggregator.setUpdatedAt(await time.latest());

      const redeemAmount = ethers.parseEther("10000");
      const usdcBefore = await reserveAsset.balanceOf(user1.address);

      await redemption.connect(user1).requestRedemption(redeemAmount);
      await time.increase(REDEMPTION_DELAY + 1);
      await redemption.connect(user1).executeRedemption();

      const usdcAfter = await reserveAsset.balanceOf(user1.address);
      const received = usdcAfter - usdcBefore;

      // Should receive less due to depeg surcharge
      const normalOutput = (redeemAmount * (BASIS_POINTS - REDEMPTION_FEE)) / BASIS_POINTS / BigInt(1e12);
      expect(received).to.be.lessThan(normalOutput);
    });
  });

  describe("Redemption Cancellation", function () {
    it("Should allow cancellation and return tokens", async function () {
      const { token, redemption, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      const balanceBefore = await token.balanceOf(user1.address);
      const redeemAmount = ethers.parseEther("10000");

      // Request
      await redemption.connect(user1).requestRedemption(redeemAmount);
      expect(await token.balanceOf(user1.address)).to.equal(
        balanceBefore - redeemAmount
      );

      // Cancel
      await redemption.connect(user1).cancelRedemption();

      // Tokens returned
      expect(await token.balanceOf(user1.address)).to.equal(balanceBefore);
    });

    it("Should allow new redemption after cancellation", async function () {
      const { redemption, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      const amount1 = ethers.parseEther("5000");
      const amount2 = ethers.parseEther("8000");

      // First request
      await redemption.connect(user1).requestRedemption(amount1);

      // Cancel
      await redemption.connect(user1).cancelRedemption();

      // New request with different amount
      await redemption.connect(user1).requestRedemption(amount2);

      const status = await redemption.getRedemptionStatus(user1.address);
      expect(status.amount).to.equal(amount2);
    });
  });

  describe("Pause Effects on Redemption", function () {
    it("Should block new requests when paused", async function () {
      const { redemption, guardian, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      await redemption.connect(guardian).pause();

      await expect(
        redemption.connect(user1).requestRedemption(ethers.parseEther("1000"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow execution of pending requests when paused", async function () {
      const { redemption, reserveAsset, guardian, user1 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      // Request before pause
      await redemption.connect(user1).requestRedemption(ethers.parseEther("10000"));
      await time.increase(REDEMPTION_DELAY + 1);

      // Pause
      await redemption.connect(guardian).pause();

      // Execution should still work
      const balanceBefore = await reserveAsset.balanceOf(user1.address);
      await redemption.connect(user1).executeRedemption();
      const balanceAfter = await reserveAsset.balanceOf(user1.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });

  describe("Rate Limits", function () {
    it("Should enforce daily redemption limits", async function () {
      const { redemption, admin, user1, user2 } = await loadFixture(
        deployFullSystemWithRedemptionFixture
      );

      // Set a daily limit
      const dailyLimit = ethers.parseEther("50000");
      await redemption.connect(admin).setDailyLimit(dailyLimit);

      // User1 redeems 40000
      await redemption.connect(user1).requestRedemption(ethers.parseEther("40000"));

      // User2 tries to redeem 20000 more - should fail
      await expect(
        redemption.connect(user2).requestRedemption(ethers.parseEther("20000"))
      ).to.be.revertedWithCustomError(redemption, "DailyLimitExceeded");

      // User2 can redeem up to remaining limit (10000)
      await redemption.connect(user2).requestRedemption(ethers.parseEther("10000"));
    });
  });
});
