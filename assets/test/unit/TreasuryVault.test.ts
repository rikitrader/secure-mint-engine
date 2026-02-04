import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("TreasuryVault", function () {
  const BASIS_POINTS = 10000n;

  // Initial allocations: T0=10%, T1=20%, T2=50%, T3=20%
  const INITIAL_ALLOCATIONS = [1000n, 2000n, 5000n, 2000n];

  async function deployTreasuryVaultFixture() {
    const [admin, rebalancer, guardian, governor, user1] = await ethers.getSigners();

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const reserveAsset = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy treasury vault
    const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
    const vault = await TreasuryVault.deploy(
      reserveAsset.target,
      admin.address,
      INITIAL_ALLOCATIONS
    );

    // Grant roles
    const REBALANCER_ROLE = await vault.REBALANCER_ROLE();
    const GUARDIAN_ROLE = await vault.GUARDIAN_ROLE();
    const GOVERNOR_ROLE = await vault.GOVERNOR_ROLE();
    const TREASURY_ADMIN_ROLE = await vault.TREASURY_ADMIN_ROLE();

    await vault.connect(admin).grantRole(REBALANCER_ROLE, rebalancer.address);
    await vault.connect(admin).grantRole(GUARDIAN_ROLE, guardian.address);
    await vault.connect(admin).grantRole(GOVERNOR_ROLE, governor.address);
    await vault.connect(admin).grantRole(TREASURY_ADMIN_ROLE, admin.address);

    // Mint some USDC to admin for testing
    await reserveAsset.mint(admin.address, ethers.parseUnits("1000000", 6));
    await reserveAsset.connect(admin).approve(vault.target, ethers.MaxUint256);

    return { vault, reserveAsset, admin, rebalancer, guardian, governor, user1 };
  }

  describe("Deployment", function () {
    it("Should set correct reserve asset", async function () {
      const { vault, reserveAsset } = await loadFixture(deployTreasuryVaultFixture);
      expect(await vault.reserveAsset()).to.equal(reserveAsset.target);
    });

    it("Should set correct initial allocations", async function () {
      const { vault } = await loadFixture(deployTreasuryVaultFixture);
      const allocations = await vault.getTargetAllocations();

      for (let i = 0; i < 4; i++) {
        expect(allocations[i]).to.equal(INITIAL_ALLOCATIONS[i]);
      }
    });

    it("Should start with zero reserves", async function () {
      const { vault } = await loadFixture(deployTreasuryVaultFixture);
      expect(await vault.totalReserves()).to.equal(0);
    });

    it("Should revert if allocations don't sum to 10000", async function () {
      const [admin] = await ethers.getSigners();
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const asset = await MockERC20.deploy("Test", "TST", 18);

      const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
      await expect(
        TreasuryVault.deploy(asset.target, admin.address, [1000n, 2000n, 3000n, 3000n])
      ).to.be.revertedWithCustomError(TreasuryVault, "AllocationSumInvalid");
    });
  });

  describe("Deposits", function () {
    it("Should allow deposits to specific tier", async function () {
      const { vault, reserveAsset, admin } = await loadFixture(
        deployTreasuryVaultFixture
      );

      const depositAmount = ethers.parseUnits("10000", 6);
      await vault.connect(admin).deposit(depositAmount, 0);

      expect(await vault.totalReserves()).to.equal(depositAmount);
      const balances = await vault.getTierBalances();
      expect(balances[0]).to.equal(depositAmount);
    });

    it("Should emit Deposit event", async function () {
      const { vault, admin } = await loadFixture(deployTreasuryVaultFixture);

      const depositAmount = ethers.parseUnits("10000", 6);
      await expect(vault.connect(admin).deposit(depositAmount, 0))
        .to.emit(vault, "Deposit")
        .withArgs(admin.address, depositAmount, 0);
    });

    it("Should allow distributed deposits", async function () {
      const { vault, admin } = await loadFixture(deployTreasuryVaultFixture);

      const depositAmount = ethers.parseUnits("100000", 6);
      await vault.connect(admin).depositDistributed(depositAmount);

      expect(await vault.totalReserves()).to.equal(depositAmount);

      const balances = await vault.getTierBalances();
      // Check allocations are approximately correct
      for (let i = 0; i < 4; i++) {
        const expected = (depositAmount * INITIAL_ALLOCATIONS[i]) / BASIS_POINTS;
        expect(balances[i]).to.equal(expected);
      }
    });

    it("Should revert deposit with invalid tier", async function () {
      const { vault, admin } = await loadFixture(deployTreasuryVaultFixture);

      await expect(
        vault.connect(admin).deposit(ethers.parseUnits("1000", 6), 4)
      ).to.be.revertedWithCustomError(vault, "InvalidTier");
    });
  });

  describe("Withdrawals", function () {
    it("Should allow withdrawals from specific tier", async function () {
      const { vault, reserveAsset, admin, user1 } = await loadFixture(
        deployTreasuryVaultFixture
      );

      // First deposit
      const depositAmount = ethers.parseUnits("10000", 6);
      await vault.connect(admin).deposit(depositAmount, 0);

      // Then withdraw
      const withdrawAmount = ethers.parseUnits("5000", 6);
      await vault.connect(admin).withdraw(user1.address, withdrawAmount, 0, "Test withdrawal");

      expect(await reserveAsset.balanceOf(user1.address)).to.equal(withdrawAmount);
      expect(await vault.totalReserves()).to.equal(depositAmount - withdrawAmount);
    });

    it("Should revert if insufficient balance in tier", async function () {
      const { vault, admin, user1 } = await loadFixture(deployTreasuryVaultFixture);

      await vault.connect(admin).deposit(ethers.parseUnits("1000", 6), 0);

      await expect(
        vault
          .connect(admin)
          .withdraw(user1.address, ethers.parseUnits("2000", 6), 0, "Too much")
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
  });

  describe("Emergency Withdrawals", function () {
    it("Should allow guardian to emergency withdraw", async function () {
      const { vault, reserveAsset, admin, guardian, user1 } = await loadFixture(
        deployTreasuryVaultFixture
      );

      await vault.connect(admin).depositDistributed(ethers.parseUnits("100000", 6));

      const withdrawAmount = ethers.parseUnits("50000", 6);
      await vault
        .connect(guardian)
        .emergencyWithdraw(user1.address, withdrawAmount, "Emergency!");

      expect(await reserveAsset.balanceOf(user1.address)).to.equal(withdrawAmount);
    });

    it("Should emit EmergencyWithdrawal event", async function () {
      const { vault, admin, guardian, user1 } = await loadFixture(
        deployTreasuryVaultFixture
      );

      await vault.connect(admin).depositDistributed(ethers.parseUnits("100000", 6));

      const withdrawAmount = ethers.parseUnits("50000", 6);
      await expect(
        vault.connect(guardian).emergencyWithdraw(user1.address, withdrawAmount, "Emergency!")
      )
        .to.emit(vault, "EmergencyWithdrawal")
        .withArgs(user1.address, withdrawAmount, "Emergency!");
    });
  });

  describe("Rebalancing", function () {
    it("Should transfer between tiers", async function () {
      const { vault, admin, rebalancer } = await loadFixture(
        deployTreasuryVaultFixture
      );

      // Deposit to tier 0
      await vault.connect(admin).deposit(ethers.parseUnits("10000", 6), 0);

      // Transfer to tier 1
      const transferAmount = ethers.parseUnits("5000", 6);
      await vault.connect(rebalancer).transferBetweenTiers(0, 1, transferAmount);

      const balances = await vault.getTierBalances();
      expect(balances[0]).to.equal(ethers.parseUnits("5000", 6));
      expect(balances[1]).to.equal(ethers.parseUnits("5000", 6));
    });

    it("Should rebalance to target allocations", async function () {
      const { vault, admin, rebalancer } = await loadFixture(
        deployTreasuryVaultFixture
      );

      // Deposit unevenly
      await vault.connect(admin).deposit(ethers.parseUnits("100000", 6), 0);

      // Rebalance
      await vault.connect(rebalancer).rebalance();

      // Check allocations are approximately correct
      const currentAllocations = await vault.getCurrentAllocations();
      for (let i = 0; i < 4; i++) {
        // Allow 1% tolerance for rounding
        const diff =
          currentAllocations[i] > INITIAL_ALLOCATIONS[i]
            ? currentAllocations[i] - INITIAL_ALLOCATIONS[i]
            : INITIAL_ALLOCATIONS[i] - currentAllocations[i];
        expect(diff).to.be.lessThan(100n);
      }
    });

    it("Should correctly identify when rebalancing needed", async function () {
      const { vault, admin } = await loadFixture(deployTreasuryVaultFixture);

      // Deposit all to one tier (very unbalanced)
      await vault.connect(admin).deposit(ethers.parseUnits("100000", 6), 0);

      expect(await vault.needsRebalancing()).to.be.true;
    });
  });

  describe("Allocation Changes (Timelocked)", function () {
    it("Should propose new allocations", async function () {
      const { vault, governor } = await loadFixture(deployTreasuryVaultFixture);

      const newAllocations = [500n, 1500n, 6000n, 2000n];
      await vault.connect(governor).proposeAllocation(newAllocations);

      const pending = await vault.pendingAllocation();
      expect(pending.pending).to.be.true;
    });

    it("Should execute allocation change after timelock", async function () {
      const { vault, governor } = await loadFixture(deployTreasuryVaultFixture);

      const newAllocations = [500n, 1500n, 6000n, 2000n];
      await vault.connect(governor).proposeAllocation(newAllocations);

      // Advance time
      await time.increase(48 * 3600 + 1);

      await vault.connect(governor).executeAllocation();

      const allocations = await vault.getTargetAllocations();
      for (let i = 0; i < 4; i++) {
        expect(allocations[i]).to.equal(newAllocations[i]);
      }
    });
  });

  describe("View Functions", function () {
    it("Should return correct health factor", async function () {
      const { vault, admin } = await loadFixture(deployTreasuryVaultFixture);

      await vault.connect(admin).deposit(ethers.parseUnits("100000", 6), 0);

      const healthFactor = await vault.getHealthFactor(ethers.parseUnits("80000", 6));
      // 100000 / 80000 * 10000 = 12500 (125%)
      expect(healthFactor).to.equal(12500n);
    });

    it("Should return full status", async function () {
      const { vault, admin } = await loadFixture(deployTreasuryVaultFixture);

      await vault.connect(admin).depositDistributed(ethers.parseUnits("100000", 6));

      const status = await vault.getStatus();
      expect(status._totalReserves).to.equal(ethers.parseUnits("100000", 6));
      expect(status._isPaused).to.be.false;
    });
  });
});

// Mock ERC20 for testing
const MockERC20Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
`;
