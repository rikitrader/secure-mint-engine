import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Script 03: Deploy BackedToken
 *
 * Prerequisites:
 * - Guardian multisig address
 *
 * Environment Variables Required:
 * - TOKEN_NAME: Name of the token (e.g., "USD Backed Token")
 * - TOKEN_SYMBOL: Symbol of the token (e.g., "USDB")
 * - GUARDIAN_MULTISIG: Guardian address for pause controls
 */

interface DeploymentConfig {
  tokenName: string;
  tokenSymbol: string;
  guardianAddress: string;
}

interface DeploymentResult {
  token: string;
  name: string;
  symbol: string;
  guardian: string;
  network: string;
  blockNumber: number;
  timestamp: number;
}

async function getConfig(): Promise<DeploymentConfig> {
  const tokenName = process.env.TOKEN_NAME || "USD Backed Token";
  const tokenSymbol = process.env.TOKEN_SYMBOL || "USDB";
  const guardianAddress = process.env.GUARDIAN_MULTISIG;

  if (!guardianAddress) {
    throw new Error("GUARDIAN_MULTISIG not set in environment");
  }

  return {
    tokenName,
    tokenSymbol,
    guardianAddress,
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Token Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: ${network.name}`);
  console.log("");

  const config = await getConfig();
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  console.log("Configuration:");
  console.log("  Token Name:", config.tokenName);
  console.log("  Token Symbol:", config.tokenSymbol);
  console.log("  Guardian Address:", config.guardianAddress);
  console.log("");

  // Deploy with placeholder secureMintPolicy (will be updated after policy deployment)
  // Using deployer as temporary placeholder
  console.log("Deploying BackedToken...");
  console.log("  NOTE: secureMintPolicy will be set to deployer temporarily");
  console.log("        Update after SecureMintPolicy deployment");
  console.log("");

  const BackedToken = await ethers.getContractFactory("BackedToken");
  const token = await BackedToken.deploy(
    config.tokenName,
    config.tokenSymbol,
    deployer.address, // Temporary - will be updated
    config.guardianAddress
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const deployTx = token.deploymentTransaction();

  console.log("✓ BackedToken deployed to:", tokenAddress);
  console.log("  Transaction hash:", deployTx?.hash);
  console.log("");

  // Verify initial state
  console.log("Verifying deployment...");
  const name = await token.name();
  const symbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  const guardian = await token.guardian();

  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Total Supply:", totalSupply.toString());
  console.log("  Guardian:", guardian);
  console.log("");

  // Save deployment info
  const deploymentResult: DeploymentResult = {
    token: tokenAddress,
    name: config.tokenName,
    symbol: config.tokenSymbol,
    guardian: config.guardianAddress,
    network: network.name,
    blockNumber: deployTx?.blockNumber || 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  writeFileSync(
    join(deploymentsDir, "03_Token.json"),
    JSON.stringify(deploymentResult, null, 2)
  );

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("IMPORTANT: After deploying SecureMintPolicy, update the token:");
  console.log("  token.setSecureMintPolicy(<policy_address>)");
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contract on block explorer");
  console.log("  2. Run 04_DeployPolicy.ts");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
