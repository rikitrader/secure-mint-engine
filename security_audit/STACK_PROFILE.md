# SecureMint Engine - Stack Profile

**Selected Stacks:** A (Next.js + Node API + Postgres + WalletConnect), C (EVM Solidity)

---

## Stack A: Next.js + Node API + Postgres + WalletConnect

### A1) Framework
- **Next.js version:** 14.x (App Router)
- **Router:** App Router
- **Runtime:** Node
- **API style:** Express + Apollo GraphQL

### A2) Auth + Sessions
- **Auth method:** JWT + Ethereum Signature (SIWE-like)
- **RBAC model:** admin / operator / user
- **Session storage:** JWT (stateless) + Redis (nonce tracking)

### A3) WalletConnect
- **WC version:** v2 (wagmi/viem compatible)
- **Sign-in flow:** Custom message signing (needs EIP-712 migration)
- **Nonce source:** Server-generated, Redis stored (5-min TTL)
- **Chain allowlist:** Ethereum, Polygon, Arbitrum, Optimism, Base
- **Domain separation:** NOT IMPLEMENTED (SEC-014)

### A4) Postgres
- **Access layer:** Prisma ORM
- **Connection pooling:** Prisma connection pool (default)
- **RLS enabled:** No
- **Migrations tool:** Prisma Migrate

### A5) Critical Flows
- [x] login/sign-in - Signature verification
- [x] deposits - Treasury management
- [x] withdrawals - Redemption engine
- [ ] swaps - Not applicable
- [x] admin controls - Role-based access
- [x] webhook processing - Alerting service

### A6) Security Gates Required
- [x] SQLi tests - Prisma parameterized (safe)
- [ ] CSRF policy check - Token-based (N/A)
- [x] Rate-limit + bot protection - Needs per-user limits
- [x] SSRF allowlist - Axios calls need review
- [x] Secrets scan + env leak prevention - Hardcoded keys found

---

## Stack C: EVM Solidity (Hardhat / Foundry)

### C1) Tooling
- **Framework:** Both Hardhat and Foundry
- **Solidity version:** 0.8.20+
- **Upgradeability:** None (non-upgradeable)
- **Admin key storage:** Multisig (Gnosis Safe)

### C2) Contract Scope
- [x] ERC20 - BackedToken
- [ ] ERC721/1155 - Not used
- [ ] AMM / LP - Not directly
- [x] Vault / Lending - TreasuryVault
- [x] Oracle consumer - BackingOraclePoR
- [ ] Bridge / cross-chain - SecureMintBridge (separate)
- [x] Governance - Governor + Timelock

### C3) Critical Controls
- **Access control:** OpenZeppelin AccessControl
- **Reentrancy guard:** Yes (nonReentrant)
- **Pausable:** Yes (4-level system)
- **Timelock delays:** 48-72 hours
- **Withdrawal limits:** Tiered limits

### C4) Oracle + MEV
- **Price oracle:** Chainlink PoR + Custom attestors
- **Slippage protection:** N/A (not AMM)
- **MEV mitigations:** Commit-reveal for large mints

### C5) Required Tests
- [x] reentrancy invariants - Implemented
- [x] access control on every function - Implemented
- [x] integer rounding boundaries - Needs review
- [x] oracle stale/zero checks - Implemented
- [ ] upgrade safety - Not upgradeable
- [x] fuzz/property tests - Foundry configured

---

## Global Threat Context

### G1) Custody Model
- **Model:** Non-custodial (users sign their own transactions)
- **Exception:** Treasury is custodial (multisig controlled)

### G2) Environments
- **Dev:** localhost
- **Stage:** Sepolia testnet
- **Prod:** Ethereum mainnet
- **CI provider:** GitHub Actions

### G3) Risk Tolerance
- **Selected:** Low (fail CI on Medium+)
- **Rationale:** Financial protocol handling real assets

---

## Stack-Specific Vulnerability Matrix

### Stack A Vulnerabilities Found

| ID | Category | Finding | Severity |
|----|----------|---------|----------|
| SEC-001 | Auth | Hardcoded API keys | Critical |
| SEC-002 | Auth | Weak JWT secret | Critical |
| SEC-003 | Auth | No nonce protection | Critical |
| SEC-007 | API | GraphQL introspection | High |
| SEC-008 | API | Global rate limiting | High |
| SEC-009 | Infra | Redis no TLS | High |
| SEC-010 | Input | JSON.parse unsafe | High |

### Stack C Vulnerabilities Found

| ID | Category | Finding | Severity |
|----|----------|---------|----------|
| SEC-004 | Web3 | Unsigned tx accepted | Critical |
| SEC-013 | Oracle | Single oracle dependency | Medium |
| SEC-014 | Crypto | No EIP-712 domain sep | Medium |

---

## Recommended Security Tools by Stack

### Stack A Tools
```bash
# Dependency audit
npm audit --audit-level=high

# ESLint security plugin
npm install --save-dev eslint-plugin-security
# Add to .eslintrc: plugins: ['security']

# SQL injection prevention (Prisma handles this)
# Manual review for raw queries

# Rate limiting
# Already using express-rate-limit, needs per-user config
```

### Stack C Tools
```bash
# Slither (Python)
pip install slither-analyzer
slither . --exclude-dependencies

# Foundry fuzz testing
forge test --fuzz-runs 50000

# Mythril (optional, heavy)
myth analyze contracts/SecureMintPolicy.sol

# Echidna (property testing)
echidna-test . --contract EchidnaSecureMint
```

---

*Profile generated: 2024-02-04*
