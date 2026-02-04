import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BackedToken } from "../../typechain-types";

describe("BackedToken", function () {
  // Fixture to deploy the contract
  async function deployBackedTokenFixture() {
    const [owner, secureMintPolicy, guardian, user1, user2] = await ethers.getSigners();

    const BackedToken = await ethers.getContractFactory("BackedToken");
    const token = await BackedToken.deploy(
      "USD Backed Token",
      "USDB",
      secureMintPolicy.address,
      guardian.address
    );

    return { token, owner, secureMintPolicy, guardian, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { token } = await loadFixture(deployBackedTokenFixture);

      expect(await token.name()).to.equal("USD Backed Token");
      expect(await token.symbol()).to.equal("USDB");
    });

    it("Should set the correct secureMintPolicy address", async function () {
      const { token, secureMintPolicy } = await loadFixture(deployBackedTokenFixture);

      expect(await token.secureMintPolicy()).to.equal(secureMintPolicy.address);
    });

    it("Should set the correct guardian address", async function () {
      const { token, guardian } = await loadFixture(deployBackedTokenFixture);

      expect(await token.guardian()).to.equal(guardian.address);
    });

    it("Should start with zero total supply", async function () {
      const { token } = await loadFixture(deployBackedTokenFixture);

      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should revert if secureMintPolicy is zero address", async function () {
      const [_, __, guardian] = await ethers.getSigners();
      const BackedToken = await ethers.getContractFactory("BackedToken");

      await expect(
        BackedToken.deploy("Test", "TST", ethers.ZeroAddress, guardian.address)
      ).to.be.revertedWithCustomError(BackedToken, "ZeroAddress");
    });

    it("Should revert if guardian is zero address", async function () {
      const [_, secureMintPolicy] = await ethers.getSigners();
      const BackedToken = await ethers.getContractFactory("BackedToken");

      await expect(
        BackedToken.deploy("Test", "TST", secureMintPolicy.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(BackedToken, "ZeroAddress");
    });
  });

  describe("Minting", function () {
    it("Should allow secureMintPolicy to mint tokens", async function () {
      const { token, secureMintPolicy, user1 } = await loadFixture(deployBackedTokenFixture);

      const mintAmount = ethers.parseEther("1000");
      await token.connect(secureMintPolicy).mint(user1.address, mintAmount);

      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await token.totalSupply()).to.equal(mintAmount);
    });

    it("Should emit SecureMint event on mint", async function () {
      const { token, secureMintPolicy, user1 } = await loadFixture(deployBackedTokenFixture);

      const mintAmount = ethers.parseEther("1000");

      await expect(token.connect(secureMintPolicy).mint(user1.address, mintAmount))
        .to.emit(token, "SecureMint")
        .withArgs(user1.address, mintAmount, mintAmount);
    });

    it("Should revert if non-secureMintPolicy tries to mint", async function () {
      const { token, user1, user2 } = await loadFixture(deployBackedTokenFixture);

      const mintAmount = ethers.parseEther("1000");

      await expect(
        token.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(token, "OnlySecureMint");
    });

    it("Should revert if minting when paused", async function () {
      const { token, secureMintPolicy, guardian, user1 } = await loadFixture(
        deployBackedTokenFixture
      );

      // Pause the contract
      await token.connect(guardian).pause();

      const mintAmount = ethers.parseEther("1000");

      await expect(
        token.connect(secureMintPolicy).mint(user1.address, mintAmount)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      const { token, secureMintPolicy, user1 } = await loadFixture(deployBackedTokenFixture);

      const mintAmount = ethers.parseEther("1000");
      await token.connect(secureMintPolicy).mint(user1.address, mintAmount);

      const burnAmount = ethers.parseEther("300");
      await token.connect(user1).burn(burnAmount);

      expect(await token.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
    });

    it("Should revert if burning more than balance", async function () {
      const { token, secureMintPolicy, user1 } = await loadFixture(deployBackedTokenFixture);

      const mintAmount = ethers.parseEther("1000");
      await token.connect(secureMintPolicy).mint(user1.address, mintAmount);

      const burnAmount = ethers.parseEther("2000");

      await expect(token.connect(user1).burn(burnAmount)).to.be.revertedWith(
        "ERC20: burn amount exceeds balance"
      );
    });
  });

  describe("Pause Controls", function () {
    it("Should allow guardian to pause", async function () {
      const { token, guardian } = await loadFixture(deployBackedTokenFixture);

      await token.connect(guardian).pause();

      expect(await token.paused()).to.be.true;
    });

    it("Should allow guardian to unpause", async function () {
      const { token, guardian } = await loadFixture(deployBackedTokenFixture);

      await token.connect(guardian).pause();
      await token.connect(guardian).unpause();

      expect(await token.paused()).to.be.false;
    });

    it("Should revert if non-guardian tries to pause", async function () {
      const { token, user1 } = await loadFixture(deployBackedTokenFixture);

      await expect(token.connect(user1).pause()).to.be.revertedWithCustomError(
        token,
        "OnlyGuardian"
      );
    });

    it("Should block transfers when paused", async function () {
      const { token, secureMintPolicy, guardian, user1, user2 } = await loadFixture(
        deployBackedTokenFixture
      );

      // Mint tokens first
      const mintAmount = ethers.parseEther("1000");
      await token.connect(secureMintPolicy).mint(user1.address, mintAmount);

      // Pause
      await token.connect(guardian).pause();

      // Try to transfer
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Guardian Management", function () {
    it("Should allow guardian to change guardian", async function () {
      const { token, guardian, user1 } = await loadFixture(deployBackedTokenFixture);

      await expect(token.connect(guardian).setGuardian(user1.address))
        .to.emit(token, "GuardianChanged")
        .withArgs(guardian.address, user1.address);

      expect(await token.guardian()).to.equal(user1.address);
    });

    it("Should revert if non-guardian tries to change guardian", async function () {
      const { token, user1, user2 } = await loadFixture(deployBackedTokenFixture);

      await expect(
        token.connect(user1).setGuardian(user2.address)
      ).to.be.revertedWithCustomError(token, "OnlyGuardian");
    });

    it("Should revert if setting guardian to zero address", async function () {
      const { token, guardian } = await loadFixture(deployBackedTokenFixture);

      await expect(
        token.connect(guardian).setGuardian(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });
  });

  describe("Transfers", function () {
    it("Should allow transfers when not paused", async function () {
      const { token, secureMintPolicy, user1, user2 } = await loadFixture(
        deployBackedTokenFixture
      );

      const mintAmount = ethers.parseEther("1000");
      await token.connect(secureMintPolicy).mint(user1.address, mintAmount);

      const transferAmount = ethers.parseEther("100");
      await token.connect(user1).transfer(user2.address, transferAmount);

      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await token.balanceOf(user1.address)).to.equal(mintAmount - transferAmount);
    });

    it("Should allow approved transfers", async function () {
      const { token, secureMintPolicy, user1, user2, owner } = await loadFixture(
        deployBackedTokenFixture
      );

      const mintAmount = ethers.parseEther("1000");
      await token.connect(secureMintPolicy).mint(user1.address, mintAmount);

      const transferAmount = ethers.parseEther("100");
      await token.connect(user1).approve(owner.address, transferAmount);
      await token.connect(owner).transferFrom(user1.address, user2.address, transferAmount);

      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
    });
  });
});
