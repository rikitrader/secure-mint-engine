import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SecureMintPolicy", function () {
  const GLOBAL_SUPPLY_CAP = ethers.parseEther("1000000000"); // 1 billion
  const EPOCH_MINT_CAP = ethers.parseEther("10000000"); // 10 million
  const MAX_ORACLE_AGE = 3600; // 1 hour

  // Mock oracle that we control
  async function deployMockOracle() {
    const MockOracle = await ethers.getContractFactory("MockBackingOracle");
    const oracle = await MockOracle.deploy();
    return oracle;
  }

  async function deploySecureMintPolicyFixture() {
    const [admin, minter, guardian, governor, user1, user2] = await ethers.getSigners();

    // Deploy mock oracle
    const oracle = await deployMockOracle();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockBackedToken");
    const token = await MockToken.deploy("Test Token", "TST");

    // Deploy policy
    const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
    const policy = await SecureMintPolicy.deploy(
      token.target,
      oracle.target,
      GLOBAL_SUPPLY_CAP,
      EPOCH_MINT_CAP,
      MAX_ORACLE_AGE,
      admin.address
    );

    // Set up token to allow policy to mint
    await token.setSecureMintPolicy(policy.target);

    // Grant roles
    const MINTER_ROLE = await policy.MINTER_ROLE();
    const GUARDIAN_ROLE = await policy.GUARDIAN_ROLE();
    const GOVERNOR_ROLE = await policy.GOVERNOR_ROLE();

    await policy.connect(admin).grantRole(MINTER_ROLE, minter.address);
    await policy.connect(admin).grantRole(GUARDIAN_ROLE, guardian.address);
    await policy.connect(admin).grantRole(GOVERNOR_ROLE, governor.address);

    // Set up oracle with healthy state and sufficient backing
    await oracle.setHealthy(true);
    await oracle.setVerifiedBacking(ethers.parseEther("2000000000")); // 2 billion backing
    await oracle.updateTimestamp();

    return { policy, token, oracle, admin, minter, guardian, governor, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set immutable values correctly", async function () {
      const { policy, token } = await loadFixture(deploySecureMintPolicyFixture);

      expect(await policy.token()).to.equal(token.target);
      expect(await policy.GLOBAL_SUPPLY_CAP()).to.equal(GLOBAL_SUPPLY_CAP);
    });

    it("Should set configurable values correctly", async function () {
      const { policy } = await loadFixture(deploySecureMintPolicyFixture);

      expect(await policy.epochMintCap()).to.equal(EPOCH_MINT_CAP);
      expect(await policy.maxOracleAge()).to.equal(MAX_ORACLE_AGE);
    });

    it("Should revert with zero address for token", async function () {
      const [admin] = await ethers.getSigners();
      const oracle = await deployMockOracle();

      const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
      await expect(
        SecureMintPolicy.deploy(
          ethers.ZeroAddress,
          oracle.target,
          GLOBAL_SUPPLY_CAP,
          EPOCH_MINT_CAP,
          MAX_ORACLE_AGE,
          admin.address
        )
      ).to.be.revertedWithCustomError(SecureMintPolicy, "ZeroAddress");
    });
  });

  describe("Minting - Happy Path", function () {
    it("Should allow minting when all conditions are met", async function () {
      const { policy, token, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      const mintAmount = ethers.parseEther("1000");
      await policy.connect(minter).mint(user1.address, mintAmount);

      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should emit SecureMintExecuted event", async function () {
      const { policy, oracle, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      const mintAmount = ethers.parseEther("1000");
      const backing = await oracle.getVerifiedBacking();
      const oracleTimestamp = await oracle.lastUpdate();

      await expect(policy.connect(minter).mint(user1.address, mintAmount))
        .to.emit(policy, "SecureMintExecuted")
        .withArgs(user1.address, mintAmount, backing, mintAmount, oracleTimestamp);
    });

    it("Should track epoch minted correctly", async function () {
      const { policy, minter, user1 } = await loadFixture(deploySecureMintPolicyFixture);

      const mintAmount = ethers.parseEther("1000");
      await policy.connect(minter).mint(user1.address, mintAmount);

      const remaining = await policy.getRemainingEpochMint();
      expect(remaining).to.equal(EPOCH_MINT_CAP - mintAmount);
    });
  });

  describe("Minting - Oracle Health Checks", function () {
    it("Should revert if oracle is unhealthy", async function () {
      const { policy, oracle, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      await oracle.setHealthy(false);

      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(policy, "OracleUnhealthy");
    });

    it("Should auto-pause on unhealthy oracle", async function () {
      const { policy, oracle, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      await oracle.setHealthy(false);

      try {
        await policy.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      } catch {}

      expect(await policy.paused()).to.be.true;
    });

    it("Should revert if oracle data is stale", async function () {
      const { policy, oracle, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      // Make oracle data stale
      await oracle.setLastUpdate(Math.floor(Date.now() / 1000) - MAX_ORACLE_AGE - 100);

      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(policy, "OracleStale");
    });
  });

  describe("Minting - Backing Verification", function () {
    it("Should revert if backing is insufficient", async function () {
      const { policy, oracle, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      // Set insufficient backing
      await oracle.setVerifiedBacking(ethers.parseEther("100"));
      await oracle.setCanMint(false);

      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(policy, "InsufficientBacking");
    });
  });

  describe("Minting - Rate Limits", function () {
    it("Should revert if global cap would be exceeded", async function () {
      const { policy, oracle, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      // Try to mint more than global cap
      await expect(
        policy.connect(minter).mint(user1.address, GLOBAL_SUPPLY_CAP + 1n)
      ).to.be.revertedWithCustomError(policy, "GlobalCapExceeded");
    });

    it("Should revert if epoch cap would be exceeded", async function () {
      const { policy, minter, user1 } = await loadFixture(deploySecureMintPolicyFixture);

      // Try to mint more than epoch cap
      await expect(
        policy.connect(minter).mint(user1.address, EPOCH_MINT_CAP + 1n)
      ).to.be.revertedWithCustomError(policy, "EpochCapExceeded");
    });

    it("Should reset epoch after duration", async function () {
      const { policy, minter, user1 } = await loadFixture(deploySecureMintPolicyFixture);

      // Mint up to epoch cap
      await policy.connect(minter).mint(user1.address, EPOCH_MINT_CAP);

      // Advance time past epoch
      await time.increase(3601);

      // Should be able to mint again
      await policy.connect(minter).mint(user1.address, ethers.parseEther("1000"));

      expect(await policy.getRemainingEpochMint()).to.equal(
        EPOCH_MINT_CAP - ethers.parseEther("1000")
      );
    });
  });

  describe("Minting - Access Control", function () {
    it("Should revert if caller does not have MINTER_ROLE", async function () {
      const { policy, user1, user2 } = await loadFixture(deploySecureMintPolicyFixture);

      await expect(
        policy.connect(user1).mint(user2.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should revert if contract is paused", async function () {
      const { policy, guardian, minter, user1 } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      await policy.connect(guardian).pause();

      await expect(
        policy.connect(minter).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Pause Controls", function () {
    it("Should allow guardian to pause", async function () {
      const { policy, guardian } = await loadFixture(deploySecureMintPolicyFixture);

      await policy.connect(guardian).pause();

      expect(await policy.paused()).to.be.true;
    });

    it("Should allow guardian to unpause when oracle is healthy", async function () {
      const { policy, guardian, oracle } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      await oracle.updateTimestamp();
      await policy.connect(guardian).pause();
      await policy.connect(guardian).unpause();

      expect(await policy.paused()).to.be.false;
    });

    it("Should revert unpause if oracle is unhealthy", async function () {
      const { policy, guardian, oracle } = await loadFixture(
        deploySecureMintPolicyFixture
      );

      await policy.connect(guardian).pause();
      await oracle.setHealthy(false);

      await expect(policy.connect(guardian).unpause()).to.be.revertedWith(
        "Cannot unpause: oracle unhealthy"
      );
    });
  });

  describe("Timelocked Parameter Changes", function () {
    it("Should propose epoch cap change", async function () {
      const { policy, governor } = await loadFixture(deploySecureMintPolicyFixture);

      const newCap = ethers.parseEther("20000000");
      await policy.connect(governor).proposeEpochCapChange(newCap);

      const CHANGE_EPOCH_CAP = await policy.CHANGE_EPOCH_CAP();
      const pending = await policy.pendingChanges(CHANGE_EPOCH_CAP);

      expect(pending.pending).to.be.true;
      expect(pending.newValue).to.equal(newCap);
    });

    it("Should execute epoch cap change after timelock", async function () {
      const { policy, governor } = await loadFixture(deploySecureMintPolicyFixture);

      const newCap = ethers.parseEther("20000000");
      await policy.connect(governor).proposeEpochCapChange(newCap);

      // Advance time past timelock
      await time.increase(48 * 3600 + 1);

      await policy.connect(governor).executeEpochCapChange();

      expect(await policy.epochMintCap()).to.equal(newCap);
    });

    it("Should revert if timelock not ready", async function () {
      const { policy, governor } = await loadFixture(deploySecureMintPolicyFixture);

      const newCap = ethers.parseEther("20000000");
      await policy.connect(governor).proposeEpochCapChange(newCap);

      // Try to execute immediately
      await expect(
        policy.connect(governor).executeEpochCapChange()
      ).to.be.revertedWithCustomError(policy, "TimelockNotReady");
    });

    it("Should allow cancelling pending changes", async function () {
      const { policy, governor } = await loadFixture(deploySecureMintPolicyFixture);

      const newCap = ethers.parseEther("20000000");
      await policy.connect(governor).proposeEpochCapChange(newCap);

      const CHANGE_EPOCH_CAP = await policy.CHANGE_EPOCH_CAP();
      await policy.connect(governor).cancelChange(CHANGE_EPOCH_CAP);

      const pending = await policy.pendingChanges(CHANGE_EPOCH_CAP);
      expect(pending.pending).to.be.false;
    });
  });

  describe("View Functions", function () {
    it("Should return correct canMintNow status", async function () {
      const { policy } = await loadFixture(deploySecureMintPolicyFixture);

      const [canMint, reason] = await policy.canMintNow(ethers.parseEther("1000"));

      expect(canMint).to.be.true;
      expect(reason).to.equal("");
    });

    it("Should return correct status", async function () {
      const { policy, oracle } = await loadFixture(deploySecureMintPolicyFixture);

      const status = await policy.getStatus();

      expect(status.isPaused).to.be.false;
      expect(status.oracleHealthy).to.be.true;
      expect(status.globalCap).to.equal(GLOBAL_SUPPLY_CAP);
    });
  });
});

// Mock contracts for testing
const MockBackingOracleABI = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockBackingOracle {
    bool public healthy = true;
    uint256 public verifiedBacking;
    uint256 public lastUpdateTimestamp;
    bool public canMintResult = true;

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
        return supply;
    }

    function canMint(uint256, uint256) external view returns (bool) {
        return canMintResult && healthy;
    }
}
`;
