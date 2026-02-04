# SecureMint Engine - Threat Model

**Version:** 1.0
**Date:** 2024-02-04
**Classification:** Internal Use Only

---

## 1. System Overview

SecureMint Engine is an oracle-gated secure minting protocol for backed tokens (stablecoins, asset-backed tokens). The system ensures tokens can ONLY be minted when backing is provably sufficient.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL ACTORS                                │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│   Users     │  Operators  │   Oracles   │  Attackers  │  Dependencies  │
│  (wallets)  │  (admin)    │ (Chainlink) │ (malicious) │  (npm, etc.)   │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴───────┬────────┘
       │             │             │             │              │
       ▼             ▼             ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY 1: Internet                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Dashboard  │  │  API Gateway │  │   GraphQL    │                   │
│  │   (Next.js)  │  │   (Express)  │  │  (Apollo)    │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
│         │                 │                 │                           │
│         └─────────────────┼─────────────────┘                           │
│                           │                                             │
│         ┌─────────────────▼─────────────────┐                           │
│         │       Auth Middleware             │                           │
│         │  - JWT Validation                 │                           │
│         │  - Signature Verification         │                           │
│         │  - Rate Limiting                  │                           │
│         └─────────────────┬─────────────────┘                           │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────────┐
│                TRUST BOUNDARY 2: Internal Network                        │
├───────────────────────────┼─────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────▼────────┐  ┌──────────────┐                  │
│  │   Redis    │  │   PostgreSQL    │  │   Subgraph   │                  │
│  │  (Cache)   │  │   (Database)    │  │ (The Graph)  │                  │
│  └────────────┘  └─────────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────────┐
│               TRUST BOUNDARY 3: Blockchain Layer                         │
├───────────────────────────┼─────────────────────────────────────────────┤
│  ┌────────────────────────▼────────────────────────┐                    │
│  │              Smart Contracts                     │                    │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │                    │
│  │  │ BackedToken│  │SecureMint  │  │  Oracle   │  │                    │
│  │  │  (ERC20)   │  │  Policy    │  │  (PoR)    │  │                    │
│  │  └────────────┘  └────────────┘  └───────────┘  │                    │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │                    │
│  │  │ Treasury   │  │ Redemption │  │ Emergency │  │                    │
│  │  │   Vault    │  │   Engine   │  │   Pause   │  │                    │
│  │  └────────────┘  └────────────┘  └───────────┘  │                    │
│  └──────────────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Assets

### 2.1 High-Value Assets (Direct Financial Impact)

| Asset | Description | Value | Location |
|-------|-------------|-------|----------|
| Treasury Reserves | Backing assets (USDC, ETH, T-Bills) | $1M - $1B+ | TreasuryVault contract |
| Private Keys | Operator/deployer signing keys | Protocol control | HSM/KMS |
| Multisig Keys | Governance signer keys | Protocol control | Hardware wallets |
| Oracle Attestations | Proof-of-Reserve data | Protocol integrity | BackingOraclePoR |

### 2.2 Medium-Value Assets (Operational Impact)

| Asset | Description | Value | Location |
|-------|-------------|-------|----------|
| JWT Secrets | API authentication secrets | Session control | Environment vars |
| API Keys | Service authentication | API access | Database/env |
| Database Credentials | PostgreSQL access | Data integrity | Environment vars |
| Redis Data | Sessions, rate limits, cache | Availability | Redis cluster |

### 2.3 Low-Value Assets (Reputational Impact)

| Asset | Description | Value | Location |
|-------|-------------|-------|----------|
| User PII | Email, addresses (if collected) | Privacy | PostgreSQL |
| Transaction History | Mint/burn records | Privacy | Subgraph |
| System Logs | Operational data | Forensics | Log aggregator |

---

## 3. Threat Actors

### 3.1 External Attacker (Unauthenticated)
- **Motivation:** Financial gain, disruption
- **Capabilities:** Web attacks, smart contract exploitation, social engineering
- **Access Level:** Public internet, blockchain
- **Typical Attacks:**
  - API exploitation (injection, auth bypass)
  - Smart contract attacks (reentrancy, oracle manipulation)
  - DDoS/resource exhaustion
  - Phishing for operator credentials

### 3.2 Authenticated User (Malicious)
- **Motivation:** Financial gain, abuse
- **Capabilities:** Valid credentials, legitimate API access
- **Access Level:** Authenticated API endpoints
- **Typical Attacks:**
  - IDOR (accessing other users' data)
  - Rate limit bypass
  - Signature replay
  - Transaction front-running

### 3.3 Insider Threat (Operator/Developer)
- **Motivation:** Financial gain, grudge
- **Capabilities:** System access, deployment keys
- **Access Level:** Internal systems, possibly multisig signer
- **Typical Attacks:**
  - Credential theft
  - Backdoor insertion
  - Multisig collusion
  - Log tampering

### 3.4 Compromised Dependency
- **Motivation:** Supply chain attack
- **Capabilities:** Code execution within application
- **Access Level:** Application runtime
- **Typical Attacks:**
  - Malicious package injection
  - Credential harvesting
  - Cryptomining
  - Data exfiltration

### 3.5 Oracle Manipulation
- **Motivation:** Financial gain through price manipulation
- **Capabilities:** Flash loans, large capital
- **Access Level:** Blockchain, oracle infrastructure
- **Typical Attacks:**
  - Price feed manipulation
  - Stale price exploitation
  - Multi-block manipulation

---

## 4. Trust Boundaries

### 4.1 Browser ↔ API Gateway
- **Data Crossing:** User requests, authentication tokens, transaction data
- **Trust Assumptions:**
  - Client cannot be trusted
  - All input must be validated
  - Rate limiting required
- **Controls Required:**
  - Input validation (Zod schemas)
  - JWT/signature verification
  - Rate limiting per-IP and per-user
  - CORS configuration

### 4.2 API Gateway ↔ Database
- **Data Crossing:** Queries, credentials, user data
- **Trust Assumptions:**
  - Database trusts API gateway
  - Credentials must be protected
- **Controls Required:**
  - Parameterized queries (Prisma)
  - Connection encryption (TLS)
  - Least privilege DB user
  - Audit logging

### 4.3 API Gateway ↔ Blockchain
- **Data Crossing:** Signed transactions, oracle data, contract calls
- **Trust Assumptions:**
  - Blockchain is trustless
  - Transactions are irreversible
- **Controls Required:**
  - Transaction signing verification
  - Gas estimation validation
  - Nonce management
  - Chain ID validation

### 4.4 Contracts ↔ Oracle
- **Data Crossing:** Price/reserve data, attestations
- **Trust Assumptions:**
  - Oracle data may be manipulated
  - Stale data is dangerous
- **Controls Required:**
  - Staleness checks
  - Deviation bounds
  - Multiple oracle sources
  - Circuit breakers

### 4.5 Contracts ↔ Treasury
- **Data Crossing:** Asset transfers, reserve queries
- **Trust Assumptions:**
  - Treasury holds real value
  - Withdrawal must be controlled
- **Controls Required:**
  - Multi-tier access control
  - Withdrawal limits
  - Timelock for large amounts
  - Audit trail

---

## 5. Abuse Cases

### 5.1 Authentication Abuse Cases

| ID | Abuse Case | Actor | Impact | Mitigation |
|----|------------|-------|--------|------------|
| AUTH-1 | JWT token forgery | External | Full API access | Strong secret, rotation |
| AUTH-2 | Signature replay | Authenticated | Duplicate actions | Nonce tracking |
| AUTH-3 | API key brute force | External | Account takeover | Rate limiting, lockout |
| AUTH-4 | Session hijacking | External | Account takeover | Secure cookies, fingerprinting |

### 5.2 Minting Abuse Cases

| ID | Abuse Case | Actor | Impact | Mitigation |
|----|------------|-------|--------|------------|
| MINT-1 | Unbacked minting | Operator/Attacker | Protocol insolvency | Oracle verification |
| MINT-2 | Rate limit bypass | Authenticated | Excessive minting | Per-user limits |
| MINT-3 | Front-running mint | MEV searcher | Value extraction | Private mempool |
| MINT-4 | Oracle manipulation | Attacker | Unbacked minting | Multi-oracle, bounds |

### 5.3 Treasury Abuse Cases

| ID | Abuse Case | Actor | Impact | Mitigation |
|----|------------|-------|--------|------------|
| TRES-1 | Unauthorized withdrawal | Attacker | Fund loss | Access control, multisig |
| TRES-2 | Multisig collusion | Insiders | Fund loss | Threshold, timelock |
| TRES-3 | Emergency drain | Compromised guardian | Fund loss | Rate limits, alerts |
| TRES-4 | Reserve manipulation | Operator | Insolvency | On-chain verification |

### 5.4 API Abuse Cases

| ID | Abuse Case | Actor | Impact | Mitigation |
|----|------------|-------|--------|------------|
| API-1 | SQL injection | External | Data breach | Parameterized queries |
| API-2 | DoS via rate limit | External | Service unavailable | Per-IP limits |
| API-3 | IDOR data access | Authenticated | Privacy breach | Ownership checks |
| API-4 | GraphQL depth attack | External | Resource exhaustion | Query depth limit |

### 5.5 Infrastructure Abuse Cases

| ID | Abuse Case | Actor | Impact | Mitigation |
|----|------------|-------|--------|------------|
| INFRA-1 | Supply chain attack | Dependency | Code execution | Lockfiles, audit |
| INFRA-2 | Secrets in logs | Operator | Credential leak | Log redaction |
| INFRA-3 | Container escape | Attacker | Host compromise | Security context |
| INFRA-4 | DNS hijacking | External | Phishing | DNSSEC, monitoring |

---

## 6. Attack Trees

### 6.1 Steal Treasury Funds

```
[GOAL: Steal Treasury Funds]
├── [1] Compromise Multisig
│   ├── [1.1] Phish signer keys
│   ├── [1.2] Insider collusion (3 of 5)
│   └── [1.3] Compromise HSM
├── [2] Exploit Smart Contract
│   ├── [2.1] Reentrancy in withdrawal
│   ├── [2.2] Access control bypass
│   └── [2.3] Upgrade to malicious impl
├── [3] Manipulate Oracle
│   ├── [3.1] Report false reserves
│   ├── [3.2] Stale price exploitation
│   └── [3.3] Flash loan manipulation
└── [4] Social Engineering
    ├── [4.1] Impersonate support
    └── [4.2] Fake emergency procedure
```

### 6.2 Mint Unbacked Tokens

```
[GOAL: Mint Unbacked Tokens]
├── [1] Bypass Oracle Check
│   ├── [1.1] Manipulate oracle data
│   ├── [1.2] Exploit staleness window
│   └── [1.3] Replace oracle contract
├── [2] Compromise Minter Role
│   ├── [2.1] Steal minter key
│   ├── [2.2] Role admin abuse
│   └── [2.3] Governor proposal attack
├── [3] Exploit Rate Limits
│   ├── [3.1] Multiple addresses
│   ├── [3.2] Time window abuse
│   └── [3.3] Parameter manipulation
└── [4] API Gateway Bypass
    ├── [4.1] Direct contract interaction
    └── [4.2] Replay authorized tx
```

---

## 7. Security Controls Summary

| Control | Implementation | Status | Gap |
|---------|---------------|--------|-----|
| Authentication | JWT + Signatures | Partial | Weak secret, no nonce |
| Authorization | RBAC via AccessControl | Good | IDOR gaps |
| Rate Limiting | express-rate-limit | Partial | Not per-user |
| Input Validation | Zod + express-validator | Partial | Missing schemas |
| Encryption in Transit | TLS | Partial | Redis unencrypted |
| Encryption at Rest | None | Missing | Database not encrypted |
| Audit Logging | Winston | Partial | No PII redaction |
| Secret Management | Env vars | Poor | Hardcoded keys |
| Dependency Security | npm audit | Partial | Non-blocking |
| Contract Security | OpenZeppelin | Good | - |

---

## 8. Recommended Mitigations Priority

### Immediate (Week 1)
1. Remove hardcoded API keys
2. Require strong JWT secret
3. Implement nonce tracking for signatures
4. Make security CI blocking

### Short-term (Week 2-4)
1. Enable Redis TLS
2. Per-user rate limiting
3. Disable GraphQL introspection in production
4. Input validation schemas

### Medium-term (Month 2-3)
1. Implement multi-oracle fallback
2. EIP-712 typed data signing
3. External Secrets Operator for K8s
4. Database encryption at rest

---

*Document maintained by Security Team*
*Last updated: 2024-02-04*
