/**
 * SecureMint Engine - Contract Verification Scripts
 * Automated verification on Etherscan, Sourcify, and Blockscout
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VerificationConfig {
  network: string;
  chainId: number;
  contractAddress: string;
  contractName: string;
  constructorArgs?: any[];
  compilerVersion: string;
  optimizationRuns: number;
  libraries?: Record<string, string>;
}

interface VerificationResult {
  platform: string;
  success: boolean;
  message: string;
  guid?: string;
  url?: string;
}

interface NetworkConfig {
  chainId: number;
  etherscanApiUrl: string;
  etherscanApiKey: string;
  sourcifyApiUrl: string;
  blockscoutApiUrl?: string;
  explorerUrl: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK CONFIGS
// ═══════════════════════════════════════════════════════════════════════════════

const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    chainId: 1,
    etherscanApiUrl: 'https://api.etherscan.io/api',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || '',
    sourcifyApiUrl: 'https://sourcify.dev/server',
    explorerUrl: 'https://etherscan.io',
  },
  sepolia: {
    chainId: 11155111,
    etherscanApiUrl: 'https://api-sepolia.etherscan.io/api',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || '',
    sourcifyApiUrl: 'https://sourcify.dev/server',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  polygon: {
    chainId: 137,
    etherscanApiUrl: 'https://api.polygonscan.com/api',
    etherscanApiKey: process.env.POLYGONSCAN_API_KEY || '',
    sourcifyApiUrl: 'https://sourcify.dev/server',
    explorerUrl: 'https://polygonscan.com',
  },
  arbitrum: {
    chainId: 42161,
    etherscanApiUrl: 'https://api.arbiscan.io/api',
    etherscanApiKey: process.env.ARBISCAN_API_KEY || '',
    sourcifyApiUrl: 'https://sourcify.dev/server',
    explorerUrl: 'https://arbiscan.io',
  },
  optimism: {
    chainId: 10,
    etherscanApiUrl: 'https://api-optimistic.etherscan.io/api',
    etherscanApiKey: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || '',
    sourcifyApiUrl: 'https://sourcify.dev/server',
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  base: {
    chainId: 8453,
    etherscanApiUrl: 'https://api.basescan.org/api',
    etherscanApiKey: process.env.BASESCAN_API_KEY || '',
    sourcifyApiUrl: 'https://sourcify.dev/server',
    explorerUrl: 'https://basescan.org',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT VERIFIER
// ═══════════════════════════════════════════════════════════════════════════════

export class ContractVerifier {
  private networkConfig: NetworkConfig;

  constructor(network: string) {
    const config = NETWORKS[network];
    if (!config) {
      throw new Error(`Unsupported network: ${network}`);
    }
    this.networkConfig = config;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ETHERSCAN VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  async verifyOnEtherscan(config: VerificationConfig): Promise<VerificationResult> {
    console.log(`\nVerifying ${config.contractName} on Etherscan...`);

    try {
      // Get flattened source code
      const sourceCode = await this.getFlattenedSource(config.contractName);

      // Encode constructor arguments
      const encodedArgs = config.constructorArgs
        ? this.encodeConstructorArgs(config.constructorArgs)
        : '';

      const params = new URLSearchParams({
        apikey: this.networkConfig.etherscanApiKey,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: config.contractAddress,
        sourceCode: sourceCode,
        codeformat: 'solidity-single-file',
        contractname: config.contractName,
        compilerversion: `v${config.compilerVersion}`,
        optimizationUsed: '1',
        runs: config.optimizationRuns.toString(),
        constructorArguements: encodedArgs,
        evmversion: 'paris',
        licenseType: '3', // MIT
      });

      // Add libraries if present
      if (config.libraries) {
        let libIndex = 1;
        for (const [name, address] of Object.entries(config.libraries)) {
          params.append(`libraryname${libIndex}`, name);
          params.append(`libraryaddress${libIndex}`, address);
          libIndex++;
        }
      }

      const response = await axios.post(
        this.networkConfig.etherscanApiUrl,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (response.data.status === '1') {
        const guid = response.data.result;

        // Check verification status
        const verificationResult = await this.checkEtherscanStatus(guid);

        return {
          platform: 'Etherscan',
          success: verificationResult.success,
          message: verificationResult.message,
          guid,
          url: `${this.networkConfig.explorerUrl}/address/${config.contractAddress}#code`,
        };
      } else {
        return {
          platform: 'Etherscan',
          success: false,
          message: response.data.result || 'Verification failed',
        };
      }
    } catch (error: any) {
      return {
        platform: 'Etherscan',
        success: false,
        message: error.message,
      };
    }
  }

  private async checkEtherscanStatus(
    guid: string,
    maxAttempts = 10
  ): Promise<{ success: boolean; message: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await axios.get(this.networkConfig.etherscanApiUrl, {
        params: {
          apikey: this.networkConfig.etherscanApiKey,
          module: 'contract',
          action: 'checkverifystatus',
          guid,
        },
      });

      if (response.data.result === 'Pending in queue') {
        console.log('  Verification pending...');
        continue;
      }

      if (response.data.result.includes('Pass')) {
        return { success: true, message: 'Verification successful' };
      }

      return { success: false, message: response.data.result };
    }

    return { success: false, message: 'Verification timeout' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOURCIFY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  async verifyOnSourcify(config: VerificationConfig): Promise<VerificationResult> {
    console.log(`\nVerifying ${config.contractName} on Sourcify...`);

    try {
      // Prepare metadata and source files
      const files = await this.prepareSourcifyFiles(config.contractName);

      const formData = new FormData();
      formData.append('address', config.contractAddress);
      formData.append('chain', this.networkConfig.chainId.toString());

      for (const file of files) {
        formData.append('files', new Blob([file.content]), file.name);
      }

      const response = await axios.post(
        `${this.networkConfig.sourcifyApiUrl}/verify`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.result && response.data.result[0]?.status === 'perfect') {
        return {
          platform: 'Sourcify',
          success: true,
          message: 'Perfect match verification',
          url: `https://sourcify.dev/#/lookup/${config.contractAddress}`,
        };
      } else if (response.data.result && response.data.result[0]?.status === 'partial') {
        return {
          platform: 'Sourcify',
          success: true,
          message: 'Partial match verification',
          url: `https://sourcify.dev/#/lookup/${config.contractAddress}`,
        };
      }

      return {
        platform: 'Sourcify',
        success: false,
        message: 'Verification failed',
      };
    } catch (error: any) {
      return {
        platform: 'Sourcify',
        success: false,
        message: error.response?.data?.error || error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HARDHAT VERIFICATION (RECOMMENDED)
  // ═══════════════════════════════════════════════════════════════════════════

  async verifyWithHardhat(config: VerificationConfig): Promise<VerificationResult> {
    console.log(`\nVerifying ${config.contractName} with Hardhat...`);

    try {
      const argsFile = path.join(__dirname, '..', '..', 'verify-args.js');

      // Write constructor args to file
      if (config.constructorArgs && config.constructorArgs.length > 0) {
        const argsContent = `module.exports = ${JSON.stringify(config.constructorArgs, null, 2)};`;
        fs.writeFileSync(argsFile, argsContent);
      }

      const command = [
        'npx hardhat verify',
        `--network ${config.network}`,
        config.contractAddress,
        config.constructorArgs?.length ? `--constructor-args ${argsFile}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      execSync(command, { stdio: 'inherit' });

      // Cleanup
      if (fs.existsSync(argsFile)) {
        fs.unlinkSync(argsFile);
      }

      return {
        platform: 'Hardhat',
        success: true,
        message: 'Verification successful',
        url: `${this.networkConfig.explorerUrl}/address/${config.contractAddress}#code`,
      };
    } catch (error: any) {
      return {
        platform: 'Hardhat',
        success: false,
        message: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getFlattenedSource(contractName: string): Promise<string> {
    const contractPath = `contracts/src/${contractName}.sol`;
    const output = execSync(`npx hardhat flatten ${contractPath}`);
    return output.toString();
  }

  private async prepareSourcifyFiles(contractName: string): Promise<Array<{ name: string; content: string }>> {
    const files: Array<{ name: string; content: string }> = [];

    // Read build info
    const artifactsDir = path.join(__dirname, '..', '..', 'artifacts', 'contracts', 'src');
    const contractDir = path.join(artifactsDir, `${contractName}.sol`);
    const artifactPath = path.join(contractDir, `${contractName}.json`);

    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      files.push({
        name: 'metadata.json',
        content: JSON.stringify(artifact),
      });
    }

    // Add source files
    const sourceDir = path.join(__dirname, '..', '..', 'contracts', 'src');
    const addSourceFiles = (dir: string, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          addSourceFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        } else if (entry.name.endsWith('.sol')) {
          files.push({
            name: `${prefix}${entry.name}`,
            content: fs.readFileSync(path.join(dir, entry.name), 'utf8'),
          });
        }
      }
    };
    addSourceFiles(sourceDir);

    return files;
  }

  private encodeConstructorArgs(args: any[]): string {
    // Would use ethers.js ABI encoder
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function verifyAllContracts(
  network: string,
  deploymentPath: string
): Promise<void> {
  const verifier = new ContractVerifier(network);

  // Load deployment data
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

  const contracts = [
    { name: 'SecureMintToken', address: deployment.token },
    { name: 'SecureMintPolicy', address: deployment.policy },
    { name: 'BackingOracle', address: deployment.oracle },
    { name: 'TreasuryVault', address: deployment.treasury },
    { name: 'RedemptionEngine', address: deployment.redemption },
    { name: 'EmergencyPause', address: deployment.emergencyPause },
  ];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SecureMint Contract Verification');
  console.log(`Network: ${network}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const results: VerificationResult[] = [];

  for (const contract of contracts) {
    if (!contract.address) continue;

    const result = await verifier.verifyWithHardhat({
      network,
      chainId: NETWORKS[network].chainId,
      contractAddress: contract.address,
      contractName: contract.name,
      compilerVersion: '0.8.20',
      optimizationRuns: 200,
    });

    results.push(result);
    console.log(`  ${contract.name}: ${result.success ? '✓' : '✗'} ${result.message}`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Verification Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${results.filter((r) => r.success).length}`);
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const network = args[0] || 'sepolia';
  const deploymentPath = args[1] || `deployments/${network}/deployment.json`;

  await verifyAllContracts(network, deploymentPath);
}

main().catch(console.error);

export default ContractVerifier;
