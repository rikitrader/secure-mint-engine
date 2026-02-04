# Crypto Protocol GitHub Architecture Map

This document maps the complete GitHub repository ecosystem and permission structure for building stablecoin + DeFi + oracle-gated mint engine projects.

## Project Type Coverage

- **STABLECOIN** — Reserve-backed tokens with oracle-gated minting
- **DEFI** — Liquidity, lending, collateral mechanics
- **ORACLE-GATED MINT ENGINE** — SecureMintEngine pattern

---

## Layer 1: Smart Contract Layer

**Purpose:** Core protocol logic, minting, burning, collateral control

### Repositories

| Repository | URL | Purpose |
|------------|-----|---------|
| OpenZeppelin Contracts | github.com/OpenZeppelin/openzeppelin-contracts | Battle-tested ERC standards, access control, security |
| Foundry Framework | github.com/foundry-rs/foundry | Fast Solidity testing, fuzzing, deployment |
| Hardhat Framework | github.com/NomicFoundation/hardhat | JavaScript/TypeScript Solidity tooling |
| Chainlink Contracts | github.com/smartcontractkit/chainlink | Oracle integration, price feeds, PoR |

### Token Permissions Required (Your Repos)

```
Contents        : READ + WRITE
Pull Requests   : READ + WRITE
Issues          : READ
Actions         : READ
Metadata        : READ
```

---

## Layer 2: Oracle + Price Feed Layer

**Purpose:** Price feeds, reserve validation, oracle-gated minting

### Repositories

| Repository | URL | Purpose |
|------------|-----|---------|
| Chainlink Core Node | github.com/smartcontractkit/chainlink | Oracle node, external adapters, PoR feeds |

### Extra Token Permission

```
Webhooks : READ + WRITE
```

---

## Layer 3: DeFi Protocol Models (Reference for Forks)

**Purpose:** Liquidity, lending, collateral mechanics reference implementations

### Repositories

| Repository | URL | Purpose |
|------------|-----|---------|
| Uniswap | github.com/Uniswap | AMM, liquidity pools, swap mechanics |
| Aave | github.com/aave | Lending protocol, collateral, liquidation |
| MakerDAO | github.com/makerdao | CDP, DAI stablecoin, governance |
| Compound | github.com/compound-finance | Money markets, interest rates, cTokens |

### Token Permissions (Read-Only Reference)

```
Contents      : READ ONLY
Pull Requests : READ ONLY
```

---

## Layer 4: Indexing + Data Layer

**Purpose:** On-chain data indexing, analytics, monitoring

### Repositories

| Repository | URL | Purpose |
|------------|-----|---------|
| The Graph | github.com/graphprotocol/graph-node | Subgraph indexing, GraphQL queries |
| Blockscout | github.com/blockscout/blockscout | Open-source block explorer |

### Token Permissions

```
Contents : READ ONLY
```

---

## Layer 5: Wallet / Frontend SDK Layer

**Purpose:** Wallet integration, blockchain interaction for frontend

### Repositories

| Repository | URL | Purpose |
|------------|-----|---------|
| MetaMask | github.com/MetaMask/metamask-extension | Browser wallet extension |
| WalletConnect | github.com/WalletConnect | Multi-wallet connection protocol |
| Ethers.js | github.com/ethers-io/ethers.js | Ethereum JavaScript library |
| Web3.js | github.com/web3/web3.js | Ethereum JavaScript API |

### Token Permissions

```
Contents : READ ONLY
```

---

## Layer 6: Final GitHub Token Config (Your Project Repos Only)

### Repository Access

```
[✓] Only selected repositories
```

### Required Permissions Summary

| Permission | Level |
|------------|-------|
| Contents | READ + WRITE |
| Pull Requests | READ + WRITE |
| Actions | READ |
| Metadata | READ |
| Issues | READ |
| Webhooks | READ + WRITE |

---

## Layer 7: Security Rules

### NEVER DO

| Rule | Rationale |
|------|-----------|
| Do NOT commit token to GitHub | Token exposure = full account compromise |
| Do NOT store in frontend code | Client-side code is public |
| Do NOT hardcode in smart contracts | Contracts are public and immutable |
| Do NOT bake into Docker images | Images can be inspected |
| Do NOT share in chat or logs | Logs persist and may be exposed |

### Safe Storage Options

| Storage | Use Case |
|---------|----------|
| Cloudflare Secrets | Edge worker secrets |
| GitHub Actions Secrets | CI/CD pipeline secrets |
| Supabase Vault | Database-backed secrets |
| Local .env (gitignored) | Local development only |

---

## Layer 8: System Flow Overview

```
        [ ORACLE DATA ]
               ↓
        [ CHAINLINK NODE ]
               ↓
        [ MINT ENGINE CONTRACT ]
               ↓
        [ STABLECOIN TOKEN ]
               ↓
        [ DEFI PROTOCOLS ]
               ↓
        [ INDEXERS / ANALYTICS ]
               ↓
        [ WALLET + FRONTEND ]
```

### Flow Description

1. **Oracle Data** — External price feeds, reserve attestations
2. **Chainlink Node** — Validates and delivers oracle data on-chain
3. **Mint Engine Contract** — SecureMintPolicy enforces backing requirements
4. **Stablecoin Token** — BackedToken (dumb ledger) receives mint calls
5. **DeFi Protocols** — Integration with Uniswap, Aave, etc.
6. **Indexers/Analytics** — The Graph subgraphs, monitoring dashboards
7. **Wallet + Frontend** — User interaction layer

---

## Complete Repository Library

### Smart Contract Foundations

```
github.com/OpenZeppelin/openzeppelin-contracts
github.com/OpenZeppelin/openzeppelin-contracts-upgradeable
github.com/foundry-rs/foundry
github.com/NomicFoundation/hardhat
github.com/crytic/slither
github.com/Certora/certora-prover
```

### Oracle & Data

```
github.com/smartcontractkit/chainlink
github.com/UMAprotocol/protocol
github.com/pyth-network/pyth-sdk-solidity
github.com/redstone-finance/redstone-oracles
```

### DeFi Reference

```
github.com/Uniswap/v2-core
github.com/Uniswap/v3-core
github.com/aave/aave-v3-core
github.com/makerdao/dss
github.com/compound-finance/compound-protocol
github.com/curvefi/curve-contract
github.com/balancer/balancer-v2-monorepo
github.com/liquity/dev
```

### Indexing & Analytics

```
github.com/graphprotocol/graph-node
github.com/blockscout/blockscout
github.com/duneanalytics/dune-client
```

### Frontend & Wallets

```
github.com/MetaMask/metamask-extension
github.com/WalletConnect/walletconnect-monorepo
github.com/ethers-io/ethers.js
github.com/web3/web3.js
github.com/wagmi-dev/wagmi
github.com/rainbow-me/rainbowkit
```

### Security & Auditing

```
github.com/crytic/echidna
github.com/trailofbits/manticore
github.com/consensys/mythril
github.com/foundry-rs/forge-std
```

### Infrastructure

```
github.com/ethereum/go-ethereum
github.com/paritytech/polkadot-sdk
github.com/solana-labs/solana
github.com/ava-labs/avalanchego
github.com/maticnetwork/bor
```

---

## Integration with SecureMintEngine

This architecture map integrates with the SecureMintEngine workflow at multiple points:

### Phase 0 (Market Intelligence)
- Reference DeFi protocols to understand ecosystem tooling per chain
- Evaluate oracle availability per chain (Chainlink coverage)
- Assess indexing infrastructure maturity (The Graph support)

### Implementation Phase
- Use OpenZeppelin contracts as base for BackedToken
- Integrate Chainlink contracts for oracle feeds
- Deploy with Foundry or Hardhat

### CI/CD Phase
- GitHub Actions for automated testing
- Slither/Mythril for security scanning
- Certora for formal verification

### Deployment Phase
- The Graph subgraphs for indexing
- Frontend SDK integration for user interface
- Block explorer verification

---

## Quick Reference: Token Scopes by Repository Type

| Repo Type | Contents | PRs | Actions | Issues | Webhooks |
|-----------|----------|-----|---------|--------|----------|
| Your Protocol Repos | R+W | R+W | R | R | R+W |
| OpenZeppelin/Foundry | R | R | - | - | - |
| DeFi Reference (Uniswap/Aave) | R | R | - | - | - |
| Oracles (Chainlink) | R | R | - | - | R+W |
| Indexers (The Graph) | R | - | - | - | - |
| Frontend SDKs | R | - | - | - | - |

**Legend:** R = Read, W = Write, R+W = Read + Write, - = Not needed
