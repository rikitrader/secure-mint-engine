import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

/**
 * Gas Report Generator for Secure Mint Engine
 *
 * Generates detailed gas consumption reports for key operations.
 * Used in CI to track gas optimization over time.
 */

interface GasReport {
  timestamp: number;
  network: string;
  operations: OperationGas[];
  summary: {
    totalOperations: number;
    averageGas: number;
    maxGas: number;
    minGas: number;
  };
}

interface OperationGas {
  contract: string;
  function: string;
  description: string;
  gasUsed: number;
  gasPrice?: string;
  usdCost?: number;
}

async function measureGas(
  contractName: string,
  functionName: string,
  description: string,
  operation: () => Promise<any>
): Promise<OperationGas> {
  const tx = await operation();
  const receipt = await tx.wait();

  return {
    contract: contractName,
    function: functionName,
    description,
    gasUsed: Number(receipt.gasUsed),
  };
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SECURE MINT ENGINE - Gas Report Generator");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  const [deployer, user1, user2, attestor1, attestor2] = await ethers.getSigners();
  const operations: OperationGas[] = [];

  // Deploy contracts for testing
  console.log("Deploying contracts for gas measurement...");

  // Deploy mock USDC
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USDC", "USDC", 6);

  // Deploy mock Chainlink
  const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
  const aggregator = await MockAggregator.deploy(8);
  await aggregator.setLatestAnswer(1e8);

  // Deploy Oracle
  const BackingOraclePoR = await ethers.getContractFactory("BackingOraclePoR");
  const oracle = await BackingOraclePoR.deploy(
    aggregator.target,
    2,
    3600,
    deployer.address
  );

  // Deploy Treasury
  const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
  const treasury = await TreasuryVault.deploy(
    usdc.target,
    deployer.address,
    [1000n, 2000n, 5000n, 2000n]
  );

  // Deploy Token
  const BackedToken = await ethers.getContractFactory("BackedToken");
  const token = await BackedToken.deploy(
    "USD Backed Token",
    "USDB",
    deployer.address,
    deployer.address
  );

  // Deploy Policy
  const SecureMintPolicy = await ethers.getContractFactory("SecureMintPolicy");
  const policy = await SecureMintPolicy.deploy(
    token.target,
    oracle.target,
    ethers.parseEther("1000000000"),
    ethers.parseEther("10000000"),
    3600,
    deployer.address
  );

  // Configure
  await token.setSecureMintPolicy(policy.target);
  const ATTESTOR_ROLE = await oracle.ATTESTOR_ROLE();
  await oracle.grantRole(ATTESTOR_ROLE, attestor1.address);
  await oracle.grantRole(ATTESTOR_ROLE, attestor2.address);
  const MINTER_ROLE = await policy.MINTER_ROLE();
  await policy.grantRole(MINTER_ROLE, deployer.address);

  // Set up oracle
  const proof = ethers.keccak256(ethers.toUtf8Bytes("proof"));
  await oracle.connect(attestor1).submitAttestation(ethers.parseUnits("1000000000", 6), proof);
  await oracle.connect(attestor2).submitAttestation(ethers.parseUnits("1000000000", 6), proof);

  console.log("Measuring gas consumption...\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // MINT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Measure first mint (cold storage)
  operations.push(
    await measureGas(
      "SecureMintPolicy",
      "mint()",
      "First mint to new address (cold)",
      () => policy.mint(user1.address, ethers.parseEther("1000"))
    )
  );

  // Measure subsequent mint (warm storage)
  operations.push(
    await measureGas(
      "SecureMintPolicy",
      "mint()",
      "Subsequent mint to same address (warm)",
      () => policy.mint(user1.address, ethers.parseEther("1000"))
    )
  );

  // Large mint
  operations.push(
    await measureGas(
      "SecureMintPolicy",
      "mint()",
      "Large mint (1M tokens)",
      () => policy.mint(user2.address, ethers.parseEther("1000000"))
    )
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Transfer
  operations.push(
    await measureGas(
      "BackedToken",
      "transfer()",
      "Token transfer",
      () => token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
    )
  );

  // Burn
  operations.push(
    await measureGas(
      "BackedToken",
      "burn()",
      "Token burn",
      () => token.connect(user1).burn(ethers.parseEther("100"))
    )
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ORACLE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Submit attestation
  operations.push(
    await measureGas(
      "BackingOraclePoR",
      "submitAttestation()",
      "Oracle attestation submission",
      () =>
        oracle
          .connect(attestor1)
          .submitAttestation(
            ethers.parseUnits("1000000001", 6),
            ethers.keccak256(ethers.toUtf8Bytes("newproof"))
          )
    )
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TREASURY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Fund treasury
  await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
  await usdc.approve(treasury.target, ethers.MaxUint256);

  const TREASURY_ADMIN_ROLE = await treasury.TREASURY_ADMIN_ROLE();
  await treasury.grantRole(TREASURY_ADMIN_ROLE, deployer.address);

  // Deposit
  operations.push(
    await measureGas(
      "TreasuryVault",
      "deposit()",
      "Treasury deposit to tier",
      () => treasury.deposit(ethers.parseUnits("10000", 6), 0)
    )
  );

  // Distributed deposit
  operations.push(
    await measureGas(
      "TreasuryVault",
      "depositDistributed()",
      "Treasury distributed deposit",
      () => treasury.depositDistributed(ethers.parseUnits("100000", 6))
    )
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  const gasValues = operations.map((o) => o.gasUsed);
  const report: GasReport = {
    timestamp: Math.floor(Date.now() / 1000),
    network: "hardhat",
    operations,
    summary: {
      totalOperations: operations.length,
      averageGas: Math.round(gasValues.reduce((a, b) => a + b, 0) / gasValues.length),
      maxGas: Math.max(...gasValues),
      minGas: Math.min(...gasValues),
    },
  };

  // Print report
  console.log("Gas Consumption Report");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log("");

  for (const op of operations) {
    console.log(`${op.contract}.${op.function}`);
    console.log(`  ${op.description}`);
    console.log(`  Gas: ${op.gasUsed.toLocaleString()}`);
    console.log("");
  }

  console.log("─────────────────────────────────────────────────────────────────");
  console.log("Summary:");
  console.log(`  Total operations: ${report.summary.totalOperations}`);
  console.log(`  Average gas: ${report.summary.averageGas.toLocaleString()}`);
  console.log(`  Max gas: ${report.summary.maxGas.toLocaleString()}`);
  console.log(`  Min gas: ${report.summary.minGas.toLocaleString()}`);
  console.log("");

  // Save report
  const reportPath = join(__dirname, "../../outputs/gas-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${reportPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Gas report generation failed:", error);
    process.exit(1);
  });
