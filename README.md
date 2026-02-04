# SecureMint Engine

Oracle-Gated Secure Minting Protocol for Backed Tokens

---

## Overview

**SecureMint Engine** is an enterprise-grade oracle-gated secure minting protocol designed for creating backed tokens (stablecoins, asset-backed tokens, RWA tokens). It enforces the fundamental invariant that tokens can ONLY be minted when backing is provably sufficient via on-chain oracles or Proof-of-Reserve feeds.

### Core Philosophy: Follow The Money

Every token in circulation MUST have a verifiable, on-chain proof of backing. No backing proof = No minting.

---

## Key Features

### Oracle-Gated Minting
- **INV-SM-1**: Tokens minted <= Total backing value (enforced on-chain)
- **INV-SM-2**: Each mint requires fresh oracle attestation (max staleness: 1 hour)
- **INV-SM-3**: Minting pauses automatically if backing ratio < 100%
- **INV-SM-4**: All minting emits verifiable on-chain events

### Production-Ready Architecture
- 8 Battle-Tested Smart Contracts (Solidity 0.8.20+)
- Full TypeScript SDK with React hooks
- The Graph Subgraph for indexed data
- REST API Gateway for off-chain integration
- Comprehensive Test Suite (unit, integration, foundry invariants)

### God-Tier Launch Gates
- **Legal Compliance Gate** - Regulatory classification analysis
- **Security Audit Gate** - Audit firm management, finding tracker
- **Tokenomics Stress Test** - Economic attack simulations
- **Launch Countdown Orchestrator** - T-30 to T-0 coordination

### Enterprise Security
- Emergency pause mechanisms
- Multi-sig governance (Timelock + Governor)
- Circuit breakers for abnormal conditions
- Comprehensive monitoring and alerting

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `BackedToken.sol` | ERC-20 token with oracle-gated mint |
| `SecureMintPolicy.sol` | Mint authorization and invariant enforcement |
| `BackingOraclePoR.sol` | Oracle aggregation and Proof-of-Reserve |
| `TreasuryVault.sol` | Reserve management and asset custody |
| `RedemptionEngine.sol` | Token redemption for backing assets |
| `EmergencyPause.sol` | Circuit breaker and emergency controls |
| `Governor.sol` | On-chain governance |
| `Timelock.sol` | Time-delayed execution for governance |

---

## Project Structure

```
secure-mint-engine/
├── assets/
│   ├── contracts/           # Solidity smart contracts
│   ├── test/                # Unit and integration tests
│   ├── scripts/             # Deploy and utility scripts
│   ├── sdk/                 # TypeScript SDK
│   ├── subgraph/            # The Graph indexer
│   ├── api-gateway/         # REST API server
│   ├── dashboard/           # Admin monitoring UI
│   └── config/              # Configuration files
├── references/              # Technical documentation
├── diagrams/                # Architecture diagrams
└── docs/                    # User guides
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Foundry (for advanced testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/secure-mint-engine.git
cd secure-mint-engine

# Install dependencies
cd assets
npm install

# Configure environment
cp config/.env.example config/.env

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test
```

---

## SDK Usage

```typescript
import { SecureMintSDK } from '@secure-mint/sdk';

// Initialize SDK
const sdk = new SecureMintSDK({
  provider: window.ethereum,
  chainId: 1,
  addresses: {
    token: '0x...',
    policy: '0x...',
    oracle: '0x...',
  }
});

// Check if minting is possible
const canMint = await sdk.policy.canMint(amount);

// Get current backing ratio
const ratio = await sdk.oracle.getBackingRatio();
```

---

## Launch Gates

### 1. Legal Compliance Gate
```bash
npx ts-node scripts/legal/legal-compliance-gate.ts
```

### 2. Security Audit Gate
```bash
npx ts-node scripts/security/audit-gate.ts
```

### 3. Tokenomics Stress Test
```bash
npx ts-node scripts/tokenomics/stress-test.ts
```

### 4. Launch Countdown Orchestrator
```bash
npx ts-node scripts/launch/countdown-orchestrator.ts
```

---

## Testing

```bash
# Unit tests
npx hardhat test

# Coverage report
npx hardhat coverage

# Foundry invariant tests
forge test
```

---

## Invariants

| ID | Invariant |
|----|-----------|
| INV-SM-1 | totalSupply <= backingValue |
| INV-SM-2 | Fresh oracle attestation required |
| INV-SM-3 | Auto-pause if backing < 100% |
| INV-SM-4 | All mints emit events |

---

## License

This project is licensed under the MIT License.

---

## Contact and Access

This repository contains protected source code.

**To request access to the full source code, please email:**

YOUR_EMAIL@domain.com

Please include:
- Your name/organization
- Intended use case
- Brief description of your project

---

Built with security-first principles for the decentralized future.
