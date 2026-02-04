import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("EmergencyPause", function () {
  // Alert levels
  const NORMAL = 0;
  const ELEVATED = 1;
  const RESTRICTED = 2;
  const EMERGENCY = 3;
  const SHUTDOWN = 4;

  async function deployEmergencyPauseFixture() {
    const [admin, guardian, operator, user1] = await ethers.getSigners();

    const EmergencyPause = await ethers.getContractFactory("EmergencyPause");
    const pause = await EmergencyPause.deploy(admin.address);

    // Grant roles
    const GUARDIAN_ROLE = await pause.GUARDIAN_ROLE();
    const OPERATOR_ROLE = await pause.OPERATOR_ROLE();

    await pause.connect(admin).grantRole(GUARDIAN_ROLE, guardian.address);
    await pause.connect(admin).grantRole(OPERATOR_ROLE, operator.address);

    return { pause, admin, guardian, operator, user1 };
  }

  describe("Deployment", function () {
    it("Should start at NORMAL alert level", async function () {
      const { pause } = await loadFixture(deployEmergencyPauseFixture);
      expect(await pause.currentLevel()).to.equal(NORMAL);
    });

    it("Should not be paused initially", async function () {
      const { pause } = await loadFixture(deployEmergencyPauseFixture);
      expect(await pause.paused()).to.be.false;
    });
  });

  describe("Alert Level Changes", function () {
    it("Should allow guardian to escalate to ELEVATED", async function () {
      const { pause, guardian } = await loadFixture(deployEmergencyPauseFixture);

      await pause.connect(guardian).setAlertLevel(ELEVATED, "Suspicious activity");

      expect(await pause.currentLevel()).to.equal(ELEVATED);
    });

    it("Should allow guardian to escalate to EMERGENCY", async function () {
      const { pause, guardian } = await loadFixture(deployEmergencyPauseFixture);

      await pause.connect(guardian).setAlertLevel(EMERGENCY, "Critical issue");

      expect(await pause.currentLevel()).to.equal(EMERGENCY);
      expect(await pause.paused()).to.be.true;
    });

    it("Should emit AlertLevelChanged event", async function () {
      const { pause, guardian } = await loadFixture(deployEmergencyPauseFixture);

      await expect(pause.connect(guardian).setAlertLevel(ELEVATED, "Test"))
        .to.emit(pause, "AlertLevelChanged")
        .withArgs(NORMAL, ELEVATED, guardian.address, "Test");
    });

    it("Should revert if non-guardian tries to change level", async function () {
      const { pause, user1 } = await loadFixture(deployEmergencyPauseFixture);

      await expect(
        pause.connect(user1).setAlertLevel(ELEVATED, "Unauthorized")
      ).to.be.reverted;
    });

    it("Should allow de-escalation after cooldown", async function () {
      const { pause, guardian, admin } = await loadFixture(deployEmergencyPauseFixture);

      // Escalate
      await pause.connect(guardian).setAlertLevel(EMERGENCY, "Issue");

      // Advance time past cooldown
      await time.increase(3600 + 1);

      // De-escalate
      await pause.connect(admin).setAlertLevel(NORMAL, "Resolved");

      expect(await pause.currentLevel()).to.equal(NORMAL);
    });
  });

  describe("Shutdown Level", function () {
    it("Should require admin for SHUTDOWN", async function () {
      const { pause, admin } = await loadFixture(deployEmergencyPauseFixture);

      await pause.connect(admin).setAlertLevel(SHUTDOWN, "Total shutdown");

      expect(await pause.currentLevel()).to.equal(SHUTDOWN);
    });

    it("Should revert if guardian tries SHUTDOWN", async function () {
      const { pause, guardian } = await loadFixture(deployEmergencyPauseFixture);

      await expect(
        pause.connect(guardian).setAlertLevel(SHUTDOWN, "Unauthorized shutdown")
      ).to.be.revertedWithCustomError(pause, "ShutdownRequiresAdmin");
    });
  });

  describe("Auto-Trigger Conditions", function () {
    it("Should allow operator to register trigger conditions", async function () {
      const { pause, operator } = await loadFixture(deployEmergencyPauseFixture);

      const condition = ethers.encodeBytes32String("ORACLE_STALE");
      await pause.connect(operator).registerTrigger(condition, ELEVATED);

      expect(await pause.triggerLevels(condition)).to.equal(ELEVATED);
    });

    it("Should allow triggering registered condition", async function () {
      const { pause, operator } = await loadFixture(deployEmergencyPauseFixture);

      const condition = ethers.encodeBytes32String("ORACLE_STALE");
      await pause.connect(operator).registerTrigger(condition, EMERGENCY);

      await pause.connect(operator).triggerCondition(condition);

      expect(await pause.currentLevel()).to.equal(EMERGENCY);
    });
  });

  describe("Operation Restrictions", function () {
    it("Should check if operations are allowed at current level", async function () {
      const { pause, guardian } = await loadFixture(deployEmergencyPauseFixture);

      // At NORMAL, all operations should be allowed
      expect(await pause.isOperationAllowed(0)).to.be.true; // MINT
      expect(await pause.isOperationAllowed(1)).to.be.true; // REDEEM
      expect(await pause.isOperationAllowed(2)).to.be.true; // TRANSFER

      // Escalate to RESTRICTED
      await pause.connect(guardian).setAlertLevel(RESTRICTED, "Test");

      // Check restrictions
      expect(await pause.isOperationAllowed(0)).to.be.false; // MINT blocked
      expect(await pause.isOperationAllowed(1)).to.be.true;  // REDEEM allowed
    });
  });

  describe("View Functions", function () {
    it("Should return current status", async function () {
      const { pause } = await loadFixture(deployEmergencyPauseFixture);

      const status = await pause.getStatus();

      expect(status.level).to.equal(NORMAL);
      expect(status.isPaused).to.be.false;
    });

    it("Should return level history", async function () {
      const { pause, guardian } = await loadFixture(deployEmergencyPauseFixture);

      await pause.connect(guardian).setAlertLevel(ELEVATED, "First");
      await pause.connect(guardian).setAlertLevel(RESTRICTED, "Second");

      const history = await pause.getRecentHistory(2);

      expect(history.length).to.equal(2);
    });
  });
});
