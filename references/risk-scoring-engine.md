# Risk-Tolerance Scoring Weights Engine

## System Role

Quantitative risk analyst + blockchain infrastructure architect.

## Goal

Create a scoring system that ranks chains for production deployment using risk-tolerance driven weights.

---

## Required Inputs

Ask user if missing:

| Input | Options |
|-------|---------|
| `risk_tolerance` | low / medium / high |
| `product_type` | stablecoin_backed / emissions / cross_chain / simple_fixed / hybrid |
| `jurisdictions` | US exposure yes/no, EU exposure yes/no |
| `required_features` | [secure_mint_por, cross_chain, timelock, multisig, pause, formal_invariants] |
| `timeline` | MVP urgency low/med/high |

---

## Output Files

Generate exactly:
- `/simulation/SCORING_MODEL.md`
- `/simulation/WEIGHTS.json`
- `/simulation/SCORECARD_TEMPLATE.md`

---

## Scoring Categories (Mandatory)

Score each category 0–10:

| Category | Description |
|----------|-------------|
| `security_maturity` | Historical security track record, audit depth, response to incidents |
| `liveness_reliability` | Uptime history, finality guarantees, reorg resistance |
| `smart_contract_safety` | Language safety, formal verification support, upgrade patterns |
| `oracle_por_maturity` | Oracle ecosystem depth, Proof-of-Reserve provider availability |
| `cross_chain_risk` | Bridge security history, messaging reliability, reconciliation support |
| `governance_capture_risk` | Token concentration, voting mechanisms, timelock adoption |
| `regulatory_optics` | Legal clarity, institutional acceptance, compliance tooling |
| `tooling_maturity` | Developer tools, RPC reliability, indexer coverage |
| `audit_ecosystem_depth` | Number of qualified auditors, audit availability |
| `monitoring_observability` | Alerting tools, on-chain analytics, incident detection |
| `operational_cost_predictability` | Fee stability, gas cost patterns |
| `adoption_real_usage` | Real transaction volume (not TVL hype), stablecoin activity |

---

## Risk Tolerance Weight Profiles

Weights must sum to 1.0.

### LOW Risk Profile

Heavily weight security, liveness, regulatory, oracle/PoR:

```json
{
  "risk_tolerance": "low",
  "weights": {
    "security_maturity": 0.18,
    "liveness_reliability": 0.14,
    "smart_contract_safety": 0.12,
    "oracle_por_maturity": 0.12,
    "cross_chain_risk": 0.08,
    "governance_capture_risk": 0.08,
    "regulatory_optics": 0.10,
    "tooling_maturity": 0.06,
    "audit_ecosystem_depth": 0.05,
    "monitoring_observability": 0.04,
    "operational_cost_predictability": 0.02,
    "adoption_real_usage": 0.01
  }
}
```

### MEDIUM Risk Profile

Balanced approach:

```json
{
  "risk_tolerance": "medium",
  "weights": {
    "security_maturity": 0.15,
    "liveness_reliability": 0.12,
    "smart_contract_safety": 0.10,
    "oracle_por_maturity": 0.10,
    "cross_chain_risk": 0.08,
    "governance_capture_risk": 0.07,
    "regulatory_optics": 0.09,
    "tooling_maturity": 0.08,
    "audit_ecosystem_depth": 0.06,
    "monitoring_observability": 0.05,
    "operational_cost_predictability": 0.05,
    "adoption_real_usage": 0.05
  }
}
```

### HIGH Risk Profile

More weight on cost + growth, but never below minimum security:

```json
{
  "risk_tolerance": "high",
  "weights": {
    "security_maturity": 0.15,
    "liveness_reliability": 0.10,
    "smart_contract_safety": 0.08,
    "oracle_por_maturity": 0.08,
    "cross_chain_risk": 0.06,
    "governance_capture_risk": 0.05,
    "regulatory_optics": 0.08,
    "tooling_maturity": 0.10,
    "audit_ecosystem_depth": 0.05,
    "monitoring_observability": 0.05,
    "operational_cost_predictability": 0.10,
    "adoption_real_usage": 0.10
  }
}
```

---

## Absolute Minimums (Guardrails)

Regardless of `risk_tolerance`, these minimums MUST be enforced:

| Guardrail | Minimum Weight |
|-----------|----------------|
| `security_maturity` | >= 0.15 |
| `liveness_reliability` | >= 0.10 |
| `regulatory_optics` | >= 0.08 |

### Product-Type Overrides

| Product Type | Override |
|--------------|----------|
| `stablecoin_backed` | `oracle_por_maturity` >= 0.15 |
| `cross_chain` | `cross_chain_risk` >= 0.12 |

---

## Scoring Method

1. **Score each category 0–10**
2. **Calculate weighted score:** `Σ(score_i × weight_i)`
3. **Normalize to 0–100**
4. **Apply tier thresholds:**

| Tier | Score Range | Recommendation |
|------|-------------|----------------|
| Tier 1 | >= 80 | Best production fit |
| Tier 2 | 65–79 | Acceptable with constraints |
| Tier 3 | < 65 | Avoid / experimental only |

---

## WEIGHTS.json Schema

```json
{
  "version": "1.0",
  "risk_profiles": {
    "low": { "weights": { ... } },
    "medium": { "weights": { ... } },
    "high": { "weights": { ... } }
  },
  "product_type_overrides": {
    "stablecoin_backed": {
      "oracle_por_maturity": { "min_weight": 0.15 }
    },
    "cross_chain": {
      "cross_chain_risk": { "min_weight": 0.12 }
    }
  },
  "absolute_minimums": {
    "security_maturity": 0.15,
    "liveness_reliability": 0.10,
    "regulatory_optics": 0.08
  },
  "tier_thresholds": {
    "tier_1": 80,
    "tier_2": 65,
    "tier_3": 0
  }
}
```

---

## SCORECARD_TEMPLATE.md

```markdown
# Chain Scorecard: [CHAIN_NAME]

**Date:** [DATE]
**Risk Tolerance:** [low/medium/high]
**Product Type:** [product_type]

## Scores

| Category | Score (0-10) | Weight | Weighted |
|----------|--------------|--------|----------|
| security_maturity | | | |
| liveness_reliability | | | |
| smart_contract_safety | | | |
| oracle_por_maturity | | | |
| cross_chain_risk | | | |
| governance_capture_risk | | | |
| regulatory_optics | | | |
| tooling_maturity | | | |
| audit_ecosystem_depth | | | |
| monitoring_observability | | | |
| operational_cost_predictability | | | |
| adoption_real_usage | | | |

## Total Score

**Weighted Score:** [X] / 10
**Normalized Score:** [X] / 100
**Tier:** [1/2/3]

## Evidence

[Links to sources, data snapshots, audit reports]

## Verdict

[ ] RECOMMENDED
[ ] CONDITIONAL (requires mitigations)
[ ] AVOID
```

---

## SCORING_MODEL.md Template

```markdown
# Scoring Model Documentation

## Category Definitions

### security_maturity
**How to score:**
- 9-10: No major exploits, multiple audits, mature security culture
- 7-8: Minor incidents, good response, regular audits
- 5-6: Some incidents, improving security practices
- 3-4: Notable exploits, slow response
- 0-2: Major ongoing security concerns

[Repeat for all 12 categories]

## Example Scorecards

### Example: Ethereum L1 (LOW risk profile)
[Include illustrative scoring]

### Example: [L2 Chain] (MEDIUM risk profile)
[Include illustrative scoring]

### Example: [Emerging Chain] (HIGH risk profile)
[Include illustrative scoring]
```

---

## Integration

This engine outputs to:
- `MarketIntelligenceEngine` (Phase 0)
- `AutoEliminationEngine` (uses scores for threshold checks)
- `DECISION_CONTEXT.json` (final chain rankings)
