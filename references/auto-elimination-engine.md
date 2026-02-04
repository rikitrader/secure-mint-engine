# Auto-Elimination Logic Engine

## System Role

Security-first selection gate designer.

## Goal

Create programmatic elimination rules that automatically fail chains/tools that cannot meet the project's chosen money mechanics, security thresholds, or regulatory posture.

---

## Output Files

Generate exactly:
- `/simulation/ELIMINATION_RULES.md`
- `/simulation/ELIMINATION_RULES.json`
- `/simulation/ELIMINATION_REPORT_TEMPLATE.md`
- `/simulation/AutoEliminationEngine.skill.md`

---

## Elimination Rule Types

| Type | Description | Action |
|------|-------------|--------|
| **HARD FAIL** | Immediate reject, no exceptions | Block from recommended_chains |
| **CONDITIONAL FAIL** | Reject unless mitigation plan exists | Require mitigation documentation |
| **WATCHLIST** | Allowed but flagged for monitoring | Add warning to report |

---

## Required HARD FAIL Rules

### Rule: Backed Token Without PoR

```json
{
  "rule_id": "HF-001",
  "severity": "hard_fail",
  "condition": "product_type == 'stablecoin_backed' AND oracle_por_maturity == 'none'",
  "rationale": "Backed tokens MUST have Proof-of-Reserve capability. Without PoR, backing cannot be cryptographically enforced.",
  "triggered_modules": ["SecureMintEngine"]
}
```

### Rule: Unbounded Mint Path

```json
{
  "rule_id": "HF-002",
  "severity": "hard_fail",
  "condition": "minting_required == true AND (unbounded_mint_exists == true OR admin_bypass_exists == true)",
  "rationale": "Any unbounded mint or admin bypass path is a FATAL flaw. Follow-the-Money doctrine prohibits this.",
  "triggered_modules": ["SecureMintEngine", "MonetaryFormalVerificationEngine"]
}
```

### Rule: Cross-Chain Without Reconciliation

```json
{
  "rule_id": "HF-003",
  "severity": "hard_fail",
  "condition": "cross_chain_required == true AND supply_reconciliation_capability == false",
  "rationale": "Cross-chain tokens require supply reconciliation to maintain global supply invariant.",
  "triggered_modules": ["CrossChainEngine"]
}
```

### Rule: Excessive Outages (LOW Risk)

```json
{
  "rule_id": "HF-004",
  "severity": "hard_fail",
  "condition": "risk_tolerance == 'low' AND outage_count_90d > 2",
  "rationale": "Low risk tolerance cannot accept chains with frequent outages.",
  "triggered_modules": ["MarketIntelligenceEngine"]
}
```

### Rule: Major Exploit Losses

```json
{
  "rule_id": "HF-005",
  "severity": "hard_fail",
  "condition": "exploit_loss_usd_12m > threshold_by_risk_tolerance",
  "thresholds": {
    "low": 10000000,
    "medium": 50000000,
    "high": 100000000
  },
  "rationale": "Chains with major exploit losses indicate systemic security issues.",
  "triggered_modules": ["MarketIntelligenceEngine"]
}
```

### Rule: Regulatory Red Line

```json
{
  "rule_id": "HF-006",
  "severity": "hard_fail",
  "condition": "regulatory_red_lines INTERSECT chain.regulatory_issues != EMPTY",
  "rationale": "Regulatory constraints are non-negotiable for compliance.",
  "triggered_modules": ["MarketIntelligenceEngine"]
}
```

---

## Required CONDITIONAL FAIL Rules

### Rule: High Governance Capture Risk

```json
{
  "rule_id": "CF-001",
  "severity": "conditional_fail",
  "condition": "governance_capture_risk == 'high'",
  "required_mitigation": "Implement timelock + multisig + emergency pause. Document governance risk acceptance.",
  "evidence_required": ["timelock_config", "multisig_setup", "pause_mechanism", "risk_acceptance_sign_off"],
  "triggered_modules": ["DAOGate"]
}
```

### Rule: Medium Tooling Maturity

```json
{
  "rule_id": "CF-002",
  "severity": "conditional_fail",
  "condition": "tooling_maturity == 'medium' AND timeline != 'low'",
  "required_mitigation": "Extend timeline to allow for additional engineering. Document tooling gaps and workarounds.",
  "evidence_required": ["tooling_gap_analysis", "engineering_plan", "timeline_adjustment"],
  "triggered_modules": ["MarketIntelligenceEngine"]
}
```

### Rule: Lock-and-Mint Bridge

```json
{
  "rule_id": "CF-003",
  "severity": "conditional_fail",
  "condition": "cross_chain_pattern == 'lock_and_mint'",
  "required_mitigation": "Document why burn-and-mint is not possible. Implement heavy monitoring + circuit breakers for lockbox.",
  "evidence_required": ["burn_mint_infeasibility_analysis", "lockbox_monitoring_plan", "circuit_breaker_config"],
  "triggered_modules": ["CrossChainEngine", "SecureMintEngine"]
}
```

### Rule: Moderate Outages (MEDIUM Risk)

```json
{
  "rule_id": "CF-004",
  "severity": "conditional_fail",
  "condition": "risk_tolerance == 'medium' AND outage_count_90d > 1",
  "required_mitigation": "Implement fallback procedures for chain downtime. Document SLA expectations.",
  "evidence_required": ["downtime_procedures", "sla_documentation"],
  "triggered_modules": ["MarketIntelligenceEngine"]
}
```

---

## WATCHLIST Rules

### Rule: Emerging Chain

```json
{
  "rule_id": "WL-001",
  "severity": "watchlist",
  "condition": "chain_age_months < 12 OR mainnet_launch_date < 12_months_ago",
  "warning": "Emerging chain with limited production history. Monitor closely.",
  "triggered_modules": ["MarketIntelligenceEngine"]
}
```

### Rule: Single Oracle Provider

```json
{
  "rule_id": "WL-002",
  "severity": "watchlist",
  "condition": "oracle_providers_count == 1",
  "warning": "Single oracle provider creates concentration risk. Consider multi-oracle when possible.",
  "triggered_modules": ["SecureMintEngine"]
}
```

---

## ELIMINATION_RULES.json Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EliminationRules",
  "type": "object",
  "properties": {
    "version": { "type": "string" },
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rule_id", "severity", "condition", "rationale"],
        "properties": {
          "rule_id": {
            "type": "string",
            "pattern": "^(HF|CF|WL)-\\d{3}$"
          },
          "severity": {
            "type": "string",
            "enum": ["hard_fail", "conditional_fail", "watchlist"]
          },
          "condition": {
            "type": "string",
            "description": "Boolean expression using DECISION_CONTEXT and live data fields"
          },
          "rationale": {
            "type": "string"
          },
          "required_mitigation": {
            "type": "string",
            "description": "Required for conditional_fail rules"
          },
          "evidence_required": {
            "type": "array",
            "items": { "type": "string" }
          },
          "triggered_modules": {
            "type": "array",
            "items": { "type": "string" }
          },
          "thresholds": {
            "type": "object",
            "description": "Risk-tolerance specific thresholds"
          }
        }
      }
    }
  }
}
```

---

## AutoEliminationEngine Workflow

### Inputs

1. `DECISION_CONTEXT.json`
2. `LIVE_DATA_SCHEMA` snapshot (if present)
3. `ELIMINATION_RULES.json`
4. User's `risk_tolerance` and `product_type`

### Process

```
1. Load DECISION_CONTEXT.json
2. Load LIVE_DATA snapshot (optional, use cached if unavailable)
3. Load ELIMINATION_RULES.json
4. For each rule:
   a. Evaluate condition against context + live data
   b. If triggered:
      - HARD_FAIL: Add to rejected_chains[]
      - CONDITIONAL_FAIL: Add to conditional_chains[] with required_mitigations
      - WATCHLIST: Add to watchlist[] with warning
5. Validate no HARD_FAIL chains in recommended_chains
6. Generate ELIMINATION_REPORT.md
7. Return exit code (0 = pass, 1 = fail)
```

### Outputs

```json
{
  "rejected_chains": [
    {
      "chain_id": "string",
      "rules_triggered": ["HF-001", "HF-002"],
      "reasons": ["string"]
    }
  ],
  "conditional_chains": [
    {
      "chain_id": "string",
      "rules_triggered": ["CF-001"],
      "required_mitigations": ["string"],
      "evidence_required": ["string"]
    }
  ],
  "watchlist": [
    {
      "chain_id": "string",
      "rules_triggered": ["WL-001"],
      "warnings": ["string"]
    }
  ],
  "approved_chains": ["string"],
  "report_path": "/simulation/ELIMINATION_REPORT.md",
  "exit_code": 0
}
```

---

## ELIMINATION_REPORT_TEMPLATE.md

```markdown
# Chain Elimination Report

**Generated:** [TIMESTAMP]
**Risk Tolerance:** [RISK_TOLERANCE]
**Product Type:** [PRODUCT_TYPE]

## Summary

| Category | Count |
|----------|-------|
| Rejected (HARD FAIL) | [N] |
| Conditional (Require Mitigation) | [N] |
| Watchlist (Flagged) | [N] |
| Approved | [N] |

## Rejected Chains

### [CHAIN_NAME]

**Rules Triggered:**
- [RULE_ID]: [RATIONALE]

**Reason:** [DETAILED_REASON]

**Action:** BLOCKED from deployment

---

## Conditional Chains

### [CHAIN_NAME]

**Rules Triggered:**
- [RULE_ID]: [RATIONALE]

**Required Mitigations:**
1. [MITIGATION_1]
2. [MITIGATION_2]

**Evidence Required:**
- [ ] [EVIDENCE_1]
- [ ] [EVIDENCE_2]

**Action:** May proceed ONLY after mitigations documented

---

## Watchlist

### [CHAIN_NAME]

**Warnings:**
- [WARNING_1]

**Action:** Monitor closely during deployment

---

## Approved Chains

- [CHAIN_1]
- [CHAIN_2]

---

## CI Gate Status

**PASS / FAIL**

[Details of CI check results]
```

---

## CI Integration

### CI Check Script

Add to CI pipeline:

```bash
python3 scripts/auto_elimination_check.py
```

### Failure Conditions

| Condition | Result |
|-----------|--------|
| Any HARD_FAIL chain in `recommended_chains` | CI FAIL |
| `stablecoin_backed` without `SecureMint` route | CI FAIL |
| `cross_chain_required` without reconciliation artifacts | CI FAIL |
| CONDITIONAL chains without mitigation documentation | CI FAIL |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | HARD FAIL detected |
| 2 | Missing mitigation documentation |
| 3 | Configuration error |
