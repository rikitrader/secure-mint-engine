# SecureMint Engine

**Oracle-gated secure minting system for blockchain tokens**

SecureMint Engine is a production-ready framework for building backed stablecoins and asset-backed tokens. It enforces the "follow-the-money" doctrine: tokens may ONLY be minted if backing is provably sufficient via on-chain oracles or Proof-of-Reserve feeds.

## Features

- **Oracle-Gated Minting**: Tokens only mint when backing is verified on-chain
- **4 Core Invariants**: Solvency, rate limiting, oracle freshness, emergency pause
- **Multi-Chain Support**: Deploy to Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC
- **Cross-Chain Bridge**: Lock-and-mint bridge with multi-sig validators
- **Complete SDK**: TypeScript SDK with React hooks and React Native support
- **Production Infrastructure**: Docker, Kubernetes, Terraform ready

## Quick Start

```bash
# Clone the repository
git clone https://github.com/securemint/engine.git
cd engine

# Install dependencies
make install

# Start development environment
make dev

# Run tests
make test
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Dashboard  │  │  DApp SDK   │  │ Mobile SDK  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Gateway                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  REST API   │  │  GraphQL    │  │  WebSocket  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Smart Contracts                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ SecureMint    │  │ SecureMint    │  │   Backing     │        │
│  │    Token      │  │   Policy      │  │   Oracle      │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │   Treasury    │  │  Redemption   │  │  Emergency    │        │
│  │    Vault      │  │   Engine      │  │    Pause      │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Core Invariants

| ID | Name | Rule |
|----|------|------|
| INV-SM-1 | Solvency | `totalSupply ≤ backing` |
| INV-SM-2 | Rate Limiting | `epochMintedAmount ≤ epochCapacity` |
| INV-SM-3 | Oracle Freshness | `block.timestamp - lastUpdate < stalenessThreshold` |
| INV-SM-4 | Emergency Pause | Operations blocked when paused |

## Project Structure

```
assets/
├── contracts/          # Solidity smart contracts
├── sdk/                # TypeScript SDK
├── api-gateway/        # REST + GraphQL API
├── dashboard/          # Next.js monitoring dashboard
├── mobile-sdk/         # React Native SDK
├── subgraph/           # The Graph indexer
├── database/           # PostgreSQL schema
├── docker/             # Docker configurations
├── infrastructure/     # Kubernetes + Terraform
├── scripts/            # Deployment and utility scripts
├── tests/              # Test suites
├── docs/               # Documentation
└── examples/           # Example applications
```

## Documentation

- [Integration Guide](docs/guides/INTEGRATION_GUIDE.md)
- [API Reference](api-gateway/openapi.yaml)
- [Security Checklist](docs/SECURITY_CHECKLIST.md)
- [Audit Preparation](docs/AUDIT_PREPARATION.md)
- [Incident Response](docs/INCIDENT_RESPONSE.md)
- [Bug Bounty Program](docs/BUG_BOUNTY.md)

## Development

### Prerequisites

- Node.js 18+
- pnpm or npm
- Foundry (for contract development)
- Docker (for local development)
- PostgreSQL 15+
- Redis 7+

### Commands

```bash
# Install all dependencies
make install

# Start development environment
make dev

# Run all tests
make test

# Build for production
make build

# Deploy contracts
make deploy NETWORK=mainnet

# Generate documentation
make docs
```

## Security

- Formal verification with Certora
- Fuzz testing with Echidna
- Static analysis with Slither
- Multi-sig governance
- Emergency pause system
- Bug bounty program ($500K pool)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Support

- Documentation: https://docs.securemint.io
- Discord: https://discord.gg/securemint
- Email: support@securemint.io
- GitHub Issues: https://github.com/securemint/engine/issues
