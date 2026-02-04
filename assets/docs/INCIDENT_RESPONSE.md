# SecureMint Engine Incident Response Playbook

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-01 | Security Team | Initial playbook |
| 1.1 | 2024-06-01 | Security Team | Added runbooks |

---

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Response Team](#response-team)
3. [Detection & Alerting](#detection--alerting)
4. [Response Procedures](#response-procedures)
5. [Runbooks](#runbooks)
6. [Communication Templates](#communication-templates)
7. [Post-Incident](#post-incident)

---

## Incident Classification

### Severity Levels

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|----------|
| SEV-1 | Critical | Active exploit, funds at risk | < 15 min | Oracle manipulation, unauthorized minting |
| SEV-2 | High | Potential exploit, elevated risk | < 1 hour | Backing discrepancy, unusual mint patterns |
| SEV-3 | Medium | Degraded service, no fund risk | < 4 hours | Oracle staleness, rebalancing failure |
| SEV-4 | Low | Minor issues, informational | < 24 hours | Performance degradation, monitoring gaps |

### Classification Criteria

**SEV-1 Triggers:**
- [ ] Invariant violation detected (INV-SM-1, 2, 3, or 4)
- [ ] Unauthorized transaction execution
- [ ] Oracle returning manipulated data
- [ ] Treasury balance mismatch > 0.1%
- [ ] Active on-chain exploit in progress

**SEV-2 Triggers:**
- [ ] Unusual minting patterns (>50% epoch capacity in 1 hour)
- [ ] Oracle deviation > 2% from reference
- [ ] Failed health checks > 3 consecutive
- [ ] Governance proposal with malicious parameters

**SEV-3 Triggers:**
- [ ] Oracle staleness approaching threshold
- [ ] Tier rebalancing delayed
- [ ] Subgraph indexing behind
- [ ] Dashboard connectivity issues

---

## Response Team

### On-Call Rotation

| Role | Primary | Secondary | Escalation |
|------|---------|-----------|------------|
| Incident Commander | @security-lead | @cto | @ceo |
| Smart Contract Lead | @solidity-lead | @auditor | @security-lead |
| Infrastructure Lead | @devops-lead | @sre | @cto |
| Communications Lead | @comms | @legal | @ceo |

### Contact Information

```
EMERGENCY HOTLINE: +1-XXX-XXX-XXXX
SLACK CHANNEL: #incident-response
PAGERDUTY: securemint-critical
```

### RACI Matrix

| Activity | IC | SC Lead | Infra | Comms |
|----------|-----|---------|-------|-------|
| Incident Declaration | A | C | C | I |
| Technical Assessment | C | R | C | I |
| Emergency Pause | A | R | C | I |
| Fix Development | I | R | C | I |
| Fix Deployment | A | R | R | I |
| User Communication | C | I | I | R |
| Post-Mortem | A | R | R | C |

*R=Responsible, A=Accountable, C=Consulted, I=Informed*

---

## Detection & Alerting

### Automated Alerts

| Alert | Threshold | Channel | Severity |
|-------|-----------|---------|----------|
| Solvency Violation | `supply > backing` | PagerDuty + Slack | SEV-1 |
| Rate Limit Breach | `epochMint > capacity` | PagerDuty + Slack | SEV-1 |
| Oracle Stale | `age > threshold` | Slack | SEV-2 |
| Emergency Triggered | `level >= EMERGENCY` | PagerDuty + Slack | SEV-1 |
| Large Mint | `amount > 10% capacity` | Slack | SEV-3 |
| Backing Drop | `drop > 5% in 1h` | Slack | SEV-2 |
| Treasury Mismatch | `diff > 0.1%` | PagerDuty | SEV-2 |

### Manual Detection

Daily security review checklist:
- [ ] Review all mint transactions > $100K
- [ ] Verify oracle sources are responding
- [ ] Check governance proposals queue
- [ ] Audit access control changes
- [ ] Review subgraph sync status

---

## Response Procedures

### Phase 1: Detection (0-5 minutes)

```
┌─────────────────────────────────────────────────────────┐
│                    ALERT RECEIVED                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  1. Acknowledge alert in PagerDuty/Slack                │
│  2. Join incident channel: #incident-YYYY-MM-DD-XXX     │
│  3. Initial assessment (< 2 min):                       │
│     - Is this a real incident or false positive?        │
│     - What is the immediate impact?                     │
│     - Are funds currently at risk?                      │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: Triage (5-15 minutes)

```
┌─────────────────────────────────────────────────────────┐
│                   CLASSIFY SEVERITY                      │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │  SEV-1  │    │  SEV-2  │    │ SEV-3/4 │
      │ CRITICAL│    │  HIGH   │    │ MEDIUM  │
      └────┬────┘    └────┬────┘    └────┬────┘
           │               │               │
           ▼               ▼               ▼
   Emergency Pause   Elevated       Normal
   All Hands         Monitoring     Response
```

### Phase 3: Containment (15-60 minutes)

**For SEV-1 (Critical):**

```bash
# IMMEDIATE: Trigger Emergency Pause
# Only Guardian or Admin can execute

cast send $EMERGENCY_PAUSE "setLevel(uint8)" 3 \
  --private-key $GUARDIAN_KEY \
  --rpc-url $RPC_URL

# Verify pause is active
cast call $EMERGENCY_PAUSE "currentLevel()" --rpc-url $RPC_URL
# Should return: 3 (EMERGENCY) or 4 (SHUTDOWN)
```

**For SEV-2 (High):**

```bash
# Increase monitoring frequency
# Prepare emergency pause transaction (don't execute yet)

# Check current state
cast call $POLICY "epochMintedAmount(uint256)" $(cast call $POLICY "currentEpoch()") \
  --rpc-url $RPC_URL

# Monitor oracle freshness
cast call $ORACLE "isStale()" --rpc-url $RPC_URL
```

### Phase 4: Eradication (1-24 hours)

1. **Root Cause Analysis**
   - Review transaction traces
   - Analyze contract state changes
   - Identify attack vector

2. **Fix Development**
   - Develop and test fix
   - Internal security review
   - Prepare upgrade transaction

3. **Fix Verification**
   - Deploy to testnet
   - Run full test suite
   - External review if time permits

### Phase 5: Recovery (1-48 hours)

```
┌─────────────────────────────────────────────────────────┐
│                   RECOVERY CHECKLIST                     │
└─────────────────────────────────────────────────────────┘

□ Fix deployed and verified on mainnet
□ Emergency pause lifted (level set to NORMAL)
□ All invariants verified:
  □ INV-SM-1: totalSupply <= backing
  □ INV-SM-2: epochMinted <= epochCapacity
  □ INV-SM-3: Oracle not stale
  □ INV-SM-4: Emergency level = NORMAL
□ Monitoring confirmed operational
□ User communication sent
□ Post-mortem scheduled
```

---

## Runbooks

### Runbook: Emergency Pause Activation

**When to use:** Active exploit detected, immediate fund protection needed.

```bash
#!/bin/bash
# runbook-emergency-pause.sh

echo "=== SecureMint Emergency Pause Activation ==="

# Configuration
EMERGENCY_PAUSE="0x..."  # EmergencyPause contract address
GUARDIAN_KEY="..."       # Guardian private key (secure storage)
RPC_URL="https://eth-mainnet.g.alchemy.com/v2/..."

# Step 1: Check current level
echo "Current emergency level:"
cast call $EMERGENCY_PAUSE "currentLevel()" --rpc-url $RPC_URL

# Step 2: Activate EMERGENCY level (3)
echo "Activating EMERGENCY level..."
TX_HASH=$(cast send $EMERGENCY_PAUSE "setLevel(uint8)" 3 \
  --private-key $GUARDIAN_KEY \
  --rpc-url $RPC_URL \
  --json | jq -r '.transactionHash')

echo "Transaction: $TX_HASH"

# Step 3: Verify activation
sleep 15
NEW_LEVEL=$(cast call $EMERGENCY_PAUSE "currentLevel()" --rpc-url $RPC_URL)
echo "New emergency level: $NEW_LEVEL"

if [ "$NEW_LEVEL" == "0x03" ]; then
  echo "✅ Emergency pause activated successfully"
else
  echo "❌ WARNING: Emergency pause may not be active!"
fi

# Step 4: Notify team
# curl -X POST $SLACK_WEBHOOK -d '{"text":"🚨 EMERGENCY PAUSE ACTIVATED"}'
```

### Runbook: Oracle Health Check

**When to use:** Suspected oracle manipulation or staleness.

```bash
#!/bin/bash
# runbook-oracle-health.sh

echo "=== Oracle Health Check ==="

ORACLE="0x..."
RPC_URL="https://eth-mainnet.g.alchemy.com/v2/..."

# Check staleness
echo "Oracle staleness status:"
cast call $ORACLE "isStale()" --rpc-url $RPC_URL

# Check last update time
LAST_UPDATE=$(cast call $ORACLE "lastUpdateTime()" --rpc-url $RPC_URL)
echo "Last update timestamp: $LAST_UPDATE"

# Check current backing
BACKING=$(cast call $ORACLE "latestBacking()" --rpc-url $RPC_URL)
echo "Current backing: $BACKING"

# Compare with reference (e.g., Chainlink PoR)
# REFERENCE=$(curl -s "https://api.chain.link/..." | jq -r '.data.result')
# echo "Reference backing: $REFERENCE"

# Calculate deviation
# DEVIATION=$((($BACKING - $REFERENCE) * 100 / $REFERENCE))
# echo "Deviation: ${DEVIATION}%"
```

### Runbook: Invariant Verification

**When to use:** Post-incident verification, daily health check.

```bash
#!/bin/bash
# runbook-verify-invariants.sh

echo "=== Invariant Verification ==="

TOKEN="0x..."
POLICY="0x..."
ORACLE="0x..."
EMERGENCY="0x..."
RPC_URL="https://eth-mainnet.g.alchemy.com/v2/..."

# INV-SM-1: Solvency
SUPPLY=$(cast call $TOKEN "totalSupply()" --rpc-url $RPC_URL)
BACKING=$(cast call $ORACLE "latestBacking()" --rpc-url $RPC_URL)

if [ "$SUPPLY" -le "$BACKING" ]; then
  echo "✅ INV-SM-1 (Solvency): PASS - Supply ($SUPPLY) <= Backing ($BACKING)"
else
  echo "❌ INV-SM-1 (Solvency): FAIL - Supply ($SUPPLY) > Backing ($BACKING)"
  exit 1
fi

# INV-SM-2: Rate Limit
EPOCH=$(cast call $POLICY "currentEpoch()" --rpc-url $RPC_URL)
MINTED=$(cast call $POLICY "epochMintedAmount(uint256)" $EPOCH --rpc-url $RPC_URL)
CAPACITY=$(cast call $POLICY "epochCapacity()" --rpc-url $RPC_URL)

if [ "$MINTED" -le "$CAPACITY" ]; then
  echo "✅ INV-SM-2 (Rate Limit): PASS - Minted ($MINTED) <= Capacity ($CAPACITY)"
else
  echo "❌ INV-SM-2 (Rate Limit): FAIL - Minted ($MINTED) > Capacity ($CAPACITY)"
  exit 1
fi

# INV-SM-3: Oracle Freshness
IS_STALE=$(cast call $ORACLE "isStale()" --rpc-url $RPC_URL)

if [ "$IS_STALE" == "false" ]; then
  echo "✅ INV-SM-3 (Freshness): PASS - Oracle is fresh"
else
  echo "⚠️ INV-SM-3 (Freshness): WARNING - Oracle is stale"
fi

# INV-SM-4: Emergency Status
LEVEL=$(cast call $EMERGENCY "currentLevel()" --rpc-url $RPC_URL)

if [ "$LEVEL" -lt "3" ]; then
  echo "✅ INV-SM-4 (Emergency): PASS - Level ($LEVEL) < EMERGENCY"
else
  echo "⚠️ INV-SM-4 (Emergency): ACTIVE - Level ($LEVEL) >= EMERGENCY"
fi

echo ""
echo "=== All invariants checked ==="
```

---

## Communication Templates

### Template: Initial Incident Notification (Internal)

```
🚨 INCIDENT DECLARED: [SEV-X] [Brief Description]

Time: [YYYY-MM-DD HH:MM UTC]
Incident Commander: @[name]
Channel: #incident-YYYY-MM-DD-XXX

Initial Assessment:
- Impact: [Description]
- Users Affected: [Estimate]
- Funds at Risk: [Yes/No - Amount if yes]

Current Status: [INVESTIGATING/CONTAINED/MITIGATING]

Next Update: [Time]
```

### Template: User Communication (SEV-1)

```
Subject: [URGENT] SecureMint Security Notice

Dear SecureMint Users,

We have detected unusual activity in our smart contracts and have
temporarily paused the protocol as a precautionary measure.

Current Status: Protocol Paused
User Funds: Secured
Estimated Recovery: [Time estimate or "Under investigation"]

What This Means:
- Minting is temporarily disabled
- Redemptions are temporarily disabled
- Existing token holdings are unaffected

We are working with security partners to investigate and will
provide updates every [X] hours.

No action is required from users at this time.

For questions: security@securemint.io
Status page: https://status.securemint.io

The SecureMint Team
```

### Template: Post-Incident Update

```
Subject: SecureMint Incident Resolved - Post-Mortem Available

Dear SecureMint Users,

The security incident reported on [DATE] has been fully resolved.

Summary:
- Duration: [Start time] to [End time] ([X] hours)
- Impact: [Description]
- Funds Lost: [Amount or "None"]
- Root Cause: [Brief description]

Actions Taken:
1. [Action 1]
2. [Action 2]
3. [Action 3]

Preventive Measures:
- [Measure 1]
- [Measure 2]

Full post-mortem: [Link]

We apologize for any inconvenience and thank our community for
their patience.

The SecureMint Team
```

---

## Post-Incident

### Post-Mortem Template

```markdown
# Post-Mortem: [Incident Title]

## Metadata
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: SEV-X
- **Author**: [Name]
- **Reviewers**: [Names]

## Summary
[2-3 sentence summary of what happened]

## Timeline (UTC)
| Time | Event |
|------|-------|
| HH:MM | First alert triggered |
| HH:MM | Incident declared |
| HH:MM | Emergency pause activated |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Service restored |

## Impact
- Users affected: [Number]
- Funds at risk: [Amount]
- Funds lost: [Amount]
- Reputation impact: [Assessment]

## Root Cause
[Detailed technical explanation]

## Detection
- How was this detected?
- Could we have detected it sooner?
- What monitoring gaps existed?

## Response
- What went well?
- What could have been better?
- Were runbooks effective?

## Action Items
| Priority | Action | Owner | Due Date |
|----------|--------|-------|----------|
| P0 | [Action] | @name | YYYY-MM-DD |
| P1 | [Action] | @name | YYYY-MM-DD |

## Lessons Learned
1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]
```

### Incident Metrics

Track and review quarterly:
- Mean Time to Detect (MTTD)
- Mean Time to Respond (MTTR)
- Mean Time to Resolve (MTTR)
- Incident frequency by severity
- False positive rate
- Runbook effectiveness

---

*This playbook should be reviewed and updated quarterly. Last review: [DATE]*
