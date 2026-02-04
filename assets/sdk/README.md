# @securemint/sdk

TypeScript SDK for interacting with SecureMint Engine.

## Installation

```bash
npm install @securemint/sdk ethers
```

## Quick Start

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
console.log('All passed:', invariants.every(i => i.passed));

// Get backing ratio
const ratio = await sdk.getBackingRatio();
console.log('Backing ratio:', ratio);

// Simulate mint
const simulation = await sdk.simulateMint(recipient, amount);
console.log('Success:', simulation.success);
```

## React Integration

```tsx
import { SecureMintProvider, useBalance, useMintCapacity } from '@securemint/sdk/react';

function App() {
  return (
    <SecureMintProvider config={config}>
      <Dashboard />
    </SecureMintProvider>
  );
}

function Dashboard() {
  const { balance, loading } = useBalance();
  const { capacity } = useMintCapacity();

  return (
    <div>
      <p>Balance: {balance?.formatted}</p>
      <p>Remaining: {capacity?.remaining}</p>
    </div>
  );
}
```

## Features

- Full TypeScript support
- Dual CJS/ESM exports
- React hooks
- WebSocket subscriptions
- Hardware wallet support (Ledger/Trezor)
- Offline signing
- Gnosis Safe integration
- Tenderly simulation

## API Reference

See [TypeDoc documentation](https://docs.securemint.io/sdk).

## License

MIT
