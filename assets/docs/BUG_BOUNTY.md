# SecureMint Engine Bug Bounty Program

## Overview

The SecureMint Engine Bug Bounty Program rewards security researchers who identify and responsibly disclose vulnerabilities in our smart contracts and supporting infrastructure.

**Program Status**: Active
**Total Bounty Pool**: $500,000 USD
**Platform**: Immunefi / Code4rena

---

## Scope

### In-Scope Assets

| Asset | Type | Severity | Max Bounty |
|-------|------|----------|------------|
| SecureMintToken.sol | Smart Contract | Critical | $100,000 |
| SecureMintPolicy.sol | Smart Contract | Critical | $100,000 |
| BackingOracle.sol | Smart Contract | Critical | $75,000 |
| TreasuryVault.sol | Smart Contract | Critical | $75,000 |
| RedemptionEngine.sol | Smart Contract | Critical | $50,000 |
| EmergencyPause.sol | Smart Contract | Critical | $50,000 |
| SecureMintGovernor.sol | Smart Contract | High | $25,000 |
| SecureMintPolicyUpgradeable.sol | Smart Contract | Critical | $25,000 |

### Out of Scope

- Frontend dashboard (assets/dashboard/)
- SDK and React hooks (assets/sdk/)
- Alerting service (assets/alerting/)
- Subgraph handlers (assets/subgraph/)
- Test files and mocks
- Documentation
- Third-party dependencies (OpenZeppelin, Chainlink)

---

## Severity Classification

### Critical (Up to $100,000)

Direct theft or permanent freezing of funds affecting:
- Total supply manipulation (minting without backing)
- Unauthorized access to treasury reserves
- Bypass of oracle validation
- Complete protocol insolvency

**Examples:**
- INV-SM-1 violation: Minting tokens when `totalSupply > backing`
- Unauthorized minter role acquisition
- Oracle manipulation enabling unbacked minting
- Treasury drain vulnerability

### High ($10,000 - $25,000)

Temporary freezing of funds or significant protocol disruption:
- Denial of service on critical functions
- Governance manipulation
- Rate limit bypass (INV-SM-2)
- Emergency pause bypass (INV-SM-4)

**Examples:**
- Epoch capacity circumvention
- Timelock bypass in governance
- Guardian role compromise
- Emergency level manipulation

### Medium ($1,000 - $10,000)

Protocol malfunction without direct fund loss:
- Oracle staleness check bypass (INV-SM-3)
- Incorrect event emissions
- Access control weaknesses
- Gas griefing attacks

**Examples:**
- Staleness threshold manipulation
- Incorrect tier allocation calculations
- Rebalancing logic errors
- Redemption queue manipulation

### Low ($100 - $1,000)

Minor issues and informational findings:
- Code quality issues
- Gas optimizations >10% improvement
- Documentation inconsistencies
- Best practice violations

---

## Rewards

### Payout Structure

| Severity | Min Reward | Max Reward | Response Time |
|----------|------------|------------|---------------|
| Critical | $25,000 | $100,000 | 24 hours |
| High | $10,000 | $25,000 | 48 hours |
| Medium | $1,000 | $10,000 | 72 hours |
| Low | $100 | $1,000 | 7 days |

### Bonus Multipliers

- **First finder**: +25% bonus
- **PoC exploit code**: +15% bonus
- **Suggested fix**: +10% bonus
- **Multiple related findings**: Bundled as single higher-severity issue

### Payment

- Payments in USDC or equivalent stablecoin
- KYC required for payments >$10,000
- Payments processed within 14 days of fix deployment

---

## Rules of Engagement

### Responsible Disclosure

1. **Do NOT**:
   - Exploit vulnerabilities on mainnet
   - Access or modify other users' data
   - Perform DoS attacks
   - Social engineer team members
   - Publicly disclose before fix deployment

2. **DO**:
   - Test only on testnets (Sepolia, Base Sepolia)
   - Use your own test accounts
   - Provide detailed reproduction steps
   - Suggest potential mitigations
   - Respond to team communications promptly

### Report Requirements

A valid report must include:

```markdown
## Summary
[Brief description of the vulnerability]

## Severity
[Critical/High/Medium/Low]

## Affected Component
[Contract name, function, line numbers]

## Attack Vector
[Step-by-step reproduction]

## Impact
[What can an attacker achieve?]

## Proof of Concept
[Code or transaction demonstrating the issue]

## Suggested Fix
[Optional but appreciated]
```

### Submission Process

1. Submit via Immunefi: https://immunefi.com/bounty/securemint
2. Or email: security@securemint.io (PGP key available)
3. Include all required information
4. Await confirmation (24-48 hours)
5. Collaborate on fix verification
6. Receive payment after deployment

---

## Invariant Violations

Special bounties for proving invariant violations:

| Invariant | Description | Bounty |
|-----------|-------------|--------|
| INV-SM-1 | `totalSupply > backing` proven possible | $100,000 |
| INV-SM-2 | `epochMinted > epochCapacity` proven possible | $50,000 |
| INV-SM-3 | Minting with stale oracle data | $25,000 |
| INV-SM-4 | Minting during emergency pause | $50,000 |

To claim invariant bounties:
1. Provide Foundry/Hardhat test demonstrating violation
2. Include transaction trace
3. Explain root cause

---

## Previous Findings

### Acknowledged Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| SM-001 | Medium | Gas optimization in batch mint | Fixed v1.1 |
| SM-002 | Low | Event parameter ordering | Fixed v1.1 |

### Known Limitations

The following are known and accepted:
- Oracle can be updated by authorized addresses (by design)
- Guardian can pause system (by design)
- Governance can change parameters after timelock (by design)
- Epoch capacity resets at epoch boundary (by design)

---

## Legal

### Safe Harbor

SecureMint will not pursue legal action against researchers who:
- Act in good faith
- Follow responsible disclosure
- Do not exploit vulnerabilities maliciously
- Do not access others' funds or data

### Eligibility

- Must be 18+ years old
- Not a resident of OFAC-sanctioned countries
- Not a current or former employee/contractor (within 6 months)
- Not involved in audit of the contracts

---

## Contact

- **Security Email**: security@securemint.io
- **PGP Key**: [Available on keyserver]
- **Immunefi**: https://immunefi.com/bounty/securemint
- **Response SLA**: 24-48 hours

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-01 | Initial program launch |
| 1.1 | 2024-03-01 | Added invariant bounties |
| 1.2 | 2024-06-01 | Increased critical rewards |

---

*Thank you for helping keep SecureMint secure. Your efforts protect millions in user funds.*
