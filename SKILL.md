---
name: secure-mint-engine
description: Priority engine for oracle-gated secure minting in blockchain token systems. This skill MUST be activated when designing any token that claims backing, stability, or reserve-based value such as stablecoins and asset-backed tokens. Enforces the follow-the-money doctrine where tokens may ONLY be minted if backing is provably sufficient via on-chain oracles or Proof-of-Reserve feeds. Takes priority over all other token mint designs when backing claims exist. Includes Phase 0 Market Intelligence Engine, Monetary Routing Decision Tree, and CI guardrails for production deployment. Use when money_mechanic_type equals stablecoin_backed, backing_type is not none, project claims 1:1 backing or fully backed or redeemable, token marketed as stable or asset-backed or reserve-backed, or treasury/reserves justify minting.
---

# SecureMintEngine — Oracle-Gated Secure Mint

```
 ███████╗███████╗ ██████╗██╗   ██╗██████╗ ███████╗    ███╗   ███╗██╗███╗   ██╗████████╗
 ██╔════╝██╔════╝██╔════╝██║   ██║██╔══██╗██╔════╝    ████╗ ████║██║████╗  ██║╚══██╔══╝
 ███████╗█████╗  ██║     ██║   ██║██████╔╝█████╗      ██╔████╔██║██║██╔██╗ ██║   ██║
 ╚════██║██╔══╝  ██║     ██║   ██║██╔══██╗██╔══╝      ██║╚██╔╝██║██║██║╚██╗██║   ██║
 ███████║███████╗╚██████╗╚██████╔╝██║  ██║███████╗    ██║ ╚═╝ ██║██║██║ ╚████║   ██║
 ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝
                     ███████╗███╗   ██╗ ██████╗ ██╗███╗   ██╗███████╗
                     ██╔════╝████╗  ██║██╔════╝ ██║████╗  ██║██╔════╝
                     █████╗  ██╔██╗ ██║██║  ███╗██║██╔██╗ ██║█████╗
                     ██╔══╝  ██║╚██╗██║██║   ██║██║██║╚██╗██║██╔══╝
                     ███████╗██║ ╚████║╚██████╔╝██║██║ ╚████║███████╗
                     ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚══════╝
                        Oracle-Gated Secure Minting Protocol
                     ═══════════════════════════════════════════
```

---

## STEP 0: OUTPUT FOLDER SETUP (MANDATORY FIRST STEP)

**BEFORE ANYTHING ELSE, ask user for output folder location.**

### Intake Question (Ask This First)

```
Where would you like me to create the project files?

Please provide:
1. OUTPUT FOLDER PATH: (e.g., /Users/you/projects/my-token)
2. TOKEN NAME: (e.g., USDX, VESD, MyStable)
3. TOKEN SYMBOL: (e.g., USDX, VSD, MST)

Example: /tmp/my-stablecoin with token name "Digital Dollar" symbol "DIGUSD"
```

### Folder Structure Created

Once user provides output path, create this structure:

```
[OUTPUT_FOLDER]/
├── README.md                    # Project overview with ASCII logo
├── docs/
│   ├── BUSINESS_PLAN.md        # 5000+ word comprehensive plan
│   ├── WHITEPAPER.md           # Technical whitepaper
│   └── architecture/           # Technical docs
├── intake/
│   ├── PROJECT_CONTEXT.json    # Token configuration
│   └── DECISION_CONTEXT.json   # Market intelligence output
├── config/
│   ├── WEIGHTS.json            # Risk scoring weights
│   └── ELIMINATION_RULES.json  # Chain elimination criteria
├── contracts/
│   ├── token/                  # ERC-20 token
│   ├── policy/                 # SecureMint policy
│   ├── oracle/                 # Backing oracle
│   ├── treasury/               # Reserve vault
│   ├── governance/             # DAO contracts
│   └── emergency/              # Circuit breaker
├── scripts/
│   ├── deploy/                 # Deployment scripts
│   └── ci/                     # CI guardrails
├── test/
│   ├── unit/
│   ├── integration/
│   └── invariant/
└── .github/workflows/          # CI/CD pipelines
```

### README.md Template (With ASCII Logo)

Create `README.md` with this header:

```markdown
# [TOKEN_NAME] Protocol

```
███████╗███████╗ ██████╗██╗   ██╗██████╗ ███████╗    ███╗   ███╗██╗███╗   ██╗████████╗
██╔════╝██╔════╝██╔════╝██║   ██║██╔══██╗██╔════╝    ████╗ ████║██║████╗  ██║╚══██╔══╝
███████╗█████╗  ██║     ██║   ██║██████╔╝█████╗      ██╔████╔██║██║██╔██╗ ██║   ██║
╚════██║██╔══╝  ██║     ██║   ██║██╔══██╗██╔══╝      ██║╚██╔╝██║██║██║╚██╗██║   ██║
███████║███████╗╚██████╗╚██████╔╝██║  ██║███████╗    ██║ ╚═╝ ██║██║██║ ╚████║   ██║
╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝
```

> **[TOKEN_SYMBOL]** - [BACKING_TYPE]-backed stablecoin powered by SecureMintEngine

## Overview
[Auto-generated description]

## Quick Links
- [Business Plan](docs/BUSINESS_PLAN.md)
- [Whitepaper](docs/WHITEPAPER.md)
- [Smart Contracts](contracts/)
- [Deployment Guide](scripts/deploy/)

## Architecture
[Auto-generated from diagrams]

## Security
- Oracle-gated minting (no unbacked issuance possible)
- Multi-tier treasury (4 reserve tiers)
- Emergency pause system (4-level shutdown)
- DAO governance with timelocks

## License
MIT
```

---

## STEP 0.5: FINANCIAL FEASIBILITY REPORT (MANDATORY GATE)

**BEFORE ANY CODING OR IMPLEMENTATION, generate and approve a Financial Feasibility Report.**

This is a **HARD GATE** - no implementation work may proceed until the financial report is:
1. Generated with all cost estimates
2. Reviewed by stakeholders
3. Signed off by required approvers

### Run Financial Report

```bash
make financial-report
```

### What the Report Includes

**One-Time Costs:**
- Smart contract development
- Security audits (2x)
- Legal and compliance
- Marketing and launch
- Infrastructure setup
- Initial liquidity

**Monthly Operating Costs:**
- Team salaries (engineers, support, legal)
- Infrastructure (RPC, hosting, monitoring)
- Services (oracles, KYC, insurance)
- Compliance and legal fees

**Revenue Projections:**
- Mint/burn fees
- Yield share from treasury
- Premium features

**Financial Analysis:**
- 24-month P&L projection
- Break-even analysis (TVL, volume)
- ROI scenarios (conservative, base, optimistic)
- Runway calculation

### Required Signatures

Before proceeding, the following must sign off:

| Role | Signature | Date |
|------|-----------|------|
| Project Lead | _________________ | ______ |
| CFO / Finance | _________________ | ______ |
| Legal Counsel | _________________ | ______ |
| Technical Lead | _________________ | ______ |

### Workflow Gate

```
FINANCIAL REPORT (make financial-report)
         │
         ▼
   Review & Approve
         │
         ▼
  ┌──────┴──────┐
  │             │
REJECT      APPROVE
  │             │
  ▼             ▼
STOP       Continue to Intake
           (make intake)
```

**The intake command will FAIL if no approved financial report exists.**

---

## GOD-TIER LAUNCH GATES (Steps 1-4)

**MANDATORY PRE-DEPLOYMENT GATES for production-ready token launches.**

These gates ensure institutional-grade compliance, security, economics, and operational readiness. Run them in sequence AFTER the Financial Feasibility Report is approved.

### Gate Workflow

```
FINANCIAL REPORT APPROVED
         │
         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    GOD-TIER LAUNCH GATES                    │
   ├─────────────────────────────────────────────────────────────┤
   │ GATE 1: Legal/Regulatory Compliance (make legal-gate)       │
   │    └── Howey Test, jurisdiction analysis, compliance matrix │
   │                                                             │
   │ GATE 2: Security Audit Management (make audit-gate)         │
   │    └── Audit firm selection, scope, findings tracker        │
   │                                                             │
   │ GATE 3: Tokenomics Stress Test (make stress-test)           │
   │    └── Bank run, whale dump, death spiral simulations       │
   │                                                             │
   │ GATE 4: Launch Countdown Orchestrator (make launch-countdown)│
   │    └── T-30 to T+7 checklist, Go/No-Go decisions           │
   └─────────────────────────────────────────────────────────────┘
         │
         ▼
  ALL GATES PASSED → Proceed to Deployment
```

### Run All Gates

```bash
make full-gates    # Runs all gates in sequence
```

### Gate 1: Legal/Regulatory Compliance

```bash
make legal-gate
```

**Generates:**
- `LEGAL_COMPLIANCE_REPORT.md` — Comprehensive regulatory analysis
- `legal-compliance-config.json` — Machine-readable configuration

**Analysis Includes:**
- **Howey Test Analysis** — 4-prong securities classification
  - Investment of Money
  - Common Enterprise
  - Expectation of Profits
  - Efforts of Others
- **Jurisdiction Database** — US, EU, UK, Singapore, Switzerland, UAE, Cayman, China
- **Compliance Checklist** — 25+ items across categories
  - Entity Structure
  - Token Classification
  - AML/KYC Requirements
  - Registration Filings
  - Ongoing Reporting
- **Legal Opinion Requirements** — Recommended law firms by jurisdiction
- **Timeline & Budget** — Estimated compliance costs and durations

**Risk Levels:**
- 🟢 LOW RISK: Utility token, clear exemptions
- 🟡 MEDIUM RISK: Hybrid characteristics, some regulatory uncertainty
- 🔴 HIGH RISK: Securities-like features, requires legal opinion

### Gate 2: Security Audit Management

```bash
make audit-gate
```

**Generates:**
- `SECURITY_AUDIT_REPORT.md` — Audit strategy and firm comparison
- `AUDIT_SCOPE_DOCUMENT.md` — Technical scope for auditors
- `AUDIT_FINDING_TRACKER.md` — Vulnerability tracking template

**Features:**
- **Audit Firm Database** — 10 firms with costs, timelines, specializations
  - Tier 1: Trail of Bits, OpenZeppelin, Consensys Diligence
  - Tier 2: CertiK, Halborn, Quantstamp
  - Tier 3: Code4rena, Sherlock, Immunefi contests
- **Vulnerability Classification**
  - CRITICAL: Direct fund theft, unlimited minting
  - HIGH: Significant fund loss, privilege escalation
  - MEDIUM: Limited impact, edge cases
  - LOW: Best practices, gas optimization
  - INFORMATIONAL: Code quality, documentation
- **Remediation Tracking** — Finding status, verification, retesting
- **Budget Estimation** — Based on contract complexity and firm tier

**Audit Readiness Checklist:**
- [ ] Code freeze complete
- [ ] Full test coverage (>90%)
- [ ] Documentation complete
- [ ] Known issues documented
- [ ] Previous audit findings addressed

### Gate 3: Tokenomics Stress Test

```bash
make stress-test
```

**Generates:**
- `TOKENOMICS_STRESS_TEST.md` — Simulation results and analysis
- `tokenomics-config.json` — Stress test parameters

**Simulation Types:**
1. **Bank Run Scenario**
   - 50% holders redeem simultaneously
   - Tests treasury liquidity tiers
   - Validates redemption queue

2. **Oracle Manipulation**
   - ±30% price deviation attack
   - Tests staleness checks
   - Validates circuit breakers

3. **Whale Dump**
   - Top 10 holders sell 80% of holdings
   - Tests liquidity depth
   - Validates peg stability

4. **Liquidity Crisis**
   - 90% LP withdrawal
   - Tests protocol survival
   - Validates emergency procedures

5. **Death Spiral**
   - Cascading liquidations
   - Tests collateral ratios
   - Validates safety margins

6. **Flash Loan Attack**
   - Single-block manipulation
   - Tests reentrancy guards
   - Validates oracle TWAPs

**Output Metrics:**
- Survival probability (%)
- Maximum drawdown (%)
- Recovery time estimate
- Recommended mitigations

### Gate 4: Launch Countdown Orchestrator

```bash
make launch-countdown
```

**Generates:**
- `LAUNCH_COUNTDOWN_REPORT.md` — Complete launch checklist
- `launch-config.json` — Launch parameters
- `launch-checklist.json` — Trackable checklist

**Countdown Phases:**
| Phase | Timeline | Focus |
|-------|----------|-------|
| T-30 | 30 days out | Final audit, legal clearance |
| T-14 | 2 weeks out | Marketing ramp, community prep |
| T-7 | 1 week out | Testnet validation, dry runs |
| T-3 | 3 days out | Final checks, team alignment |
| T-1 | 24 hours out | Go/No-Go decision |
| T-0 | Launch day | Deployment, monitoring |
| POST | T+1 to T+7 | Post-launch support |

**Checklist Categories (50+ items):**
- Contracts & Security
- Legal & Compliance
- Infrastructure
- Marketing & Communications
- Team & Operations
- Financial & Treasury
- Monitoring & Support

**Go/No-Go Framework:**
- **BLOCKING** items — Must be resolved before launch
- **NON-BLOCKING** items — Warnings, can launch with caveats
- **Decision Authority** — Defines who can make final call

**Multi-sig Coordination:**
- Defines required signers for deployment
- Emergency pause authority
- Post-launch parameter changes

### Required Signatures (All Gates)

| Gate | Required Approvers |
|------|-------------------|
| Gate 1: Legal | Legal Counsel, Compliance Officer |
| Gate 2: Security | CTO, Security Lead, Auditor |
| Gate 3: Stress Test | Tokenomics Lead, Risk Officer |
| Gate 4: Launch | CEO, CTO, Legal, Marketing |

---

## QUICK START: Master Intake Prompt

**Use this simple prompt to trigger the full workflow:**

```
Build me a [TOKEN_TYPE] token called [NAME] with the following:
- Backing: [fiat_reserves / crypto_collateral / RWA]
- Chains: [ethereum / polygon / arbitrum / multi-chain]
- Risk tolerance: [low / medium / high]
- Cross-chain: [yes / no]
- Output folder: [/path/to/project]
```

**Example:**
```
Build me a stablecoin called USDX with the following:
- Backing: fiat_reserves
- Chains: ethereum, arbitrum
- Risk tolerance: low
- Cross-chain: yes
- Output folder: /tmp/usdx-protocol
```

This triggers the complete workflow automatically:
1. **Step 0: Output Folder Setup** - Create project structure
2. **Step 0.5: FINANCIAL FEASIBILITY REPORT** (MANDATORY GATE)
3. **Phase 1: Comprehensive Business Plan** (5000+ words)
4. Phase 0 Market Intelligence
5. Chain Selection & Elimination
6. Monetary Routing Decision
7. Smart Contract Generation
8. All 12 ASCII Diagrams Applied
9. Deep Technical Reports
10. Whitepaper Generation
11. Full Deployment Package

---

## PHASE 1: COMPREHENSIVE BUSINESS PLAN (MANDATORY FIRST OUTPUT)

**BEFORE ANY TECHNICAL WORK, generate a complete business plan document.**

See `references/business-plan-template.md` for the full 5000+ word template.

### Mandatory Business Plan Sections (15 Sections)

1. **Executive Summary** - Vision, value props, funding needs
2. **Market Analysis** - TAM/SAM/SOM, regional data, competition
3. **Problem Statement & Solution** - Pain points with quantified impact
4. **Technical Architecture Overview** - System diagram, security model
5. **Token Economics (Tokenomics)** - Specs, backing, fees, peg mechanics
6. **Business Model & Revenue Streams** - 4 revenue streams, unit economics
7. **Go-to-Market Strategy** - 5 launch phases, acquisition channels
8. **Development Roadmap & Task List** - Complete task breakdown (50+ tasks)
9. **Team & Organization Requirements** - Org chart, key hires, advisors
10. **Financial Projections & Investment Requirements** - Startup costs, monthly opex, funding rounds
11. **Risk Analysis & Mitigation** - Technical, market, regulatory, operational
12. **Legal & Regulatory Considerations** - Compliance strategy, licensing
13. **Competitive Analysis** - Direct competitors, competitive advantages
14. **Success Metrics & KPIs** - Targets by month, north star metric
15. **Appendices** - Technical specs, financial model, legal opinions

### Task List Structure (Required in Business Plan)

Generate a complete task breakdown with:

| Task ID | Task | Dependencies | Duration | Resources | Status |
|---------|------|--------------|----------|-----------|--------|
| P0-01 | Market research | None | 1 week | 1 analyst | [ ] |
| P0-02 | Competitor analysis | P0-01 | 3 days | 1 analyst | [ ] |
| ... | ... | ... | ... | ... | [ ] |

**Minimum 50 tasks across 6 phases:**
- Phase 0: Planning & Research (8 tasks)
- Phase 1: Smart Contract Development (12 tasks)
- Phase 2: Security & Audit (8 tasks)
- Phase 3: Infrastructure & Frontend (7 tasks)
- Phase 4: Testnet Launch (5 tasks)
- Phase 5: Mainnet Launch (8 tasks)
- Phase 6: Post-Launch Operations (ongoing)

### Financial Model (Required)

Include detailed cost breakdowns:

**Startup Costs:**
| Category | Amount |
|----------|--------|
| Smart Contract Development | $X |
| Security Audits (2x) | $X |
| Legal & Compliance | $X |
| Infrastructure | $X |
| Initial Liquidity | $X |
| Marketing | $X |
| Operational Reserve | $X |
| **TOTAL** | **$X** |

**Monthly Operating Costs:**
| Category | Month 1-6 | Month 7-12 | Month 13-18 |
|----------|-----------|------------|-------------|
| Team | $X | $X | $X |
| Infrastructure | $X | $X | $X |
| ... | ... | ... | ... |

**Revenue Projections (3 Years):**
| Year | TVL | Volume | Revenue | Costs | Net |
|------|-----|--------|---------|-------|-----|
| 1 | $X | $X | $X | $X | $X |
| 2 | $X | $X | $X | $X | $X |
| 3 | $X | $X | $X | $X | $X |

### Investment Requirements

Document funding rounds:
- **Seed Round**: Amount, valuation, use of funds
- **Series A**: Amount, valuation, use of funds
- **Break-Even Analysis**: Fixed costs, variable costs, break-even volume
- **ROI Scenarios**: Conservative, base case, optimistic

### Feasibility Checklist

Before proceeding to technical implementation:
- [ ] Market size validated (TAM > $1B)
- [ ] Competitive advantage identified
- [ ] Revenue model sustainable
- [ ] Funding requirements reasonable
- [ ] Team requirements defined
- [ ] Regulatory path clear
- [ ] Technical feasibility confirmed
- [ ] Risk mitigations documented

---

## Brainstorm Trigger Prompts

### Trigger 1: Full System Build
```
Create a complete backed token system for [DESCRIPTION]
```

### Trigger 2: Specific Engine Deep Dive
```
Generate deep report for [ENGINE_NAME] engine
```

### Trigger 3: Dashboard Specification
```
Design monitoring dashboard for [ENGINE_NAME]
```

### Trigger 4: Incident Playbook
```
Create incident response playbook for [ENGINE_NAME]
```

### Trigger 5: Risk Weight Optimization
```
Optimize risk weights for [TOKEN_NAME] protocol
```

### Trigger 6: Whitepaper Only
```
Write whitepaper for [TOKEN_NAME] with formulas
```

### Trigger 7: Contracts Only
```
Generate smart contracts for [TOKEN_NAME] stablecoin
```

---

## Auto-Detected Triggers

The skill automatically activates when ANY of these are detected:

| Phrase Detected | Action Triggered |
|-----------------|------------------|
| "stablecoin" | Full SecureMint workflow |
| "backed token" | Full SecureMint workflow |
| "reserve-backed" | Full SecureMint workflow |
| "1:1 backing" | Full SecureMint workflow |
| "oracle-gated" | SecureMint + Oracle setup |
| "cross-chain token" | SecureMint + Bridge |
| "mint policy" | Policy contract generation |
| "proof of reserve" | PoR oracle integration |
| **"memecoin"** | **Memecoin Execution Layer (Solana)** |
| **"solana token"** | **Memecoin Execution Layer** |
| **"raydium"** | **Memecoin Execution Layer** |
| **"jupiter"** | **Memecoin Execution Layer** |
| **"pump.fun"** | **Memecoin Execution Layer** |
| **"fixed supply token"** | **Memecoin Execution Layer** |
| **"SPL token"** | **Memecoin Execution Layer** |
| **"anchor program"** | **Memecoin Execution Layer** |

---

## System Execution Flow (Locked)

```
STEP 0   → Output Folder Setup
          ↓
STEP 0.5 → FINANCIAL FEASIBILITY REPORT [MANDATORY GATE]
          ↓
     ┌────┴────┐
     │         │
  REJECT    APPROVE
     │         │
     ▼         ▼
   STOP    Continue
              ↓
PHASE 0  → MarketIntelligenceEngine
          ↓
DECISION_CONTEXT.json
          ↓
IntakeBrain (Chain Detection)
          ↓
     ┌────┴────┐
     │         │
  SOLANA     EVM
     │         │
     ▼         ▼
══════════════════════════════════════════════════════════════════════
║ [ROUTE:MEMECOIN]          ║ Monetary Routing Tree                  ║
║ MemecoinExecutionLayer    ║ SecureMint / Emissions / Cross-Chain   ║
║ → 5 Anchor Programs       ║ → Oracle-gated ERC-20                  ║
║ → 9 TypeScript Scripts    ║ → Chainlink PoR                        ║
║ → 2 CI/CD Workflows       ║ → Multi-tier Treasury                  ║
║ → 2 EVM Mirror Contracts  ║ → Formal Invariants                    ║
║ → Raydium/Jupiter         ║ → Threat Matrices                      ║
══════════════════════════════════════════════════════════════════════
          ↓
Formal Invariants + Threat Matrices
          ↓
Simulation + DAO Gate
          ↓
Contracts + CI + Evidence
          ↓
GitHub Architecture (Repo Setup + Permissions)
          ↓
Deep Technical Reports (Institutional Grade)
          ↓
Whitepaper + Financial Documentation
          ↓
Indexers + Frontend + Deployment
```

### Phase 0 Chain Detection Logic

```
PHASE 0 STARTS
       │
       ▼
Analyze user request for chain indicators:
       │
       ├── "solana", "SPL", "anchor", "raydium", "jupiter", "pump.fun"
       │         │
       │         └── IF DETECTED → [ROUTE:MEMECOIN]
       │                           Load: references/memecoin-execution-layer.md
       │                           Generate: Complete Anchor repo (28+ files)
       │
       ├── "ethereum", "EVM", "polygon", "arbitrum", "base", "stablecoin"
       │         │
       │         └── IF DETECTED → [ROUTE:SECURE_MINT] or [ROUTE:EMISSIONS]
       │                           Load: Standard SecureMint workflow
       │
       └── AMBIGUOUS → Ask user: "Which blockchain: Solana or EVM?"
```

### Full System Flow Diagram

For complete visual workflow, see `diagrams/FullSystemWorkflow.ascii` (332 lines)

---

## Phase 0: Market Intelligence Engine (MANDATORY FIRST)

**THIS ENGINE RUNS FIRST. No other engine may execute until Phase 0 completes.**

See `references/market-intelligence-engine.md` for complete specification.

### Purpose

Perform deep, neutral, production-grade market research across ALL viable blockchains, execution environments, and tooling stacks BEFORE any architectural decision.

This prevents: Chain-first bias, tooling hype, incompatible money mechanics, regulatory dead-ends, security theater.

### Required Outputs

1. **Chain Comparison Table** — Security, tooling, stablecoin suitability per chain
2. **Tooling Stack Matrix** — Oracles, PoR providers, bridges, auditors
3. **Money Mechanic Fit Map** — Best/unsafe mechanics per chain
4. **Risk Exclusion List** — Chains/tools to AVOID
5. **Recommended Shortlist** — Tier 1/2/3 recommendations
6. **DECISION_CONTEXT.json** — Structured output for downstream engines

### Output File

Write to: `intake/DECISION_CONTEXT.json`

```json
{
  "recommended_chains": [],
  "rejected_chains": [],
  "preferred_execution_env": "",
  "preferred_oracle_stack": "",
  "preferred_proof_of_reserve": "",
  "preferred_cross_chain_pattern": "",
  "money_mechanic_constraints": [],
  "security_red_lines": [],
  "regulatory_red_lines": [],
  "tooling_dependencies": [],
  "open_unknowns": []
}
```

---

## SecureMintEngine Purpose

Enforce the clearest, most battle-tested "follow the money" rule for token minting:

- Tokens may ONLY be minted if backing is provably sufficient
- Enforcement MUST be cryptographic and on-chain, not discretionary

This pattern prevents the #1 catastrophic failure mode: **UNBACKED MINTING**.

## Activation Triggers (Mandatory)

Activate SecureMintEngine if ANY of the following are true:

- `money_mechanic_type == "stablecoin_backed"`
- `backing_type != "none"`
- Project claims "1:1 backing", "fully backed", "redeemable", or similar
- Token is marketed as "stable", "asset-backed", "reserve-backed"
- Treasury or reserves are referenced as justification for minting

**If triggered, NO OTHER MINT SYSTEM MAY BYPASS THIS ENGINE.**

## Monetary Routing Decision Tree

Before implementing, consult `diagrams/MonetaryRouting.ascii` to determine the correct path.

### Route Markers (for CI Check)

- `[ROUTE:FIXED]` — Fixed supply tokens
- `[ROUTE:EMISSIONS]` — Emissions/incentive tokens
- `[ROUTE:SECURE_MINT]` — Backed tokens (this engine)
- `[ROUTE:CROSS_CHAIN]` — Multi-chain tokens
- **`[ROUTE:MEMECOIN]`** — **Solana memecoin (fixed supply, Raydium/Jupiter)**

### Decision Flow

```
TOKEN DESIGN START
       │
       ▼
Which blockchain?
       │
   EVM ─┴─ SOLANA
   │         │
   │         ▼
   │    ══════════════════════════════════════════════
   │    ║ [ROUTE:MEMECOIN] MEMECOIN EXECUTION LAYER ║
   │    ║ → Load: references/memecoin-execution-layer.md
   │    ║ → Output: Full Anchor repo + Raydium/Jupiter ║
   │    ══════════════════════════════════════════════
   │
   ▼
Is minting required after TGE?
       │
   NO ─┴─ YES
   │       │
   ▼       ▼
[GREEN]  Is token backed/claiming value from reserves?
FIXED         │
SUPPLY    NO ─┴─ YES
          │       │
          ▼       ▼
     [YELLOW]   ══════════════════════════════════════
     EMISSIONS  ║ [RED] SECURE MINT ENGINE (THIS)    ║
     PATH       ══════════════════════════════════════
```

### Memecoin Route (Phase 0 Decision)

When Phase 0 detects ANY of these conditions, activate `[ROUTE:MEMECOIN]`:

```
PHASE 0 DETECTION:
├── chain == "solana"
├── token_type == "memecoin" OR "meme" OR "fixed_supply"
├── mentions: "Raydium", "Jupiter", "pump.fun", "SPL token"
├── mentions: "Anchor", "Solana program"
└── backing_type == "none" AND chain == "solana"

IF ANY MATCH:
   └── Load: references/memecoin-execution-layer.md
   └── Generate: Complete repo with 28+ files
   └── Apply: Research-backed defaults (1B supply, 9 decimals, 7% LP)
```

---

## Architecture Overview

```
[ ERC-20 Token (DUMB LEDGER) ]
             ↑
[ SecureMint Policy Contract ]
             ↑
[ Proof-of-Reserve / Oracle Feeds ]
             ↑
[ Emergency Pause + Governance Controls ]
```

## Implementation Workflow

### Step 1: Design Token Contract (Dumb Ledger)

Use `assets/contracts/BackedToken.sol` as template. Requirements:

- No embedded business logic
- No discretionary mint functions
- Mint callable ONLY by SecureMint policy contract address
- Optional burn allowed (user or protocol-initiated)

### Step 2: Implement SecureMint Policy Contract

Use `assets/contracts/SecureMintPolicy.sol` as template. Minting allowed IFF ALL conditions hold:

1. Verified backing exists (oracle/PoR check)
2. Backing >= post-mint totalSupply (or required collateral ratio)
3. Oracle feeds are healthy (not stale, not deviated)
4. Mint amount <= rate limit (per-epoch cap)
5. Mint amount <= global cap
6. Contract is NOT paused

**If ANY condition fails → `mint()` MUST revert.**

### Step 3: Configure Oracle/Proof-of-Reserve

See `references/oracle-requirements.md` for detailed specifications.

**Mode A — On-Chain Collateral:**
- Price oracles for collateral valuation
- LTV / collateral ratio enforcement
- Staleness checks (e.g., 1 hour max)
- Deviation bounds (e.g., ±5%)
- Emergency pause on oracle failure

**Mode B — Off-Chain/Cross-Chain Reserves (Preferred for Stablecoins):**
- Proof-of-Reserve oracle feed
- Mint blocked if: `reported_reserves < required_backing(post_mint_supply)`
- Continuous enforcement (not one-time attestation)

### Step 4: Implement Emergency Pause

PAUSE MUST:

- Instantly block `mint()`
- Optionally block transfers (configurable)
- Be callable by Guardian multisig or DAO emergency vote
- Auto-trigger on: oracle unhealthy, reserve mismatch, invariant breach

**PAUSE IS NOT OPTIONAL. If pause does not exist → DESIGN IS INVALID.**

### Step 5: Configure Access Control & Timelocks

Mandatory controls:

| Parameter | Requirement |
|-----------|-------------|
| GLOBAL_SUPPLY_CAP | Required, immutable or timelocked |
| PER_EPOCH_MINT_CAP | Required (e.g., per hour/day) |
| RATE_LIMITS | Required |
| ACCESS_CONTROL | No EOAs; multisig only |
| TIMELOCK | Required for: cap changes, oracle changes, role changes, pause authority |

**NO "TEMPORARY UNLIMITED MINT" IS EVER ALLOWED.**

### Step 6: Register Formal Invariants

Register with MonetaryFormalVerificationEngine. See `references/invariants.md`:

- **INV-SM-1**: BackingAlwaysCoversSupply — `backing(t) >= required_backing(totalSupply(t))`
- **INV-SM-2**: OracleHealthRequired — mint allowed only if `oracle_healthy == true`
- **INV-SM-3**: MintIsBounded — `minted(epoch) <= epoch_cap AND totalSupply <= global_cap`
- **INV-SM-4**: NoBypassPath — No contract or role can mint except SecureMint policy contract

### Step 7: Run Simulation & Threat Modeling

See `references/threat-matrix.md`. Required simulations:

- Oracle manipulation / downtime
- Reserve shortfall
- Delayed PoR updates
- Emergency pause race conditions

Required threat analysis:

- Unbacked mint attempt
- Oracle compromise
- Admin key compromise
- Governance capture
- False reserve reporting

**Any unmitigated fatal scenario → NO-GO.**

### Step 8: Integration Requirements

SecureMintEngine MUST integrate with:

- TokenMonetaryEngine
- MonetaryFormalVerificationEngine
- TreasuryEngine
- EvidenceLoggingEngine
- KillSwitchWorkflow
- DAO / Multi-Sig Gate
- Enforcement & Litigation Readiness Engine

All mint/burn events MUST be:
- Immutably logged
- Timestamped
- Linked to oracle state at time of execution

---

## CI Guardrail: Monetary Routing Consistency Check

Run `scripts/monetary_routing_ci_check.py` in CI pipeline.

### Purpose

Fail CI if the selected money mechanic in `intake/PROJECT_CONTEXT.json` does not match the active routing path documented in `diagrams/MonetaryRouting.ascii`.

### Rules

1. `stablecoin_backed` or `backing_type != "none"` → must include `[ROUTE:SECURE_MINT]`
2. `emissions_schedule != "none"` → must include `[ROUTE:EMISSIONS]`
3. `cross_chain_required == true` → must include `[ROUTE:CROSS_CHAIN]`
4. `minting_required == false` → must include `[ROUTE:FIXED]`

### Usage

```bash
python3 scripts/monetary_routing_ci_check.py
```

### Outputs

- `outputs/MonetaryRoutingCIReport.md` — Detailed report
- Exit code non-zero on mismatch

**If CI fails, DAO Gate MUST block deployment and require remediation.**

---

## Absolute Rule (Follow-the-Money Doctrine)

> If backing cannot be proven ON-CHAIN or via trusted Proof-of-Reserve feeds,
> THE TOKEN MUST NOT BE MINTABLE.

Claims about backing without cryptographic enforcement are treated as a **HIGH-RISK / FRAUD VECTOR**.

---

## Resources

### scripts/
- `monetary_routing_ci_check.py` — CI guardrail for routing consistency

### assets/contracts/
Solidity reference implementations:
- `BackedToken.sol` — Minimal ERC-20 with restricted mint
- `SecureMintPolicy.sol` — Oracle-gated mint policy with all controls
- `IBackingOracle.sol` — Oracle interface specification

### references/

**Phase 0 Engines:**
- `market-intelligence-engine.md` — Phase 0 Meta Prompt (blockchain selection & elimination)
- `risk-scoring-engine.md` — Risk-tolerance scoring weights engine
- `live-data-hooks-engine.md` — Live data hooks (TVL, outages, exploits)
- `auto-elimination-engine.md` — Programmatic fail rules engine

**Memecoin Execution Layer (Solana):**
- `memecoin-execution-layer.md` — **COMPLETE PRODUCTION-READY SOLANA MEMECOIN SYSTEM**
  - 5 Anchor Programs (Rust): token_mint, burn_controller, treasury_vault, governance_multisig, emergency_pause
  - 9 TypeScript Scripts: env check, mint creation, distribution, authority revocation, Raydium pool, liquidity, LP lock/burn, Jupiter quote, swap test
  - 2 CI/CD Workflows: ci.yml (lint, build, test, security), release.yml (devnet/mainnet deploy)
  - 2 EVM Contracts: WrappedMeme.sol (cross-chain mirror), MirrorBridgeGate.sol (bridge verification)
  - Research-backed defaults: 1B supply, 9 decimals, 10 wallets, 7% LP + $100K USDC
  - Complete checklists: Devnet, Mainnet, Security
  - Known adaptation points documented

**SecureMint Technical:**
- `oracle-requirements.md` — Detailed oracle/PoR specifications
- `invariants.md` — Formal invariants for verification
- `threat-matrix.md` — Threat modeling requirements

**Foundational Knowledge:**
- `monetary-theory-foundations.md` — Modern Money Mechanics principles for token design
- `blockchain-ecosystem.md` — Core repos, tools, DeFi protocols, infrastructure

**GitHub & DevOps:**
- `github-architecture-map.md` — Complete GitHub repository ecosystem, permissions, security rules, and system flow for crypto protocol development

**Business Planning:**
- `business-plan-template.md` — 5000+ word comprehensive business plan template with 50+ tasks

**Reporting & Analysis:**
- `deep-report-template.md` — Institutional-grade technical report template with 14 mandatory sections, formulas, graphs, and audit-level documentation

### diagrams/ (12 ASCII Protocol Engines)

**Core System:**
- `FullSystemWorkflow.ascii` — Complete system workflow visualization
- `MonetaryRouting.ascii` — Decision tree for monetary design routing
- `MasterProtocolControlPanel.ascii` — Unified control panel tying all engines

**Token Operations:**
- `StablecoinMintBurnFlow.ascii` — Mint/burn lifecycle with evidence logging
- `OracleGatedSecurityModel.ascii` — Multi-layer oracle validation + circuit breaker

**Risk & Governance:**
- `RiskScoringEngine.ascii` — Real-time risk assessment (9 metrics, weighted scoring)
- `GovernanceControlFlow.ascii` — DAO proposal lifecycle + timelock
- `EmergencyShutdownArchitecture.ascii` — 4-level shutdown + recovery procedures

**Treasury & Reserves:**
- `TreasuryReserveArchitecture.ascii` — 4-tier reserve system + PoR gates
- `DeFiLiquidityRoutingEngine.ascii` — Yield optimization with risk tiers

**Multi-Chain & Stability:**
- `CrossChainBridgeSecurity.ascii` — Lock-mint bridge + invariants
- `PegStabilityMechanics.ascii` — 5-layer peg defense system

---

## Knowledge Sources (Monetary Mechanics)

When designing token systems, reference these foundational monetary economics resources:

### Classic Money Mechanics
- **Modern Money Mechanics (Federal Reserve)** — Public-domain workbook on money creation in banking
  - https://upload.wikimedia.org/wikipedia/commons/4/4a/Modern_Money_Mechanics.pdf
- **Understanding Money Mechanics (Robert Murphy)** — Comprehensive overview of money, banking, monetary creation
  - https://mises.org/library/periodical/understanding-money-mechanics

### Monetary Economics Textbooks
- **Monetary Economics (Handa)** — Monetary theory and policy textbook
  - https://dcbrozenwurcel.files.wordpress.com/2018/04/handa-monetary-economics.pdf
- **Monetary Economics (Godley & Lavoie)** — Integrated approach to credit, money, and income
  - https://joseluisoreiro.com.br/site/link/933ba4894c7bd29837b2f70f0a3fb2c94ac5ae5f.pdf

These sources inform the "Follow-the-Money" doctrine and help understand why cryptographic enforcement of backing is essential

---

## Production Manual & Deployment Tools

### Documentation
- **`docs/MANUAL.md`** — Complete production manual (16 sections)
  - Executive overview, glossary, quick start
  - Full user manual by persona and feature
  - Permissions & security model
  - Data model and integrations
  - Task system with execution protocol
  - Troubleshooting runbook and FAQ

### Deployment Workflow Commands

```bash
# Full production deployment workflow
make production-deploy    # intake → preflight → deploy → smoke-test

# Individual steps
make intake              # Interactive configuration questionnaire
make preflight           # Validate all prerequisites
make smoke-test          # Post-deployment validation

# Quick checks
make check               # Lint + typecheck + quick tests
make validate            # Pre-release validation
```

### Intake Command

The intake CLI collects ALL required configuration before deployment:

```bash
npx ts-node scripts/intake/intake-cli.ts
```

**Generates:**
- `config.json` — Machine-readable configuration
- `RUN_PLAN.md` — Deployment steps with gates
- `CHECKLIST.md` — Pre/post flight checklists
- `TEST_PLAN.md` — Smoke tests to run

### Preflight Checks

Validates prerequisites before deployment:

```bash
make preflight
```

**Hard Gates (blockers):**
- RPC connectivity
- Deployer balance ≥ 0.5 ETH
- Oracle feed responding
- Safe configuration valid
- Node.js 18+, Foundry installed

**Soft Gates (warnings):**
- PostgreSQL, Redis connectivity
- Etherscan/Tenderly API keys
- Slack webhook configured

### Smoke Tests

Validates deployment success:

```bash
make smoke-test
```

**Tests:**
- SM-01: Token deployment
- SM-02: Policy deployment
- SM-03: Oracle connectivity
- SM-04: Token metadata
- SM-05: Total supply
- SM-06: Pause level
- SM-07: API health
- SM-08: GraphQL endpoint
- SM-09: Invariant check (INV-SM-1)

---

## Deployment Checklist

### Phase 0 Gate
- [ ] Market Intelligence Engine completed
- [ ] DECISION_CONTEXT.json approved
- [ ] Chain selection justified

### SecureMint Implementation
- [ ] Token contract has no discretionary mint
- [ ] Mint only callable by SecureMint policy
- [ ] Oracle staleness check implemented
- [ ] Oracle deviation bounds configured
- [ ] Global supply cap set
- [ ] Per-epoch rate limits configured
- [ ] Emergency pause implemented
- [ ] Pause auto-triggers on oracle failure
- [ ] Multisig controls (no EOAs)
- [ ] Timelocks on critical parameter changes

### Verification Gate
- [ ] All invariants registered
- [ ] Threat modeling complete
- [ ] All fatal scenarios mitigated
- [ ] CI guardrail passes
- [ ] Audit scheduled/complete

### DAO Gate
- [ ] Routing consistency verified
- [ ] DECISION_CONTEXT matches implementation
- [ ] All engines integrated
- [ ] Evidence logging active

### GitHub Architecture Setup
- [ ] Repository structure follows `references/github-architecture-map.md`
- [ ] Token permissions configured (Contents, PRs, Actions, Webhooks)
- [ ] Security rules enforced (no hardcoded secrets)
- [ ] CI/CD pipelines configured (GitHub Actions)
- [ ] Slither/Mythril security scanning enabled
- [ ] The Graph subgraph deployed for indexing
- [ ] Frontend SDK integrated (ethers.js/wagmi)

---

## Local Python Execution Engine (90-99% Token Reduction)

**Instead of loading code through context, Claude executes MAKE Python locally with API access—achieving 90-99% token reduction for bulk operations.**

### Overview

The Python Engine (`assets/python-engine/`) provides a complete local execution framework for:
- **Batch minting/burning** — Process thousands of transactions from CSV/JSON
- **Compliance checking** — Bulk KYC/AML/sanctions screening
- **Report generation** — Reserve attestations, compliance reports, treasury reports
- **Invariant checking** — Verify all 4 SecureMint invariants
- **Transaction simulation** — Simulate before broadcast

### Quick Start

```bash
# Install dependencies
cd assets/python-engine
pip install -r requirements.txt
make setup

# Configure
export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export PRIVATE_KEY="your_private_key"  # For transactions
export TOKEN_ADDRESS="0x..."
export POLICY_ADDRESS="0x..."
```

### Make Commands (Local Execution)

```bash
# Token Operations
make mint FILE=mint_requests.csv           # Batch mint from CSV
make mint-dry FILE=mint_requests.csv       # Dry-run (simulate only)
make burn FILE=burn_requests.csv           # Batch burn

# Compliance
make compliance ADDR=0x123...              # Check single address
make compliance FILE=addresses.txt         # Bulk compliance check
make compliance-aml FILE=addresses.txt     # AML-only check
make compliance-sanctions FILE=addrs.txt   # Sanctions-only check

# Reports
make report TYPE=reserve                   # Reserve attestation
make report TYPE=monthly                   # Monthly compliance summary
make report TYPE=treasury                  # Treasury status report
make report TYPE=compliance                # Full compliance report
make report TYPE=bridge                    # Bridge activity report
make reports-all                           # Generate all reports

# Status Checks
make oracle-status                         # Oracle health
make treasury-status                       # Treasury balances
make bridge-status                         # Bridge status
make invariants                            # Check all 4 invariants

# Simulation
make simulate FILE=transactions.json       # Simulate tx bundle
```

### CLI Usage

```bash
# Batch mint with validation
python securemint_cli.py mint-batch \
  -i mint_requests.csv \
  -o results.json \
  --batch-size 50 \
  --dry-run

# Compliance check
python securemint_cli.py compliance \
  -i addresses.txt \
  --kyc --aml --sanctions \
  -j US \
  -o compliance_results.json

# Generate reserve attestation
python securemint_cli.py report \
  -t reserve \
  --include-proof \
  --markdown \
  -o reports/
```

### Input File Formats

**CSV (mint/burn):**
```csv
recipient,amount
0x1234...,1000000000
0x5678...,2500000000
```

**JSON (mint/burn):**
```json
{
  "requests": [
    {"recipient": "0x1234...", "amount": 1000000000},
    {"recipient": "0x5678...", "amount": 2500000000}
  ]
}
```

### Token Reduction Impact

| Operation | Without Python Engine | With Python Engine | Reduction |
|-----------|----------------------|-------------------|-----------|
| Batch mint 1000 addresses | ~50K tokens | ~500 tokens | 99% |
| Compliance check 500 addrs | ~25K tokens | ~300 tokens | 98.8% |
| Generate all reports | ~20K tokens | ~200 tokens | 99% |
| Check invariants | ~5K tokens | ~100 tokens | 98% |

### Python Engine Files

```
assets/python-engine/
├── securemint_cli.py        # Main CLI entry point
├── securemint_api.py        # Web3 API client
├── bulk_operations.py       # Batch processing
├── compliance_engine.py     # KYC/AML/sanctions
├── report_generator.py      # Report generation
├── requirements.txt         # Python dependencies
├── Makefile                 # Make commands
└── data/
    └── sanctions_addresses.json  # OFAC list (cached)
```

### Integration with Claude

When performing bulk operations, Claude will:
1. Prepare input files (CSV/JSON)
2. Execute `make` commands locally
3. Parse and summarize results
4. No need to load contract code into context

**Example Claude workflow:**
```
User: "Mint tokens to these 500 addresses..."

Claude:
1. Writes addresses to mint_requests.csv
2. Runs: make mint-dry FILE=mint_requests.csv
3. Reviews simulation results
4. If OK: make mint FILE=mint_requests.csv
5. Reports: "Completed 498/500 mints, 2 failed due to..."
```

---

## Complete Deliverables Specification

When using this skill, generate ALL of the following deliverables for a production-ready token system:

### 1. PROJECT CONFIGURATION FILES

```
project-root/
├── intake/
│   ├── PROJECT_CONTEXT.json       # Token configuration
│   └── DECISION_CONTEXT.json      # Phase 0 output
├── config/
│   ├── WEIGHTS.json               # Risk scoring weights
│   ├── ELIMINATION_RULES.json     # Auto-fail criteria
│   └── LIVE_DATA_SOURCES.md       # Data hook endpoints
```

### 2. SMART CONTRACTS (Solidity)

```
contracts/
├── token/
│   └── BackedToken.sol            # ERC-20 dumb ledger
├── policy/
│   └── SecureMintPolicy.sol       # Oracle-gated mint policy
├── oracle/
│   └── IBackingOracle.sol         # Oracle interface
├── governance/
│   ├── Governor.sol               # DAO governance
│   └── Timelock.sol               # Execution delay
├── treasury/
│   ├── TreasuryVault.sol          # Reserve custody
│   └── RedemptionEngine.sol       # Burn-to-redeem
└── emergency/
    └── EmergencyPause.sol         # Circuit breaker
```

### 3. DEPLOYMENT SCRIPTS

```
scripts/
├── deploy/
│   ├── 01_deploy_token.js
│   ├── 02_deploy_policy.js
│   ├── 03_configure_oracle.js
│   └── 04_setup_governance.js
├── verify/
│   └── verify_all.js
└── ci/
    └── monetary_routing_ci_check.py
```

### 4. ARCHITECTURE DOCUMENTATION

```
docs/architecture/
├── SYSTEM_OVERVIEW.md             # High-level architecture
├── TOKEN_MECHANICS.md             # Mint/burn flows
├── ORACLE_INTEGRATION.md          # Oracle setup guide
├── GOVERNANCE_GUIDE.md            # DAO operations
├── TREASURY_OPERATIONS.md         # Reserve management
└── EMERGENCY_PROCEDURES.md        # Incident response
```

### 5. FINANCIAL REPORTS

```
docs/financial/
├── TOKENOMICS.md                  # Supply, distribution, economics
├── RESERVE_COMPOSITION.md         # Tier breakdown, allocations
├── RISK_ASSESSMENT.md             # Threat analysis, mitigations
├── FINANCIAL_MODEL.md             # Revenue, costs, projections
└── AUDIT_READINESS.md             # Pre-audit checklist
```

### 6. WHITEPAPER (Required Output)

Generate `docs/WHITEPAPER.md` with minimum 3000 characters containing:

**Required Sections:**
1. Executive Summary (300+ chars)
2. Problem Statement (300+ chars)
3. Solution Architecture (500+ chars)
4. Token Mechanics (500+ chars)
5. Security Model (400+ chars)
6. Governance (300+ chars)
7. Economic Model with Formulas (500+ chars)
8. Roadmap (200+ chars)

**Required Formulas:**

```
HEALTH FACTOR FORMULA:
health_factor = total_backing / total_supply
Mint allowed IFF: health_factor >= 1.0

RISK SCORE FORMULA:
risk_score = Σ(metric_i × weight_i) for i in [1..12]
Tier 1: score >= 80 | Tier 2: 65-79 | Tier 3: < 65

ARBITRAGE PROFIT (Depeg Down):
profit = redemption_value - market_price - fees
When token < $1: buy → redeem → profit

COLLATERALIZATION RATIO:
CR = (collateral_value / debt_value) × 100%
Min CR for mint: 100% (or configured minimum)

YIELD DISTRIBUTION:
buyback = yield × 0.30
rewards = yield × 0.40
reserves = yield × 0.30

PEG DEVIATION THRESHOLD:
deviation = |market_price - target_price| / target_price
Yellow: > 1% | Orange: > 2% | Red: > 5%
```

### 7. CONFIGURATION FILES

```
config/
├── hardhat.config.js              # Hardhat setup
├── foundry.toml                   # Foundry setup
├── .env.example                   # Environment template
├── package.json                   # Dependencies
└── remappings.txt                 # Import remappings
```

### 8. TESTING SUITE

```
test/
├── unit/
│   ├── BackedToken.test.js
│   ├── SecureMintPolicy.test.js
│   └── Oracle.test.js
├── integration/
│   ├── MintFlow.test.js
│   └── RedemptionFlow.test.js
└── invariant/
    └── Invariants.t.sol           # Foundry invariant tests
```

### 9. CI/CD PIPELINE

```
.github/workflows/
├── test.yml                       # Run tests
├── security.yml                   # Slither + Mythril
├── monetary_routing.yml           # CI guardrail check
└── deploy.yml                     # Deployment pipeline
```

### 10. DEPENDENCY LIST

**Solidity Dependencies:**
```
@openzeppelin/contracts ^5.0.0
@chainlink/contracts ^0.8.0
```

**JavaScript Dependencies:**
```
hardhat ^2.19.0
@nomicfoundation/hardhat-toolbox
ethers ^6.0.0
dotenv
```

**Python Dependencies (CI):**
```
python >= 3.9
json (stdlib)
```

---

## Whitepaper Template Structure

When generating the whitepaper, follow this structure:

```markdown
# [TOKEN_NAME] Protocol Whitepaper

## 1. Executive Summary
[300+ characters describing the protocol purpose and value proposition]

## 2. Problem Statement
[300+ characters describing the problem being solved - unbacked stablecoins,
discretionary minting, lack of transparency]

## 3. Solution Architecture
[500+ characters describing the oracle-gated secure mint architecture,
including the multi-layer defense system]

### 3.1 Core Components
- BackedToken (ERC-20 Ledger)
- SecureMintPolicy (Oracle Gate)
- Treasury Reserve System (4 Tiers)
- Governance + Emergency Controls

### 3.2 System Flow
[Reference diagrams/MasterProtocolControlPanel.ascii]

## 4. Token Mechanics

### 4.1 Minting
Tokens are minted ONLY when ALL conditions are satisfied:
1. Oracle reports healthy
2. Backing >= required_backing(post_mint_supply)
3. Amount <= epoch_cap
4. totalSupply + amount <= global_cap
5. Contract is NOT paused
6. Caller has MINTER_ROLE

Formula: `mint_allowed = (backing >= supply + amount) AND oracle_healthy`

### 4.2 Burning / Redemption
Users can burn tokens to redeem underlying collateral:
`collateral_out = burn_amount × redemption_rate - fees`

## 5. Security Model

### 5.1 Invariants
- INV-SM-1: backing(t) >= totalSupply(t) at all times
- INV-SM-2: mint() reverts if oracle_healthy == false
- INV-SM-3: minted(epoch) <= epoch_cap
- INV-SM-4: No bypass paths exist

### 5.2 Risk Scoring
risk_score = Σ(metric_i × weight_i)

| Metric | Weight |
|--------|--------|
| Volatility | 0.15 |
| Liquidity | 0.12 |
| Oracle Deviation | 0.15 |
| TVL Exposure | 0.10 |
| Audit Score | 0.12 |
| Exploit Alerts | 0.15 |
| Correlation | 0.06 |
| Collateral Ratio | 0.10 |
| Utilization | 0.05 |

## 6. Governance

### 6.1 DAO Structure
- Token-weighted voting
- Proposal lifecycle: Discussion → Voting → Timelock → Execution
- Guardian multisig for emergency actions

### 6.2 Timelocks
| Action Type | Delay |
|-------------|-------|
| Standard | 48 hours |
| Critical | 72 hours |
| Emergency | 24 hours |

## 7. Economic Model

### 7.1 Reserve Tiers
| Tier | Name | Allocation | Liquidity |
|------|------|------------|-----------|
| T0 | Hot | 5-10% | Immediate |
| T1 | Warm | 15-25% | Hours |
| T2 | Cold | 50-60% | Days |
| T3 | RWA | 10-20% | Days-Weeks |

### 7.2 Yield Distribution
```
total_yield = Σ(tier_yield[i])
buyback_amount = total_yield × 0.30
rewards_amount = total_yield × 0.40
reserve_buffer = total_yield × 0.30
```

### 7.3 Health Factor
```
health_factor = verified_backing / total_supply
IF health_factor < 1.0: PAUSE_MINT
IF health_factor < 0.95: ALERT_GOVERNANCE
IF health_factor < 0.90: EMERGENCY_MODE
```

## 8. Roadmap

- Phase 1: Testnet deployment + audit
- Phase 2: Mainnet launch (single chain)
- Phase 3: Cross-chain expansion
- Phase 4: Advanced DeFi integrations

## Appendix A: Contract Addresses
[To be populated after deployment]

## Appendix B: Audit Reports
[To be populated after audits]

## Appendix C: References
- Modern Money Mechanics (Federal Reserve)
- Chainlink Proof of Reserve Documentation
- OpenZeppelin Security Guidelines
```
