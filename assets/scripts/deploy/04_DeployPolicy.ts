import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Script 04: Deploy SecureMintPolicy
 *
 * Prerequisites:
 * - 01_DeployOracle.ts must have been run
 * - 03_DeployToken.ts must have been run
 *
 * Environment Variables Required:
 * - GLOBAL_SUPPLY_CAP: Maximum total supply (in wei)
 * - EPOCH_MINT_CAP: Maximum mint per epoch (in wei)
 * - MAX_ORACLE_AGE: Maximum oracle data age (seconds)
 * - ADMIN_ADDRESS: Admin multisig address
 */

interface DeploymentConfig {
  tokenAddress: string;
  oracleAddress: string;
  globalSupplyCap: bigint;
  epochMintCap: bigint;
  maxOracleAge: number;
  adminAddress: string;
}

interface DeploymentResult {
  policy: string;
  token: string;
  oracle: string;
  globalSupplyCap: string;
  epochMintCap: string;
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
  // Load previous deployments
  const oracleDeployment = await loadPreviousDeployment("01_Oracle.json");
  const tokenDeployment = await loadPreviousDeployment("03_Token.json");

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    throw new Error("ADMIN_ADDRESS not set in environment");
  }

  return {
    tokenAddress: tokenDeployment.token,
    oracleAddress: oracleDeployment.oracle,
    globalSupplyCap: BigInt(process.env.GLOBAL_SUPPLY_CAP || ethers.parseEther("1000000000").toString()),
    epochMintCap: BigInt(process.env.EPOCH_MINT_CAP || ethers.parseEther("10000000").toString()),
    maxOracleAge: parseInt(process.env.MAX_ORACLE_AGE || "3600"),
    adminAddress,
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Policy Deployment");
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
  console.log("  Oracle Address:", config.oracleAddress);
  console.log("  Global Supply Cap:", ethers.formatEther(config.globalSupplyCap), "tokens");
  console.log("  Epoch Mint Cap:", ethers.formatEther(config.epochMintCap), "tokens");
  console.log("  Max Oracle Age:", config.maxOracleAge, "seconds");
  console.log("  Admin Address:", config.adminAddress);
  console.log("");

  // Deploy SecureMintPolicy
  console.log("Deploying SecureMintPolicy...");
  const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
  const policy = await SecureMintPolicy.deploy(
    config.tokenAddress,
    config.oracleAddress,
    config.globalSupplyCap,
    config.epochMintCap,
    config.maxOracleAge,
    config.adminAddress
  );

  await policy.waitForDeployment();
  const policyAddress = await policy.getAddress();
  const deployTx = policy.deploymentTransaction();

  console.log("✓ SecureMintPolicy deployed to:", policyAddress);
  console.log("  Transaction hash:", deployTx?.hash);
  console.log("");

  // Update token to use this policy
  console.log("Updating token to use SecureMintPolicy...");
  const BackedToken = await ethers.getContractFactory("BackedToken");
  const token = BackedToken.attach(config.tokenAddress);

  const updateTx = await token.setSecureMintPolicy(policyAddress);
  await updateTx.wait();

  console.log("✓ Token secureMintPolicy updated");
  console.log("  Transaction hash:", updateTx.hash);
  console.log("");

  // Verify state
  console.log("Verifying deployment...");
  const tokenFromPolicy = await policy.token();
  const oracleFromPolicy = await policy.oracle();
  const globalCap = await policy.GLOBAL_SUPPLY_CAP();
  const epochCap = await policy.epochMintCap();

  console.log("  Policy token:", tokenFromPolicy);
  console.log("  Policy oracle:", oracleFromPolicy);
  console.log("  Global cap:", ethers.formatEther(globalCap));
  console.log("  Epoch cap:", ethers.formatEther(epochCap));
  console.log("");

  // Save deployment info
  const deploymentResult: DeploymentResult = {
    policy: policyAddress,
    token: config.tokenAddress,
    oracle: config.oracleAddress,
    globalSupplyCap: config.globalSupplyCap.toString(),
    epochMintCap: config.epochMintCap.toString(),
    network: network.name,
    blockNumber: deployTx?.blockNumber || 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  writeFileSync(
    join(deploymentsDir, "04_Policy.json"),
    JSON.stringify(deploymentResult, null, 2)
  );

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contract on block explorer");
  console.log("  2. Grant MINTER_ROLE to authorized minters");
  console.log("  3. Grant GUARDIAN_ROLE to guardian multisig");
  console.log("  4. Grant GOVERNOR_ROLE to governance/timelock");
  console.log("  5. Run 05_DeployRedemption.ts");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
