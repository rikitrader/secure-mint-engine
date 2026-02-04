import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Script 01: Deploy BackingOraclePoR
 *
 * Prerequisites:
 * - Chainlink price feed address for the network
 * - Admin multisig address
 *
 * Environment Variables Required:
 * - CHAINLINK_POR_FEED: Chainlink Proof-of-Reserve feed address
 * - ADMIN_ADDRESS: Admin/deployer address with initial roles
 */

interface DeploymentConfig {
  chainlinkFeed: string;
  minAttestors: number;
  maxOracleAge: number;
  adminAddress: string;
}

interface DeploymentResult {
  oracle: string;
  chainlinkFeed: string;
  network: string;
  blockNumber: number;
  timestamp: number;
}

async function getConfig(): Promise<DeploymentConfig> {
  const networkName = network.name;

  // Network-specific Chainlink feeds
  const chainlinkFeeds: Record<string, string> = {
    mainnet: process.env.CHAINLINK_USDC_USD_FEED || "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    sepolia: process.env.CHAINLINK_USDC_USD_FEED_SEPOLIA || "",
    arbitrum: process.env.CHAINLINK_USDC_USD_FEED_ARB || "",
    polygon: process.env.CHAINLINK_USDC_USD_FEED_POLYGON || "",
  };

  const chainlinkFeed = chainlinkFeeds[networkName];
  if (!chainlinkFeed) {
    throw new Error(`No Chainlink feed configured for network: ${networkName}`);
  }

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    throw new Error("ADMIN_ADDRESS not set in environment");
  }

  return {
    chainlinkFeed,
    minAttestors: parseInt(process.env.MIN_ATTESTORS || "2"),
    maxOracleAge: parseInt(process.env.MAX_ORACLE_AGE || "3600"),
    adminAddress,
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Oracle Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
  console.log("");

  const config = await getConfig();
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  console.log("Configuration:");
  console.log("  Chainlink Feed:", config.chainlinkFeed);
  console.log("  Min Attestors:", config.minAttestors);
  console.log("  Max Oracle Age:", config.maxOracleAge, "seconds");
  console.log("  Admin Address:", config.adminAddress);
  console.log("");

  // Deploy BackingOraclePoR
  console.log("Deploying BackingOraclePoR...");
  const BackingOraclePoR = await ethers.getContractFactory("BackingOraclePoR");
  const oracle = await BackingOraclePoR.deploy(
    config.chainlinkFeed,
    config.minAttestors,
    config.maxOracleAge,
    config.adminAddress
  );

  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  const deployTx = oracle.deploymentTransaction();

  console.log("✓ BackingOraclePoR deployed to:", oracleAddress);
  console.log("  Transaction hash:", deployTx?.hash);
  console.log("  Gas used:", deployTx?.gasLimit.toString());
  console.log("");

  // Save deployment info
  const deploymentResult: DeploymentResult = {
    oracle: oracleAddress,
    chainlinkFeed: config.chainlinkFeed,
    network: network.name,
    blockNumber: deployTx?.blockNumber || 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  writeFileSync(
    join(deploymentsDir, "01_Oracle.json"),
    JSON.stringify(deploymentResult, null, 2)
  );

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contract on block explorer");
  console.log("  2. Grant ATTESTOR_ROLE to authorized attestors");
  console.log("  3. Run 02_DeployTreasury.ts");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
