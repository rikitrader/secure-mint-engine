# Master Protocol Engine Deep Report Template

## Purpose

This template generates EXTENSIVE TECHNICAL REPORTS in .MD format at institutional audit depth for any protocol engine or workflow.

## Role Assignment

When generating a deep report, assume the role of:
- Senior Protocol Architect
- Quantitative Risk Modeler
- Smart Contract Security Engineer
- Financial Systems Auditor
- On-Chain Risk Controller

## System Context

The system analyzed is a production-grade stablecoin + DeFi protocol with:
- Oracle-gated minting
- Multi-tier reserves
- Risk scoring
- Governance-controlled parameters

---

## Report Generation Prompt

Use this prompt to generate deep reports for any engine:

```
ENGINE TO ANALYZE: {{ENGINE_NAME}}

Generate an institutional-grade technical report following the structure below.
```

---

## Mandatory Report Structure

### 1. Executive Summary

**Content Requirements:**
- Purpose of the engine
- Systemic risk it mitigates
- Key value proposition
- Critical dependencies

**Length:** 200-400 words

---

### 2. System Architecture

**Required Elements:**

#### 2.1 Actors
| Actor | Role | Trust Level |
|-------|------|-------------|
| User | Token holder / minter | Untrusted |
| Guardian | Emergency response | Semi-trusted |
| Oracle | Price/reserve data | Trusted |
| Governance | Parameter control | Trusted |

#### 2.2 Smart Contracts
| Contract | Function | Upgradeable |
|----------|----------|-------------|
| BackedToken | ERC-20 ledger | No |
| SecureMintPolicy | Mint gate | Timelocked |

#### 2.3 Off-Chain Components
- Oracle nodes
- Monitoring systems
- Alert infrastructure
- Custodian APIs

#### 2.4 Trust Boundaries
```
[Untrusted Zone]        [Trust Boundary]        [Trusted Zone]
User requests    →    Smart Contract Logic    →    Oracle Data
```

---

### 3. Control Flow Logic

**Required Diagram Format:**

```
START
  │
  ▼
┌─────────────────┐
│ Step 1: Input   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: Check   │──── FAIL ──→ Revert
└────────┬────────┘
         │ PASS
         ▼
┌─────────────────┐
│ Step 3: Execute │
└────────┬────────┘
         │
         ▼
       END
```

**State Transition Table:**

| Current State | Trigger | Next State | Conditions |
|---------------|---------|------------|------------|
| NORMAL | risk > 65 | ELEVATED | - |
| ELEVATED | risk > 85 | PAUSED | Guardian alert |
| PAUSED | fix + vote | NORMAL | DAO approval |

---

### 4. Mathematical Modeling

**Required Formula Documentation:**

#### Formula 4.1: [Formula Name]
```
[Formula Expression]
```

**Variables:**
| Symbol | Description | Unit | Range |
|--------|-------------|------|-------|
| x | Variable description | unit | [min, max] |

**Example Calculation:**
```
Given: [inputs]
Calculate: [steps]
Result: [output]
```

**Safe vs Unsafe Ranges:**
| Range | Classification | Action |
|-------|----------------|--------|
| [0, 0.5] | Safe | Normal operations |
| (0.5, 0.8] | Elevated | Increase monitoring |
| (0.8, 1.0] | Critical | Trigger pause |

---

### 5. Graph & Dashboard Visualization Requirements

**Required Graph Specifications:**

#### Graph 5.1: [Graph Name]

| Attribute | Value |
|-----------|-------|
| **X-axis** | Time (UTC) |
| **Y-axis** | Metric value (units) |
| **Data Source** | On-chain / Oracle / API |
| **Update Frequency** | Per-block / Hourly / Daily |
| **Normal Trend** | Description of healthy pattern |
| **Dangerous Trend** | Description of concerning pattern |

**Visual Example:**
```
Y-axis (metric)
    │
100%├────────────────────────── DANGER ZONE
    │         ╱╲
 80%├────────╱──╲───────────── WARNING ZONE
    │       ╱    ╲
 60%├──────╱──────╲─────────── ELEVATED
    │     ╱        ╲
 40%├────╱──────────╲────────── NORMAL
    │   ╱            ╲
 20%├──────────────────────────
    │
    └────┼────┼────┼────┼────→ X-axis (time)
        T1   T2   T3   T4
```

**Standard Graphs to Include:**

1. **Peg Deviation Over Time**
   - X: Time (hourly)
   - Y: Deviation % from $1.00
   - Warning: > 1%
   - Critical: > 5%

2. **Risk Score Trend**
   - X: Time (hourly)
   - Y: Composite risk score (0-100)
   - Warning: > 50
   - Critical: > 75

3. **Reserve Ratio vs Supply**
   - X: Total supply (tokens)
   - Y: Reserve ratio (%)
   - Warning: < 105%
   - Critical: < 100%

4. **Liquidity Depth Curve**
   - X: Trade size ($)
   - Y: Slippage (%)
   - Warning: > 1% for $1M
   - Critical: > 5% for $1M

5. **Bridge Locked vs Minted**
   - X: Time (daily)
   - Y: Amount (tokens)
   - Two lines: Locked, Minted
   - Critical: Minted > Locked

6. **Treasury Allocation %**
   - X: Tier (T0/T1/T2/T3)
   - Y: Percentage of total
   - Show target vs actual

---

### 6. Risk Formula Library

**Formula Catalog:**

#### 6.1 Health Factor
| Attribute | Value |
|-----------|-------|
| **Formula** | `health_factor = total_backing / total_supply` |
| **Variables** | `total_backing`: USD value of reserves<br>`total_supply`: tokens outstanding |
| **Purpose** | Determine if protocol is solvent |
| **Thresholds** | Safe: ≥ 1.05, Warning: 1.00-1.05, Critical: < 1.00 |

#### 6.2 Risk Score
| Attribute | Value |
|-----------|-------|
| **Formula** | `risk_score = Σ(metric_i × weight_i)` |
| **Variables** | `metric_i`: normalized score (0-100)<br>`weight_i`: category weight (sum to 1.0) |
| **Purpose** | Composite risk assessment |
| **Thresholds** | Low: 0-30, Medium: 31-65, High: 66-100 |

#### 6.3 Collateralization Ratio
| Attribute | Value |
|-----------|-------|
| **Formula** | `CR = (collateral_value / debt_value) × 100%` |
| **Variables** | `collateral_value`: USD value of locked collateral<br>`debt_value`: USD value of minted tokens |
| **Purpose** | Measure overcollateralization |
| **Thresholds** | Safe: ≥ 150%, Warning: 100-150%, Critical: < 100% |

#### 6.4 Peg Deviation
| Attribute | Value |
|-----------|-------|
| **Formula** | `deviation = |market_price - target_price| / target_price` |
| **Variables** | `market_price`: DEX/oracle price<br>`target_price`: $1.00 |
| **Purpose** | Measure peg stability |
| **Thresholds** | Normal: < 1%, Warning: 1-2%, Critical: > 5% |

#### 6.5 Utilization Rate
| Attribute | Value |
|-----------|-------|
| **Formula** | `utilization = borrowed / total_liquidity` |
| **Variables** | `borrowed`: amount currently lent out<br>`total_liquidity`: total pool size |
| **Purpose** | Measure capacity usage |
| **Thresholds** | Optimal: 50-80%, High: 80-95%, Critical: > 95% |

#### 6.6 Arbitrage Profit
| Attribute | Value |
|-----------|-------|
| **Formula** | `profit = (redemption_value - market_price - fees) × amount` |
| **Variables** | `redemption_value`: $1.00<br>`market_price`: current price<br>`fees`: protocol fees |
| **Purpose** | Incentive for peg restoration |
| **Thresholds** | N/A (market-driven) |

---

### 7. Alert & Monitoring Thresholds

**Threshold Matrix:**

| Metric | Warning Level | Critical Level | Action |
|--------|---------------|----------------|--------|
| Peg Deviation | 1% | 3% | Tighten mint caps |
| Risk Score | 50 | 75 | Pause minting |
| Reserve Ratio | 105% | 100% | Block mint, allow burn |
| Oracle Staleness | 30 min | 60 min | Pause operations |
| Oracle Deviation | 3% | 5% | Emergency pause |
| TVL Change (24h) | -20% | -40% | Guardian alert |
| Mint Volume Spike | 2x avg | 5x avg | Rate limit |
| Single Wallet % | 5% supply | 10% supply | Enhanced monitoring |

**Alert Escalation Path:**

```
AUTOMATED ALERT
      │
      ▼
┌──────────────┐
│ Level 1:     │
│ Log + Metric │
└──────┬───────┘
       │ threshold exceeded
       ▼
┌──────────────┐
│ Level 2:     │
│ Team Alert   │
└──────┬───────┘
       │ sustained > 15min
       ▼
┌──────────────┐
│ Level 3:     │
│ Guardian     │
│ Notification │
└──────┬───────┘
       │ critical threshold
       ▼
┌──────────────┐
│ Level 4:     │
│ Auto-Pause   │
└──────────────┘
```

---

### 8. Failure Modes & Attack Vectors

**Technical Attack Vectors:**

| Attack | Vector | Impact | Likelihood | Mitigation |
|--------|--------|--------|------------|------------|
| Oracle Manipulation | Flash loan | Unbacked mint | Medium | TWAP, multi-source |
| Smart Contract Bug | Code flaw | Fund loss | Low | Audits, formal verification |
| Key Compromise | Social engineering | Unauthorized actions | Low | Multisig, timelocks |
| Governance Attack | Vote buying | Parameter manipulation | Low | Timelock, veto |

**Economic Attack Vectors:**

| Attack | Vector | Impact | Likelihood | Mitigation |
|--------|--------|--------|------------|------------|
| Bank Run | Panic | Liquidity crisis | Medium | Reserve tiers, rate limits |
| Peg Attack | Short selling | Depeg spiral | Medium | Deep liquidity, arbitrage |
| Whale Manipulation | Large positions | Price impact | Medium | Position limits |

---

### 9. Defensive Mechanisms

**Defense Matrix:**

| Defense | Purpose | Trigger | Response Time |
|---------|---------|---------|---------------|
| Circuit Breaker | Stop operations | Risk threshold | Immediate |
| Rate Limits | Prevent spikes | Volume threshold | Per-tx |
| Oracle Redundancy | Data reliability | Source disagreement | Automatic |
| Emergency Pause | Full stop | Guardian action | < 1 min |
| Multisig Override | Human judgment | 2-of-5 signature | < 15 min |
| Timelock | Delay changes | All gov actions | 24-72 hrs |

---

### 10. Engine Interdependencies

**Dependency Map:**

```
                    ┌─────────────┐
                    │  TREASURY   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │   PEG    │ │   RISK   │ │ EMERGENCY│
       │CONTROLLER│ │  ENGINE  │ │  SWITCH  │
       └────┬─────┘ └────┬─────┘ └────┬─────┘
            │            │            │
            └────────────┼────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  GOVERNANCE  │
                  └──────────────┘
```

**Data Flow Between Engines:**

| From | To | Data | Frequency |
|------|----|------|-----------|
| Risk Engine | Peg Controller | Risk score | Per-block |
| Treasury | Risk Engine | Reserve levels | Per-block |
| Emergency | All | Pause signal | On trigger |
| Governance | All | Parameter updates | On execution |

---

### 11. Stress Test Scenarios

**Scenario Template:**

#### Scenario 11.X: [Scenario Name]

**Initial Conditions:**
- Reserve ratio: X%
- Risk score: Y
- Market price: $Z

**Shock Event:**
- Description of external event

**System Response:**
1. Step 1: [automated action]
2. Step 2: [alert triggered]
3. Step 3: [guardian action]

**Outcome:**
- Protocol state after event
- User impact
- Time to recovery

**Standard Scenarios:**

1. **30% Reserve Shortfall**
2. **Oracle 4-Hour Outage**
3. **50% Price Crash (Volatile Collateral)**
4. **Coordinated Bank Run**
5. **Governance Attack Attempt**
6. **Bridge Validator Compromise**

---

### 12. Monitoring Telemetry

**Required Metrics:**

| Metric | Source | Frequency | Retention |
|--------|--------|-----------|-----------|
| Total Supply | On-chain | Per-block | Forever |
| Reserve Balance | PoR Oracle | Hourly | 1 year |
| Mint/Burn Volume | On-chain | Per-block | 1 year |
| Oracle Price | Chainlink | Per-block | 90 days |
| Risk Score | Computed | Per-block | 90 days |
| Treasury Allocation | Off-chain | Daily | 1 year |

---

### 13. Governance Parameters

**Parameter Registry:**

| Parameter | Current | Min | Max | Timelock | Risk if Changed |
|-----------|---------|-----|-----|----------|-----------------|
| Global Mint Cap | 1B | 0 | ∞ | 72hr | Supply inflation |
| Epoch Mint Cap | 10M | 0 | 100M | 48hr | Burst risk |
| Oracle Staleness | 1hr | 5min | 24hr | 48hr | Stale data risk |
| Collateral Factor | 100% | 100% | 200% | 48hr | Under/over collat |
| Pause Authority | Guardian | - | - | 72hr | Centralization |

---

### 14. Red Flag Checklist

**Systemic Failure Indicators:**

| Red Flag | Threshold | Implication |
|----------|-----------|-------------|
| ☐ Reserve ratio < 100% | Imminent | Insolvency |
| ☐ Oracle offline > 4hr | Critical | Blind operations |
| ☐ Peg deviation > 10% | Severe | Loss of confidence |
| ☐ TVL exodus > 50%/24hr | Critical | Bank run in progress |
| ☐ Bridge minted > locked | Fatal | Infinite mint exploit |
| ☐ Governance hijacked | Fatal | Protocol compromise |
| ☐ Multiple guardians compromised | Fatal | No emergency control |

---

## Style Requirements

- Professional technical audit style
- Structured Markdown with clear headers
- Precise language, no ambiguity
- No marketing tone
- Assume institutional review audience
- Include all numerical thresholds
- Show formulas with variable definitions
- Provide visual diagrams where helpful

---

## Engine-Specific Report Templates

When generating reports, select the appropriate engine:

1. **SecureMintEngine** - Oracle-gated minting mechanics
2. **RiskScoringEngine** - Composite risk calculation
3. **PegStabilityEngine** - Price stability mechanisms
4. **TreasuryReserveEngine** - Reserve management
5. **GovernanceEngine** - DAO operations
6. **EmergencyShutdownEngine** - Circuit breaker system
7. **CrossChainBridgeEngine** - Multi-chain operations
8. **LiquidityRoutingEngine** - DeFi yield layer
9. **OracleAggregatorEngine** - Data validation
10. **MasterControlPanel** - Unified system overview

---

## Example Report Header

```markdown
# [ENGINE_NAME] Deep Technical Report

**Report Type:** Institutional Audit Grade
**Version:** 1.0
**Generated:** {{DATE}}
**Protocol:** [PROTOCOL_NAME] Stablecoin System
**Reviewer:** AI Protocol Analyst (SecureMintEngine Skill)

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {{DATE}} | AI | Initial report |

---

[REPORT CONTENT FOLLOWS STRUCTURE ABOVE]
```

---

# ADDITIONAL REPORT TEMPLATES

---

## Protocol Dashboard Auto-Builder Template

**Purpose:** Design full monitoring dashboard specifications for any engine

### Dashboard Report Structure

#### 1. Dashboard Overview
- Purpose of the dashboard
- What operators should detect
- Primary user personas

#### 2. Critical Metrics Table

| Metric Name | Formula | Data Source | Update Frequency | Importance |
|-------------|---------|-------------|------------------|------------|
| Peg Deviation | `\|Oracle-DEX\|/Oracle` | Oracle + DEX | 30s | Critical |
| Reserve Ratio | `reserves/supply` | PoR + On-chain | 1min | Critical |
| Risk Score | `Σ(metric×weight)` | Computed | Per-block | High |
| Mint Rate | `minted_today/cap` | On-chain | Per-block | Medium |
| Oracle Staleness | `now - last_update` | Oracle | Per-block | Critical |

#### 3. Core Graph Specifications

For EACH graph provide:

```
GRAPH TEMPLATE:
─────────────────────────────────────────────────
Graph Title: [Name]
X Axis: [Time / Amount / Category]
Y Axis: [Metric name + units]
Data Feeds: [Sources]
Normal Behavior: [Description of healthy pattern]
Danger Pattern: [Description of concerning pattern]
Operator Action: [What to do when danger detected]
─────────────────────────────────────────────────
```

**Required Graph Types:**
- Time-series graphs (trends over time)
- Ratio graphs (A/B comparisons)
- Heatmaps (multi-dimensional data)
- Threshold overlays (warning/critical lines)

#### 4. System Health Indicators

| Status | Condition | Visual |
|--------|-----------|--------|
| GREEN | All metrics nominal | Solid green dot |
| YELLOW | Warning threshold breached | Pulsing yellow |
| RED | Critical threshold breached | Flashing red |

#### 5. Risk Score Visualization

**Display Requirements:**
- Current score (large number)
- 24hr trend sparkline
- Component breakdown (pie/bar)
- Historical comparison

**Interpretation Guide:**
| Range | Color | Meaning |
|-------|-------|---------|
| 0-30 | Green | Low risk |
| 31-65 | Yellow | Elevated |
| 66-100 | Red | Critical |

#### 6. Treasury Visibility

**Required Components:**
- Tier allocation breakdown (pie chart)
- Liquidity depth by tier (bar chart)
- Utilization rate gauge
- Rebalancing history

#### 7. Alert Widgets

| Widget | Purpose | Trigger |
|--------|---------|---------|
| Peg Alert | Price deviation | > 1% |
| Reserve Alert | Underbacking | < 100% |
| Oracle Alert | Stale data | > 1hr |
| Volume Alert | Unusual activity | > 2x avg |

#### 8. Cross-Engine Links

| Dashboard | Link Trigger | Purpose |
|-----------|--------------|---------|
| Treasury | Click reserve | Drill into tiers |
| Risk | Click score | See components |
| Emergency | Any red alert | Response actions |

---

## Risk Weight Optimization Engine Template

**Purpose:** Design optimized weighting model for risk scoring

### Risk Weight Report Structure

#### 1. Risk Metrics Inventory

| Metric | Source | Range | Update |
|--------|--------|-------|--------|
| Price Volatility | Oracle | 0-100 | Real-time |
| Liquidity Depth | DEX | 0-100 | Per-block |
| Oracle Deviation | Computed | 0-100 | Per-block |
| TVL Exposure | DeFiLlama | 0-100 | Hourly |
| Audit Score | Registry | 0-100 | On change |
| Exploit Alerts | Feeds | 0-100 | Real-time |
| Correlation Risk | Computed | 0-100 | Daily |
| Collateral Ratio | On-chain | 0-100 | Per-block |
| Utilization Rate | On-chain | 0-100 | Per-block |

#### 2. Weighting Methodology

**Approaches:**
- Equal weighting (baseline)
- Variance-based (higher weight to volatile metrics)
- Expert judgment (domain knowledge)
- Historical backtesting (optimized for past crises)

#### 3. Formula Structure

```
Risk Score = Σ(metric_i × weight_i)

Constraints:
- Σ(weight_i) = 1.0
- weight_i >= 0
- weight_i <= 0.25 (no single factor dominance)
```

**Standard Weight Table:**

| Metric | Weight | Rationale |
|--------|--------|-----------|
| Price Volatility | 0.15 | Direct market risk |
| Liquidity Depth | 0.12 | Exit risk |
| Oracle Deviation | 0.15 | Data integrity |
| TVL Exposure | 0.10 | Concentration risk |
| Audit Score | 0.12 | Code security |
| Exploit Alerts | 0.15 | Active threat |
| Correlation Risk | 0.06 | Systemic exposure |
| Collateral Ratio | 0.10 | Solvency margin |
| Utilization Rate | 0.05 | Capacity stress |

#### 4. Sensitivity Analysis

| Metric | +10% Change | Score Impact |
|--------|-------------|--------------|
| Volatility | ↑ | +1.5 points |
| Liquidity | ↓ | +1.2 points |
| Oracle Dev | ↑ | +1.5 points |

#### 5. Stress Case Calibration

| Scenario | Weight Adjustment |
|----------|-------------------|
| Market crash | Volatility × 1.5 |
| Liquidity crisis | Depth × 1.5 |
| Oracle outage | Deviation × 2.0 |

#### 6. Correlation Handling

**Correlated Pairs:**
- Volatility ↔ Liquidity (moderate)
- Exploit ↔ TVL (high during incidents)

**Mitigation:**
- Cap combined weight of correlated metrics
- Use residualized metrics where possible

#### 7. Adaptive Weighting Rules

| Condition | Adaptation |
|-----------|------------|
| Risk > 70 sustained | Increase real-time weights |
| Market calm period | Reduce volatility weight |
| Post-exploit | Increase audit weight |

#### 8. Governance Boundaries

| Weight | Min | Max | Timelock |
|--------|-----|-----|----------|
| Any single | 0.05 | 0.25 | 48hr |
| Total reallocation | - | 0.20 | 72hr |

#### 9. Failure Detection

**Model Invalid When:**
- Correlation matrix unstable
- Single metric dominates (>50% contribution)
- Historical validation fails
- Extreme outliers present

---

## Incident Response Playbook Template

**Purpose:** Step-by-step response guide for protocol incidents

### Playbook Report Structure

#### 1. Incident Types Covered

| Type | Description | Severity Range |
|------|-------------|----------------|
| Oracle Failure | Price feed unavailable/corrupted | 2-4 |
| Smart Contract Exploit | Unauthorized fund movement | 4 |
| Bank Run | Mass redemption event | 3-4 |
| Bridge Failure | Cross-chain message corruption | 3-4 |
| Peg Attack | Coordinated price manipulation | 2-3 |
| Governance Attack | Malicious proposal execution | 4 |
| Key Compromise | Admin key leaked | 4 |

#### 2. Detection Signals

| Signal | Source | Threshold | Incident Type |
|--------|--------|-----------|---------------|
| Oracle staleness | Health check | > 1hr | Oracle Failure |
| TVL drop | On-chain | > 30%/hr | Bank Run |
| Price deviation | TWAP | > 5% | Peg Attack |
| Unusual mint | Monitoring | > 10x avg | Exploit |

#### 3. Severity Levels

| Level | Name | Description | Response Time |
|-------|------|-------------|---------------|
| 1 | Minor | Single metric warning | 1 hour |
| 2 | Elevated | Multiple warnings | 15 minutes |
| 3 | Critical | Active degradation | 5 minutes |
| 4 | Systemic | Protocol at risk | Immediate |

#### 4. Immediate Actions

| Severity | Action | Authority |
|----------|--------|-----------|
| 1 | Log + monitor | Automated |
| 2 | Alert team + prepare | On-call |
| 2 | Tighten rate limits | On-call |
| 3 | Pause minting | Guardian 2/5 |
| 3 | Alert governance | Automated |
| 4 | Full emergency pause | Guardian 3/5 |
| 4 | Freeze treasury | Guardian 4/5 |

#### 5. Smart Contract Actions

| Action | Contract | Function | Authority |
|--------|----------|----------|-----------|
| Pause mint | SecureMintPolicy | pause() | Guardian |
| Pause burn | BackedToken | pauseBurn() | Guardian |
| Freeze transfers | BackedToken | freeze() | Emergency |
| Reduce cap | SecureMintPolicy | setCap() | Timelock |

#### 6. Treasury Actions

| Action | Purpose | Authority |
|--------|---------|-----------|
| Move to T0 | Increase liquidity | Treasury Ops |
| Freeze movements | Protect reserves | Guardian |
| Emergency redemption | Allow user exit | Emergency |

#### 7. Governance Actions

| Action | Quorum | Timelock |
|--------|--------|----------|
| Emergency proposal | 15% | 24hr |
| Parameter override | 10% | 0 (emergency) |
| Resume operations | 50% | 24hr |

#### 8. Communication Plan

| Stage | Audience | Channel | Timing |
|-------|----------|---------|--------|
| 1 | Core team | Slack/Discord | Immediate |
| 2 | Guardians | Direct + on-chain | < 5 min |
| 3 | Community | Twitter/Discord | < 30 min |
| 4 | Exchanges | Direct API/contact | < 1 hr |
| 5 | Partners | Email + call | < 2 hr |

**Message Template:**
```
[SEVERITY] [INCIDENT TYPE] Detected

Status: [Investigating/Contained/Resolved]
Impact: [User impact description]
Actions Taken: [List actions]
Next Update: [Time]

Do NOT:
- Panic sell
- Use affected functions
- Spread unverified info
```

#### 9. Recovery Procedure

| Phase | Actions | Duration |
|-------|---------|----------|
| 1. Contain | Pause affected systems | 0-1hr |
| 2. Assess | Root cause analysis | 1-4hr |
| 3. Fix | Deploy patch or workaround | 4-24hr |
| 4. Verify | Security team sign-off | 24-48hr |
| 5. Resume | Gradual unpause | 48-72hr |
| 6. Monitor | Enhanced surveillance | 30 days |

#### 10. Post-Mortem Framework

**Required Sections:**
1. Incident timeline (minute-by-minute)
2. Root cause analysis
3. Impact assessment (users, funds, reputation)
4. Response evaluation (what worked/didn't)
5. Remediation actions
6. Prevention measures
7. Governance report
8. Public disclosure

**Logging Requirements:**
- All on-chain actions with tx hashes
- All off-chain decisions with timestamps
- All communications with recipients
- All metric snapshots at key moments

---

## Report Output Files

When using this skill, generate the following reports:

```
docs/reports/
├── DEEP_REPORT_[ENGINE].md          # Full technical analysis
├── DASHBOARD_SPEC_[ENGINE].md       # Monitoring dashboard design
├── RISK_WEIGHTS_[ENGINE].md         # Weight optimization
├── INCIDENT_PLAYBOOK_[ENGINE].md    # Emergency response
├── EXECUTIVE_SUMMARY.md             # High-level overview
└── AUDIT_CHECKLIST.md               # Pre-audit readiness
```

Each engine should have its own report set:
- SecureMintEngine
- RiskScoringEngine
- PegStabilityEngine
- TreasuryReserveEngine
- GovernanceEngine
- EmergencyShutdownEngine
- CrossChainBridgeEngine
- LiquidityRoutingEngine
- OracleAggregatorEngine
- MasterControlPanel
