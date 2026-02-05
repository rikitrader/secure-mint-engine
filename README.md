# SecureMint Engine

<div align="center">

<img src="assets/logo.svg" alt="SecureMint Engine Logo" width="640">

**Enterprise-grade oracle-gated secure minting protocol for backed tokens**

[![Security Audit](https://img.shields.io/badge/Security-Audited-green.svg)](#security-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)

**English** | [Versión en Español](README_ES.md)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Mathematical Foundations & Economic Model](#mathematical-foundations--economic-model)
- [Architecture](#architecture)
- [Core Invariants](#core-invariants)
- [Security Audit](#security-audit)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Smart Contracts](#smart-contracts)
- [API Gateway](#api-gateway)
- [SDK Usage](#sdk-usage)
- [Backtest Engine](#backtest-engine)
- [Testing](#testing)
- [Deployment](#deployment)
- [License & Third-Party Disclosures](#license--third-party-disclosures)
- [Contributing](#contributing)
- [Contact](#contact)

---

## Overview

**SecureMint Engine** is an enterprise-grade oracle-gated secure minting protocol designed for creating backed tokens including stablecoins, asset-backed tokens, and Real World Asset (RWA) tokens. At its core, the protocol enforces one fundamental, non-negotiable invariant: tokens can ONLY be minted when backing is provably sufficient via on-chain oracles or Proof-of-Reserve feeds. This cryptographic enforcement eliminates the trust assumptions that have led to catastrophic failures in the stablecoin and backed token ecosystem.

### The Problem We Solve

The history of backed tokens is littered with failures rooted in a single vulnerability: **discretionary minting without verifiable backing**. From algorithmic stablecoins that collapsed under bank-run conditions to asset-backed tokens where reserves existed only on paper, the common thread is always the same—the ability to create tokens without cryptographic proof that corresponding backing exists.

Traditional token systems rely on trust. Users trust that when a protocol claims "1:1 backing" or "fully collateralized," the reserves actually exist. They trust that minting is controlled responsibly. They trust that attestations from third parties are accurate and timely. This trust-based model has failed repeatedly:

- **Terra/LUNA (2022)**: $40 billion evaporated when algorithmic backing proved insufficient under stress
- **FTX/Alameda**: Customer deposits backing FTT tokens were secretly depleted
- **Numerous smaller projects**: Promised reserves that were never verified, leading to insolvency

SecureMint Engine eliminates trust from the equation. Every mint operation requires cryptographic proof—delivered via on-chain oracles or Proof-of-Reserve feeds—that backing exists and is sufficient. No proof means no minting. Period.

### Core Philosophy: Follow The Money

> Every token in circulation MUST have a verifiable, on-chain proof of backing.
> **No backing proof = No minting.**

This philosophy, which we call the "Follow-the-Money Doctrine," is not merely a design principle—it is an immutable constraint enforced at the smart contract level. The SecureMint Policy Contract acts as an automated gatekeeper that mathematically verifies backing before any mint operation can execute. Human discretion is removed from the critical path. Administrative keys cannot override backing requirements. There are no emergency minting functions that bypass verification.

### How It Works

SecureMint Engine implements a multi-layer architecture that separates concerns while maintaining ironclad security:

**1. The Token Layer (BackedToken.sol)**

The token contract itself is intentionally "dumb." It implements the ERC-20 standard with one critical modification: the `mint()` function can ONLY be called by the SecureMint Policy Contract. No admin keys, no multisig, no governance vote can mint tokens directly. This architectural decision means that even if every other system component were compromised, unbacked tokens could not be created.

**2. The Policy Layer (SecureMintPolicy.sol)**

This is the brain of the system. When a mint request arrives, the Policy Contract executes a series of mandatory checks:

- **Oracle Health Check**: Is the price/reserve oracle responding? Is the data fresh (less than 1 hour old)? Is there suspicious deviation from recent values?
- **Backing Verification**: After this mint, will total supply still be less than or equal to verified backing? This check uses real-time oracle data, not cached or stale values.
- **Rate Limiting**: Does this mint exceed the per-epoch cap? Does it exceed the global supply cap?
- **System State**: Is the system paused due to an emergency? Are all circuit breakers in normal state?

If ANY check fails, the transaction reverts. There are no warnings, no override options, no admin bypass. The mint simply cannot occur.

**3. The Oracle Layer (BackingOraclePoR.sol)**

The oracle layer aggregates data from multiple sources to determine verified backing. For on-chain collateral, this means querying price feeds and calculating collateral value. For off-chain reserves (like bank deposits backing a fiat-collateralized stablecoin), this means consuming Proof-of-Reserve feeds from providers like Chainlink.

The oracle layer implements staleness checks (rejecting data older than the configured threshold), deviation bounds (flagging suspicious price movements), and multi-source aggregation (requiring consensus across multiple oracle providers). If oracles disagree significantly or go offline, minting automatically pauses.

**4. The Treasury Layer (TreasuryVault.sol)**

Reserves are managed through a four-tier system designed to balance accessibility with security:

- **Tier 0 (Hot)**: 5-10% of reserves for immediate redemptions, held in liquid on-chain assets
- **Tier 1 (Warm)**: 15-25% accessible within hours, typically in money market protocols
- **Tier 2 (Cold)**: 50-60% in secure custody, accessible within days
- **Tier 3 (RWA)**: 10-20% in real-world assets like T-bills, accessible within days to weeks

This tiered approach ensures that normal redemption demand can be met instantly while protecting the majority of reserves from smart contract risk.

**5. The Governance Layer**

While minting is fully automated and cannot be overridden, protocol parameters can be adjusted through governance. However, all parameter changes flow through a Timelock contract, providing a mandatory delay (typically 48-72 hours) during which the community can review changes and, if necessary, exit the system. Emergency actions require Guardian multisig approval and are limited to protective measures (pausing, not minting).

### The Four Invariants

SecureMint Engine enforces four core invariants that are continuously monitored and automatically enforced:

**INV-SM-1: Backing Always Covers Supply**
```
backing(t) >= totalSupply(t) for all time t
```
At no point can the total token supply exceed verified backing. This is checked before every mint and continuously monitored.

**INV-SM-2: Oracle Health Required**
```
mint() reverts if oracle_healthy == false
```
Minting is impossible without fresh, valid oracle data. Stale data, unresponsive oracles, or suspicious deviations all trigger automatic rejection.

**INV-SM-3: Mint Is Bounded**
```
minted(epoch) <= epoch_cap AND totalSupply <= global_cap
```
Even with sufficient backing, minting is rate-limited to prevent rapid supply expansion that could destabilize markets.

**INV-SM-4: No Bypass Path**
```
∀ contracts, roles: mint() callable only via SecureMintPolicy
```
There exists no function, role, or contract that can mint tokens except through the Policy Contract's verified path.

### Why This Matters

The implications of cryptographic backing enforcement extend beyond technical security:

**For Users**: You no longer need to trust attestations, auditors, or protocol teams. The blockchain itself enforces backing requirements. If tokens exist, backing exists—mathematically guaranteed.

**For Regulators**: Proof-of-Reserve becomes real-time and verifiable, not a quarterly PDF. Regulators can independently verify backing at any block height.

**For Institutions**: The risk of fractional reserve exposure is eliminated. Integration with SecureMint tokens doesn't require trust assumptions about the issuer's solvency.

**For the Ecosystem**: Failures of backed tokens have repeatedly damaged confidence in the broader crypto ecosystem. Provably-backed tokens rebuild that trust on cryptographic foundations.

### Production-Ready Architecture

SecureMint Engine is not a proof-of-concept. It is production infrastructure designed for institutional deployment:

- **8 Battle-Tested Smart Contracts** implementing the full token lifecycle
- **TypeScript SDK** with React hooks for frontend integration
- **The Graph Subgraph** for indexed, queryable blockchain data
- **REST/GraphQL API Gateway** for off-chain system integration
- **Comprehensive Test Suite** including unit tests, integration tests, fuzz testing, and formal verification
- **Security Audit Framework** with regression tests preventing vulnerability reintroduction
- **Backtest Engine** simulating protocol behavior under stress conditions (bank runs, oracle failures, market crashes)
- **CI/CD Pipeline** with security gates that block deployment on any finding

### Who Should Use SecureMint Engine

SecureMint Engine is designed for:

- **Stablecoin Issuers** building fiat-backed, crypto-collateralized, or hybrid stablecoins
- **RWA Tokenization Projects** bringing real-world assets on-chain with verifiable backing
- **Institutional Token Issuers** requiring regulatory-grade backing verification
- **DeFi Protocols** building lending, borrowing, or trading systems that need provably-backed assets
- **Central Bank Digital Currency (CBDC) Research** exploring cryptographic backing enforcement

If your token claims backing—whether from fiat reserves, crypto collateral, real estate, commodities, or any other asset—SecureMint Engine ensures that claim is cryptographically verifiable and automatically enforced.

### The Future of Backed Tokens

The era of trust-based backing is ending. Users, regulators, and institutions increasingly demand verifiable proof rather than attestations and promises. SecureMint Engine represents the architectural standard for this new era: backing that is proven, not promised; enforcement that is cryptographic, not discretionary; and security that is guaranteed by mathematics, not trust.

Welcome to the future of backed tokens. Welcome to SecureMint Engine.

---

## Mathematical Foundations & Economic Model

SecureMint Engine is built on rigorous mathematical foundations that ensure cryptographic security and economic stability. This section documents the core equations, models, and graphs that underpin the protocol.

### Core Invariant Equations

#### Fundamental Backing Invariant (INV-SM-1)

The primary security constraint ensuring tokens are always fully backed:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ∀t : B(t) ≥ S(t)                                                          ║
║                                                                              ║
║   where:                                                                     ║
║     B(t) = Total verified backing value at time t (in base currency)        ║
║     S(t) = Total token supply at time t                                     ║
║                                                                              ║
║   Expanded form:                                                             ║
║                                                                              ║
║   B(t) = Σᵢ[Rᵢ(t) × Pᵢ(t)] + PoR(t)                                        ║
║                                                                              ║
║   where:                                                                     ║
║     Rᵢ(t)  = Reserve quantity of asset i at time t                          ║
║     Pᵢ(t)  = Oracle price of asset i at time t                              ║
║     PoR(t) = Proof-of-Reserve attestation for off-chain assets              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Collateralization Ratio

```
                    B(t)
    CR(t) = ─────────────────  × 100%
                    S(t)

    Constraints:
    ┌─────────────────────────────────────────────────────────┐
    │  CR(t) ≥ 100%     →  Minting ALLOWED                    │
    │  CR(t) < 100%     →  Minting BLOCKED, System PAUSED     │
    │  CR(t) ≥ 150%     →  Healthy over-collateralization     │
    └─────────────────────────────────────────────────────────┘
```

#### Mint Authorization Function

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   canMint(amount, recipient) → boolean                                       ║
║                                                                              ║
║   = oracle_healthy(t)                                                        ║
║     ∧ (S(t) + amount ≤ B(t))                                                ║
║     ∧ (minted_epoch(e) + amount ≤ epoch_cap)                                ║
║     ∧ (S(t) + amount ≤ global_cap)                                          ║
║     ∧ ¬isPaused                                                              ║
║     ∧ hasRole(msg.sender, MINTER_ROLE)                                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Oracle Health Functions

#### Staleness Check (INV-SM-2)

```
    oracle_healthy(t) = (t - t_last_update) < STALENESS_THRESHOLD

    where:
      t                   = Current timestamp
      t_last_update       = Last oracle update timestamp
      STALENESS_THRESHOLD = 3600 seconds (1 hour)

    ┌──────────────────────────────────────────────────────────────────────┐
    │  ORACLE STALENESS TIMELINE                                           │
    │                                                                      │
    │  Fresh         Warning Zone        Stale (BLOCKED)                   │
    │    ◄─────────────►◄───────────────►◄───────────────────►             │
    │    0            45min            1hr                                 │
    │    │              │               │                                  │
    │    ●──────────────●───────────────●────────────────────►  time       │
    │  update        warning         reject                                │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

#### Price Deviation Detection

```
    deviation(P_new, P_old) = |P_new - P_old| / P_old × 100%

    ┌───────────────────────────────────────────────────────────────┐
    │  Deviation < 5%   →  ACCEPT                                   │
    │  5% ≤ Deviation < 10%  →  ACCEPT with WARNING flag            │
    │  Deviation ≥ 10%  →  REJECT (requires multi-oracle consensus) │
    └───────────────────────────────────────────────────────────────┘
```

#### Multi-Oracle Aggregation

```
    P_aggregated = median(P₁, P₂, ..., Pₙ)

    Consensus requirement:

    ∀i,j : |Pᵢ - Pⱼ| / max(Pᵢ, Pⱼ) < MAX_DEVIATION (5%)

    If consensus fails → System enters DEGRADED mode → Minting PAUSED
```

### Rate Limiting Equations (INV-SM-3)

#### Epoch-Based Rate Limiting

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   epoch(t) = ⌊t / EPOCH_DURATION⌋                                           ║
║                                                                              ║
║   minted_epoch(e) = Σ amount_minted during epoch e                          ║
║                                                                              ║
║   Rate limit check:                                                          ║
║   minted_epoch(current_epoch) + amount ≤ EPOCH_CAP                          ║
║                                                                              ║
║   Default parameters:                                                        ║
║     EPOCH_DURATION = 86400 seconds (24 hours)                               ║
║     EPOCH_CAP = 5% of total supply                                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Exponential Backoff for Failed Mints

```
    wait_time(n) = min(BASE_DELAY × 2ⁿ, MAX_DELAY)

    where:
      n         = Number of consecutive failed attempts
      BASE_DELAY = 1 second
      MAX_DELAY  = 3600 seconds (1 hour)

    ┌──────────────────────────────────────────────────────────────────────┐
    │  BACKOFF CURVE                                                       │
    │                                                                      │
    │  wait(s) │                                    ┌───────────────       │
    │    3600  │                                    │                      │
    │          │                              ┌─────┘                      │
    │    1800  │                        ┌─────┘                            │
    │          │                  ┌─────┘                                  │
    │     900  │            ┌─────┘                                        │
    │          │      ┌─────┘                                              │
    │     450  │ ┌────┘                                                    │
    │          │─┘                                                         │
    │       1  └──────────────────────────────────────────────► attempts   │
    │          1    2    3    4    5    6    7    8    9   10              │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Treasury Reserve Model

#### Four-Tier Reserve Allocation

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        RESERVE TIER STRUCTURE                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   Total Reserves = Tier₀ + Tier₁ + Tier₂ + Tier₃                            ║
║                                                                              ║
║   ┌────────┬───────────┬─────────────┬───────────────────────────────────┐  ║
║   │  Tier  │ Allocation│ Access Time │ Asset Types                       │  ║
║   ├────────┼───────────┼─────────────┼───────────────────────────────────┤  ║
║   │  T₀    │   5-10%   │ Immediate   │ Stablecoins, Native tokens        │  ║
║   │  T₁    │  15-25%   │ < 4 hours   │ Money markets (Aave, Compound)    │  ║
║   │  T₂    │  50-60%   │ < 48 hours  │ Cold storage, Multi-sig vaults    │  ║
║   │  T₃    │  10-20%   │ < 7 days    │ T-Bills, RWA, Bonds               │  ║
║   └────────┴───────────┴─────────────┴───────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Reserve Utilization Function

```
    liquidity_available(urgency) =
        if urgency == IMMEDIATE:
            return T₀
        elif urgency == URGENT:
            return T₀ + T₁
        elif urgency == STANDARD:
            return T₀ + T₁ + T₂
        else:
            return T₀ + T₁ + T₂ + T₃

    ┌──────────────────────────────────────────────────────────────────────┐
    │  RESERVE ACCESSIBILITY GRAPH                                         │
    │                                                                      │
    │  Available │                                                         │
    │  Reserves  │                                      ┌─────────  100%   │
    │    (%)     │                            ┌─────────┘                  │
    │            │                   ┌────────┘                            │
    │    80%     │                   │                                     │
    │            │          ┌────────┘                                     │
    │    60%     │          │                                              │
    │            │ ┌────────┘                                              │
    │    40%     │ │                                                       │
    │            │ │                                                       │
    │    20%     │ │                                                       │
    │            ├─┘                                                       │
    │     0%     └─────────────────────────────────────────────► time      │
    │            0    4hr    12hr    24hr    48hr    5d     7d             │
    │           T₀    T₁                     T₂            T₃              │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Redemption Queue Model

#### FIFO Redemption Processing

```
    Queue = [(amount₁, user₁, timestamp₁), (amount₂, user₂, timestamp₂), ...]

    process_redemption(queue_position):
        if available_liquidity >= queue[position].amount:
            execute_redemption(queue[position])
            return SUCCESS
        else:
            return QUEUED

    Priority function:
    priority(request) = base_priority + time_bonus(age) + size_penalty(amount)

    where:
      time_bonus(age) = min(age / 86400, 10)  // +1 per day, max +10
      size_penalty(amount) = -log₂(amount / median_request)
```

#### Redemption Rate Limiting

```
    max_redemption_per_epoch = min(
        EPOCH_CAP,
        available_liquidity × 0.9,  // 90% of liquid reserves
        total_supply × 0.15          // 15% of supply per epoch
    )
```

### Economic Stability Model

#### Bank Run Resistance

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  BANK RUN SIMULATION MODEL                                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   redemption_rate(t) = base_rate × (1 + panic_factor(t))                    ║
║                                                                              ║
║   panic_factor(t) = α × (1 - CR(t)/100) + β × social_sentiment(t)           ║
║                                                                              ║
║   System survives if:                                                        ║
║   ∫₀ᵀ redemption_rate(t) dt ≤ Total_Reserves                                ║
║                                                                              ║
║   where T = stress test duration                                             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────┐
    │  BANK RUN STRESS TEST VISUALIZATION                                  │
    │                                                                      │
    │  Reserves │ ████████████████████████████████████████████ 100%       │
    │    (%)    │ ████████████████████████████████████████                │
    │           │ ████████████████████████████████████                    │
    │    75%    │ ████████████████████████████████          ← T₂ depleted │
    │           │ ████████████████████████████                            │
    │    50%    │ ████████████████████████                                │
    │           │ ████████████████████              ← T₁ depleted         │
    │    25%    │ ████████████████                                        │
    │           │ ████████████████                                        │
    │    10%    │ ██████████████                    ← EMERGENCY THRESHOLD │
    │           │ ████████──────────────────────────────────────────────  │
    │     0%    └─────────────────────────────────────────────► time      │
    │           0     12hr    24hr    48hr    72hr    96hr    120hr       │
    │                                                                      │
    │  Legend: ████ = Reserves remaining                                   │
    │          ──── = Protocol survives (reserves > 0)                     │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Governance Timelock Mathematics

#### Delay Calculation

```
    execution_time = proposal_time + voting_period + timelock_delay

    ┌───────────────────────────────────────────────────────────────┐
    │  Parameter Changes:                                           │
    │    timelock_delay = 48 hours (standard)                       │
    │    timelock_delay = 72 hours (critical parameters)            │
    │                                                               │
    │  Emergency Actions:                                           │
    │    timelock_delay = 0 (Guardian multisig, pause only)         │
    └───────────────────────────────────────────────────────────────┘
```

#### Voting Power Calculation

```
    voting_power(address, block) = token_balance(address, block)
                                  + delegated_votes(address, block)

    Quorum requirement:
    total_votes_cast ≥ QUORUM_PERCENTAGE × total_supply

    Pass requirement:
    votes_for > votes_against
    AND total_votes_cast ≥ quorum
```

### Backtest Scoring Function

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ECONOMIC SECURITY SCORE CALCULATION                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   score = 100                                                                ║
║         - 20 × invariant_violations                                          ║
║         - 10 × backing_ratio_breaches                                        ║
║         -  5 × oracle_failure_hours                                          ║
║         - 15 × redemption_halts                                              ║
║         -  2 × warning_events                                                ║
║                                                                              ║
║   Pass criteria: score ≥ 80 AND invariant_violations == 0                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────┐
    │  SCENARIO PERFORMANCE CHART                                          │
    │                                                                      │
    │  Score │                                                             │
    │   100  │ ●────────────────────────── BASELINE (98)                  │
    │        │                                                             │
    │    90  │     ●───────────────────── ORACLE_STRESS (92)              │
    │        │                                                             │
    │    80  │ ════════════════════════════════════════ PASS THRESHOLD    │
    │        │          ●─────────────── MARKET_CRASH (85)                │
    │    70  │               ●────────── BANK_RUN (78)                    │
    │        │                                                             │
    │    60  │                                                             │
    │        │                    ●──── COMBINED_STRESS (65)              │
    │    50  │                                                             │
    │        │                                                             │
    │    40  │                                                             │
    │        │                                                             │
    │     0  └─────────────────────────────────────────────────────────── │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Gas Optimization Model

```
    mint_gas_cost = BASE_GAS
                  + oracle_query_gas
                  + state_update_gas
                  + event_emission_gas

    Estimated costs:
    ┌─────────────────────────────────────────────────┐
    │  Operation              │  Gas Units            │
    ├─────────────────────────┼───────────────────────┤
    │  Base mint              │  ~65,000              │
    │  Oracle query           │  ~15,000              │
    │  State update           │  ~25,000              │
    │  Event emission         │  ~3,000               │
    │  Total                  │  ~108,000             │
    └─────────────────────────┴───────────────────────┘
```

---

## Architecture

### System Overview

```
                                    SECUREMINT ENGINE ARCHITECTURE
    ================================================================================

                                   +------------------+
                                   |   FRONTEND       |
                                   |   Dashboard      |
                                   |   (React/Next)   |
                                   +--------+---------+
                                            |
                                            | HTTPS/WSS
                                            v
    +-------------------+          +------------------+          +-------------------+
    |                   |          |                  |          |                   |
    |   EXTERNAL        |  REST/   |   API GATEWAY    |  Events  |   THE GRAPH       |
    |   INTEGRATIONS    +--------->+   (Express)      +--------->+   SUBGRAPH        |
    |                   |  GraphQL |                  |          |                   |
    +-------------------+          +--------+---------+          +-------------------+
                                            |
                                            | ethers.js / JSON-RPC
                                            v
    ================================================================================
                               BLOCKCHAIN LAYER (EVM)
    ================================================================================

         +-------------+     +------------------+     +-----------------+
         |             |     |                  |     |                 |
         | BackedToken +---->+ SecureMintPolicy +---->+ BackingOracle   |
         | (ERC-20)    |     | (Authorization)  |     | (PoR Feed)      |
         |             |     |                  |     |                 |
         +------+------+     +--------+---------+     +--------+--------+
                |                     |                        |
                |                     v                        |
                |            +------------------+              |
                |            |                  |              |
                +----------->+ TreasuryVault    +<-------------+
                             | (Reserve Mgmt)   |
                             |                  |
                             +--------+---------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             | RedemptionEngine |
                             | (Burn & Redeem)  |
                             |                  |
                             +------------------+

    ================================================================================
                              GOVERNANCE & SAFETY
    ================================================================================

         +-------------+     +------------------+     +-----------------+
         |             |     |                  |     |                 |
         |  Governor   +---->+    Timelock      +---->+ EmergencyPause  |
         | (Voting)    |     | (Delay Actions)  |     | (Circuit Break) |
         |             |     |                  |     |                 |
         +-------------+     +------------------+     +-----------------+
```

### Request Flow Diagram

```
    USER REQUEST                API GATEWAY                    BLOCKCHAIN
    ============               =============                  ============

         +                          +                              +
         |   1. Mint Request        |                              |
         +------------------------->+                              |
         |                          |                              |
         |                          |  2. Validate JWT/Signature   |
         |                          +--+                           |
         |                          |  | Auth Middleware           |
         |                          +<-+                           |
         |                          |                              |
         |                          |  3. Check Rate Limits        |
         |                          +--+                           |
         |                          |  | Redis Cache               |
         |                          +<-+                           |
         |                          |                              |
         |                          |  4. Query Oracle State       |
         |                          +----------------------------->+
         |                          |                              |
         |                          |  5. Oracle Response          |
         |                          +<-----------------------------+
         |                          |                              |
         |                          |  6. Verify Backing Ratio     |
         |                          +--+                           |
         |                          |  | INV-SM-1 Check            |
         |                          +<-+                           |
         |                          |                              |
         |                          |  7. Submit Mint TX           |
         |                          +----------------------------->+
         |                          |                              |
         |                          |  8. TX Confirmation          |
         |   9. Success Response    +<-----------------------------+
         +<-------------------------+                              |
         |                          |                              |
         +                          +                              +
```

### Security Layers

```
    ================================================================================
                           DEFENSE-IN-DEPTH SECURITY MODEL
    ================================================================================

    LAYER 1: NETWORK PERIMETER
    +--------------------------------------------------------------------------+
    |  WAF  |  DDoS Protection  |  TLS 1.3  |  IP Allowlisting  |  Rate Limit  |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    LAYER 2: APPLICATION SECURITY
    +--------------------------------------------------------------------------+
    |  JWT Auth  |  Nonce Protection  |  RBAC  |  Input Validation  |  CORS    |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    LAYER 3: API SECURITY
    +--------------------------------------------------------------------------+
    |  Zod Schema  |  GraphQL Depth Limit  |  Query Complexity  |  Sanitization|
    +--------------------------------------------------------------------------+
                                      |
                                      v
    LAYER 4: BLOCKCHAIN SECURITY
    +--------------------------------------------------------------------------+
    |  Oracle Gating  |  Reentrancy Guard  |  Access Control  |  Pausable     |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    LAYER 5: OPERATIONAL SECURITY
    +--------------------------------------------------------------------------+
    |  Multi-Sig  |  Timelock  |  Emergency Pause  |  Audit Trail  |  Alerting |
    +--------------------------------------------------------------------------+
```

---

## Core Invariants

The SecureMint Engine enforces four critical invariants:

| ID | Invariant | Description | Enforcement |
|----|-----------|-------------|-------------|
| **INV-SM-1** | `totalSupply <= backingValue` | Tokens minted never exceed total backing | On-chain + Oracle |
| **INV-SM-2** | Fresh Oracle Attestation | Each mint requires oracle data < 1 hour old | Staleness check |
| **INV-SM-3** | Auto-Pause on Under-backing | Minting pauses if backing ratio < 100% | Circuit breaker |
| **INV-SM-4** | Event Emission | All mints emit verifiable on-chain events | Immutable logs |

```
    INVARIANT ENFORCEMENT FLOW
    ==========================

    Mint Request
         |
         v
    +----+----+
    | Check   |    INV-SM-2: Oracle freshness
    | Oracle  +--> Staleness > 1hr? --> REJECT
    | Age     |
    +----+----+
         |
         v
    +----+----+
    | Check   |    INV-SM-1: Backing sufficiency
    | Backing +--> supply + amount > backing? --> REJECT
    | Ratio   |
    +----+----+
         |
         v
    +----+----+
    | Check   |    INV-SM-3: System health
    | Paused  +--> isPaused? --> REJECT
    | State   |
    +----+----+
         |
         v
    +----+----+
    | Execute |    INV-SM-4: Emit event
    | Mint &  +--> MintExecuted(recipient, amount, backing)
    | Log     |
    +---------+
```

---

## Security Audit

### Audit Status

This codebase has undergone comprehensive security review with the following findings addressed:

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| SEC-001 | Hardcoded API keys | Critical | FIXED |
| SEC-002 | Weak JWT secret | High | FIXED |
| SEC-003 | No nonce protection (replay attacks) | High | FIXED |
| SEC-004 | Missing signed transaction verification | High | FIXED |
| SEC-007 | GraphQL introspection in production | Medium | FIXED |
| SEC-008 | Per-user rate limiting | Medium | FIXED |
| SEC-009 | Redis TLS configuration | Medium | FIXED |
| SEC-010 | Zod schema validation | Medium | FIXED |

### Security Checklists

- [Stack A Checklist](security_audit/CHECKLIST_STACK_A.md) - Next.js + Node + Postgres + WalletConnect
- [Stack C Checklist](security_audit/CHECKLIST_STACK_C.md) - EVM Solidity (Hardhat/Foundry)
- [Remediation Plan](security_audit/REMEDIATION_PLAN.md) - Full audit remediation details

### Regression Tests

Security regression tests ensure vulnerabilities cannot be reintroduced:

```bash
# Run all security regression tests
npm test -- --testPathPattern="REGRESSION_TESTS"

# Individual test suites
npm test -- auth.test.ts        # SEC-001, SEC-002, SEC-003
npm test -- rate-limit.test.ts  # SEC-008
npm test -- input.test.ts       # SEC-010
```

---

## Project Structure

```
secure-mint-engine/
├── assets/
│   ├── contracts/              # Solidity smart contracts
│   │   ├── src/
│   │   │   ├── BackedToken.sol
│   │   │   ├── SecureMintPolicy.sol
│   │   │   ├── BackingOraclePoR.sol
│   │   │   ├── TreasuryVault.sol
│   │   │   ├── RedemptionEngine.sol
│   │   │   ├── EmergencyPause.sol
│   │   │   ├── Governor.sol
│   │   │   └── Timelock.sol
│   │   └── test/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── security/
│   │
│   ├── api-gateway/            # REST/GraphQL API server
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/
│   │       │   └── mint.ts
│   │       └── middleware/
│   │           ├── auth.ts     # JWT + Signature auth
│   │           └── cache.ts    # Rate limiting
│   │
│   ├── sdk/                    # TypeScript SDK
│   │   └── src/
│   │       ├── index.ts
│   │       ├── react/          # React hooks
│   │       └── compliance/     # Compliance checks
│   │
│   ├── subgraph/               # The Graph indexer
│   ├── dashboard/              # Admin monitoring UI
│   ├── scripts/
│   │   └── backtest/           # Backtest engine
│   │       ├── backtest-engine.ts
│   │       └── index.ts
│   ├── config/                 # Configuration files
│   └── examples/
│       ├── dapp/               # Example DApp
│       └── cli/                # CLI examples
│
├── security_audit/             # Security documentation
│   ├── CI_SECURITY.yml         # Security CI pipeline
│   ├── CHECKLIST_STACK_A.md    # Web stack checklist
│   ├── CHECKLIST_STACK_C.md    # Solidity checklist
│   ├── REMEDIATION_PLAN.md     # Audit remediation
│   └── REGRESSION_TESTS/       # Security tests
│       ├── auth.test.ts
│       ├── rate-limit.test.ts
│       └── input.test.ts
│
├── docs/                       # Documentation
│   └── guides/
├── docker/                     # Docker configs
├── tests/                      # Integration tests
├── LICENSE                     # MIT License
└── README.md                   # This file
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **npm** or **yarn**
- **Foundry** (for Solidity testing) - [install](https://book.getfoundry.sh/getting-started/installation)
- **Redis** (for rate limiting) - [install](https://redis.io/docs/getting-started/)
- **PostgreSQL** (optional, for API persistence)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/rikitrader/secure-mint-engine.git
cd secure-mint-engine

# 2. Install contract dependencies
cd assets/contracts
npm install
forge install

# 3. Install API gateway dependencies
cd ../api-gateway
npm install

# 4. Install SDK dependencies
cd ../sdk
npm install

# 5. Return to root
cd ../..
```

### Environment Configuration

```bash
# Copy example environment files
cp assets/config/.env.example assets/config/.env

# Edit configuration
nano assets/config/.env
```

**Required Environment Variables:**

```env
# JWT Configuration (REQUIRED - must be 32+ characters)
JWT_SECRET=your-secure-random-secret-minimum-32-characters

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Blockchain Configuration
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
CHAIN_ID=1

# Contract Addresses (after deployment)
TOKEN_ADDRESS=0x...
POLICY_ADDRESS=0x...
ORACLE_ADDRESS=0x...
TREASURY_ADDRESS=0x...
```

### Compile and Test

```bash
# Compile smart contracts
cd assets/contracts
npx hardhat compile
forge build

# Run tests
npx hardhat test
forge test

# Run with coverage
npx hardhat coverage
forge coverage
```

### Start Development Server

```bash
# Start Redis (if not running)
redis-server

# Start API Gateway
cd assets/api-gateway
npm run dev

# Server runs on http://localhost:3000
```

---

## Smart Contracts

### Contract Overview

| Contract | Purpose | Upgradeability |
|----------|---------|----------------|
| `BackedToken.sol` | ERC-20 token with oracle-gated mint | UUPS |
| `SecureMintPolicy.sol` | Mint authorization and invariant enforcement | UUPS |
| `BackingOraclePoR.sol` | Oracle aggregation and Proof-of-Reserve | UUPS |
| `TreasuryVault.sol` | Reserve management and asset custody | UUPS |
| `RedemptionEngine.sol` | Token redemption for backing assets | UUPS |
| `EmergencyPause.sol` | Circuit breaker and emergency controls | Immutable |
| `Governor.sol` | On-chain governance | Immutable |
| `Timelock.sol` | Time-delayed execution | Immutable |

### Deployment

```bash
# Deploy to local network
cd assets/contracts
npx hardhat node
npx hardhat deploy --network localhost

# Deploy to testnet
npx hardhat deploy --network sepolia

# Deploy to mainnet
npx hardhat deploy --network mainnet

# Verify contracts
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>
```

### Foundry Commands

```bash
# Build
forge build

# Test
forge test -vvv

# Test with gas report
forge test --gas-report

# Fuzz testing
forge test --fuzz-runs 10000

# Invariant testing
forge test --match-contract "Invariant"

# Coverage
forge coverage

# Security analysis with Slither
slither .
```

---

## API Gateway

### Endpoints

#### Authentication

```
POST /api/auth/nonce          - Request authentication nonce
POST /api/auth/verify         - Verify signature and get JWT
POST /api/auth/refresh        - Refresh JWT token
```

#### Minting

```
GET  /api/mint/capacity       - Get available mint capacity
POST /api/mint/simulate       - Simulate mint transaction
POST /api/mint/execute        - Execute mint (requires signature)
GET  /api/mint/history        - Get mint history
```

#### Oracle

```
GET  /api/oracle/backing      - Get current backing ratio
GET  /api/oracle/price        - Get oracle price feed
GET  /api/oracle/health       - Check oracle health
```

#### Treasury

```
GET  /api/treasury/balance    - Get treasury balance
GET  /api/treasury/reserves   - Get reserve breakdown
```

### Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Anonymous (IP) | 20 req | 1 min |
| Authenticated (IP) | 100 req | 1 min |
| Per-User | 100 req | 1 min |
| Per-Wallet (mint ops) | 50 req | 1 min |

---

## SDK Usage

### Installation

```bash
npm install @securemint/sdk
```

### Basic Usage

```typescript
import { SecureMintSDK } from '@securemint/sdk';

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

// Check mint eligibility
const canMint = await sdk.policy.canMint(amount);
console.log('Can mint:', canMint);

// Get backing ratio
const ratio = await sdk.oracle.getBackingRatio();
console.log('Backing ratio:', ratio);

// Execute mint (with signature)
const tx = await sdk.token.mint(recipient, amount);
await tx.wait();
```

### React Hooks

```typescript
import { useSecureMint, useMintCapacity, useBackingRatio } from '@securemint/sdk/react';

function MintComponent() {
  const { mint, isLoading, error } = useSecureMint();
  const { capacity } = useMintCapacity();
  const { ratio } = useBackingRatio();

  return (
    <div>
      <p>Backing Ratio: {ratio}%</p>
      <p>Available Capacity: {capacity}</p>
      <button onClick={() => mint(amount)} disabled={isLoading}>
        Mint Tokens
      </button>
    </div>
  );
}
```

---

## Backtest Engine

The Backtest Engine simulates protocol behavior under various market conditions to validate economic security.

### Running Backtests

```bash
cd assets

# Run baseline scenario (full year)
npx ts-node scripts/backtest/backtest-engine.ts 2024-01-01 2024-12-31

# Run specific scenarios
npx ts-node -e "import('./scripts/backtest').then(m => m.runBacktest('BANK_RUN'))"
npx ts-node -e "import('./scripts/backtest').then(m => m.runBacktest('ORACLE_STRESS'))"
npx ts-node -e "import('./scripts/backtest').then(m => m.runBacktest('MARKET_CRASH'))"

# Run all scenarios (CI integration)
npx ts-node -e "import('./scripts/backtest').then(m => m.runAllScenarios())"
```

### Available Scenarios

| Scenario | Description | Duration |
|----------|-------------|----------|
| `BASELINE` | Normal market conditions | 1 year |
| `BANK_RUN` | 15% hourly redemption rate | 3 months |
| `ORACLE_STRESS` | 1% oracle failure probability | 6 months |
| `MARKET_CRASH` | 30% price crash event | 6 months |
| `COMBINED_STRESS` | All stress factors combined | 1 year |

### Backtest Metrics

```
    BACKTEST OUTPUT METRICS
    =======================

    Economic Security Score: 0-100
    +------------------------+
    |  Invariant Violations  |  -20 points each
    |  Backing Ratio < 100%  |  -10 points per occurrence
    |  Oracle Failures       |  -5 points per hour
    |  Redemption Halts      |  -15 points each
    +------------------------+

    Pass Criteria:
    - Score >= 80
    - Zero invariant violations
```

---

## Testing

### Unit Tests

```bash
# Smart contracts (Hardhat)
cd assets/contracts
npx hardhat test

# Smart contracts (Foundry)
forge test

# API Gateway
cd assets/api-gateway
npm test

# SDK
cd assets/sdk
npm test
```

### Security Tests

```bash
# Run all security tests
npm test -- --testPathPattern="security"

# Run regression tests
npm test -- --testPathPattern="REGRESSION_TESTS"

# Run with coverage
npm test -- --coverage
```

### Fuzz Testing

```bash
# Foundry fuzz tests
cd assets/contracts
forge test --fuzz-runs 10000 --match-contract "Fuzz"

# Echidna (if configured)
echidna test/fuzzing/EchidnaSecureMint.sol --contract EchidnaSecureMint
```

### Invariant Testing

```bash
# Foundry invariant tests
forge test --match-contract "Invariant" --fuzz-runs 1000 -vvv
```

---

## Deployment

### Deployment Checklist

```
    PRE-DEPLOYMENT CHECKLIST
    ========================

    [ ] All tests passing
    [ ] Security audit complete
    [ ] Slither analysis clean
    [ ] Coverage > 80%
    [ ] Backtest scenarios passing
    [ ] Environment variables configured
    [ ] Multi-sig wallets ready
    [ ] Oracle feeds configured
    [ ] Emergency contacts ready

    DEPLOYMENT SEQUENCE
    ===================

    1. Deploy Timelock
    2. Deploy Governor
    3. Deploy EmergencyPause
    4. Deploy BackingOraclePoR
    5. Deploy TreasuryVault
    6. Deploy SecureMintPolicy
    7. Deploy BackedToken
    8. Deploy RedemptionEngine
    9. Configure permissions
    10. Transfer ownership to Timelock
```

### CI/CD Pipeline

The security CI pipeline in `security_audit/CI_SECURITY.yml` runs:

1. **Dependency Audit** - npm audit + Snyk
2. **Secrets Scan** - TruffleHog + pattern matching
3. **Slither Analysis** - Static analysis for Solidity
4. **Foundry Tests** - Unit, fuzz, and invariant tests
5. **API Security Tests** - Authentication and authorization
6. **ESLint Security** - Security rules for TypeScript
7. **Backtest Engine** - Economic simulation
8. **Regression Tests** - Security vulnerability prevention

**All checks must pass before merge to main.**

---

## License & Third-Party Disclosures

### Project License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 SecureMint Engine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Third-Party Dependencies & Licenses

#### Smart Contracts

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| [@openzeppelin/contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) | ^5.0.0 | MIT | Secure smart contract library |
| [@openzeppelin/contracts-upgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable) | ^5.0.0 | MIT | Upgradeable contracts |
| [@chainlink/contracts](https://github.com/smartcontractkit/chainlink) | ^0.8.0 | MIT | Oracle integration |
| [hardhat](https://github.com/NomicFoundation/hardhat) | ^2.19.0 | MIT | Ethereum development environment |
| [foundry](https://github.com/foundry-rs/foundry) | latest | MIT/Apache-2.0 | Smart contract toolkit |

#### API Gateway

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| [express](https://github.com/expressjs/express) | ^4.18.0 | MIT | Web framework |
| [ethers](https://github.com/ethers-io/ethers.js) | ^6.9.0 | MIT | Ethereum library |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | ^9.0.0 | MIT | JWT authentication |
| [ioredis](https://github.com/redis/ioredis) | ^5.3.0 | MIT | Redis client |
| [zod](https://github.com/colinhacks/zod) | ^3.22.0 | MIT | Schema validation |
| [graphql](https://github.com/graphql/graphql-js) | ^16.8.0 | MIT | GraphQL implementation |
| [@apollo/server](https://github.com/apollographql/apollo-server) | ^4.9.0 | MIT | GraphQL server |
| [helmet](https://github.com/helmetjs/helmet) | ^7.1.0 | MIT | Security headers |
| [@prisma/client](https://github.com/prisma/prisma) | ^5.6.0 | Apache-2.0 | Database ORM |

#### SDK

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| [ethers](https://github.com/ethers-io/ethers.js) | ^6.9.0 | MIT | Ethereum library |
| [axios](https://github.com/axios/axios) | ^1.6.0 | MIT | HTTP client |
| [ws](https://github.com/websockets/ws) | ^8.14.0 | MIT | WebSocket client |
| [eventemitter3](https://github.com/primus/eventemitter3) | ^5.0.0 | MIT | Event emitter |

#### Development Tools

| Package | Version | License | Description |
|---------|---------|---------|-------------|
| [typescript](https://github.com/microsoft/TypeScript) | ^5.3.0 | Apache-2.0 | TypeScript compiler |
| [jest](https://github.com/facebook/jest) | ^29.7.0 | MIT | Testing framework |
| [eslint](https://github.com/eslint/eslint) | ^8.50.0 | MIT | Linting |
| [prettier](https://github.com/prettier/prettier) | ^3.1.0 | MIT | Code formatting |
| [supertest](https://github.com/ladjs/supertest) | ^6.3.0 | MIT | HTTP testing |

### License Compliance Notes

1. **MIT License** - Most dependencies are MIT licensed, allowing free use, modification, and distribution with attribution.

2. **Apache-2.0 License** - TypeScript and Prisma use Apache-2.0, which requires preservation of copyright notices and includes patent grant provisions.

3. **OpenZeppelin Contracts** - Used under MIT license. Security-audited implementations of ERC standards.

4. **Chainlink Contracts** - Used under MIT license for oracle integration.

### Notice for Redistributors

When redistributing this software, you must:

1. Include the original MIT license file
2. Include copyright notices for all third-party dependencies
3. Preserve attribution in source files
4. Not use project names or logos to endorse derived products

---

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- All code must pass security CI checks
- Minimum 80% test coverage
- Slither analysis must be clean
- Follow existing code style (enforced by ESLint/Prettier)

---

## Contact

**Repository:** [github.com/rikitrader/secure-mint-engine](https://github.com/rikitrader/secure-mint-engine)

**Author:** Ricardo Prieto

For security vulnerabilities, please report responsibly via GitHub Security Advisories.

---

<div align="center">

```
    Built with security-first principles for the decentralized future.

    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║   "No backing proof = No minting"                             ║
    ║                                                               ║
    ║   SecureMint Engine - Enterprise Oracle-Gated Minting         ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
```

**Copyright (c) 2024 SecureMint Engine - MIT License**

</div>
