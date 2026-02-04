# SecureMint Engine - Examples

Example applications demonstrating SecureMint SDK usage.

## DApp Example (`dapp/`)

React + Vite + Tailwind application showing:

- SDK initialization
- Token info display
- System status monitoring
- Invariant checking
- Mint simulation

```bash
cd dapp
npm install
npm run dev
```

Open http://localhost:3001

## CLI Examples (`cli/`)

Command-line scripts for:

### SDK Usage (`sdk-usage.ts`)

```bash
# Check system status
npx ts-node cli/sdk-usage.ts status

# Check balance
npx ts-node cli/sdk-usage.ts balance 0x...

# Simulate mint
npx ts-node cli/sdk-usage.ts simulate 0x... 1000000

# Monitor changes
npx ts-node cli/sdk-usage.ts monitor
```

### Deployment Verification (`deploy-check.ts`)

Verify a SecureMint deployment:

```bash
export TOKEN_ADDRESS=0x...
export POLICY_ADDRESS=0x...
export ORACLE_ADDRESS=0x...
export TREASURY_ADDRESS=0x...
export RPC_URL=https://...

npx ts-node cli/deploy-check.ts
```

## Environment Setup

Create `.env` file:

```bash
RPC_URL=http://localhost:8545
TOKEN_ADDRESS=0x...
POLICY_ADDRESS=0x...
ORACLE_ADDRESS=0x...
TREASURY_ADDRESS=0x...
```

## License

MIT
