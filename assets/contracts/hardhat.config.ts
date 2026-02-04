import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY || "0x" + "0".repeat(64);

const accounts = [DEPLOYER_PRIVATE_KEY, OPERATOR_PRIVATE_KEY];

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "paris",
    },
  },

  networks: {
    // Local
    hardhat: {
      chainId: 31337,
      forking: process.env.MAINNET_RPC_URL
        ? {
            url: process.env.MAINNET_RPC_URL,
            blockNumber: 18500000,
          }
        : undefined,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000", // 10000 ETH
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Testnets
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts,
      gasPrice: "auto",
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "https://rpc.ankr.com/eth_goerli",
      chainId: 5,
      accounts,
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      chainId: 80001,
      accounts,
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts,
    },

    // Mainnets
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com",
      chainId: 1,
      accounts,
      gasPrice: "auto",
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts,
      gasPrice: "auto",
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts,
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      chainId: 10,
      accounts,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts,
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts,
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      avalanche: process.env.SNOWTRACE_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
    },
  },

  sourcify: {
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLUGINS
  // ═══════════════════════════════════════════════════════════════════════════

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: process.env.GAS_REPORT_FILE,
    noColors: !!process.env.GAS_REPORT_FILE,
    excludeContracts: ["mocks/", "test/"],
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: process.env.CONTRACT_SIZER === "true",
    strict: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PATHS
  // ═══════════════════════════════════════════════════════════════════════════

  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NAMED ACCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════

  namedAccounts: {
    deployer: {
      default: 0,
    },
    operator: {
      default: 1,
    },
    guardian: {
      default: 2,
    },
    treasury: {
      default: 3,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCHA
  // ═══════════════════════════════════════════════════════════════════════════

  mocha: {
    timeout: 200000,
    parallel: false,
  },
};

export default config;
