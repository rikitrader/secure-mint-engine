#!/usr/bin/env ts-node
/**
 * SecureMint Engine - CLI SDK Usage Examples
 * Demonstrates SDK usage from command line scripts
 */

import { SecureMintSDK, ErrorCodes, SecureMintError } from '@securemint/sdk';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config = {
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  policyAddress: process.env.POLICY_ADDRESS || '',
  oracleAddress: process.env.ORACLE_ADDRESS || '',
  treasuryAddress: process.env.TREASURY_ADDRESS || '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function log(message: string, data?: any): void {
  console.log(`[SecureMint] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(message: string, error: any): void {
  console.error(`[SecureMint ERROR] ${message}`);
  if (error instanceof SecureMintError) {
    console.error(`  Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);
  } else {
    console.error(`  ${error.message || error}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Basic System Status Check
// ═══════════════════════════════════════════════════════════════════════════════

async function checkSystemStatus(sdk: SecureMintSDK): Promise<void> {
  log('Checking system status...');

  try {
    // Token info
    const tokenInfo = await sdk.getTokenInfo();
    log('Token Info:', tokenInfo);

    // Backing ratio
    const backingRatio = await sdk.getBackingRatio();
    log(`Backing Ratio: ${(backingRatio * 100).toFixed(2)}%`);

    // Oracle staleness
    const isStale = await sdk.isOracleStale();
    log(`Oracle Stale: ${isStale}`);

    // Emergency level
    const emergencyLevel = await sdk.getEmergencyLevel();
    log(`Emergency Level: ${emergencyLevel}`);

    // All invariants
    const invariants = await sdk.checkInvariants();
    log('Invariants:');
    invariants.forEach((inv) => {
      const status = inv.passed ? '✓' : '✗';
      console.log(`  ${status} ${inv.id}: ${inv.name}`);
    });

    const allPassed = invariants.every((i) => i.passed);
    log(`All Invariants Passed: ${allPassed}`);
  } catch (error) {
    logError('Failed to check system status', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Check Balance
// ═══════════════════════════════════════════════════════════════════════════════

async function checkBalance(sdk: SecureMintSDK, address: string): Promise<void> {
  log(`Checking balance for ${address}...`);

  try {
    const balance = await sdk.getBalance(address);
    const formatted = await sdk.getFormattedBalance(address);

    log('Balance:', {
      raw: balance.toString(),
      formatted: formatted,
    });
  } catch (error) {
    logError('Failed to check balance', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Check Epoch Capacity
// ═══════════════════════════════════════════════════════════════════════════════

async function checkEpochCapacity(sdk: SecureMintSDK): Promise<void> {
  log('Checking epoch capacity...');

  try {
    const capacity = await sdk.getEpochCapacity();

    log('Epoch Capacity:', {
      total: ethers.formatUnits(capacity.total, 6),
      used: ethers.formatUnits(capacity.used, 6),
      remaining: ethers.formatUnits(capacity.remaining, 6),
      utilizationPercent: ((Number(capacity.used) / Number(capacity.total)) * 100).toFixed(2) + '%',
    });
  } catch (error) {
    logError('Failed to check epoch capacity', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Simulate Mint
// ═══════════════════════════════════════════════════════════════════════════════

async function simulateMint(
  sdk: SecureMintSDK,
  recipient: string,
  amount: string
): Promise<void> {
  log(`Simulating mint of ${amount} to ${recipient}...`);

  try {
    // First check if mint is allowed
    const canMint = await sdk.canMint(recipient, amount);
    log('Can Mint Check:', canMint);

    if (!canMint.allowed) {
      log(`Mint not allowed: ${canMint.reason}`);
      return;
    }

    // Run simulation
    const simulation = await sdk.simulateMint(recipient, amount);
    log('Simulation Result:', simulation);

    if (simulation.success) {
      log(`Mint simulation successful! Estimated gas: ${simulation.estimatedGas}`);
    } else {
      log(`Mint simulation failed: ${simulation.reason}`);
    }
  } catch (error) {
    logError('Mint simulation failed', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Monitor for Changes (WebSocket)
// ═══════════════════════════════════════════════════════════════════════════════

async function monitorChanges(sdk: SecureMintSDK): Promise<void> {
  log('Starting monitor (press Ctrl+C to stop)...');

  // Poll every 10 seconds (would use WebSocket in production)
  let lastBackingRatio = await sdk.getBackingRatio();
  let lastEmergencyLevel = await sdk.getEmergencyLevel();

  const interval = setInterval(async () => {
    try {
      const backingRatio = await sdk.getBackingRatio();
      const emergencyLevel = await sdk.getEmergencyLevel();

      if (backingRatio !== lastBackingRatio) {
        log(`Backing ratio changed: ${lastBackingRatio} -> ${backingRatio}`);
        lastBackingRatio = backingRatio;
      }

      if (emergencyLevel !== lastEmergencyLevel) {
        log(`Emergency level changed: ${lastEmergencyLevel} -> ${emergencyLevel}`);
        lastEmergencyLevel = emergencyLevel;
      }
    } catch (error) {
      logError('Monitor check failed', error);
    }
  }, 10000);

  // Handle shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    log('Monitor stopped');
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Batch Check Multiple Addresses
// ═══════════════════════════════════════════════════════════════════════════════

async function batchCheckAddresses(
  sdk: SecureMintSDK,
  addresses: string[]
): Promise<void> {
  log(`Checking ${addresses.length} addresses...`);

  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        const balance = await sdk.getFormattedBalance(address);
        return { address, balance, error: null };
      } catch (error: any) {
        return { address, balance: null, error: error.message };
      }
    })
  );

  log('Batch Results:');
  results.forEach((r) => {
    if (r.error) {
      console.log(`  ${r.address}: ERROR - ${r.error}`);
    } else {
      console.log(`  ${r.address}: ${r.balance}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CLI
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  // Validate config
  if (!config.tokenAddress) {
    console.error('Error: TOKEN_ADDRESS environment variable is required');
    process.exit(1);
  }

  // Initialize SDK
  const sdk = new SecureMintSDK(config);
  log('SDK initialized');

  switch (command) {
    case 'status':
      await checkSystemStatus(sdk);
      break;

    case 'balance':
      const address = args[1];
      if (!address) {
        console.error('Usage: cli balance <address>');
        process.exit(1);
      }
      await checkBalance(sdk, address);
      break;

    case 'capacity':
      await checkEpochCapacity(sdk);
      break;

    case 'simulate':
      const recipient = args[1];
      const amount = args[2];
      if (!recipient || !amount) {
        console.error('Usage: cli simulate <recipient> <amount>');
        process.exit(1);
      }
      await simulateMint(sdk, recipient, amount);
      break;

    case 'monitor':
      await monitorChanges(sdk);
      break;

    case 'batch':
      const addresses = args.slice(1);
      if (addresses.length === 0) {
        console.error('Usage: cli batch <address1> <address2> ...');
        process.exit(1);
      }
      await batchCheckAddresses(sdk, addresses);
      break;

    case 'help':
    default:
      console.log(`
SecureMint Engine CLI

Usage:
  cli <command> [args]

Commands:
  status              Check overall system status
  balance <address>   Check token balance for an address
  capacity            Check current epoch minting capacity
  simulate <to> <amt> Simulate a mint operation
  monitor             Monitor for system changes (Ctrl+C to stop)
  batch <addr...>     Check balances for multiple addresses
  help                Show this help message

Environment Variables:
  RPC_URL             Ethereum RPC URL
  TOKEN_ADDRESS       SecureMint token contract address
  POLICY_ADDRESS      Mint policy contract address
  ORACLE_ADDRESS      Backing oracle contract address
  TREASURY_ADDRESS    Treasury contract address

Examples:
  cli status
  cli balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  cli simulate 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 1000000000
  cli batch 0x123... 0x456... 0x789...
`);
      break;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
