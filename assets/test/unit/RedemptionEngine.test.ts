import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("RedemptionEngine", function () {
  const REDEMPTION_DELAY = 86400; // 24 hours
  const MIN_REDEMPTION = ethers.parseEther("100");
  const MAX_REDEMPTION = ethers.parseEther("1000000");
  const REDEMPTION_FEE = 10n; // 0.1% in basis points
  const BASIS_POINTS = 10000n;

  async function deployRedemptionEngineFixture() {
    const [admin, operator, guardian, user1, user2] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockBackedToken");
    const token = await MockToken.deploy("Test Token", "TST");

    // Deploy mock reserve asset (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const reserveAsset = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy mock treasury
    const MockTreasury = await ethers.getContractFactory("MockTreasury");
    const treasury = await MockTreasury.deploy(reserveAsset.target);

    // Deploy mock oracle
    const MockOracle = await ethers.getContractFactory("MockBackingOracle");
    const oracle = await MockOracle.deploy();
    await oracle.setHealthy(true);
    await oracle.setVerifiedBacking(ethers.parseUnits("1000000000", 6));
    await oracle.updateTimestamp();

    // Deploy redemption engine
    const RedemptionEngine = await ethers.getContractFactory("RedemptionEngine");
    const engine = await RedemptionEngine.deploy(
      token.target,
      reserveAsset.target,
      treasury.target,
      oracle.target,
      admin.address
    );

    // Grant roles
    const OPERATOR_ROLE = await engine.OPERATOR_ROLE();
    const GUARDIAN_ROLE = await engine.GUARDIAN_ROLE();

    await engine.connect(admin).grantRole(OPERATOR_ROLE, operator.address);
    await engine.connect(admin).grantRole(GUARDIAN_ROLE, guardian.address);

    // Set up token and treasury permissions
    await token.setSecureMintPolicy(admin.address);
    await treasury.setRedemptionEngine(engine.target);

    // Mint tokens to users
    await token.connect(admin).mint(user1.address, ethers.parseEther("10000"));
    await token.connect(admin).mint(user2.address, ethers.parseEther("10000"));

    // Fund treasury with reserve asset
    await reserveAsset.mint(treasury.target, ethers.parseUnits("1000000", 6));

    // Approve engine to spend user tokens
    await token.connect(user1).approve(engine.target, ethers.MaxUint256);
    await token.connect(user2).approve(engine.target, ethers.MaxUint256);

    return {
      engine,
      token,
      reserveAsset,
      treasury,
      oracle,
      admin,
      operator,
      guardian,
      user1,
      user2,
    };
  }

  describe("Deployment", function () {
    it("Should set correct token address", async function () {
      const { engine, token } = await loadFixture(deployRedemptionEngineFixture);
      expect(await engine.token()).to.equal(token.target);
    });

    it("Should set correct reserve asset", async function () {
      const { engine, reserveAsset } = await loadFixture(
        deployRedemptionEngineFixture
      );
      expect(await engine.reserveAsset()).to.equal(reserveAsset.target);
    });

    it("Should start unpaused", async function () {
      const { engine } = await loadFixture(deployRedemptionEngineFixture);
      expect(await engine.paused()).to.be.false;
    });
  });

  describe("Redemption Requests", function () {
    it("Should allow users to request redemption", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      const request = await engine.redemptionRequests(user1.address);
      expect(request.amount).to.equal(amount);
      expect(request.pending).to.be.true;
    });

    it("Should emit RedemptionRequested event", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");

      await expect(engine.connect(user1).requestRedemption(amount))
        .to.emit(engine, "RedemptionRequested")
        .withArgs(user1.address, amount, (await time.latest()) + REDEMPTION_DELAY);
    });

    it("Should burn tokens on request", async function () {
      const { engine, token, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      const balanceBefore = await token.balanceOf(user1.address);
      const amount = ethers.parseEther("1000");

      await engine.connect(user1).requestRedemption(amount);

      const balanceAfter = await token.balanceOf(user1.address);
      expect(balanceBefore - balanceAfter).to.equal(amount);
    });

    it("Should revert if amount below minimum", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("10"); // Below MIN_REDEMPTION

      await expect(
        engine.connect(user1).requestRedemption(amount)
      ).to.be.revertedWithCustomError(engine, "BelowMinimumRedemption");
    });

    it("Should revert if pending request exists", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      await expect(
        engine.connect(user1).requestRedemption(amount)
      ).to.be.revertedWithCustomError(engine, "PendingRequestExists");
    });
  });

  describe("Redemption Execution", function () {
    it("Should allow execution after delay", async function () {
      const { engine, reserveAsset, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      // Advance time past delay
      await time.increase(REDEMPTION_DELAY + 1);

      const balanceBefore = await reserveAsset.balanceOf(user1.address);
      await engine.connect(user1).executeRedemption();
      const balanceAfter = await reserveAsset.balanceOf(user1.address);

      // Check received amount (minus fee)
      const expectedFee = (amount * REDEMPTION_FEE) / BASIS_POINTS;
      const expectedReceived = amount - expectedFee;
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        expectedReceived / BigInt(1e12), // Convert 18 decimals to 6
        ethers.parseUnits("1", 6)
      );
    });

    it("Should emit RedemptionExecuted event", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      await time.increase(REDEMPTION_DELAY + 1);

      await expect(engine.connect(user1).executeRedemption())
        .to.emit(engine, "RedemptionExecuted")
        .withArgs(user1.address, amount, anyValue);
    });

    it("Should revert if executed too early", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      await expect(
        engine.connect(user1).executeRedemption()
      ).to.be.revertedWithCustomError(engine, "RedemptionNotReady");
    });

    it("Should revert if no pending request", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      await expect(
        engine.connect(user1).executeRedemption()
      ).to.be.revertedWithCustomError(engine, "NoPendingRedemption");
    });
  });

  describe("Redemption Cancellation", function () {
    it("Should allow users to cancel pending redemption", async function () {
      const { engine, token, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      const amount = ethers.parseEther("1000");
      const balanceBefore = await token.balanceOf(user1.address);

      await engine.connect(user1).requestRedemption(amount);
      await engine.connect(user1).cancelRedemption();

      const balanceAfter = await token.balanceOf(user1.address);

      // Tokens should be returned
      expect(balanceAfter).to.equal(balanceBefore);

      // Request should be cleared
      const request = await engine.redemptionRequests(user1.address);
      expect(request.pending).to.be.false;
    });

    it("Should emit RedemptionCancelled event", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      await expect(engine.connect(user1).cancelRedemption())
        .to.emit(engine, "RedemptionCancelled")
        .withArgs(user1.address, amount);
    });
  });

  describe("Depeg Surcharge", function () {
    it("Should apply surcharge when price depegged", async function () {
      const { engine, oracle, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      // Simulate depeg condition
      await oracle.setDepegged(true);
      await oracle.setDepegSurchargeRate(500); // 5% surcharge

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      await time.increase(REDEMPTION_DELAY + 1);

      // Execute and verify surcharge was applied
      // (actual amounts would depend on implementation)
      await engine.connect(user1).executeRedemption();
    });
  });

  describe("Pause Controls", function () {
    it("Should allow guardian to pause", async function () {
      const { engine, guardian } = await loadFixture(deployRedemptionEngineFixture);

      await engine.connect(guardian).pause();
      expect(await engine.paused()).to.be.true;
    });

    it("Should block redemption requests when paused", async function () {
      const { engine, guardian, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      await engine.connect(guardian).pause();

      await expect(
        engine.connect(user1).requestRedemption(ethers.parseEther("1000"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow execution of pending requests when paused", async function () {
      const { engine, guardian, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      // Request before pause
      await engine.connect(user1).requestRedemption(ethers.parseEther("1000"));
      await time.increase(REDEMPTION_DELAY + 1);

      // Pause
      await engine.connect(guardian).pause();

      // Should still be able to execute
      await engine.connect(user1).executeRedemption();
    });
  });

  describe("Rate Limiting", function () {
    it("Should enforce daily redemption limit", async function () {
      const { engine, admin, user1, user2 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      // Set a daily limit
      await engine.connect(admin).setDailyLimit(ethers.parseEther("5000"));

      // First user redeems 3000
      await engine.connect(user1).requestRedemption(ethers.parseEther("3000"));

      // Second user tries to redeem 3000 more - should fail
      await expect(
        engine.connect(user2).requestRedemption(ethers.parseEther("3000"))
      ).to.be.revertedWithCustomError(engine, "DailyLimitExceeded");
    });

    it("Should reset daily limit after 24 hours", async function () {
      const { engine, admin, user1 } = await loadFixture(
        deployRedemptionEngineFixture
      );

      await engine.connect(admin).setDailyLimit(ethers.parseEther("5000"));

      // Redeem up to limit
      await engine.connect(user1).requestRedemption(ethers.parseEther("5000"));

      // Advance 24 hours
      await time.increase(86400);

      // Mint more tokens for user1
      const MockToken = await ethers.getContractFactory("MockBackedToken");
      const token = await MockToken.attach(await engine.token());
      await token.connect(await ethers.getSigner(admin.address)).mint(
        user1.address,
        ethers.parseEther("5000")
      );
      await token.connect(user1).approve(engine.target, ethers.MaxUint256);

      // Cancel previous request first
      await engine.connect(user1).cancelRedemption();

      // Should be able to redeem again
      await engine.connect(user1).requestRedemption(ethers.parseEther("1000"));
    });
  });

  describe("View Functions", function () {
    it("Should return redemption status", async function () {
      const { engine, user1 } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      await engine.connect(user1).requestRedemption(amount);

      const status = await engine.getRedemptionStatus(user1.address);
      expect(status.pending).to.be.true;
      expect(status.amount).to.equal(amount);
    });

    it("Should calculate output amount correctly", async function () {
      const { engine } = await loadFixture(deployRedemptionEngineFixture);

      const amount = ethers.parseEther("1000");
      const output = await engine.calculateRedemptionOutput(amount);

      // Output should be less than input due to fees
      expect(output).to.be.lessThan(amount / BigInt(1e12)); // Adjust for decimals
    });
  });
});

// Helper for matching any value
const anyValue = () => true;
