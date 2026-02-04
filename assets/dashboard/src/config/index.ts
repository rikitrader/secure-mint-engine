export interface DashboardConfig {
  rpcUrl: string;
  networkName: string;
  chainId: number;
  subgraphUrl?: string;
  contracts: {
    token: string;
    policy: string;
    oracle: string;
    treasury: string;
    redemption: string;
    governor: string;
    emergencyPause: string;
  };
}

// Default configuration - override with environment variables
export const config: DashboardConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545',
  networkName: process.env.NEXT_PUBLIC_NETWORK_NAME || 'Localhost',
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337'),
  subgraphUrl: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
  contracts: {
    token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    policy: process.env.NEXT_PUBLIC_POLICY_ADDRESS || '0x0000000000000000000000000000000000000000',
    oracle: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || '0x0000000000000000000000000000000000000000',
    treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000',
    redemption: process.env.NEXT_PUBLIC_REDEMPTION_ADDRESS || '0x0000000000000000000000000000000000000000',
    governor: process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS || '0x0000000000000000000000000000000000000000',
    emergencyPause: process.env.NEXT_PUBLIC_EMERGENCY_PAUSE_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
};

// Network configurations
export const networks: Record<string, Partial<DashboardConfig>> = {
  mainnet: {
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    networkName: 'Ethereum Mainnet',
    chainId: 1,
  },
  sepolia: {
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
    networkName: 'Sepolia Testnet',
    chainId: 11155111,
  },
  base: {
    rpcUrl: 'https://mainnet.base.org',
    networkName: 'Base',
    chainId: 8453,
  },
  arbitrum: {
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    networkName: 'Arbitrum One',
    chainId: 42161,
  },
};
