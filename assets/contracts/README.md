# SecureMint Engine - Smart Contracts

Solidity smart contracts for the SecureMint oracle-gated minting system.

## Contracts

| Contract | Description |
|----------|-------------|
| `SecureMintToken` | ERC-20 backed stablecoin with minter role |
| `SecureMintPolicy` | Oracle-gated minting with epoch rate limits |
| `BackingOracle` | Chainlink Proof-of-Reserve integration |
| `TreasuryVault` | 4-tier reserve management system |
| `RedemptionEngine` | Token redemption queue with timelock |
| `EmergencyPause` | 5-level circuit breaker system |
| `SecureMintGovernor` | Timelocked DAO governance |
| `SecureMintBridge` | Cross-chain lock-and-mint bridge |
| `InsuranceFund` | Depeg and slashing protection |
| `LiquidityIncentives` | LP reward distribution |

## Quick Start

```bash
# Install dependencies
npm install
forge install

# Compile
forge build
npx hardhat compile

# Test
forge test -vvv

# Deploy (local)
npx hardhat node
npx hardhat run scripts/deploy/01_deploy_token.ts --network localhost
```

## Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_Mint_Success

# Generate coverage
forge coverage

# Gas report
forge test --gas-report
```

## Security

```bash
# Static analysis
slither . --config-file slither.config.json

# Fuzz testing
echidna test/fuzzing/EchidnaSecureMint.sol --contract EchidnaSecureMint

# Formal verification
certoraRun certora/conf/SecureMint.conf
```

## Deployment

See [deployment scripts](scripts/deploy/) for network-specific deployments.

## Architecture

```
src/
├── SecureMintToken.sol      # Main token contract
├── SecureMintPolicy.sol     # Minting policy logic
├── BackingOracle.sol        # Oracle integration
├── TreasuryVault.sol        # Reserve management
├── RedemptionEngine.sol     # Redemption queue
├── EmergencyPause.sol       # Circuit breaker
├── SecureMintGovernor.sol   # Governance
├── interfaces/              # Contract interfaces
├── upgrades/                # Upgradeable versions
├── bridge/                  # Cross-chain bridge
└── defi/                    # DeFi features
```

## License

MIT
