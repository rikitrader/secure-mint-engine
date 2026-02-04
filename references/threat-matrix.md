# Threat Matrix for SecureMintEngine

## Overview

This document defines required simulations and threat modeling for any SecureMintEngine deployment. **Any unmitigated fatal scenario → NO-GO.**

---

## Required Simulations

### 1. Oracle Manipulation

**Scenario:** Attacker manipulates oracle price feed to mint tokens with insufficient backing.

**Simulation Parameters:**
- Flash loan attack on oracle source
- Spot price manipulation
- Multi-block manipulation

**Required Mitigations:**
- [ ] TWAP oracle usage (not spot price)
- [ ] Deviation bounds (reject >5% single-block moves)
- [ ] Multi-oracle aggregation
- [ ] Minimum liquidity requirements for price sources

**Test Cases:**
```
simulate_oracle_manipulation(
    price_change: +50%,
    blocks: 1,
    expected: MINT_BLOCKED
)
```

---

### 2. Oracle Downtime

**Scenario:** Oracle feed stops updating (network congestion, provider failure, etc.)

**Simulation Parameters:**
- 1 hour downtime
- 24 hour downtime
- Permanent failure

**Required Mitigations:**
- [ ] Staleness check (auto-pause if data > threshold age)
- [ ] Fallback oracle configured
- [ ] Graceful degradation (allow burns, block mints)

**Test Cases:**
```
simulate_oracle_downtime(
    duration: 3600, // 1 hour
    expected: MINT_PAUSED_AUTOMATICALLY
)
```

---

### 3. Reserve Shortfall

**Scenario:** Actual reserves fall below reported/required amount.

**Simulation Parameters:**
- 5% shortfall
- 20% shortfall
- 50% shortfall
- Complete reserve loss

**Required Mitigations:**
- [ ] Real-time reserve monitoring
- [ ] Auto-pause on any shortfall detection
- [ ] Redemption queue (orderly unwinding)
- [ ] Insurance fund (if applicable)

**Test Cases:**
```
simulate_reserve_shortfall(
    shortfall_percent: 20,
    expected: MINT_BLOCKED + ALERT_EMITTED
)
```

---

### 4. Delayed PoR Updates

**Scenario:** Proof-of-Reserve attestation is delayed, creating uncertainty window.

**Simulation Parameters:**
- Attestation delayed 1 hour
- Attestation delayed 24 hours
- Attestation provider failure

**Required Mitigations:**
- [ ] Maximum acceptable PoR age configured
- [ ] Auto-pause if PoR too old
- [ ] Secondary attestation source

**Test Cases:**
```
simulate_por_delay(
    delay: 86400, // 24 hours
    expected: MINT_PAUSED
)
```

---

### 5. Emergency Pause Race Conditions

**Scenario:** Attacker attempts to front-run pause transaction with large mint.

**Simulation Parameters:**
- Pause in mempool, attacker sees and front-runs
- High gas price attack
- Flashbots bundle attack

**Required Mitigations:**
- [ ] Private mempool for pause transactions
- [ ] Rate limits independent of pause
- [ ] Per-transaction caps
- [ ] Keeper network for monitoring

**Test Cases:**
```
simulate_pause_frontrun(
    attacker_mint_amount: EPOCH_CAP,
    expected: MINT_BOUNDED_BY_RATE_LIMIT
)
```

---

## Threat Analysis Matrix

### T1: Unbacked Mint Attempt

| Attribute | Value |
|-----------|-------|
| **Threat** | Attacker attempts to mint tokens without sufficient backing |
| **Attack Vector** | Bypass oracle check, manipulate oracle, exploit logic bug |
| **Impact** | CRITICAL - Devaluation of all tokens, loss of peg |
| **Likelihood** | HIGH - Primary attack target |
| **Mitigations** | Oracle gating, invariant checks, rate limits, formal verification |
| **Residual Risk** | LOW if all mitigations implemented |

---

### T2: Oracle Compromise

| Attribute | Value |
|-----------|-------|
| **Threat** | Oracle provider is compromised or reports false data |
| **Attack Vector** | Hack oracle infrastructure, bribe attestors |
| **Impact** | CRITICAL - False backing enables unbacked mints |
| **Likelihood** | MEDIUM - Requires sophisticated attack |
| **Mitigations** | Multi-oracle, deviation bounds, manual circuit breaker |
| **Residual Risk** | MEDIUM - Trust in oracle providers remains |

---

### T3: Admin Key Compromise

| Attribute | Value |
|-----------|-------|
| **Threat** | Admin keys are stolen or misused |
| **Attack Vector** | Phishing, insider threat, key theft |
| **Impact** | HIGH - Parameter manipulation, pause override |
| **Likelihood** | MEDIUM - Common attack vector |
| **Mitigations** | Multisig (3/5 minimum), timelocks, no direct mint authority |
| **Residual Risk** | LOW if admin cannot bypass backing checks |

---

### T4: Governance Capture

| Attribute | Value |
|-----------|-------|
| **Threat** | Malicious actor gains control of governance |
| **Attack Vector** | Token accumulation, vote buying, flashloan governance |
| **Impact** | CRITICAL - Can change all parameters |
| **Likelihood** | LOW-MEDIUM - Expensive but possible |
| **Mitigations** | Timelocks, guardian veto, immutable core invariants |
| **Residual Risk** | MEDIUM - Governance always has some power |

---

### T5: False Reserve Reporting

| Attribute | Value |
|-----------|-------|
| **Threat** | Reserve custodian reports false reserve amounts |
| **Attack Vector** | Fraud, accounting manipulation, rehypothecation |
| **Impact** | CRITICAL - System believes it has backing when it doesn't |
| **Likelihood** | MEDIUM - Depends on custodian trustworthiness |
| **Mitigations** | Multiple attestors, on-chain collateral (preferred), audits |
| **Residual Risk** | HIGH for off-chain reserves - inherent trust assumption |

---

## Risk Assessment Summary

| Threat | Pre-Mitigation Risk | Post-Mitigation Risk | Status |
|--------|---------------------|----------------------|--------|
| T1: Unbacked Mint | CRITICAL | LOW | ✅ Mitigated |
| T2: Oracle Compromise | CRITICAL | MEDIUM | ⚠️ Residual Risk |
| T3: Admin Key Compromise | HIGH | LOW | ✅ Mitigated |
| T4: Governance Capture | HIGH | MEDIUM | ⚠️ Residual Risk |
| T5: False Reserve Reporting | CRITICAL | HIGH* | ⚠️ Trust Assumption |

*Off-chain reserves have inherent trust assumptions that cannot be fully mitigated on-chain.

---

## NO-GO Criteria

Deployment MUST be blocked if ANY of the following:

1. **Oracle manipulation simulation succeeds** in minting unbacked tokens
2. **No automatic pause** on oracle failure
3. **Admin can bypass** backing verification
4. **No rate limits** or caps configured
5. **Single key** controls critical functions
6. **No timelock** on parameter changes
7. **Invariant violation** possible under any tested scenario
8. **Formal verification** identifies critical vulnerability

---

## Sign-Off Requirements

Before deployment, the following must sign off:

- [ ] Security audit firm
- [ ] Internal security team
- [ ] Formal verification results reviewed
- [ ] All simulations passed
- [ ] Threat matrix reviewed and accepted
- [ ] Residual risks documented and accepted by governance
