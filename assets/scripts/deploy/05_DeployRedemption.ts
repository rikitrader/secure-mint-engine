import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Script 05: Deploy RedemptionEngine
 *
 * Prerequisites:
 * - 01_DeployOracle.ts must have been run
 * - 02_DeployTreasury.ts must have been run
 * - 03_DeployToken.ts must have been run
 *
 * Environment Variables Required:
 * - ADMIN_ADDRESS: Admin multisig address
 */

interface DeploymentConfig {
  tokenAddress: string;
  reserveAsset: string;
  treasuryAddress: string;
  oracleAddress: string;
  adminAddress: string;
}

interface DeploymentResult {
  redemption: string;
  token: string;
  treasury: string;
  oracle: string;
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
  const oracleDeployment = await loadPreviousDeployment("01_Oracle.json");
  const treasuryDeployment = await loadPreviousDeployment("02_Treasury.json");
  const tokenDeployment = await loadPreviousDeployment("03_Token.json");

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    throw new Error("ADMIN_ADDRESS not set in environment");
  }

  return {
    tokenAddress: tokenDeployment.token,
    reserveAsset: treasuryDeployment.reserveAsset,
    treasuryAddress: treasuryDeployment.treasury,
    oracleAddress: oracleDeployment.oracle,
    adminAddress,
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Redemption Engine Deployment");
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
  console.log("  Reserve Asset:", config.reserveAsset);
  console.log("  Treasury Address:", config.treasuryAddress);
  console.log("  Oracle Address:", config.oracleAddress);
  console.log("  Admin Address:", config.adminAddress);
  console.log("");

  // Deploy RedemptionEngine
  console.log("Deploying RedemptionEngine...");
  const RedemptionEngine = await ethers.getContractFactory("RedemptionEngine");
  const redemption = await RedemptionEngine.deploy(
    config.tokenAddress,
    config.reserveAsset,
    config.treasuryAddress,
    config.oracleAddress,
    config.adminAddress
  );

  await redemption.waitForDeployment();
  const redemptionAddress = await redemption.getAddress();
  const deployTx = redemption.deploymentTransaction();

  console.log("✓ RedemptionEngine deployed to:", redemptionAddress);
  console.log("  Transaction hash:", deployTx?.hash);
  console.log("");

  // Grant treasury withdrawal role to redemption engine
  console.log("Granting treasury permissions to RedemptionEngine...");
  const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
  const treasury = TreasuryVault.attach(config.treasuryAddress);

  const REBALANCER_ROLE = await treasury.REBALANCER_ROLE();
  const grantTx = await treasury.grantRole(REBALANCER_ROLE, redemptionAddress);
  await grantTx.wait();

  console.log("✓ Treasury REBALANCER_ROLE granted to RedemptionEngine");
  console.log("");

  // Save deployment info
  const deploymentResult: DeploymentResult = {
    redemption: redemptionAddress,
    token: config.tokenAddress,
    treasury: config.treasuryAddress,
    oracle: config.oracleAddress,
    network: network.name,
    blockNumber: deployTx?.blockNumber || 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  writeFileSync(
    join(deploymentsDir, "05_Redemption.json"),
    JSON.stringify(deploymentResult, null, 2)
  );

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contract on block explorer");
  console.log("  2. Grant GUARDIAN_ROLE to guardian multisig");
  console.log("  3. Run 06_DeployGovernance.ts (optional)");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
