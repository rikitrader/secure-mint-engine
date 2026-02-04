import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Integration tests for the complete mint flow
 * Tests the interaction between SecureMintPolicy, BackedToken, BackingOracle, and TreasuryVault
 */
describe("Integration: Complete Mint Flow", function () {
  const GLOBAL_SUPPLY_CAP = ethers.parseEther("1000000000"); // 1 billion
  const EPOCH_MINT_CAP = ethers.parseEther("10000000"); // 10 million
  const MAX_ORACLE_AGE = 3600; // 1 hour
  const INITIAL_ALLOCATIONS = [1000n, 2000n, 5000n, 2000n]; // T0-T3

  async function deployFullSystemFixture() {
    const [deployer, admin, minter, guardian, governor, attestor1, attestor2, user1, user2] =
      await ethers.getSigners();

    // 1. Deploy mock Chainlink aggregator
    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const chainlinkAggregator = await MockAggregator.deploy(8);
    await chainlinkAggregator.setLatestAnswer(1e8); // $1.00
    await chainlinkAggregator.setUpdatedAt(await time.latest());

    // 2. Deploy BackingOraclePoR
    const BackingOraclePoR = await ethers.getContractFactory("BackingOraclePoR");
    const oracle = await BackingOraclePoR.deploy(
      chainlinkAggregator.target,
      2, // min attestors
      MAX_ORACLE_AGE,
      admin.address
    );

    // 3. Deploy mock reserve asset (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const reserveAsset = await MockERC20.deploy("USD Coin", "USDC", 6);

    // 4. Deploy TreasuryVault
    const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
    const treasury = await TreasuryVault.deploy(
      reserveAsset.target,
      admin.address,
      INITIAL_ALLOCATIONS
    );

    // 5. Deploy BackedToken (placeholder mint policy for now)
    const BackedToken = await ethers.getContractFactory("BackedToken");
    const token = await BackedToken.deploy(
      "USD Backed Token",
      "USDB",
      admin.address, // Temporary - will update
      guardian.address
    );

    // 6. Deploy SecureMintPolicy
    const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
    const policy = await SecureMintPolicy.deploy(
      token.target,
      oracle.target,
      GLOBAL_SUPPLY_CAP,
      EPOCH_MINT_CAP,
      MAX_ORACLE_AGE,
      admin.address
    );

    // 7. Deploy EmergencyPause
    const EmergencyPause = await ethers.getContractFactory("EmergencyPause");
    const emergencyPause = await EmergencyPause.deploy(admin.address);

    // ========== Configure roles and permissions ==========

    // Grant oracle attestor roles
    const ATTESTOR_ROLE = await oracle.ATTESTOR_ROLE();
    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor1.address);
    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor2.address);

    // Grant policy roles
    const MINTER_ROLE = await policy.MINTER_ROLE();
    const GUARDIAN_ROLE = await policy.GUARDIAN_ROLE();
    const GOVERNOR_ROLE = await policy.GOVERNOR_ROLE();

    await policy.connect(admin).grantRole(MINTER_ROLE, minter.address);
    await policy.connect(admin).grantRole(GUARDIAN_ROLE, guardian.address);
    await policy.connect(admin).grantRole(GOVERNOR_ROLE, governor.address);

    // Update token to use SecureMintPolicy
    await token.connect(admin).setSecureMintPolicy(policy.target);

    // Grant treasury roles
    const TREASURY_ADMIN_ROLE = await treasury.TREASURY_ADMIN_ROLE();
    await treasury.connect(admin).grantRole(TREASURY_ADMIN_ROLE, admin.address);

    // Fund treasury with reserve assets
    const treasuryFunding = ethers.parseUnits("100000000", 6); // 100M USDC
    await reserveAsset.mint(admin.address, treasuryFunding);
    await reserveAsset.connect(admin).approve(treasury.target, treasuryFunding);
    await treasury.connect(admin).depositDistributed(treasuryFunding);

    // Set up oracle with sufficient backing
    const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    await oracle.connect(attestor1).submitAttestation(treasuryFunding, proof);
    await oracle.connect(attestor2).submitAttestation(treasuryFunding, proof);

    return {
      token,
      policy,
      oracle,
      treasury,
      emergencyPause,
      reserveAsset,
      chainlinkAggregator,
      deployer,
      admin,
      minter,
      guardian,
      governor,
      attestor1,
      attestor2,
      user1,
      user2,
    };
  }

  describe("Full Mint Lifecycle", function () {
    it("Should complete full mint cycle: Oracle -> Policy -> Token", async function () {
      const { token, policy, oracle, minter, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      // Verify system is healthy
      expect(await oracle.isHealthy()).to.be.true;
      expect(await policy.paused()).to.be.false;

      // Execute mint
      const mintAmount = ethers.parseEther("1000");
      await policy.connect(minter).mint(user1.address, mintAmount);

      // Verify token minted
      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await token.totalSupply()).to.equal(mintAmount);
    });

    it("Should enforce backing requirement throughout mint", async function () {
      const { policy, oracle, attestor1, attestor2, minter, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      // Lower the backing significantly
      const lowBacking = ethers.parseUnits("1000", 6); // Only 1000 USDC
      const proof = ethers.keccak256(ethers.toUtf8Bytes("newproof"));
      await oracle.connect(attestor1).submitAttestation(lowBacking, proof);
      await oracle.connect(attestor2).submitAttestation(lowBacking, proof);

      // Try to mint more than backing
      const mintAmount = ethers.parseEther("10000"); // More than 1000 backing

      await expect(
        policy.connect(minter).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(policy, "InsufficientBacking");
    });

    it("Should track epoch limits across multiple mints", async function () {
      const { policy, minter, user1, user2 } = await loadFixture(
        deployFullSystemFixture
      );

      // Mint 8M tokens (within 10M epoch cap)
      await policy.connect(minter).mint(user1.address, ethers.parseEther("8000000"));

      // Try to mint 3M more (would exceed 10M cap)
      await expect(
        policy.connect(minter).mint(user2.address, ethers.parseEther("3000000"))
      ).to.be.revertedWithCustomError(policy, "EpochCapExceeded");

      // Mint remaining 2M should work
      await policy.connect(minter).mint(user2.address, ethers.parseEther("2000000"));

      expect(await policy.getRemainingEpochMint()).to.equal(0n);
    });

    it("Should auto-pause on oracle failure during mint", async function () {
      const { policy, oracle, attestor1, attestor2, minter, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      // First mint should work
      await policy.connect(minter).mint(user1.address, ethers.parseEther("1000"));

      // Make oracle stale by advancing time
      await time.increase(MAX_ORACLE_AGE + 100);

      // Next mint should fail and pause
      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(policy, "OracleStale");

      expect(await policy.paused()).to.be.true;
    });
  });

  describe("Multi-User Scenarios", function () {
    it("Should handle concurrent mints to different users", async function () {
      const { token, policy, minter, user1, user2 } = await loadFixture(
        deployFullSystemFixture
      );

      const mint1 = ethers.parseEther("5000");
      const mint2 = ethers.parseEther("3000");

      await policy.connect(minter).mint(user1.address, mint1);
      await policy.connect(minter).mint(user2.address, mint2);

      expect(await token.balanceOf(user1.address)).to.equal(mint1);
      expect(await token.balanceOf(user2.address)).to.equal(mint2);
      expect(await token.totalSupply()).to.equal(mint1 + mint2);
    });
  });

  describe("Treasury-Token Coordination", function () {
    it("Should maintain backing ratio as supply grows", async function () {
      const { token, policy, oracle, treasury, minter, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      // Initial treasury has 100M USDC
      const initialReserves = await treasury.totalReserves();

      // Mint tokens up to backing
      const mintAmount = ethers.parseEther("50000000"); // 50M tokens
      await policy.connect(minter).mint(user1.address, mintAmount);

      // Verify health factor
      const totalSupply = await token.totalSupply();
      const healthFactor = await treasury.getHealthFactor(totalSupply);

      // Should be > 10000 (100%) since reserves > supply
      expect(healthFactor).to.be.greaterThan(10000n);
    });
  });

  describe("Guardian Emergency Controls", function () {
    it("Should allow guardian to pause minting in emergency", async function () {
      const { policy, guardian, minter, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      // Guardian pauses
      await policy.connect(guardian).pause();

      // Mint should fail
      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow guardian to unpause after fixing issue", async function () {
      const { policy, oracle, guardian, minter, attestor1, attestor2, user1 } =
        await loadFixture(deployFullSystemFixture);

      // Pause
      await policy.connect(guardian).pause();

      // Refresh oracle attestations
      const proof = ethers.keccak256(ethers.toUtf8Bytes("freshproof"));
      const backing = ethers.parseUnits("100000000", 6);
      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      // Unpause
      await policy.connect(guardian).unpause();

      // Mint should work again
      await policy.connect(minter).mint(user1.address, ethers.parseEther("1000"));
    });
  });

  describe("Epoch Reset Behavior", function () {
    it("Should reset epoch allowance after duration", async function () {
      const { policy, minter, user1 } = await loadFixture(deployFullSystemFixture);

      // Mint up to epoch cap
      await policy.connect(minter).mint(user1.address, EPOCH_MINT_CAP);

      // Verify can't mint more
      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(policy, "EpochCapExceeded");

      // Advance past epoch duration (1 hour)
      await time.increase(3601);

      // Should be able to mint again
      await policy.connect(minter).mint(user1.address, ethers.parseEther("1000"));

      expect(await policy.getRemainingEpochMint()).to.equal(
        EPOCH_MINT_CAP - ethers.parseEther("1000")
      );
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero mint amount gracefully", async function () {
      const { policy, minter, user1 } = await loadFixture(deployFullSystemFixture);

      await expect(
        policy.connect(minter).mint(user1.address, 0n)
      ).to.be.revertedWithCustomError(policy, "ZeroAmount");
    });

    it("Should reject mint to zero address", async function () {
      const { policy, minter } = await loadFixture(deployFullSystemFixture);

      await expect(
        policy.connect(minter).mint(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(policy, "ZeroAddress");
    });

    it("Should handle exact epoch cap mint", async function () {
      const { policy, minter, user1 } = await loadFixture(deployFullSystemFixture);

      // Mint exactly the epoch cap
      await policy.connect(minter).mint(user1.address, EPOCH_MINT_CAP);

      expect(await policy.getRemainingEpochMint()).to.equal(0n);
    });
  });

  describe("Event Emission", function () {
    it("Should emit correct events throughout mint flow", async function () {
      const { token, policy, oracle, minter, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      const mintAmount = ethers.parseEther("1000");
      const backing = await oracle.getVerifiedBacking();
      const oracleTimestamp = await oracle.lastUpdate();

      // Check policy event
      await expect(policy.connect(minter).mint(user1.address, mintAmount))
        .to.emit(policy, "SecureMintExecuted")
        .withArgs(user1.address, mintAmount, backing, mintAmount, oracleTimestamp);
    });
  });
});
