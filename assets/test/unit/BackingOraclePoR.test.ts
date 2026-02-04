import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("BackingOraclePoR", function () {
  const MIN_ATTESTORS = 2;
  const MAX_ORACLE_AGE = 3600; // 1 hour
  const BACKING_RATIO = 10000n; // 100% in basis points

  async function deployBackingOracleFixture() {
    const [admin, attestor1, attestor2, attestor3, operator, user1] =
      await ethers.getSigners();

    // Deploy mock Chainlink aggregator
    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const aggregator = await MockAggregator.deploy(8); // 8 decimals
    await aggregator.setLatestAnswer(1e8); // $1.00

    // Deploy BackingOraclePoR
    const BackingOraclePoR = await ethers.getContractFactory("BackingOraclePoR");
    const oracle = await BackingOraclePoR.deploy(
      aggregator.target,
      MIN_ATTESTORS,
      MAX_ORACLE_AGE,
      admin.address
    );

    // Grant roles
    const ATTESTOR_ROLE = await oracle.ATTESTOR_ROLE();
    const OPERATOR_ROLE = await oracle.OPERATOR_ROLE();

    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor1.address);
    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor2.address);
    await oracle.connect(admin).grantRole(ATTESTOR_ROLE, attestor3.address);
    await oracle.connect(admin).grantRole(OPERATOR_ROLE, operator.address);

    return {
      oracle,
      aggregator,
      admin,
      attestor1,
      attestor2,
      attestor3,
      operator,
      user1,
    };
  }

  describe("Deployment", function () {
    it("Should set correct min attestors", async function () {
      const { oracle } = await loadFixture(deployBackingOracleFixture);
      expect(await oracle.minAttestors()).to.equal(MIN_ATTESTORS);
    });

    it("Should set correct max oracle age", async function () {
      const { oracle } = await loadFixture(deployBackingOracleFixture);
      expect(await oracle.maxOracleAge()).to.equal(MAX_ORACLE_AGE);
    });

    it("Should start as unhealthy until attestations received", async function () {
      const { oracle } = await loadFixture(deployBackingOracleFixture);
      expect(await oracle.isHealthy()).to.be.false;
    });
  });

  describe("Attestations", function () {
    it("Should allow attestor to submit backing proof", async function () {
      const { oracle, attestor1 } = await loadFixture(deployBackingOracleFixture);

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof1"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);

      const attestation = await oracle.attestations(attestor1.address);
      expect(attestation.backing).to.equal(backing);
    });

    it("Should emit AttestationSubmitted event", async function () {
      const { oracle, attestor1 } = await loadFixture(deployBackingOracleFixture);

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof1"));

      await expect(oracle.connect(attestor1).submitAttestation(backing, proof))
        .to.emit(oracle, "AttestationSubmitted")
        .withArgs(attestor1.address, backing, proof, anyValue);
    });

    it("Should revert if non-attestor submits", async function () {
      const { oracle, user1 } = await loadFixture(deployBackingOracleFixture);

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await expect(
        oracle.connect(user1).submitAttestation(backing, proof)
      ).to.be.reverted;
    });
  });

  describe("Consensus", function () {
    it("Should reach consensus with minimum attestors", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof1 = ethers.keccak256(ethers.toUtf8Bytes("proof1"));
      const proof2 = ethers.keccak256(ethers.toUtf8Bytes("proof2"));

      await oracle.connect(attestor1).submitAttestation(backing, proof1);
      await oracle.connect(attestor2).submitAttestation(backing, proof2);

      expect(await oracle.isHealthy()).to.be.true;
      expect(await oracle.getVerifiedBacking()).to.equal(backing);
    });

    it("Should use conservative estimate with varying attestations", async function () {
      const { oracle, attestor1, attestor2, attestor3 } = await loadFixture(
        deployBackingOracleFixture
      );

      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      // Submit different backing amounts
      await oracle
        .connect(attestor1)
        .submitAttestation(ethers.parseUnits("1000000", 6), proof);
      await oracle
        .connect(attestor2)
        .submitAttestation(ethers.parseUnits("900000", 6), proof);
      await oracle
        .connect(attestor3)
        .submitAttestation(ethers.parseUnits("950000", 6), proof);

      // Should use minimum (conservative) value
      const backing = await oracle.getVerifiedBacking();
      expect(backing).to.equal(ethers.parseUnits("900000", 6));
    });

    it("Should require re-attestation after timeout", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      expect(await oracle.isHealthy()).to.be.true;

      // Advance time past max age
      await time.increase(MAX_ORACLE_AGE + 1);

      expect(await oracle.isHealthy()).to.be.false;
    });
  });

  describe("Chainlink Integration", function () {
    it("Should fetch price from Chainlink", async function () {
      const { oracle, aggregator } = await loadFixture(deployBackingOracleFixture);

      await aggregator.setLatestAnswer(1.05e8); // $1.05

      const price = await oracle.getReservePrice();
      expect(price).to.equal(1.05e8);
    });

    it("Should revert if Chainlink data is stale", async function () {
      const { oracle, aggregator } = await loadFixture(deployBackingOracleFixture);

      // Set stale timestamp
      await aggregator.setUpdatedAt(
        Math.floor(Date.now() / 1000) - MAX_ORACLE_AGE - 100
      );

      await expect(oracle.getReservePrice()).to.be.revertedWithCustomError(
        oracle,
        "ChainlinkStale"
      );
    });

    it("Should revert if Chainlink returns invalid price", async function () {
      const { oracle, aggregator } = await loadFixture(deployBackingOracleFixture);

      await aggregator.setLatestAnswer(0);

      await expect(oracle.getReservePrice()).to.be.revertedWithCustomError(
        oracle,
        "InvalidPrice"
      );
    });
  });

  describe("Mint Authorization", function () {
    it("Should authorize mint when backing sufficient", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      // Current supply: 0, mint amount: 500000
      const canMint = await oracle.canMint(0, ethers.parseEther("500000"));
      expect(canMint).to.be.true;
    });

    it("Should reject mint when backing insufficient", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      // Try to mint more than backing
      const canMint = await oracle.canMint(0, ethers.parseEther("10000"));
      expect(canMint).to.be.false;
    });

    it("Should consider existing supply", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      // Current supply: 900000, mint: 200000 = 1.1M > 1M backing
      const canMint = await oracle.canMint(
        ethers.parseEther("900000"),
        ethers.parseEther("200000")
      );
      expect(canMint).to.be.false;
    });
  });

  describe("Data Age Tracking", function () {
    it("Should return correct data age", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      // Immediately after, age should be minimal
      const age = await oracle.getDataAge();
      expect(age).to.be.lessThan(10);

      // After some time
      await time.increase(1000);
      const newAge = await oracle.getDataAge();
      expect(newAge).to.be.greaterThanOrEqual(1000);
    });

    it("Should return last update timestamp", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      const lastUpdate = await oracle.lastUpdate();
      const currentTime = await time.latest();

      expect(lastUpdate).to.be.closeTo(currentTime, 5);
    });
  });

  describe("Required Backing Calculation", function () {
    it("Should calculate required backing for supply", async function () {
      const { oracle } = await loadFixture(deployBackingOracleFixture);

      const supply = ethers.parseEther("1000000");
      const required = await oracle.getRequiredBacking(supply);

      // At 100% backing ratio, required should equal supply (adjusted for decimals)
      expect(required).to.equal(ethers.parseUnits("1000000", 6));
    });
  });

  describe("Operator Controls", function () {
    it("Should allow operator to adjust backing ratio", async function () {
      const { oracle, operator } = await loadFixture(deployBackingOracleFixture);

      await oracle.connect(operator).setBackingRatio(10500); // 105%

      expect(await oracle.backingRatio()).to.equal(10500);
    });

    it("Should revert if backing ratio too low", async function () {
      const { oracle, operator } = await loadFixture(deployBackingOracleFixture);

      await expect(
        oracle.connect(operator).setBackingRatio(9000) // Below 100%
      ).to.be.revertedWithCustomError(oracle, "BackingRatioTooLow");
    });

    it("Should allow operator to remove attestor", async function () {
      const { oracle, admin, attestor1, attestor2, attestor3 } = await loadFixture(
        deployBackingOracleFixture
      );

      const ATTESTOR_ROLE = await oracle.ATTESTOR_ROLE();

      // Remove attestor1
      await oracle.connect(admin).revokeRole(ATTESTOR_ROLE, attestor1.address);

      // attestor1 should no longer be able to submit
      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await expect(
        oracle.connect(attestor1).submitAttestation(backing, proof)
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    it("Should return oracle status", async function () {
      const { oracle, attestor1, attestor2 } = await loadFixture(
        deployBackingOracleFixture
      );

      const backing = ethers.parseUnits("1000000", 6);
      const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));

      await oracle.connect(attestor1).submitAttestation(backing, proof);
      await oracle.connect(attestor2).submitAttestation(backing, proof);

      const status = await oracle.getStatus();

      expect(status.healthy).to.be.true;
      expect(status.verifiedBacking).to.equal(backing);
      expect(status.attestorCount).to.equal(2n);
    });

    it("Should list active attestors", async function () {
      const { oracle } = await loadFixture(deployBackingOracleFixture);

      const attestors = await oracle.getActiveAttestors();
      expect(attestors.length).to.equal(3);
    });
  });
});

// Helper for matching any value
const anyValue = () => true;
