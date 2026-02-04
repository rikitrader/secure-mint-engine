#!/usr/bin/env ts-node
/**
 * SecureMint Engine - Deployment Verification Script
 * Verifies that a SecureMint deployment is correctly configured
 */

import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

interface DeploymentConfig {
  rpcUrl: string;
  tokenAddress: string;
  policyAddress: string;
  oracleAddress: string;
  treasuryAddress: string;
}

const config: DeploymentConfig = {
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  policyAddress: process.env.POLICY_ADDRESS || '',
  oracleAddress: process.env.ORACLE_ADDRESS || '',
  treasuryAddress: process.env.TREASURY_ADDRESS || '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MINIMAL ABIS
// ═══════════════════════════════════════════════════════════════════════════════

const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function minter() view returns (address)',
  'function paused() view returns (bool)',
];

const POLICY_ABI = [
  'function token() view returns (address)',
  'function oracle() view returns (address)',
  'function treasury() view returns (address)',
  'function epochCapacity() view returns (uint256)',
  'function emergencyLevel() view returns (uint8)',
];

const ORACLE_ABI = [
  'function getBacking() view returns (uint256 value, uint256 timestamp)',
  'function stalenessThreshold() view returns (uint256)',
];

const TREASURY_ABI = [
  'function getTotalReserves() view returns (uint256)',
  'function policy() view returns (address)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  critical: boolean;
}

const results: CheckResult[] = [];

function addResult(name: string, passed: boolean, details: string, critical = true): void {
  results.push({ name, passed, details, critical });
}

async function verifyContract(
  provider: ethers.JsonRpcProvider,
  address: string,
  name: string
): Promise<boolean> {
  const code = await provider.getCode(address);
  const hasCode = code !== '0x';
  addResult(
    `${name} Contract Deployed`,
    hasCode,
    hasCode ? `Found at ${address}` : `No code at ${address}`,
    true
  );
  return hasCode;
}

async function verifyToken(
  provider: ethers.JsonRpcProvider
): Promise<void> {
  if (!(await verifyContract(provider, config.tokenAddress, 'Token'))) return;

  const token = new ethers.Contract(config.tokenAddress, TOKEN_ABI, provider);

  try {
    const [name, symbol, decimals, totalSupply, minter, paused] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
      token.totalSupply(),
      token.minter(),
      token.paused(),
    ]);

    addResult('Token Readable', true, `${name} (${symbol})`, false);
    addResult('Token Decimals', decimals === 6n, `Decimals: ${decimals} (expected 6)`, true);
    addResult(
      'Minter is Policy',
      minter.toLowerCase() === config.policyAddress.toLowerCase(),
      `Minter: ${minter}`,
      true
    );
    addResult('Token Not Paused', !paused, paused ? 'Token is PAUSED' : 'Token is active', true);
  } catch (error: any) {
    addResult('Token Readable', false, error.message, true);
  }
}

async function verifyPolicy(
  provider: ethers.JsonRpcProvider
): Promise<void> {
  if (!(await verifyContract(provider, config.policyAddress, 'Policy'))) return;

  const policy = new ethers.Contract(config.policyAddress, POLICY_ABI, provider);

  try {
    const [tokenAddr, oracleAddr, treasuryAddr, epochCapacity, emergencyLevel] = await Promise.all([
      policy.token(),
      policy.oracle(),
      policy.treasury(),
      policy.epochCapacity(),
      policy.emergencyLevel(),
    ]);

    addResult(
      'Policy -> Token Link',
      tokenAddr.toLowerCase() === config.tokenAddress.toLowerCase(),
      `Links to: ${tokenAddr}`,
      true
    );
    addResult(
      'Policy -> Oracle Link',
      oracleAddr.toLowerCase() === config.oracleAddress.toLowerCase(),
      `Links to: ${oracleAddr}`,
      true
    );
    addResult(
      'Policy -> Treasury Link',
      treasuryAddr.toLowerCase() === config.treasuryAddress.toLowerCase(),
      `Links to: ${treasuryAddr}`,
      true
    );
    addResult(
      'Epoch Capacity Set',
      epochCapacity > 0n,
      `Capacity: ${ethers.formatUnits(epochCapacity, 6)}`,
      true
    );
    addResult(
      'Emergency Level Normal',
      emergencyLevel === 0n,
      `Level: ${emergencyLevel}`,
      false
    );
  } catch (error: any) {
    addResult('Policy Readable', false, error.message, true);
  }
}

async function verifyOracle(
  provider: ethers.JsonRpcProvider
): Promise<void> {
  if (!(await verifyContract(provider, config.oracleAddress, 'Oracle'))) return;

  const oracle = new ethers.Contract(config.oracleAddress, ORACLE_ABI, provider);

  try {
    const [backing, stalenessThreshold] = await Promise.all([
      oracle.getBacking(),
      oracle.stalenessThreshold(),
    ]);

    const [value, timestamp] = backing;
    const now = Math.floor(Date.now() / 1000);
    const age = now - Number(timestamp);
    const isStale = age > Number(stalenessThreshold);

    addResult(
      'Oracle Has Backing Data',
      value > 0n,
      `Backing: ${ethers.formatUnits(value, 6)}`,
      true
    );
    addResult(
      'Oracle Data Fresh',
      !isStale,
      `Age: ${age}s (threshold: ${stalenessThreshold}s)`,
      true
    );
  } catch (error: any) {
    addResult('Oracle Readable', false, error.message, true);
  }
}

async function verifyTreasury(
  provider: ethers.JsonRpcProvider
): Promise<void> {
  if (!(await verifyContract(provider, config.treasuryAddress, 'Treasury'))) return;

  const treasury = new ethers.Contract(config.treasuryAddress, TREASURY_ABI, provider);

  try {
    const [totalReserves, policyAddr] = await Promise.all([
      treasury.getTotalReserves(),
      treasury.policy(),
    ]);

    addResult(
      'Treasury Has Reserves',
      totalReserves > 0n,
      `Reserves: ${ethers.formatUnits(totalReserves, 6)}`,
      true
    );
    addResult(
      'Treasury -> Policy Link',
      policyAddr.toLowerCase() === config.policyAddress.toLowerCase(),
      `Links to: ${policyAddr}`,
      true
    );
  } catch (error: any) {
    addResult('Treasury Readable', false, error.message, true);
  }
}

async function verifySolvency(
  provider: ethers.JsonRpcProvider
): Promise<void> {
  try {
    const token = new ethers.Contract(config.tokenAddress, TOKEN_ABI, provider);
    const oracle = new ethers.Contract(config.oracleAddress, ORACLE_ABI, provider);

    const [totalSupply, backing] = await Promise.all([
      token.totalSupply(),
      oracle.getBacking(),
    ]);

    const [backingValue] = backing;
    const isSolvent = backingValue >= totalSupply;

    addResult(
      'INV-SM-1: Solvency',
      isSolvent,
      `Supply: ${ethers.formatUnits(totalSupply, 6)}, Backing: ${ethers.formatUnits(backingValue, 6)}`,
      true
    );
  } catch (error: any) {
    addResult('Solvency Check', false, error.message, true);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('       SecureMint Engine - Deployment Verification');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Validate config
  const missingEnvs = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingEnvs.length > 0) {
    console.error('Missing required environment variables:');
    missingEnvs.forEach((env) => console.error(`  - ${env.toUpperCase()}`));
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  RPC URL:     ${config.rpcUrl}`);
  console.log(`  Token:       ${config.tokenAddress}`);
  console.log(`  Policy:      ${config.policyAddress}`);
  console.log(`  Oracle:      ${config.oracleAddress}`);
  console.log(`  Treasury:    ${config.treasuryAddress}`);
  console.log('\n');

  // Connect to provider
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  try {
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})\n`);
  } catch (error) {
    console.error('Failed to connect to RPC:', error);
    process.exit(1);
  }

  // Run all verifications
  console.log('Running verification checks...\n');

  await verifyToken(provider);
  await verifyPolicy(provider);
  await verifyOracle(provider);
  await verifyTreasury(provider);
  await verifySolvency(provider);

  // Print results
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                         RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let criticalFailures = 0;
  let warnings = 0;

  results.forEach((result) => {
    const icon = result.passed ? '✓' : (result.critical ? '✗' : '⚠');
    const color = result.passed ? '\x1b[32m' : (result.critical ? '\x1b[31m' : '\x1b[33m');
    const reset = '\x1b[0m';

    console.log(`${color}${icon}${reset} ${result.name}`);
    console.log(`    ${result.details}\n`);

    if (!result.passed) {
      if (result.critical) {
        criticalFailures++;
      } else {
        warnings++;
      }
    }
  });

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const totalChecks = results.length;
  const passed = results.filter((r) => r.passed).length;

  console.log(`Total Checks:      ${totalChecks}`);
  console.log(`Passed:            ${passed}`);
  console.log(`Critical Failures: ${criticalFailures}`);
  console.log(`Warnings:          ${warnings}`);
  console.log('');

  if (criticalFailures === 0) {
    console.log('\x1b[32m✓ Deployment verification PASSED\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[31m✗ Deployment verification FAILED\x1b[0m');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
