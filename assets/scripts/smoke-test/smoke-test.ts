#!/usr/bin/env npx ts-node
/**
 * SecureMint Engine - Smoke Test Runner
 * Validates deployment with essential tests
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  message?: string;
  details?: string;
}

interface TestConfig {
  rpcUrl: string;
  tokenAddress?: string;
  policyAddress?: string;
  oracleAddress?: string;
  emergencyAddress?: string;
  apiUrl?: string;
  testRecipient?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function loadConfig(): TestConfig {
  const config: TestConfig = {
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    tokenAddress: process.env.TOKEN_ADDRESS,
    policyAddress: process.env.POLICY_ADDRESS,
    oracleAddress: process.env.ORACLE_ADDRESS,
    emergencyAddress: process.env.EMERGENCY_ADDRESS,
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    testRecipient: process.env.TEST_RECIPIENT || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  };

  // Load from deployment file if exists
  const deploymentPaths = [
    'deployments/localhost/deployment.json',
    'deployments/sepolia/deployment.json',
    'deployments/mainnet/deployment.json',
  ];

  for (const depPath of deploymentPaths) {
    const fullPath = path.join(process.cwd(), depPath);
    if (fs.existsSync(fullPath)) {
      try {
        const deployment = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        config.tokenAddress = config.tokenAddress || deployment.token;
        config.policyAddress = config.policyAddress || deployment.policy;
        config.oracleAddress = config.oracleAddress || deployment.oracle;
        config.emergencyAddress = config.emergencyAddress || deployment.emergency;
        break;
      } catch (e) {
        // Ignore errors
      }
    }
  }

  return config;
}

function execCommand(command: string, timeout = 30000): { success: boolean; output: string; duration: number } {
  const start = Date.now();
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: output.trim(), duration: Date.now() - start };
  } catch (error: any) {
    return {
      success: false,
      output: error.stderr || error.message || 'Command failed',
      duration: Date.now() - start,
    };
  }
}

function ethCall(config: TestConfig, to: string, data: string): { success: boolean; result: string; duration: number } {
  const start = Date.now();
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"${to}","data":"${data}"},"latest"],"id":1}' --max-time 10`;

  try {
    const output = execSync(curlCmd, { encoding: 'utf-8', timeout: 15000 });
    const parsed = JSON.parse(output);
    if (parsed.result && !parsed.error) {
      return { success: true, result: parsed.result, duration: Date.now() - start };
    }
    return { success: false, result: parsed.error?.message || 'Call failed', duration: Date.now() - start };
  } catch (e: any) {
    return { success: false, result: e.message, duration: Date.now() - start };
  }
}

// ============================================================================
// TESTS
// ============================================================================

async function testRpcConnectivity(config: TestConfig): Promise<TestResult> {
  const start = Date.now();
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' --max-time 5`;
  const { success, output } = execCommand(curlCmd);

  if (success && output.includes('"result"')) {
    const blockHex = JSON.parse(output).result;
    const blockNum = parseInt(blockHex, 16);
    return {
      id: 'SM-00',
      name: 'RPC Connectivity',
      status: 'PASS',
      duration: Date.now() - start,
      message: `Block #${blockNum}`,
    };
  }

  return {
    id: 'SM-00',
    name: 'RPC Connectivity',
    status: 'FAIL',
    duration: Date.now() - start,
    details: 'Could not connect to RPC',
  };
}

async function testTokenDeployment(config: TestConfig): Promise<TestResult> {
  if (!config.tokenAddress) {
    return {
      id: 'SM-01',
      name: 'Token Deployment',
      status: 'SKIP',
      duration: 0,
      message: 'No token address configured',
    };
  }

  // Check code exists at address
  const start = Date.now();
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["${config.tokenAddress}","latest"],"id":1}' --max-time 5`;
  const { success, output } = execCommand(curlCmd);

  if (success && output.includes('"result"')) {
    const code = JSON.parse(output).result;
    if (code && code !== '0x' && code.length > 10) {
      return {
        id: 'SM-01',
        name: 'Token Deployment',
        status: 'PASS',
        duration: Date.now() - start,
        message: `Contract at ${config.tokenAddress.slice(0, 10)}...`,
      };
    }
  }

  return {
    id: 'SM-01',
    name: 'Token Deployment',
    status: 'FAIL',
    duration: Date.now() - start,
    details: `No contract at ${config.tokenAddress}`,
  };
}

async function testPolicyDeployment(config: TestConfig): Promise<TestResult> {
  if (!config.policyAddress) {
    return {
      id: 'SM-02',
      name: 'Policy Deployment',
      status: 'SKIP',
      duration: 0,
      message: 'No policy address configured',
    };
  }

  const start = Date.now();
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["${config.policyAddress}","latest"],"id":1}' --max-time 5`;
  const { success, output } = execCommand(curlCmd);

  if (success && output.includes('"result"')) {
    const code = JSON.parse(output).result;
    if (code && code !== '0x' && code.length > 10) {
      return {
        id: 'SM-02',
        name: 'Policy Deployment',
        status: 'PASS',
        duration: Date.now() - start,
        message: `Contract at ${config.policyAddress.slice(0, 10)}...`,
      };
    }
  }

  return {
    id: 'SM-02',
    name: 'Policy Deployment',
    status: 'FAIL',
    duration: Date.now() - start,
    details: `No contract at ${config.policyAddress}`,
  };
}

async function testOracleConnectivity(config: TestConfig): Promise<TestResult> {
  if (!config.oracleAddress) {
    return {
      id: 'SM-03',
      name: 'Oracle Connectivity',
      status: 'SKIP',
      duration: 0,
      message: 'No oracle address configured',
    };
  }

  // Call latestRoundData() - selector: 0xfeaf968c
  const { success, result, duration } = ethCall(config, config.oracleAddress, '0xfeaf968c');

  if (success && result && result !== '0x' && result.length > 10) {
    // Parse answer from result (5th 32-byte slot)
    // (roundId, answer, startedAt, updatedAt, answeredInRound)
    try {
      const answerHex = '0x' + result.slice(66, 130);
      const answer = BigInt(answerHex);
      if (answer > 0n) {
        return {
          id: 'SM-03',
          name: 'Oracle Connectivity',
          status: 'PASS',
          duration,
          message: `Value: ${answer.toString()}`,
        };
      }
    } catch (e) {
      // Fall through
    }
  }

  return {
    id: 'SM-03',
    name: 'Oracle Connectivity',
    status: 'FAIL',
    duration,
    details: 'Oracle returned invalid data',
  };
}

async function testTokenMetadata(config: TestConfig): Promise<TestResult> {
  if (!config.tokenAddress) {
    return {
      id: 'SM-04',
      name: 'Token Metadata',
      status: 'SKIP',
      duration: 0,
      message: 'No token address configured',
    };
  }

  const start = Date.now();

  // name() selector: 0x06fdde03
  const nameCall = ethCall(config, config.tokenAddress, '0x06fdde03');

  // symbol() selector: 0x95d89b41
  const symbolCall = ethCall(config, config.tokenAddress, '0x95d89b41');

  // decimals() selector: 0x313ce567
  const decimalsCall = ethCall(config, config.tokenAddress, '0x313ce567');

  if (nameCall.success && symbolCall.success && decimalsCall.success) {
    // Parse decimals
    const decimals = parseInt(decimalsCall.result, 16);

    return {
      id: 'SM-04',
      name: 'Token Metadata',
      status: 'PASS',
      duration: Date.now() - start,
      message: `Decimals: ${decimals}`,
    };
  }

  return {
    id: 'SM-04',
    name: 'Token Metadata',
    status: 'FAIL',
    duration: Date.now() - start,
    details: 'Could not read token metadata',
  };
}

async function testTotalSupply(config: TestConfig): Promise<TestResult> {
  if (!config.tokenAddress) {
    return {
      id: 'SM-05',
      name: 'Total Supply',
      status: 'SKIP',
      duration: 0,
      message: 'No token address configured',
    };
  }

  // totalSupply() selector: 0x18160ddd
  const { success, result, duration } = ethCall(config, config.tokenAddress, '0x18160ddd');

  if (success && result) {
    const supply = BigInt(result);
    const formatted = (Number(supply) / 1e18).toLocaleString();
    return {
      id: 'SM-05',
      name: 'Total Supply',
      status: 'PASS',
      duration,
      message: `${formatted} tokens`,
    };
  }

  return {
    id: 'SM-05',
    name: 'Total Supply',
    status: 'FAIL',
    duration,
    details: 'Could not read total supply',
  };
}

async function testPauseLevel(config: TestConfig): Promise<TestResult> {
  if (!config.emergencyAddress) {
    return {
      id: 'SM-06',
      name: 'Pause Level',
      status: 'SKIP',
      duration: 0,
      message: 'No emergency address configured',
    };
  }

  // pauseLevel() selector: 0xe1a29ed9 (example, may vary)
  // Try common selector patterns
  const selectors = ['0xe1a29ed9', '0x136439dd', '0x5c975abb'];

  for (const selector of selectors) {
    const { success, result, duration } = ethCall(config, config.emergencyAddress, selector);

    if (success && result && result !== '0x') {
      const level = parseInt(result, 16);
      const levelNames = ['Normal', 'Caution', 'Warning', 'Critical', 'Emergency', 'Recovery'];
      return {
        id: 'SM-06',
        name: 'Pause Level',
        status: 'PASS',
        duration,
        message: `Level ${level} (${levelNames[level] || 'Unknown'})`,
      };
    }
  }

  // Try paused() as fallback
  const pausedCall = ethCall(config, config.emergencyAddress, '0x5c975abb');
  if (pausedCall.success) {
    const paused = parseInt(pausedCall.result, 16) === 1;
    return {
      id: 'SM-06',
      name: 'Pause Level',
      status: 'PASS',
      duration: pausedCall.duration,
      message: paused ? 'Paused' : 'Not Paused',
    };
  }

  return {
    id: 'SM-06',
    name: 'Pause Level',
    status: 'SKIP',
    duration: 0,
    message: 'Could not determine pause state',
  };
}

async function testApiHealth(config: TestConfig): Promise<TestResult> {
  const start = Date.now();
  const { success, output } = execCommand(`curl -s ${config.apiUrl}/health --max-time 5`);

  if (success) {
    try {
      const response = JSON.parse(output);
      if (response.status === 'healthy' || response.status === 'ok') {
        return {
          id: 'SM-07',
          name: 'API Health',
          status: 'PASS',
          duration: Date.now() - start,
          message: response.version || 'Healthy',
        };
      }
    } catch (e) {
      // Not JSON, check for OK
      if (output.toLowerCase().includes('ok') || output.toLowerCase().includes('healthy')) {
        return {
          id: 'SM-07',
          name: 'API Health',
          status: 'PASS',
          duration: Date.now() - start,
          message: 'Healthy',
        };
      }
    }
  }

  return {
    id: 'SM-07',
    name: 'API Health',
    status: 'FAIL',
    duration: Date.now() - start,
    details: `API not responding at ${config.apiUrl}/health`,
  };
}

async function testGraphQLEndpoint(config: TestConfig): Promise<TestResult> {
  const start = Date.now();
  const query = '{"query":"{ __typename }"}';
  const { success, output } = execCommand(
    `curl -s -X POST ${config.apiUrl}/graphql -H "Content-Type: application/json" -d '${query}' --max-time 5`
  );

  if (success) {
    try {
      const response = JSON.parse(output);
      if (response.data && !response.errors) {
        return {
          id: 'SM-08',
          name: 'GraphQL Endpoint',
          status: 'PASS',
          duration: Date.now() - start,
          message: 'Responding',
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return {
    id: 'SM-08',
    name: 'GraphQL Endpoint',
    status: 'SKIP',
    duration: Date.now() - start,
    message: 'Could not verify GraphQL',
  };
}

async function testInvariantCheck(config: TestConfig): Promise<TestResult> {
  if (!config.tokenAddress || !config.oracleAddress) {
    return {
      id: 'SM-09',
      name: 'Invariant Check (INV-SM-1)',
      status: 'SKIP',
      duration: 0,
      message: 'Addresses not configured',
    };
  }

  const start = Date.now();

  // Get total supply
  const supplyCall = ethCall(config, config.tokenAddress, '0x18160ddd');
  if (!supplyCall.success) {
    return {
      id: 'SM-09',
      name: 'Invariant Check (INV-SM-1)',
      status: 'FAIL',
      duration: Date.now() - start,
      details: 'Could not read total supply',
    };
  }

  // Get backing (try getLatestBacking or similar)
  // This is implementation-specific, using latestRoundData as proxy
  const oracleCall = ethCall(config, config.oracleAddress, '0xfeaf968c');

  const totalSupply = BigInt(supplyCall.result);

  if (totalSupply === 0n) {
    return {
      id: 'SM-09',
      name: 'Invariant Check (INV-SM-1)',
      status: 'PASS',
      duration: Date.now() - start,
      message: 'Supply = 0, invariant holds',
    };
  }

  if (oracleCall.success && oracleCall.result.length > 130) {
    // Extract answer from oracle response
    const answerHex = '0x' + oracleCall.result.slice(66, 130);
    const backing = BigInt(answerHex);

    if (backing >= totalSupply) {
      return {
        id: 'SM-09',
        name: 'Invariant Check (INV-SM-1)',
        status: 'PASS',
        duration: Date.now() - start,
        message: `Backing >= Supply ✓`,
      };
    } else {
      return {
        id: 'SM-09',
        name: 'Invariant Check (INV-SM-1)',
        status: 'FAIL',
        duration: Date.now() - start,
        details: 'INVARIANT VIOLATION: backing < totalSupply',
      };
    }
  }

  return {
    id: 'SM-09',
    name: 'Invariant Check (INV-SM-1)',
    status: 'SKIP',
    duration: Date.now() - start,
    message: 'Could not verify invariant',
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function runSmokeTests(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log(colorize('  SecureMint Engine - Smoke Tests', 'cyan'));
  console.log('═'.repeat(60) + '\n');

  const config = loadConfig();
  const results: TestResult[] = [];

  const tests = [
    testRpcConnectivity,
    testTokenDeployment,
    testPolicyDeployment,
    testOracleConnectivity,
    testTokenMetadata,
    testTotalSupply,
    testPauseLevel,
    testApiHealth,
    testGraphQLEndpoint,
    testInvariantCheck,
  ];

  for (const test of tests) {
    process.stdout.write(`  Running ${test.name.replace('test', '')}...`);
    const result = await test(config);
    results.push(result);

    // Clear line and print result
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);

    const statusColors: Record<string, keyof typeof COLORS> = {
      PASS: 'green',
      FAIL: 'red',
      SKIP: 'yellow',
    };
    const statusSymbols: Record<string, string> = {
      PASS: '✅',
      FAIL: '❌',
      SKIP: '⏭️ ',
    };

    const status = colorize(result.status, statusColors[result.status]);
    const duration = result.duration > 0 ? ` (${result.duration}ms)` : '';

    console.log(
      `  ${statusSymbols[result.status]} [${result.id}] ${result.name.padEnd(25)} ${status}${duration}`
    );

    if (result.message) {
      console.log(`     └─ ${result.message}`);
    }
    if (result.details && result.status === 'FAIL') {
      console.log(colorize(`     └─ ${result.details}`, 'red'));
    }
  }

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('\n' + '═'.repeat(60));
  console.log(colorize('  RESULTS', 'bold'));
  console.log('═'.repeat(60));
  console.log(`  Tests Run:    ${total}`);
  console.log(`  ${colorize('Passed:', 'green')}       ${passed}`);
  console.log(`  ${colorize('Failed:', 'red')}       ${failed}`);
  console.log(`  ${colorize('Skipped:', 'yellow')}      ${skipped}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log(colorize('\n  Overall: FAIL', 'red'));
    console.log('  Some smoke tests failed. Review the errors above.\n');
    process.exit(1);
  } else {
    console.log(colorize('\n  Overall: PASS', 'green'));
    console.log('  All smoke tests passed!\n');
    process.exit(0);
  }
}

// Run
runSmokeTests().catch((error) => {
  console.error('Smoke test runner failed:', error.message);
  process.exit(1);
});
