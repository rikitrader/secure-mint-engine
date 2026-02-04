import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Script 02: Deploy TreasuryVault
 *
 * Prerequisites:
 * - 01_DeployOracle.ts must have been run
 * - Reserve asset (USDC) address for the network
 *
 * Environment Variables Required:
 * - RESERVE_ASSET: Address of reserve asset (e.g., USDC)
 * - ADMIN_ADDRESS: Admin multisig address
 * - TIER0_ALLOCATION through TIER3_ALLOCATION: Basis points (must sum to 10000)
 */

interface DeploymentConfig {
  reserveAsset: string;
  adminAddress: string;
  allocations: bigint[];
}

interface DeploymentResult {
  treasury: string;
  reserveAsset: string;
  allocations: string[];
  network: string;
  blockNumber: number;
  timestamp: number;
}

async function getConfig(): Promise<DeploymentConfig> {
  const networkName = network.name;

  // Network-specific USDC addresses
  const usdcAddresses: Record<string, string> = {
    mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    sepolia: process.env.USDC_SEPOLIA || "",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  };

  const reserveAsset = process.env.RESERVE_ASSET || usdcAddresses[networkName];
  if (!reserveAsset) {
    throw new Error(`No reserve asset configured for network: ${networkName}`);
  }

  const adminAddress = process.env.ADMIN_ADDRESS;
  if (!adminAddress) {
    throw new Error("ADMIN_ADDRESS not set in environment");
  }

  // Parse allocations (must sum to 10000 basis points)
  const allocations = [
    BigInt(process.env.TIER0_ALLOCATION || "1000"),  // 10% - HOT
    BigInt(process.env.TIER1_ALLOCATION || "2000"),  // 20% - WARM
    BigInt(process.env.TIER2_ALLOCATION || "5000"),  // 50% - COLD
    BigInt(process.env.TIER3_ALLOCATION || "2000"),  // 20% - RWA
  ];

  const sum = allocations.reduce((a, b) => a + b, 0n);
  if (sum !== 10000n) {
    throw new Error(`Allocations must sum to 10000 basis points, got ${sum}`);
  }

  return {
    reserveAsset,
    adminAddress,
    allocations,
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Treasury Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: ${network.name}`);
  console.log("");

  const config = await getConfig();
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  console.log("Configuration:");
  console.log("  Reserve Asset:", config.reserveAsset);
  console.log("  Admin Address:", config.adminAddress);
  console.log("  Allocations:");
  console.log("    Tier 0 (HOT):", config.allocations[0].toString(), "bp");
  console.log("    Tier 1 (WARM):", config.allocations[1].toString(), "bp");
  console.log("    Tier 2 (COLD):", config.allocations[2].toString(), "bp");
  console.log("    Tier 3 (RWA):", config.allocations[3].toString(), "bp");
  console.log("");

  // Deploy TreasuryVault
  console.log("Deploying TreasuryVault...");
  const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
  const treasury = await TreasuryVault.deploy(
    config.reserveAsset,
    config.adminAddress,
    config.allocations
  );

  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  const deployTx = treasury.deploymentTransaction();

  console.log("✓ TreasuryVault deployed to:", treasuryAddress);
  console.log("  Transaction hash:", deployTx?.hash);
  console.log("");

  // Verify initial state
  console.log("Verifying deployment...");
  const reserveAsset = await treasury.reserveAsset();
  const totalReserves = await treasury.totalReserves();
  const allocations = await treasury.getTargetAllocations();

  console.log("  Reserve Asset:", reserveAsset);
  console.log("  Total Reserves:", totalReserves.toString());
  console.log("  Target Allocations:", allocations.map(a => a.toString()).join(", "));
  console.log("");

  // Save deployment info
  const deploymentResult: DeploymentResult = {
    treasury: treasuryAddress,
    reserveAsset: config.reserveAsset,
    allocations: config.allocations.map(a => a.toString()),
    network: network.name,
    blockNumber: deployTx?.blockNumber || 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  writeFileSync(
    join(deploymentsDir, "02_Treasury.json"),
    JSON.stringify(deploymentResult, null, 2)
  );

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contract on block explorer");
  console.log("  2. Grant TREASURY_ADMIN_ROLE to governance");
  console.log("  3. Run 03_DeployToken.ts");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
