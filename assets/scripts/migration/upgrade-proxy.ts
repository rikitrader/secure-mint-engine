/**
 * SecureMint Engine - UUPS Proxy Upgrade Scripts
 * Safe contract upgrade automation with validation
 */

import { ethers, upgrades } from 'hardhat';
import { Contract, Signer } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UpgradeConfig {
  proxyAddress: string;
  newImplementationName: string;
  validateStorage: boolean;
  validateCode: boolean;
  multisig?: string;
  timelock?: string;
  dryRun: boolean;
}

interface UpgradeResult {
  success: boolean;
  proxyAddress: string;
  oldImplementation: string;
  newImplementation: string;
  transactionHash?: string;
  validationResults: ValidationResult[];
  error?: string;
}

interface ValidationResult {
  check: string;
  passed: boolean;
  details: string;
}

interface StorageLayout {
  storage: Array<{
    label: string;
    offset: number;
    slot: string;
    type: string;
  }>;
  types: Record<string, { encoding: string; label: string; numberOfBytes: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPGRADE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class UpgradeManager {
  private signer: Signer;
  private networkName: string;
  private deploymentsDir: string;

  constructor(signer: Signer, networkName: string) {
    this.signer = signer;
    this.networkName = networkName;
    this.deploymentsDir = path.join(__dirname, '..', '..', 'deployments', networkName);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN UPGRADE FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════

  async upgradeProxy(config: UpgradeConfig): Promise<UpgradeResult> {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SecureMint Proxy Upgrade');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const validationResults: ValidationResult[] = [];
    const result: UpgradeResult = {
      success: false,
      proxyAddress: config.proxyAddress,
      oldImplementation: '',
      newImplementation: '',
      validationResults,
    };

    try {
      // Step 1: Get current implementation
      console.log('Step 1: Fetching current implementation...');
      const currentImpl = await this.getCurrentImplementation(config.proxyAddress);
      result.oldImplementation = currentImpl;
      console.log(`  Current implementation: ${currentImpl}`);

      // Step 2: Validate storage layout compatibility
      if (config.validateStorage) {
        console.log('\nStep 2: Validating storage layout...');
        const storageValidation = await this.validateStorageLayout(
          config.proxyAddress,
          config.newImplementationName
        );
        validationResults.push(storageValidation);

        if (!storageValidation.passed) {
          throw new Error(`Storage validation failed: ${storageValidation.details}`);
        }
        console.log('  ✓ Storage layout compatible');
      }

      // Step 3: Validate new implementation code
      if (config.validateCode) {
        console.log('\nStep 3: Validating new implementation...');
        const codeValidation = await this.validateImplementation(config.newImplementationName);
        validationResults.push(codeValidation);

        if (!codeValidation.passed) {
          throw new Error(`Code validation failed: ${codeValidation.details}`);
        }
        console.log('  ✓ Implementation code validated');
      }

      // Step 4: Deploy new implementation
      console.log('\nStep 4: Deploying new implementation...');
      const NewImplementation = await ethers.getContractFactory(config.newImplementationName);

      if (config.dryRun) {
        console.log('  [DRY RUN] Would deploy new implementation');
        const estimatedGas = await NewImplementation.signer.estimateGas(
          NewImplementation.getDeployTransaction()
        );
        console.log(`  Estimated gas: ${estimatedGas.toString()}`);
        result.success = true;
        return result;
      }

      // Step 5: Perform upgrade
      console.log('\nStep 5: Performing upgrade...');

      if (config.multisig) {
        // Generate multisig transaction
        console.log('  Generating multisig transaction...');
        const upgradeData = await this.generateUpgradeCalldata(
          config.proxyAddress,
          config.newImplementationName
        );

        console.log(`  Submit this to multisig (${config.multisig}):`);
        console.log(`  To: ${config.proxyAddress}`);
        console.log(`  Data: ${upgradeData}`);

        result.success = true;
        result.newImplementation = 'Pending multisig execution';
      } else {
        // Direct upgrade
        const upgraded = await upgrades.upgradeProxy(config.proxyAddress, NewImplementation, {
          kind: 'uups',
        });

        await upgraded.deploymentTransaction()?.wait();

        const newImpl = await this.getCurrentImplementation(config.proxyAddress);
        result.newImplementation = newImpl;
        result.transactionHash = upgraded.deploymentTransaction()?.hash;

        console.log(`  ✓ Upgrade successful!`);
        console.log(`  New implementation: ${newImpl}`);
        console.log(`  Transaction: ${result.transactionHash}`);

        result.success = true;
      }

      // Step 6: Post-upgrade validation
      console.log('\nStep 6: Post-upgrade validation...');
      const postValidation = await this.validatePostUpgrade(config.proxyAddress);
      validationResults.push(postValidation);

      if (!postValidation.passed) {
        console.warn('  ⚠ Post-upgrade validation warnings');
      } else {
        console.log('  ✓ Post-upgrade validation passed');
      }

      // Save deployment record
      await this.saveUpgradeRecord(result);

      return result;
    } catch (error: any) {
      result.error = error.message;
      console.error(`\n✗ Upgrade failed: ${error.message}`);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async validateStorageLayout(
    proxyAddress: string,
    newImplementationName: string
  ): Promise<ValidationResult> {
    try {
      // Get current storage layout
      const currentLayout = await this.getStorageLayout(proxyAddress);

      // Get new implementation storage layout
      const NewContract = await ethers.getContractFactory(newImplementationName);
      const newLayout = await upgrades.getStorageLayout(NewContract);

      // Compare layouts
      const issues: string[] = [];

      // Check for removed or reordered variables
      for (let i = 0; i < currentLayout.storage.length; i++) {
        const currentVar = currentLayout.storage[i];
        const newVar = newLayout.storage?.[i];

        if (!newVar) {
          issues.push(`Variable '${currentVar.label}' at slot ${currentVar.slot} was removed`);
        } else if (currentVar.slot !== newVar.slot) {
          issues.push(
            `Variable '${currentVar.label}' moved from slot ${currentVar.slot} to ${newVar.slot}`
          );
        } else if (currentVar.type !== newVar.type) {
          issues.push(
            `Variable '${currentVar.label}' type changed from ${currentVar.type} to ${newVar.type}`
          );
        }
      }

      return {
        check: 'storage_layout',
        passed: issues.length === 0,
        details: issues.length > 0 ? issues.join('; ') : 'Storage layout compatible',
      };
    } catch (error: any) {
      return {
        check: 'storage_layout',
        passed: false,
        details: `Failed to validate storage: ${error.message}`,
      };
    }
  }

  async validateImplementation(implementationName: string): Promise<ValidationResult> {
    const issues: string[] = [];

    try {
      const Contract = await ethers.getContractFactory(implementationName);

      // Check 1: Contract compiles
      if (!Contract.bytecode) {
        issues.push('Contract bytecode is empty');
      }

      // Check 2: Has required UUPS functions
      const requiredFunctions = ['proxiableUUID', 'upgradeTo', 'upgradeToAndCall'];
      const abi = Contract.interface;

      for (const fn of requiredFunctions) {
        try {
          abi.getFunction(fn);
        } catch {
          issues.push(`Missing required UUPS function: ${fn}`);
        }
      }

      // Check 3: Has _authorizeUpgrade
      try {
        abi.getFunction('_authorizeUpgrade');
      } catch {
        // Internal function, check bytecode for selector
        const selector = ethers.id('_authorizeUpgrade(address)').slice(0, 10);
        if (!Contract.bytecode.includes(selector.slice(2))) {
          issues.push('Missing _authorizeUpgrade implementation');
        }
      }

      return {
        check: 'implementation_code',
        passed: issues.length === 0,
        details: issues.length > 0 ? issues.join('; ') : 'Implementation code valid',
      };
    } catch (error: any) {
      return {
        check: 'implementation_code',
        passed: false,
        details: `Failed to validate implementation: ${error.message}`,
      };
    }
  }

  async validatePostUpgrade(proxyAddress: string): Promise<ValidationResult> {
    const issues: string[] = [];

    try {
      const proxy = await ethers.getContractAt('UUPSUpgradeable', proxyAddress);

      // Check 1: Proxy is functional
      try {
        await proxy.proxiableUUID();
      } catch {
        issues.push('Proxy not responding to proxiableUUID()');
      }

      // Check 2: Check invariants if SecureMint contract
      try {
        const secureMint = await ethers.getContractAt('SecureMintPolicy', proxyAddress);
        const epochCap = await secureMint.epochCapacity();
        const globalCap = await secureMint.globalCap();

        if (epochCap.eq(0)) {
          issues.push('Epoch capacity is zero after upgrade');
        }
        if (globalCap.eq(0)) {
          issues.push('Global cap is zero after upgrade');
        }
      } catch {
        // Not a SecureMint contract, skip
      }

      return {
        check: 'post_upgrade',
        passed: issues.length === 0,
        details: issues.length > 0 ? issues.join('; ') : 'Post-upgrade validation passed',
      };
    } catch (error: any) {
      return {
        check: 'post_upgrade',
        passed: false,
        details: `Post-upgrade validation failed: ${error.message}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async getCurrentImplementation(proxyAddress: string): Promise<string> {
    // EIP-1967 implementation slot
    const IMPLEMENTATION_SLOT =
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

    const implementation = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);

    return ethers.getAddress('0x' + implementation.slice(-40));
  }

  async getStorageLayout(proxyAddress: string): Promise<StorageLayout> {
    // Try to load from deployments
    const deploymentPath = path.join(this.deploymentsDir, `${proxyAddress}.json`);

    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      return deployment.storageLayout || { storage: [], types: {} };
    }

    return { storage: [], types: {} };
  }

  async generateUpgradeCalldata(proxyAddress: string, newImplementationName: string): Promise<string> {
    const NewImplementation = await ethers.getContractFactory(newImplementationName);
    const newImpl = await NewImplementation.deploy();
    await newImpl.waitForDeployment();

    const proxy = await ethers.getContractAt('UUPSUpgradeable', proxyAddress);
    return proxy.interface.encodeFunctionData('upgradeTo', [await newImpl.getAddress()]);
  }

  async saveUpgradeRecord(result: UpgradeResult): Promise<void> {
    const recordPath = path.join(this.deploymentsDir, 'upgrades.json');

    let records = [];
    if (fs.existsSync(recordPath)) {
      records = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    }

    records.push({
      ...result,
      timestamp: new Date().toISOString(),
      network: this.networkName,
    });

    fs.mkdirSync(this.deploymentsDir, { recursive: true });
    fs.writeFileSync(recordPath, JSON.stringify(records, null, 2));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI SCRIPT
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const manager = new UpgradeManager(signer, network.name);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const proxyAddress = args[0];
  const newImplementationName = args[1];
  const dryRun = args.includes('--dry-run');
  const multisig = args.find((a) => a.startsWith('--multisig='))?.split('=')[1];

  if (!proxyAddress || !newImplementationName) {
    console.log('Usage: npx hardhat run scripts/migration/upgrade-proxy.ts --network <network>');
    console.log('  <proxy_address> <new_implementation_name> [--dry-run] [--multisig=<address>]');
    process.exit(1);
  }

  const result = await manager.upgradeProxy({
    proxyAddress,
    newImplementationName,
    validateStorage: true,
    validateCode: true,
    multisig,
    dryRun,
  });

  if (!result.success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export default UpgradeManager;
