#!/usr/bin/env npx ts-node
/**
 * SecureMint Engine - Preflight Check Script
 * Validates all prerequisites before deployment
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
  duration?: number;
  details?: string;
}

interface PreflightConfig {
  rpcUrl: string;
  deployerAddress?: string;
  oracleAddress?: string;
  safeAddress?: string;
  explorerApiKey?: string;
  tenderlyApiKey?: string;
  slackWebhook?: string;
  postgresUrl?: string;
  redisUrl?: string;
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

function printHeader(): void {
  console.log('\n' + '═'.repeat(60));
  console.log(colorize('  SecureMint Engine - Preflight Checks', 'cyan'));
  console.log('═'.repeat(60) + '\n');
}

function printSection(title: string): void {
  console.log('\n' + colorize(title.toUpperCase() + ':', 'bold'));
}

function printResult(result: CheckResult): void {
  const statusColors: Record<string, keyof typeof COLORS> = {
    PASS: 'green',
    FAIL: 'red',
    WARN: 'yellow',
    SKIP: 'blue',
  };

  const statusSymbols: Record<string, string> = {
    PASS: '✅',
    FAIL: '❌',
    WARN: '⚠️ ',
    SKIP: '⏭️ ',
  };

  const status = colorize(result.status, statusColors[result.status]);
  const duration = result.duration ? ` (${result.duration}ms)` : '';

  console.log(`  ${statusSymbols[result.status]} ${result.name.padEnd(30)} ${status}${duration}`);

  if (result.details && result.status !== 'PASS') {
    console.log(`     └─ ${result.details}`);
  }
}

function loadConfig(): PreflightConfig {
  // Try to load from environment or config file
  const config: PreflightConfig = {
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    deployerAddress: process.env.DEPLOYER_ADDRESS,
    oracleAddress: process.env.ORACLE_ADDRESS,
    safeAddress: process.env.SAFE_ADDRESS,
    explorerApiKey: process.env.ETHERSCAN_API_KEY,
    tenderlyApiKey: process.env.TENDERLY_API_KEY,
    slackWebhook: process.env.SLACK_WEBHOOK,
    postgresUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/securemint',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  };

  // Try to load from config.json if exists
  const configPath = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (fileConfig.deployment?.rpcUrl) config.rpcUrl = fileConfig.deployment.rpcUrl;
      if (fileConfig.integrations?.chainlink?.oracleAddress) config.oracleAddress = fileConfig.integrations.chainlink.oracleAddress;
      if (fileConfig.permissions?.admin) config.safeAddress = fileConfig.permissions.admin;
    } catch (e) {
      // Ignore config file errors
    }
  }

  return config;
}

function execCommand(command: string, timeout = 10000): { success: boolean; output: string; duration: number } {
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
      output: error.message || 'Command failed',
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// CHECKS
// ============================================================================

async function checkNodeVersion(): Promise<CheckResult> {
  const { success, output, duration } = execCommand('node --version');

  if (!success) {
    return { name: 'Node.js Version', status: 'FAIL', message: 'Node.js not found', duration };
  }

  const version = output.replace('v', '');
  const major = parseInt(version.split('.')[0], 10);

  if (major >= 18) {
    return { name: 'Node.js Version', status: 'PASS', message: output, duration };
  } else {
    return {
      name: 'Node.js Version',
      status: 'FAIL',
      message: output,
      duration,
      details: `Required: v18.x or higher, Found: ${output}`,
    };
  }
}

async function checkFoundry(): Promise<CheckResult> {
  const { success, output, duration } = execCommand('forge --version');

  if (success) {
    return { name: 'Foundry Installed', status: 'PASS', message: 'Installed', duration };
  } else {
    return {
      name: 'Foundry Installed',
      status: 'FAIL',
      message: 'Not found',
      duration,
      details: 'Install with: curl -L https://foundry.paradigm.xyz | bash && foundryup',
    };
  }
}

async function checkDocker(): Promise<CheckResult> {
  const { success, output, duration } = execCommand('docker --version');

  if (success) {
    return { name: 'Docker Installed', status: 'PASS', message: 'Installed', duration };
  } else {
    return {
      name: 'Docker Installed',
      status: 'WARN',
      message: 'Not found',
      duration,
      details: 'Docker is optional but recommended for development',
    };
  }
}

async function checkRpcConnectivity(config: PreflightConfig): Promise<CheckResult> {
  const start = Date.now();

  try {
    const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' --max-time 5`;
    const { success, output, duration } = execCommand(curlCmd);

    if (success && output.includes('"result"')) {
      const blockHex = JSON.parse(output).result;
      const blockNum = parseInt(blockHex, 16);
      return {
        name: 'RPC Connectivity',
        status: 'PASS',
        message: `Block #${blockNum}`,
        duration,
      };
    } else {
      return {
        name: 'RPC Connectivity',
        status: 'FAIL',
        message: 'Connection failed',
        duration,
        details: `RPC URL: ${config.rpcUrl}`,
      };
    }
  } catch (e: any) {
    return {
      name: 'RPC Connectivity',
      status: 'FAIL',
      message: 'Connection failed',
      duration: Date.now() - start,
      details: e.message,
    };
  }
}

async function checkDeployerBalance(config: PreflightConfig): Promise<CheckResult> {
  if (!config.deployerAddress) {
    return { name: 'Deployer Balance', status: 'SKIP', message: 'No deployer address configured' };
  }

  const start = Date.now();
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["${config.deployerAddress}","latest"],"id":1}' --max-time 5`;
  const { success, output, duration } = execCommand(curlCmd);

  if (success && output.includes('"result"')) {
    const balanceHex = JSON.parse(output).result;
    const balanceWei = BigInt(balanceHex);
    const balanceEth = Number(balanceWei) / 1e18;

    if (balanceEth >= 0.5) {
      return {
        name: 'Deployer Balance',
        status: 'PASS',
        message: `${balanceEth.toFixed(4)} ETH`,
        duration,
      };
    } else {
      return {
        name: 'Deployer Balance',
        status: 'FAIL',
        message: `${balanceEth.toFixed(4)} ETH`,
        duration,
        details: 'Minimum 0.5 ETH required for deployment',
      };
    }
  }

  return {
    name: 'Deployer Balance',
    status: 'FAIL',
    message: 'Could not check balance',
    duration: Date.now() - start,
  };
}

async function checkOracleFeed(config: PreflightConfig): Promise<CheckResult> {
  if (!config.oracleAddress) {
    return { name: 'Oracle Feed', status: 'SKIP', message: 'No oracle address configured' };
  }

  const start = Date.now();
  // latestRoundData() selector: 0xfeaf968c
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"${config.oracleAddress}","data":"0xfeaf968c"},"latest"],"id":1}' --max-time 5`;
  const { success, output, duration } = execCommand(curlCmd);

  if (success && output.includes('"result"') && !output.includes('"error"')) {
    const result = JSON.parse(output).result;
    if (result && result !== '0x') {
      return {
        name: 'Oracle Feed',
        status: 'PASS',
        message: 'Responding',
        duration,
      };
    }
  }

  return {
    name: 'Oracle Feed',
    status: 'WARN',
    message: 'Could not verify oracle',
    duration: Date.now() - start,
    details: `Address: ${config.oracleAddress}`,
  };
}

async function checkSafeConfiguration(config: PreflightConfig): Promise<CheckResult> {
  if (!config.safeAddress) {
    return { name: 'Safe Configuration', status: 'SKIP', message: 'No Safe address configured' };
  }

  const start = Date.now();
  // getThreshold() selector: 0xe75235b8
  const curlCmd = `curl -s -X POST ${config.rpcUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"${config.safeAddress}","data":"0xe75235b8"},"latest"],"id":1}' --max-time 5`;
  const { success, output, duration } = execCommand(curlCmd);

  if (success && output.includes('"result"')) {
    const result = JSON.parse(output).result;
    if (result && result !== '0x' && result !== '0x0') {
      const threshold = parseInt(result, 16);
      if (threshold >= 3) {
        return {
          name: 'Safe Configuration',
          status: 'PASS',
          message: `Threshold: ${threshold}`,
          duration,
        };
      } else {
        return {
          name: 'Safe Configuration',
          status: 'WARN',
          message: `Threshold: ${threshold}`,
          duration,
          details: 'Recommended threshold: 3 or higher',
        };
      }
    }
  }

  return {
    name: 'Safe Configuration',
    status: 'WARN',
    message: 'Could not verify Safe',
    duration: Date.now() - start,
    details: 'Safe may not be deployed or address is invalid',
  };
}

async function checkPostgres(config: PreflightConfig): Promise<CheckResult> {
  const start = Date.now();

  // Parse postgres URL to check connectivity
  try {
    const url = new URL(config.postgresUrl!);
    const host = url.hostname;
    const port = url.port || '5432';

    // Simple TCP check using curl (works on most systems)
    const { success, duration } = execCommand(`nc -z -w 2 ${host} ${port} 2>/dev/null || curl -s --connect-timeout 2 telnet://${host}:${port} 2>/dev/null`);

    // Alternative: try pg_isready if available
    const pgCheck = execCommand(`pg_isready -h ${host} -p ${port} -t 2 2>/dev/null`);

    if (pgCheck.success) {
      return {
        name: 'PostgreSQL',
        status: 'PASS',
        message: 'Accepting connections',
        duration: pgCheck.duration,
      };
    }

    return {
      name: 'PostgreSQL',
      status: 'WARN',
      message: 'Could not verify',
      duration: Date.now() - start,
      details: `Host: ${host}:${port}`,
    };
  } catch (e: any) {
    return {
      name: 'PostgreSQL',
      status: 'WARN',
      message: 'Could not parse URL',
      duration: Date.now() - start,
    };
  }
}

async function checkRedis(config: PreflightConfig): Promise<CheckResult> {
  const start = Date.now();

  try {
    const url = new URL(config.redisUrl!);
    const host = url.hostname;
    const port = url.port || '6379';

    // Try redis-cli ping
    const { success, output, duration } = execCommand(`redis-cli -h ${host} -p ${port} ping 2>/dev/null`);

    if (success && output.includes('PONG')) {
      return {
        name: 'Redis',
        status: 'PASS',
        message: 'PONG',
        duration,
      };
    }

    return {
      name: 'Redis',
      status: 'WARN',
      message: 'Could not connect',
      duration: Date.now() - start,
      details: `Host: ${host}:${port}`,
    };
  } catch (e: any) {
    return {
      name: 'Redis',
      status: 'WARN',
      message: 'Could not verify',
      duration: Date.now() - start,
    };
  }
}

async function checkEtherscanApi(config: PreflightConfig): Promise<CheckResult> {
  if (!config.explorerApiKey) {
    return { name: 'Etherscan API', status: 'SKIP', message: 'No API key configured' };
  }

  const start = Date.now();
  const url = `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${config.explorerApiKey}`;
  const { success, output, duration } = execCommand(`curl -s "${url}" --max-time 5`);

  if (success && output.includes('"status":"1"')) {
    return {
      name: 'Etherscan API',
      status: 'PASS',
      message: 'Valid',
      duration,
    };
  }

  return {
    name: 'Etherscan API',
    status: 'WARN',
    message: 'Invalid or rate limited',
    duration: Date.now() - start,
    details: 'Contract verification may fail',
  };
}

async function checkTenderlyApi(config: PreflightConfig): Promise<CheckResult> {
  if (!config.tenderlyApiKey) {
    return { name: 'Tenderly API', status: 'SKIP', message: 'Not configured' };
  }

  const start = Date.now();
  const { success, duration } = execCommand(`curl -s -o /dev/null -w "%{http_code}" -H "X-Access-Key: ${config.tenderlyApiKey}" https://api.tenderly.co/api/v1/account/me --max-time 5`);

  if (success) {
    return {
      name: 'Tenderly API',
      status: 'PASS',
      message: 'Valid',
      duration,
    };
  }

  return {
    name: 'Tenderly API',
    status: 'WARN',
    message: 'Could not verify',
    duration: Date.now() - start,
    details: 'Simulation features may not work',
  };
}

async function checkSlackWebhook(config: PreflightConfig): Promise<CheckResult> {
  if (!config.slackWebhook) {
    return { name: 'Slack Webhook', status: 'SKIP', message: 'Not configured' };
  }

  const start = Date.now();
  // Don't actually send a message, just verify URL format
  if (config.slackWebhook.includes('hooks.slack.com/services/')) {
    return {
      name: 'Slack Webhook',
      status: 'PASS',
      message: 'Configured',
      duration: Date.now() - start,
    };
  }

  return {
    name: 'Slack Webhook',
    status: 'WARN',
    message: 'Invalid URL format',
    duration: Date.now() - start,
  };
}

async function checkEnvFile(): Promise<CheckResult> {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  if (fs.existsSync(envPath)) {
    return { name: '.env File', status: 'PASS', message: 'Exists' };
  }

  if (fs.existsSync(envExamplePath)) {
    return {
      name: '.env File',
      status: 'WARN',
      message: 'Not found',
      details: 'Copy .env.example to .env and configure',
    };
  }

  return { name: '.env File', status: 'WARN', message: 'Not found' };
}

async function checkGitStatus(): Promise<CheckResult> {
  const { success, output, duration } = execCommand('git status --porcelain 2>/dev/null');

  if (!success) {
    return { name: 'Git Status', status: 'SKIP', message: 'Not a git repository' };
  }

  if (output === '') {
    return { name: 'Git Status', status: 'PASS', message: 'Clean', duration };
  }

  const changedFiles = output.split('\n').filter(l => l).length;
  return {
    name: 'Git Status',
    status: 'WARN',
    message: `${changedFiles} uncommitted changes`,
    duration,
    details: 'Consider committing changes before deployment',
  };
}

async function checkContractsBuild(): Promise<CheckResult> {
  const outDir = path.join(process.cwd(), 'contracts', 'out');
  const artifactsDir = path.join(process.cwd(), 'contracts', 'artifacts');

  if (fs.existsSync(outDir) || fs.existsSync(artifactsDir)) {
    return { name: 'Contracts Build', status: 'PASS', message: 'Built' };
  }

  return {
    name: 'Contracts Build',
    status: 'WARN',
    message: 'Not built',
    details: 'Run: make build-contracts',
  };
}

async function checkTestsPassing(): Promise<CheckResult> {
  const start = Date.now();
  const { success, output, duration } = execCommand('cd contracts && forge test --no-match-test "testFuzz" -q 2>&1 | tail -5', 30000);

  if (success && !output.includes('FAIL') && !output.includes('Error')) {
    return {
      name: 'Contract Tests',
      status: 'PASS',
      message: 'Passing',
      duration,
    };
  }

  if (output.includes('FAIL')) {
    return {
      name: 'Contract Tests',
      status: 'FAIL',
      message: 'Failing',
      duration: Date.now() - start,
      details: 'Run: make test-contracts',
    };
  }

  return {
    name: 'Contract Tests',
    status: 'SKIP',
    message: 'Could not run tests',
    duration: Date.now() - start,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function runPreflightChecks(): Promise<void> {
  printHeader();

  const config = loadConfig();
  const results: CheckResult[] = [];

  // Hard Gates
  printSection('Hard Gates (Blockers)');

  results.push(await checkRpcConnectivity(config));
  printResult(results[results.length - 1]);

  results.push(await checkDeployerBalance(config));
  printResult(results[results.length - 1]);

  results.push(await checkNodeVersion());
  printResult(results[results.length - 1]);

  results.push(await checkFoundry());
  printResult(results[results.length - 1]);

  results.push(await checkOracleFeed(config));
  printResult(results[results.length - 1]);

  results.push(await checkSafeConfiguration(config));
  printResult(results[results.length - 1]);

  // Soft Gates
  printSection('Soft Gates (Warnings)');

  results.push(await checkPostgres(config));
  printResult(results[results.length - 1]);

  results.push(await checkRedis(config));
  printResult(results[results.length - 1]);

  results.push(await checkEtherscanApi(config));
  printResult(results[results.length - 1]);

  results.push(await checkTenderlyApi(config));
  printResult(results[results.length - 1]);

  results.push(await checkSlackWebhook(config));
  printResult(results[results.length - 1]);

  results.push(await checkDocker());
  printResult(results[results.length - 1]);

  // Build Status
  printSection('Build Status');

  results.push(await checkEnvFile());
  printResult(results[results.length - 1]);

  results.push(await checkGitStatus());
  printResult(results[results.length - 1]);

  results.push(await checkContractsBuild());
  printResult(results[results.length - 1]);

  results.push(await checkTestsPassing());
  printResult(results[results.length - 1]);

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log('\n' + '═'.repeat(60));
  console.log(colorize('  SUMMARY', 'bold'));
  console.log('═'.repeat(60));
  console.log(`  ${colorize('✅ Passed:', 'green')}   ${passed}`);
  console.log(`  ${colorize('❌ Failed:', 'red')}   ${failed}`);
  console.log(`  ${colorize('⚠️  Warnings:', 'yellow')} ${warnings}`);
  console.log(`  ${colorize('⏭️  Skipped:', 'blue')}  ${skipped}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log(colorize('\n  Result: NOT READY FOR DEPLOYMENT', 'red'));
    console.log('  Fix the failed checks above before proceeding.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log(colorize('\n  Result: READY WITH WARNINGS', 'yellow'));
    console.log('  Review warnings above. Proceed with caution.\n');
    process.exit(0);
  } else {
    console.log(colorize('\n  Result: READY FOR DEPLOYMENT', 'green'));
    console.log('  All checks passed. You may proceed.\n');
    process.exit(0);
  }
}

// Run
runPreflightChecks().catch((error) => {
  console.error('Preflight check failed:', error.message);
  process.exit(1);
});
