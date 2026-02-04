# SecureMint Subgraph

The Graph subgraph for indexing SecureMint Engine events.

## Quick Start

```bash
# Install dependencies
npm install

# Generate types
npm run codegen

# Build
npm run build

# Deploy to The Graph Studio
npm run deploy
```

## Entities

- **Token**: Token metadata and total supply
- **Account**: User balances and transactions
- **MintEvent**: Mint operations
- **BurnEvent**: Burn operations
- **OracleUpdate**: Oracle data updates
- **EmergencyEvent**: Emergency level changes
- **BridgeTransfer**: Cross-chain transfers

## Queries

```graphql
# Get recent mints
{
  mintEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    recipient
    amount
    timestamp
    transaction
  }
}

# Get account with history
{
  account(id: "0x...") {
    balance
    mints {
      amount
      timestamp
    }
    burns {
      amount
      timestamp
    }
  }
}

# Get system stats
{
  token(id: "0x...") {
    totalSupply
    totalMinted
    totalBurned
    holderCount
  }
}
```

## Networks

- Ethereum Mainnet
- Sepolia
- Polygon
- Arbitrum
- Optimism
- Base

## License

MIT
