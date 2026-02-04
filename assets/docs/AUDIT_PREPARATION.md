# SecureMint Security Audit Preparation

## Overview

This document provides comprehensive preparation materials for security auditors reviewing the SecureMint protocol. It includes architecture overview, known concerns, test coverage, and specific areas requiring attention.

---

## 1. Protocol Architecture

### 1.1 Core Components

| Contract | Purpose | Criticality |
|----------|---------|-------------|
| `SecureMintToken` | ERC-20 token with controlled mint/burn | HIGH |
| `SecureMintPolicy` | Oracle-gated mint authorization | CRITICAL |
| `BackingOracle` | Chainlink PoR integration | CRITICAL |
| `TreasuryVault` | Multi-tier reserve management | HIGH |
| `RedemptionEngine` | Token-to-reserve redemption | HIGH |
| `EmergencyPause` | 5-level circuit breaker | CRITICAL |
| `SecureMintGovernor` | Timelocked DAO governance | MEDIUM |

### 1.2 Token Flow Diagram

```
                    ┌─────────────────┐
                    │  Chainlink PoR  │
                    │     Oracle      │
                    └────────┬────────┘
                             │ backing data
                             ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Treasury   │◄───│  BackingOracle  │───►│ SecureMintPolicy│
│   Vault     │    │                 │    │                 │
└─────────────┘    └─────────────────┘    └────────┬────────┘
                                                   │ mint()
                                                   ▼
                                          ┌─────────────────┐
                                          │ SecureMintToken │
                                          └────────┬────────┘
                                                   │
                    ┌─────────────────┐            │
                    │RedemptionEngine │◄───────────┘
                    └─────────────────┘
```

### 1.3 Invariants

The protocol maintains the following critical invariants:

1. **INV-SM-1**: `totalSupply ≤ backing` (adjusted for decimals)
   - Token supply (18 decimals) must never exceed oracle-reported backing (6 decimals)
   - File: `SecureMintPolicy.sol:secureMint()`

2. **INV-SM-2**: `epochMintedAmount ≤ epochCapacity`
   - Per-epoch minting is rate-limited
   - File: `SecureMintPolicy.sol:secureMint()`

3. **INV-SM-3**: Oracle staleness check
   - Oracle data must be within staleness threshold
   - File: `BackingOracle.sol:latestBacking()`

4. **INV-SM-4**: System pause enforcement
   - All operations check alert level before execution
   - File: `EmergencyPause.sol`

---

## 2. Access Control Matrix

| Role | Contract | Permissions |
|------|----------|-------------|
| `DEFAULT_ADMIN` | All | Grant/revoke roles |
| `MINTER_ROLE` | Policy | Execute secureMint |
| `PAUSER_ROLE` | Policy, Emergency | Pause/unpause |
| `ORACLE_UPDATER` | Oracle | Update backing data |
| `GUARDIAN_ROLE` | Emergency, Governor | Escalate alerts, veto |
| `TREASURY_MANAGER` | Treasury | Manage tier allocations |
| `EPOCH_MANAGER` | Policy | Modify epoch capacity |

---

## 3. Known Concerns & Design Decisions

### 3.1 Accepted Risks

1. **Oracle Dependency**: System relies on Chainlink PoR feed accuracy
   - Mitigation: Staleness checks, minimum backing threshold

2. **Centralized Emergency Controls**: Guardian can pause instantly
   - Mitigation: Multi-sig requirement, governance override

3. **Decimal Conversion**: 6-decimal backing vs 18-decimal tokens
   - Mitigation: Always round up when calculating required backing

### 3.2 Areas Requiring Scrutiny

1. **Reentrancy**: All external calls in `secureMint()` and `executeRedemption()`
2. **Integer Overflow**: Decimal conversions between 6 and 18 decimals
3. **Access Control**: Role assignment and inheritance
4. **Timestamp Dependence**: Epoch timing and staleness checks
5. **Front-running**: Mint/redemption ordering

---

## 4. Test Coverage

### 4.1 Unit Tests

```
contracts/test/
├── SecureMintToken.test.ts      (32 tests)
├── SecureMintPolicy.test.ts     (28 tests)
├── BackingOracle.test.ts        (18 tests)
├── TreasuryVault.test.ts        (24 tests)
├── RedemptionEngine.test.ts     (22 tests)
├── EmergencyPause.test.ts       (20 tests)
└── SecureMintGovernor.test.ts   (26 tests)
```

### 4.2 Integration Tests

```
contracts/test/integration/
├── MintFlow.test.ts             (12 scenarios)
└── RedemptionFlow.test.ts       (10 scenarios)
```

### 4.3 Invariant Tests (Foundry)

```
contracts/test/foundry/
└── Invariants.t.sol             (4 invariants, 10k runs)
```

### 4.4 Coverage Report

Run: `npx hardhat coverage`

Target: >95% line coverage, >90% branch coverage

---

## 5. Deployment & Upgrade Process

### 5.1 Deployment Order

1. Deploy `SecureMintToken`
2. Deploy `BackingOracle` (with Chainlink feed)
3. Deploy `EmergencyPause`
4. Deploy `TreasuryVault`
5. Deploy `SecureMintPolicy` (references 1-4)
6. Deploy `RedemptionEngine`
7. Deploy Governor + Timelock

### 5.2 Upgrade Strategy

- **Policy**: UUPS upgradeable with UPGRADER_ROLE + timelock
- **Treasury**: UUPS upgradeable with governance approval
- **Token**: Immutable (no upgrades)
- **Oracle**: Immutable (deploy new + governance switch)

---

## 6. External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| OpenZeppelin Contracts | 5.0.0 | ERC-20, Access Control, Pausable |
| OpenZeppelin Upgradeable | 5.0.0 | UUPS proxy pattern |
| Chainlink Contracts | 0.8.0 | AggregatorV3Interface |

---

## 7. Audit Scope

### 7.1 In Scope

- All Solidity contracts in `contracts/src/`
- Deployment scripts in `contracts/script/`
- Test coverage in `contracts/test/`

### 7.2 Out of Scope

- Frontend dashboard code
- SDK implementation
- Subgraph mappings
- External dependencies (OpenZeppelin, Chainlink)

---

## 8. Contact Information

- **Technical Lead**: [Contact Email]
- **Security Contact**: security@[domain].com
- **Bug Bounty**: [Program Link]

---

## 9. Audit Checklist

### Pre-Audit
- [ ] All tests passing
- [ ] Coverage report generated
- [ ] Slither analysis clean (no high/medium findings)
- [ ] Mythril analysis complete
- [ ] Documentation up to date
- [ ] Deployment addresses documented

### During Audit
- [ ] Daily sync calls scheduled
- [ ] Secure communication channel established
- [ ] Finding severity agreed upon

### Post-Audit
- [ ] All critical/high findings addressed
- [ ] Medium findings triaged
- [ ] Fix verification complete
- [ ] Final report published

---

## 10. Appendix

### A. Gas Optimization Notes

- `secureMint()`: ~150k gas (includes oracle read)
- `executeRedemption()`: ~120k gas
- Batch minting not supported by design (intentional)

### B. Previous Audits

None (initial audit)

### C. Bug Bounty Scope

Critical: Up to $100,000
High: Up to $25,000
Medium: Up to $5,000
Low: Up to $1,000

### D. Formal Verification Status

- Invariant testing: Complete (Foundry)
- Symbolic execution: Pending
- Full formal verification: Not performed
