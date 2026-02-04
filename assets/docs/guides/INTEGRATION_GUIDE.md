# SecureMint Engine - Integration Guide

This guide walks you through integrating SecureMint Engine into your application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [SDK Installation](#sdk-installation)
3. [Basic Usage](#basic-usage)
4. [React Integration](#react-integration)
5. [API Integration](#api-integration)
6. [Smart Contract Interaction](#smart-contract-interaction)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Ethereum wallet (MetaMask, etc.)
- RPC endpoint (Alchemy, Infura, etc.)

### Installation

```bash
# Install the SDK
npm install @securemint/sdk ethers

# For React applications
npm install @securemint/sdk ethers react
```

### Minimal Example

```typescript
import { SecureMintSDK } from '@securemint/sdk';

const sdk = new SecureMintSDK({
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  tokenAddress: '0x...',
  policyAddress: '0x...',
  oracleAddress: '0x...',
  treasuryAddress: '0x...',
});

// Check system status
const invariants = await sdk.checkInvariants();
console.log('All invariants passed:', invariants.every(i => i.passed));

// Get backing ratio
const ratio = await sdk.getBackingRatio();
console.log('Backing ratio:', ratio);
```

---

## SDK Installation

### NPM

```bash
npm install @securemint/sdk
```

### Yarn

```bash
yarn add @securemint/sdk
```

### Import

```typescript
// ES Modules
import { SecureMintSDK } from '@securemint/sdk';

// CommonJS
const { SecureMintSDK } = require('@securemint/sdk');
```

---

## Basic Usage

### Initialize SDK

```typescript
import { SecureMintSDK } from '@securemint/sdk';

const sdk = new SecureMintSDK({
  rpcUrl: process.env.RPC_URL,
  tokenAddress: process.env.TOKEN_ADDRESS,
  policyAddress: process.env.POLICY_ADDRESS,
  oracleAddress: process.env.ORACLE_ADDRESS,
  treasuryAddress: process.env.TREASURY_ADDRESS,
});
```

### Token Operations

```typescript
// Get token info
const tokenInfo = await sdk.getTokenInfo();
console.log(tokenInfo);
// { name: 'SecureMint USD', symbol: 'smUSD', decimals: 6, totalSupply: '1000000000000' }

// Get balance
const balance = await sdk.getBalance('0x...');
console.log(balance); // BigInt

// Get formatted balance
const formatted = await sdk.getFormattedBalance('0x...');
console.log(formatted); // '1000.00'
```

### Mint Operations

```typescript
// Check epoch capacity
const capacity = await sdk.getEpochCapacity();
console.log(capacity);
// { total: '1000000000000', used: '100000000000', remaining: '900000000000' }

// Check if mint is allowed
const canMint = await sdk.canMint('0x...', '1000000000');
console.log(canMint);
// { allowed: true, reason: 'OK' }

// Simulate mint
const simulation = await sdk.simulateMint('0x...', '1000000000');
console.log(simulation);
// { success: true, estimatedGas: '150000', ... }
```

### Oracle Operations

```typescript
// Get backing data
const backing = await sdk.getBacking();
console.log(backing);
// { value: '10000000000000', timestamp: 1699000000 }

// Check if oracle is stale
const isStale = await sdk.isOracleStale();
console.log(isStale); // false

// Get backing ratio
const ratio = await sdk.getBackingRatio();
console.log(ratio); // 1.05
```

### Invariant Checks

```typescript
// Check all invariants
const invariants = await sdk.checkInvariants();
invariants.forEach(inv => {
  console.log(`${inv.id}: ${inv.passed ? 'PASSED' : 'FAILED'}`);
});

// Check specific invariant
const solvency = await sdk.checkSolvencyInvariant();
console.log(solvency);
// { id: 'INV-SM-1', name: 'Solvency', passed: true, details: 'totalSupply <= backing' }
```

---

## React Integration

### Setup Provider

```tsx
import { SecureMintProvider } from '@securemint/sdk/react';

function App() {
  return (
    <SecureMintProvider config={{
      rpcUrl: process.env.REACT_APP_RPC_URL,
      tokenAddress: process.env.REACT_APP_TOKEN_ADDRESS,
      // ...
    }}>
      <YourApp />
    </SecureMintProvider>
  );
}
```

### Use Hooks

```tsx
import { useBalance, useMintCapacity, useInvariants } from '@securemint/sdk/react';

function Dashboard() {
  const { balance, loading: balanceLoading } = useBalance();
  const { capacity, loading: capacityLoading } = useMintCapacity();
  const { invariants, allPassed } = useInvariants();

  if (balanceLoading || capacityLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>Balance: {balance?.formatted}</p>
      <p>Remaining Capacity: {capacity?.remaining}</p>
      <p>Invariants: {allPassed ? 'All Passed' : 'Some Failed'}</p>
    </div>
  );
}
```

### Mint Component

```tsx
import { useMint } from '@securemint/sdk/react';

function MintForm() {
  const { simulate, execute, loading, error, result } = useMint();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const handleSimulate = async () => {
    const simulation = await simulate(recipient, amount);
    if (simulation.success) {
      // Show confirmation
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSimulate(); }}>
      <input
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Recipient"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Simulate Mint'}
      </button>
      {error && <p className="error">{error}</p>}
      {result && <p>Success: {result.transactionHash}</p>}
    </form>
  );
}
```

---

## API Integration

### REST API

```typescript
const API_URL = 'https://api.securemint.io';
const API_KEY = 'your-api-key';

// Simulate mint
const response = await fetch(`${API_URL}/api/mint/simulate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    recipient: '0x...',
    amount: '1000000000',
  }),
});

const result = await response.json();
```

### GraphQL API

```typescript
const GRAPHQL_URL = 'https://api.securemint.io/graphql';

const query = `
  query GetSystemStatus {
    token {
      totalSupply
      name
      symbol
    }
    backing {
      totalBacking
      backingRatio
      isStale
    }
    invariants {
      id
      name
      passed
    }
  }
`;

const response = await fetch(GRAPHQL_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({ query }),
});

const { data } = await response.json();
```

---

## Smart Contract Interaction

### Direct Contract Calls

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Token contract
const tokenAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];
const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, signer);

// Check balance
const balance = await token.balanceOf(address);

// Transfer tokens
const tx = await token.transfer(recipient, amount);
await tx.wait();
```

### With SDK Types

```typescript
import { SecureMintSDK } from '@securemint/sdk';
import { SecureMintToken__factory } from '@securemint/contracts/typechain-types';

const sdk = new SecureMintSDK(config);
const tokenAddress = sdk.getTokenAddress();

// Use generated types
const token = SecureMintToken__factory.connect(tokenAddress, signer);
const balance = await token.balanceOf(address);
```

---

## Error Handling

### SDK Errors

```typescript
import { SecureMintSDK, SecureMintError, ErrorCodes } from '@securemint/sdk';

try {
  const result = await sdk.simulateMint(recipient, amount);
} catch (error) {
  if (error instanceof SecureMintError) {
    switch (error.code) {
      case ErrorCodes.INSUFFICIENT_BACKING:
        console.error('Insufficient backing for mint');
        break;
      case ErrorCodes.EPOCH_CAPACITY_EXCEEDED:
        console.error('Epoch capacity exceeded');
        break;
      case ErrorCodes.ORACLE_STALE:
        console.error('Oracle data is stale');
        break;
      case ErrorCodes.EMERGENCY_PAUSED:
        console.error('System is paused');
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

### API Errors

```typescript
const response = await fetch(`${API_URL}/api/mint/simulate`, {
  // ...
});

if (!response.ok) {
  const error = await response.json();

  switch (response.status) {
    case 400:
      console.error('Bad request:', error.message);
      break;
    case 401:
      console.error('Unauthorized');
      break;
    case 429:
      console.error('Rate limited');
      break;
    default:
      console.error('API error:', error);
  }
}
```

---

## Best Practices

### 1. Always Check Invariants Before Minting

```typescript
const invariants = await sdk.checkInvariants();
if (!invariants.every(i => i.passed)) {
  throw new Error('Invariant check failed');
}
```

### 2. Use Simulation Before Execution

```typescript
const simulation = await sdk.simulateMint(recipient, amount);
if (!simulation.success) {
  throw new Error(`Mint would fail: ${simulation.reason}`);
}
```

### 3. Monitor Oracle Staleness

```typescript
const isStale = await sdk.isOracleStale();
if (isStale) {
  console.warn('Oracle data is stale - proceed with caution');
}
```

### 4. Handle Emergency Levels

```typescript
const level = await sdk.getEmergencyLevel();
if (level >= 2) {
  console.warn(`Emergency level ${level} - minting may be restricted`);
}
```

### 5. Use WebSocket for Real-time Updates

```typescript
import { SecureMintWebSocket } from '@securemint/sdk';

const ws = new SecureMintWebSocket(WS_URL);

ws.on('backingUpdated', (data) => {
  console.log('Backing updated:', data);
});

ws.on('emergencyLevelChanged', (data) => {
  console.log('Emergency level changed:', data);
});

ws.connect();
```

---

## Support

- Documentation: https://docs.securemint.io
- GitHub: https://github.com/securemint
- Discord: https://discord.gg/securemint
- Email: support@securemint.io
