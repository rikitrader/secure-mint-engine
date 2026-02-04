# SecureMint Engine - Security Checklist: Stack C

**Stack:** EVM Solidity (Hardhat + Foundry)
**Solidity Version:** 0.8.20+
**Upgradeability:** Non-upgradeable
**Admin Key Storage:** Multisig (Gnosis Safe)

---

## C1) Smart Contract Fundamentals

### Compiler Settings
- [ ] **Solidity Version** - Using 0.8.20+ (overflow protection built-in)
- [ ] **Optimizer Enabled** - Runs configured appropriately (200-1000)
- [ ] **Via-IR** - Enabled for complex contracts
- [ ] **Deterministic Build** - Same bytecode from same source

### Code Quality
- [ ] **NatSpec Documentation** - All public/external functions documented
- [ ] **Event Emission** - State changes emit indexed events
- [ ] **Custom Errors** - Using custom errors (not `require` strings)
- [ ] **No Magic Numbers** - Constants defined with meaningful names

---

## C2) Access Control

### Role Management (OpenZeppelin AccessControl)
- [ ] **Role Hierarchy** - DEFAULT_ADMIN_ROLE > MINTER_ROLE > GUARDIAN_ROLE
- [ ] **Role Separation** - Different addresses for different roles
- [ ] **Admin Transfer** - Two-step admin transfer (propose + accept)
- [ ] **Role Revocation** - Ability to revoke compromised roles

### Function Visibility
- [ ] **Explicit Visibility** - All functions have explicit visibility
- [ ] **Internal Helpers** - Utility functions marked `internal` or `private`
- [ ] **View/Pure** - Read-only functions marked appropriately
- [ ] **External vs Public** - `external` for non-internal calls

### Access Modifiers on Every Function
| Function | Required Role | Verified |
|----------|---------------|----------|
| `mint()` | MINTER_ROLE | [ ] |
| `burn()` | MINTER_ROLE or owner | [ ] |
| `pause()` | GUARDIAN_ROLE | [ ] |
| `unpause()` | ADMIN_ROLE | [ ] |
| `setEpochCap()` | GOVERNOR_ROLE | [ ] |
| `emergencyWithdraw()` | MULTISIG | [ ] |

---

## C3) Reentrancy Protection

### Guards Applied
- [ ] **ReentrancyGuard** - Inherited from OpenZeppelin
- [ ] **nonReentrant Modifier** - Applied to all state-changing functions
- [ ] **Check-Effects-Interactions** - Pattern followed in all functions
- [ ] **External Calls Last** - External calls after state changes

### Vulnerable Patterns Avoided
- [ ] **No delegate-call to untrusted** - Only trusted contracts
- [ ] **No callback before state update** - CEI pattern enforced
- [ ] **Pull over push** - Users withdraw instead of receiving

---

## C4) Pausable System

### 4-Level Pause System
| Level | Functions Affected | Guardian Can | Verified |
|-------|-------------------|--------------|----------|
| 0 | None | N/A | [ ] |
| 1 | New mints only | Enable | [ ] |
| 2 | All mints/burns | Enable | [ ] |
| 3 | All operations | Enable | [ ] |
| 4 | Emergency (total) | Cannot unpause | [ ] |

### Pause Controls
- [ ] **Guardian Pause** - Can pause to level 1-3
- [ ] **Admin Unpause** - Only admin can unpause
- [ ] **Emergency Level 4** - Requires timelock + multisig to unpause
- [ ] **Pause Events** - All pause changes emit events

---

## C5) Oracle Integration (SEC-013)

### Chainlink PoR Integration
- [ ] **Staleness Check** - Reject if `updatedAt` > threshold
- [ ] **Zero Value Check** - Reject if answer == 0
- [ ] **Deviation Check** - Alert if change > 10% from previous
- [ ] **Fallback Oracle** - Secondary oracle if primary fails

### Oracle Security
- [ ] **Multi-Oracle** - Not dependent on single oracle (SEC-013)
- [ ] **Heartbeat Validation** - Check against expected heartbeat
- [ ] **Price Bounds** - Sanity check min/max values
- [ ] **Sequencer Check** - L2 sequencer uptime feed checked

### Staleness Parameters
```solidity
uint256 constant STALENESS_THRESHOLD = 3600; // 1 hour
uint256 constant MIN_BACKING_RATIO = 1e18;   // 100%
uint256 constant MAX_DEVIATION = 1000;        // 10%
```

---

## C6) Integer Safety

### Rounding Boundaries
- [ ] **Favor Protocol** - Rounding always favors protocol/users fairly
- [ ] **Division Before Multiplication** - Avoided where possible
- [ ] **Precision Loss** - Documented and acceptable
- [ ] **Overflow Checks** - 0.8.x built-in, but explicit for clarity

### Amount Validation
- [ ] **Zero Check** - Reject amount == 0
- [ ] **Max Supply Check** - Reject if exceeds max supply
- [ ] **Balance Check** - Verify sender has sufficient balance
- [ ] **Allowance Check** - ERC20 allowance validated

---

## C7) Timelock Controls

### Governance Timelock
| Operation | Minimum Delay | Verified |
|-----------|---------------|----------|
| Parameter change | 48 hours | [ ] |
| Role grant/revoke | 48 hours | [ ] |
| Emergency unpause | 24 hours | [ ] |
| Contract upgrade | 72 hours | [ ] |
| Treasury withdrawal | 72 hours | [ ] |

### Timelock Security
- [ ] **Proposer Role** - Limited to governance
- [ ] **Executor Role** - Limited to multisig
- [ ] **Canceller Role** - Admin can cancel pending
- [ ] **Proposal Events** - All proposals emit events

---

## C8) Withdrawal Limits

### Tiered Withdrawal System
| Tier | Amount | Requirement | Verified |
|------|--------|-------------|----------|
| 1 | < $10K | Standard auth | [ ] |
| 2 | $10K - $100K | Operator approval | [ ] |
| 3 | $100K - $1M | Multisig 2/3 | [ ] |
| 4 | > $1M | Multisig 3/5 + Timelock | [ ] |

### Rate Limits
- [ ] **Epoch Cap** - Max tokens mintable per epoch
- [ ] **Daily Limit** - Per-address daily withdrawal limit
- [ ] **Cooldown Period** - Minimum time between large withdrawals

---

## C9) MEV Protection

### Commit-Reveal for Large Mints
- [ ] **Commit Phase** - Hash of intent submitted
- [ ] **Reveal Window** - 2-10 blocks after commit
- [ ] **Expired Commits** - Auto-invalidate after 256 blocks
- [ ] **Commit Bond** - Small deposit to prevent spam

### MEV Mitigations
- [ ] **Private Mempool** - Option for Flashbots Protect
- [ ] **Slippage Protection** - Max slippage parameter on swaps
- [ ] **Deadline Parameter** - Transaction expiry timestamp

---

## C10) Testing Requirements

### Foundry Fuzz Tests
```bash
# Minimum fuzz runs
forge test --fuzz-runs 50000 --match-contract "Fuzz"
```

- [ ] **Input Fuzzing** - All external functions fuzzed
- [ ] **State Fuzzing** - Various contract states tested
- [ ] **Invariant Tests** - Core invariants never violated

### Invariant Tests
| ID | Invariant | Verified |
|----|-----------|----------|
| INV-SM-1 | Supply <= Backing | [ ] |
| INV-SM-2 | No mint when paused | [ ] |
| INV-SM-3 | No mint with stale oracle | [ ] |
| INV-SM-4 | Epoch minted <= Epoch cap | [ ] |

### Coverage Requirements
- [ ] **Line Coverage** - >= 90%
- [ ] **Branch Coverage** - >= 85%
- [ ] **Function Coverage** - 100%

---

## C11) Static Analysis

### Slither Analysis
```bash
slither . --exclude-dependencies --filter-paths "test/|script/"
```

- [ ] **No High/Critical** - Zero high/critical findings
- [ ] **Medium Reviewed** - All medium findings reviewed
- [ ] **False Positives** - Documented and suppressed

### Mythril (Optional)
```bash
myth analyze contracts/SecureMintPolicy.sol --solc-json mythril.config.json
```

### Echidna Property Testing
```bash
echidna-test . --contract EchidnaSecureMint --test-mode assertion
```

---

## C12) Deployment Security

### Pre-Deployment Checklist
- [ ] **Testnet Deployment** - Verified on Sepolia
- [ ] **Verify Source** - Etherscan verification ready
- [ ] **Constructor Args** - Double-checked all parameters
- [ ] **Initial Roles** - Correct addresses for roles

### Post-Deployment Verification
- [ ] **Role Verification** - Query all roles, verify addresses
- [ ] **Parameter Verification** - Check all initial parameters
- [ ] **Integration Test** - Full flow test on mainnet fork
- [ ] **Monitoring Setup** - Alerts for critical events

---

## C13) Emergency Procedures

### Circuit Breakers
- [ ] **Guardian Pause** - Can pause within seconds
- [ ] **Oracle Circuit Breaker** - Auto-pause on stale oracle
- [ ] **Price Circuit Breaker** - Auto-pause on extreme deviation
- [ ] **Volume Circuit Breaker** - Auto-pause on unusual volume

### Recovery Procedures
- [ ] **Emergency Contact List** - 24/7 contact for all signers
- [ ] **Recovery Playbook** - Documented steps for incidents
- [ ] **Backup Signers** - Alternate signers if primary unavailable

---

## Verification Commands

```bash
# Run Slither
slither . --exclude-dependencies --filter-paths "test/|script/"

# Run Foundry tests with high fuzz runs
forge test --fuzz-runs 50000 -vvv

# Run invariant tests
forge test --match-contract "Invariant" --fuzz-runs 1000 -vvv

# Check test coverage
forge coverage --report lcov

# Verify reentrancy guards
grep -r "nonReentrant" contracts/ | wc -l
# Should match number of state-changing functions

# Verify access control
grep -r "onlyRole\|require.*msg.sender" contracts/ | wc -l
# Every external function should have access check
```

---

## Contract-Specific Checks

### BackedToken (ERC20)
- [ ] `mint()` - Only MINTER_ROLE, respects epoch cap
- [ ] `burn()` - Only token holder or approved
- [ ] `transfer()` - No blocklist, standard ERC20
- [ ] `permit()` - EIP-2612 implemented correctly

### SecureMintPolicy
- [ ] `canMint()` - Oracle check, epoch check, pause check
- [ ] `executeMint()` - Pre-signed tx verification, signer check
- [ ] `proposeCapChange()` - Governor role, timelock

### TreasuryVault
- [ ] `deposit()` - Ownership recorded correctly
- [ ] `withdraw()` - Tiered limits, ownership verified
- [ ] `emergencyWithdraw()` - Multisig only, logged

### BackingOraclePoR
- [ ] `getTotalBackingValue()` - Aggregates all oracles
- [ ] `isStale()` - Correct staleness logic
- [ ] `getLatestPrice()` - Zero/negative check

---

*Checklist Version: 1.0*
*Generated: 2024-02-04*
*Stack: C (EVM Solidity - Hardhat/Foundry)*
