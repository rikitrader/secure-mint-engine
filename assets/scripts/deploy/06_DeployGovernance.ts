import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Script 06: Deploy Governance (Timelock + Governor)
 *
 * Prerequisites:
 * - 03_DeployToken.ts must have been run
 * - 04_DeployPolicy.ts must have been run
 *
 * Environment Variables Required:
 * - GUARDIAN_MULTISIG: Guardian address with veto power
 * - VOTING_DELAY: Blocks before voting starts
 * - VOTING_PERIOD: Blocks voting is open
 * - PROPOSAL_THRESHOLD: Tokens required to propose
 * - QUORUM_PERCENTAGE: Percentage of tokens for quorum
 */

interface DeploymentConfig {
  tokenAddress: string;
  guardianAddress: string;
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: bigint;
  quorumPercentage: number;
  standardDelay: number;
  criticalDelay: number;
  emergencyDelay: number;
}

interface DeploymentResult {
  timelock: string;
  governor: string;
  token: string;
  guardian: string;
  network: string;
  blockNumber: number;
  timestamp: number;
}

async function loadPreviousDeployment(filename: string): Promise<any> {
  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  const filepath = join(deploymentsDir, filename);

  if (!existsSync(filepath)) {
    throw new Error(`Deployment file not found: ${filepath}. Run previous deployment scripts first.`);
  }

  return JSON.parse(readFileSync(filepath, "utf-8"));
}

async function getConfig(): Promise<DeploymentConfig> {
  const tokenDeployment = await loadPreviousDeployment("03_Token.json");

  const guardianAddress = process.env.GUARDIAN_MULTISIG;
  if (!guardianAddress) {
    throw new Error("GUARDIAN_MULTISIG not set in environment");
  }

  return {
    tokenAddress: tokenDeployment.token,
    guardianAddress,
    votingDelay: parseInt(process.env.VOTING_DELAY || "7200"),      // ~1 day @ 12s blocks
    votingPeriod: parseInt(process.env.VOTING_PERIOD || "50400"),   // ~1 week
    proposalThreshold: BigInt(process.env.PROPOSAL_THRESHOLD || ethers.parseEther("100000").toString()),
    quorumPercentage: parseInt(process.env.QUORUM_PERCENTAGE || "4"),
    standardDelay: parseInt(process.env.STANDARD_DELAY || "172800"),   // 48 hours
    criticalDelay: parseInt(process.env.CRITICAL_DELAY || "259200"),   // 72 hours
    emergencyDelay: parseInt(process.env.EMERGENCY_DELAY || "86400"),  // 24 hours
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Governance Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: ${network.name}`);
  console.log("");

  const config = await getConfig();
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  console.log("Configuration:");
  console.log("  Token Address:", config.tokenAddress);
  console.log("  Guardian Address:", config.guardianAddress);
  console.log("  Voting Delay:", config.votingDelay, "blocks");
  console.log("  Voting Period:", config.votingPeriod, "blocks");
  console.log("  Proposal Threshold:", ethers.formatEther(config.proposalThreshold), "tokens");
  console.log("  Quorum Percentage:", config.quorumPercentage, "%");
  console.log("  Standard Delay:", config.standardDelay, "seconds");
  console.log("  Critical Delay:", config.criticalDelay, "seconds");
  console.log("  Emergency Delay:", config.emergencyDelay, "seconds");
  console.log("");

  // Deploy Timelock
  console.log("Deploying SecureMintTimelock...");
  const SecureMintTimelock = await ethers.getContractFactory("SecureMintTimelock");
  const timelock = await SecureMintTimelock.deploy(
    config.standardDelay,
    config.criticalDelay,
    config.emergencyDelay,
    [], // proposers - will add governor
    [], // executors - will add governor
    deployer.address // admin - will be transferred
  );

  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("✓ SecureMintTimelock deployed to:", timelockAddress);
  console.log("");

  // Deploy Governor
  console.log("Deploying SecureMintGovernor...");
  const SecureMintGovernor = await ethers.getContractFactory("SecureMintGovernor");
  const governor = await SecureMintGovernor.deploy(
    config.tokenAddress,
    timelockAddress,
    config.guardianAddress,
    config.votingDelay,
    config.votingPeriod,
    config.proposalThreshold,
    config.quorumPercentage
  );

  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  const deployTx = governor.deploymentTransaction();

  console.log("✓ SecureMintGovernor deployed to:", governorAddress);
  console.log("");

  // Configure timelock roles
  console.log("Configuring timelock roles...");

  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

  // Grant roles to governor
  await (await timelock.grantRole(PROPOSER_ROLE, governorAddress)).wait();
  await (await timelock.grantRole(EXECUTOR_ROLE, governorAddress)).wait();
  await (await timelock.grantRole(CANCELLER_ROLE, governorAddress)).wait();

  // Grant executor role to address(0) for open execution
  await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();

  console.log("✓ Timelock roles configured");
  console.log("");

  // Renounce admin role (governance now in control)
  console.log("Renouncing deployer admin role...");
  await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();
  console.log("✓ Deployer admin role renounced");
  console.log("");

  // Save deployment info
  const deploymentResult: DeploymentResult = {
    timelock: timelockAddress,
    governor: governorAddress,
    token: config.tokenAddress,
    guardian: config.guardianAddress,
    network: network.name,
    blockNumber: deployTx?.blockNumber || 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  writeFileSync(
    join(deploymentsDir, "06_Governance.json"),
    JSON.stringify(deploymentResult, null, 2)
  );

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("IMPORTANT: Transfer policy GOVERNOR_ROLE to timelock:");
  console.log(`  policy.grantRole(GOVERNOR_ROLE, ${timelockAddress})`);
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contracts on block explorer");
  console.log("  2. Transfer admin roles to timelock/governor");
  console.log("  3. Run 07_VerifyAll.ts to verify deployment");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
