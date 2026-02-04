import { ethers, network, run } from "hardhat";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Script 07: Verify All Deployed Contracts
 *
 * This script verifies all deployed contracts on block explorers
 * and performs a comprehensive system health check.
 */

interface AllDeployments {
  oracle?: any;
  treasury?: any;
  token?: any;
  policy?: any;
  redemption?: any;
  governance?: any;
}

async function loadAllDeployments(): Promise<AllDeployments> {
  const deploymentsDir = join(__dirname, "../../deployments", network.name);
  const deployments: AllDeployments = {};

  const files = [
    { key: "oracle", file: "01_Oracle.json" },
    { key: "treasury", file: "02_Treasury.json" },
    { key: "token", file: "03_Token.json" },
    { key: "policy", file: "04_Policy.json" },
    { key: "redemption", file: "05_Redemption.json" },
    { key: "governance", file: "06_Governance.json" },
  ];

  for (const { key, file } of files) {
    const filepath = join(deploymentsDir, file);
    if (existsSync(filepath)) {
      (deployments as any)[key] = JSON.parse(readFileSync(filepath, "utf-8"));
    }
  }

  return deployments;
}

async function verifyContract(
  address: string,
  constructorArgs: any[],
  contractName: string
): Promise<boolean> {
  console.log(`Verifying ${contractName} at ${address}...`);

  try {
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`✓ ${contractName} verified successfully`);
    return true;
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log(`✓ ${contractName} already verified`);
      return true;
    }
    console.error(`✗ ${contractName} verification failed:`, error.message);
    return false;
  }
}

async function performHealthCheck(deployments: AllDeployments): Promise<void> {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  System Health Check");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  let healthyCount = 0;
  let totalChecks = 0;

  // Check Oracle
  if (deployments.oracle) {
    totalChecks++;
    try {
      const BackingOraclePoR = await ethers.getContractFactory("BackingOraclePoR");
      const oracle = BackingOraclePoR.attach(deployments.oracle.oracle);

      const isHealthy = await oracle.isHealthy();
      const backing = await oracle.getVerifiedBacking();
      const dataAge = await oracle.getDataAge();

      console.log("Oracle Status:");
      console.log(`  Healthy: ${isHealthy ? "✓ Yes" : "✗ No"}`);
      console.log(`  Verified Backing: ${ethers.formatUnits(backing, 6)} USDC`);
      console.log(`  Data Age: ${dataAge.toString()} seconds`);

      if (isHealthy) healthyCount++;
    } catch (error) {
      console.log("Oracle Status: ✗ Failed to query");
    }
  }

  // Check Treasury
  if (deployments.treasury) {
    totalChecks++;
    try {
      const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
      const treasury = TreasuryVault.attach(deployments.treasury.treasury);

      const totalReserves = await treasury.totalReserves();
      const tierBalances = await treasury.getTierBalances();
      const needsRebalancing = await treasury.needsRebalancing();

      console.log("");
      console.log("Treasury Status:");
      console.log(`  Total Reserves: ${ethers.formatUnits(totalReserves, 6)} USDC`);
      console.log(`  Tier Balances: ${tierBalances.map(b => ethers.formatUnits(b, 6)).join(", ")}`);
      console.log(`  Needs Rebalancing: ${needsRebalancing ? "Yes" : "No"}`);

      healthyCount++;
    } catch (error) {
      console.log("Treasury Status: ✗ Failed to query");
    }
  }

  // Check Policy
  if (deployments.policy) {
    totalChecks++;
    try {
      const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
      const policy = SecureMintPolicy.attach(deployments.policy.policy);

      const paused = await policy.paused();
      const remainingEpoch = await policy.getRemainingEpochMint();
      const [canMint, reason] = await policy.canMintNow(ethers.parseEther("1"));

      console.log("");
      console.log("Policy Status:");
      console.log(`  Paused: ${paused ? "✗ Yes" : "✓ No"}`);
      console.log(`  Remaining Epoch Mint: ${ethers.formatEther(remainingEpoch)} tokens`);
      console.log(`  Can Mint (1 token): ${canMint ? "✓ Yes" : `✗ No - ${reason}`}`);

      if (!paused) healthyCount++;
    } catch (error) {
      console.log("Policy Status: ✗ Failed to query");
    }
  }

  // Check Token
  if (deployments.token) {
    totalChecks++;
    try {
      const BackedToken = await ethers.getContractFactory("BackedToken");
      const token = BackedToken.attach(deployments.token.token);

      const totalSupply = await token.totalSupply();
      const paused = await token.paused();
      const secureMintPolicy = await token.secureMintPolicy();

      console.log("");
      console.log("Token Status:");
      console.log(`  Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
      console.log(`  Paused: ${paused ? "✗ Yes" : "✓ No"}`);
      console.log(`  SecureMintPolicy: ${secureMintPolicy}`);

      if (!paused) healthyCount++;
    } catch (error) {
      console.log("Token Status: ✗ Failed to query");
    }
  }

  // Summary
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Health Check Summary: ${healthyCount}/${totalChecks} systems healthy`);
  console.log("═══════════════════════════════════════════════════════════════");
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Verification & Health Check");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: ${network.name}`);
  console.log("");

  const deployments = await loadAllDeployments();

  // Skip verification on local networks
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Contract Verification");
    console.log("─────────────────────────────────────────────────────────────────");
    console.log("");

    // Verify Oracle
    if (deployments.oracle) {
      await verifyContract(
        deployments.oracle.oracle,
        [
          deployments.oracle.chainlinkFeed,
          2, // minAttestors
          3600, // maxOracleAge
          process.env.ADMIN_ADDRESS,
        ],
        "BackingOraclePoR"
      );
    }

    // Verify Treasury
    if (deployments.treasury) {
      await verifyContract(
        deployments.treasury.treasury,
        [
          deployments.treasury.reserveAsset,
          process.env.ADMIN_ADDRESS,
          deployments.treasury.allocations.map((a: string) => BigInt(a)),
        ],
        "TreasuryVault"
      );
    }

    // Verify Token
    if (deployments.token) {
      await verifyContract(
        deployments.token.token,
        [
          deployments.token.name,
          deployments.token.symbol,
          deployments.policy?.policy || ethers.ZeroAddress,
          deployments.token.guardian,
        ],
        "BackedToken"
      );
    }

    // Verify Policy
    if (deployments.policy) {
      await verifyContract(
        deployments.policy.policy,
        [
          deployments.policy.token,
          deployments.policy.oracle,
          BigInt(deployments.policy.globalSupplyCap),
          BigInt(deployments.policy.epochMintCap),
          3600,
          process.env.ADMIN_ADDRESS,
        ],
        "SecureMintPolicy"
      );
    }
  }

  // Perform health check
  await performHealthCheck(deployments);

  // Output deployment summary
  console.log("");
  console.log("Deployed Contract Addresses:");
  console.log("─────────────────────────────────────────────────────────────────");
  if (deployments.oracle) console.log(`  Oracle:     ${deployments.oracle.oracle}`);
  if (deployments.treasury) console.log(`  Treasury:   ${deployments.treasury.treasury}`);
  if (deployments.token) console.log(`  Token:      ${deployments.token.token}`);
  if (deployments.policy) console.log(`  Policy:     ${deployments.policy.policy}`);
  if (deployments.redemption) console.log(`  Redemption: ${deployments.redemption.redemption}`);
  if (deployments.governance) {
    console.log(`  Timelock:   ${deployments.governance.timelock}`);
    console.log(`  Governor:   ${deployments.governance.governor}`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
