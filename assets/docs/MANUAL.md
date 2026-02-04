# SecureMint Engine - Complete Production Manual

## Table of Contents

- [0. Executive Overview](#0-executive-overview)
- [1. Glossary + Concepts](#1-glossary--concepts)
- [2. Quick Start (10-15 minutes)](#2-quick-start-10-15-minutes)
- [3. Full User Manual](#3-full-user-manual)
- [4. Permissions & Security Model](#4-permissions--security-model)
- [5. Data Model](#5-data-model)
- [6. Integrations Manual](#6-integrations-manual)
- [7. Task System Manual](#7-task-system-manual)
- [8. THE INTAKE COMMAND](#8-the-intake-command)
- [9. Preflight Checks](#9-preflight-checks)
- [10. QA Pack](#10-qa-pack)
- [11. Troubleshooting + Runbook](#11-troubleshooting--runbook)
- [12. FAQ + Examples Library](#12-faq--examples-library)
- [13. Pre-Launch Readiness Checklist](#13-pre-launch-readiness-checklist)

---

## 0. Executive Overview

### What SecureMint Engine Does

SecureMint Engine is a production-grade oracle-gated token minting system for blockchain applications. It enforces the **"follow-the-money" doctrine**: tokens can ONLY be minted when backing is provably sufficient via on-chain oracles or Proof-of-Reserve feeds.

### Who It's For

| Persona | Description |
|---------|-------------|
| **Token Issuers** | Companies issuing stablecoins, asset-backed tokens, or RWA tokens |
| **DeFi Architects** | Developers building protocols requiring collateralized minting |
| **Security Auditors** | Teams reviewing smart contract security |
| **DevOps Engineers** | Personnel deploying and maintaining the infrastructure |
| **Compliance Officers** | Staff ensuring regulatory requirements are met |

### Problems Solved

1. **Unbacked Token Issuance** → Prevents minting without sufficient collateral
2. **Oracle Manipulation** → Multi-oracle aggregation with staleness checks
3. **Flash Loan Attacks** → Epoch-based rate limiting
4. **Rug Pull Risk** → Timelocked governance, multi-sig requirements
5. **Regulatory Non-Compliance** → Built-in KYC/AML hooks and audit trails

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECUREMINT ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   EXTERNAL  │    │   ORACLE    │    │   POLICY    │    │    TOKEN    │  │
│  │   BACKING   │───▶│   LAYER     │───▶│   ENGINE    │───▶│   MINTING   │  │
│  │   (Assets)  │    │ (Chainlink) │    │ (Invariants)│    │   (ERC-20)  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         │                  ▼                  ▼                  ▼          │
│         │          ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│         │          │  TREASURY   │    │  EMERGENCY  │    │ REDEMPTION  │   │
│         └─────────▶│   VAULT     │    │   PAUSE     │    │   ENGINE    │   │
│                    │  (4-Tier)   │    │ (5-Level)   │    │   (Queue)   │   │
│                    └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  SDK (TypeScript/React/Mobile) │ API Gateway │ Subgraph │ Python Engine    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Infrastructure: Docker │ Kubernetes │ Terraform │ Prometheus │ Grafana    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Invariants (INV-SM-*)

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-SM-1 | `totalSupply ≤ backing` | Solvency: never mint more than backing |
| INV-SM-2 | `epochMinted ≤ epochCapacity` | Rate limiting: cap per epoch |
| INV-SM-3 | `oracle.timestamp + stalenessThreshold ≥ block.timestamp` | Freshness: reject stale data |
| INV-SM-4 | `paused → no operations` | Emergency: full halt when paused |

---

## 1. Glossary + Concepts

### Core Terms

| Term | Definition |
|------|------------|
| **Backing** | Real-world or on-chain assets that collateralize minted tokens |
| **Backing Ratio** | `totalBacking / totalSupply` - must be ≥ 100% |
| **Chainlink PoR** | Proof-of-Reserve feed providing off-chain asset attestation |
| **Collateralization** | Ratio of backing assets to token liabilities |
| **Epoch** | Time window (default: 1 hour) for rate limiting |
| **Guardian** | Role authorized to trigger emergency pause |
| **Invariant** | System property that must ALWAYS be true |
| **Minter** | Role authorized to call mint functions |
| **Oracle** | External data feed providing price/backing information |
| **Staleness Threshold** | Maximum age of oracle data before rejection (default: 1 hour) |

### Smart Contract Roles

| Role | Permissions | Typical Holder |
|------|-------------|----------------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke all roles | Gnosis Safe |
| `MINTER_ROLE` | Call `mint()` | Policy Contract |
| `GUARDIAN_ROLE` | Trigger pause levels 1-3 | Security EOA |
| `ORACLE_UPDATER_ROLE` | Update oracle sources | Chainlink Keeper |
| `GOVERNOR_ROLE` | Execute governance proposals | Timelock |

### Pause Levels

| Level | Name | Effect | Who Can Trigger |
|-------|------|--------|-----------------|
| 0 | Normal | All operations enabled | - |
| 1 | Caution | Minting rate halved | Guardian |
| 2 | Warning | New mints paused | Guardian |
| 3 | Critical | Mints + transfers paused | Guardian |
| 4 | Emergency | All operations frozen | Admin (multi-sig) |
| 5 | Recovery | Controlled recovery mode | Governance |

---

## 2. Quick Start (10-15 minutes)

### Prerequisites

| Requirement | Minimum Version | Verify Command |
|-------------|-----------------|----------------|
| Node.js | 18.x | `node --version` |
| npm/pnpm | 8.x / 8.x | `npm --version` |
| Foundry | Latest | `forge --version` |
| Git | 2.x | `git --version` |
| Docker | 24.x | `docker --version` |

### Step 1: Clone and Install (3 minutes)

```bash
# Clone the repository
git clone https://github.com/your-org/securemint-engine.git
cd securemint-engine/assets

# Run setup command
make setup
```

### Step 2: Configure Environment (2 minutes)

```bash
# Copy environment template
cp .env.example .env

# Edit required values
nano .env
```

**Minimum Required Variables:**
```env
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL_LOCAL=http://localhost:8545
RPC_URL_SEPOLIA=https://sepolia.infura.io/v3/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

### Step 3: Start Local Development (2 minutes)

```bash
# Start Docker environment
make dev

# In another terminal, start local Hardhat node
make dev-local
```

### Step 4: Deploy Contracts Locally (2 minutes)

```bash
make dev-deploy-local
```

### Step 5: Run First Mint (3 minutes)

```bash
npx ts-node examples/cli/sdk-usage.ts
```

### Step 6: Verify Setup (1 minute)

```bash
make check
```

---

## 3. Full User Manual

### 3.1 Token Minting

**Prerequisites:**
- `MINTER_ROLE` granted to caller
- Sufficient backing in treasury
- Oracle data fresh (< staleness threshold)
- Epoch rate limit not exceeded
- System not paused (level < 2)

**Step-by-Step:**

```typescript
import { SecureMintSDK } from '@securemint/sdk';

const sdk = new SecureMintSDK({ /* config */ });

// 1. Check eligibility
const eligibility = await sdk.policy.checkMintEligibility(amount, recipient);
if (!eligibility.canMint) {
  console.error('Cannot mint:', eligibility.reason);
  return;
}

// 2. Simulate
const simulation = await sdk.policy.simulateMint(amount, recipient);
console.log('Estimated gas:', simulation.gasEstimate);

// 3. Execute
const tx = await sdk.policy.mint(amount, recipient);
const receipt = await tx.wait();

// 4. Verify
const newSupply = await sdk.token.totalSupply();
```

**Common Errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `AccessControl: account missing role` | No MINTER_ROLE | Grant role via admin |
| `OracleStale(timestamp, threshold)` | Stale oracle data | Wait for oracle update |
| `EpochCapacityExceeded(minted, capacity)` | Rate limit hit | Wait for next epoch |
| `InsufficientBacking(required, available)` | Not enough backing | Add backing or reduce amount |
| `Paused(currentLevel)` | System paused | Wait for resume |

### 3.2 Emergency Pause

**Triggering Pause (Guardian):**
```typescript
await sdk.emergency.triggerPause(2, 'Oracle anomaly detected');
```

**Resuming (Admin):**
```typescript
await sdk.emergency.resume('Security review completed');
```

### 3.3 Cross-Chain Bridge

```typescript
// Initiate on source chain
const bridgeTx = await sdk.bridge.initiateTransfer({
  amount: 1000n * 10n ** 18n,
  destinationChain: 137,
  recipient: userAddress,
});

// Wait for validators...

// Claim on destination chain
await dstSdk.bridge.claimTransfer(transferId, signatures);
```

---

## 4. Permissions & Security Model

### Roles Matrix

| Role | Grant Roles | Pause | Mint | Burn | Update Oracle | Upgrade |
|------|-------------|-------|------|------|---------------|---------|
| DEFAULT_ADMIN | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| GUARDIAN | ❌ | ✅ (L1-3) | ❌ | ❌ | ❌ | ❌ |
| MINTER | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| BURNER | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| GOVERNOR | ✅* | ✅ | ✅* | ✅* | ✅* | ✅ |

*Through governance proposals with timelock

### Security Best Practices

1. **Multi-sig for Admin**: Always use Gnosis Safe (3/5 minimum)
2. **Timelock Everything**: All parameter changes go through timelock
3. **Monitor Continuously**: Set up alerts for all sensitive actions
4. **Principle of Least Privilege**: Grant minimum required roles
5. **Regular Audits**: Schedule quarterly security reviews

---

## 5. Data Model

### Core Entities

```graphql
type Token @entity {
  id: ID!
  name: String!
  symbol: String!
  totalSupply: BigInt!
  totalBacking: BigInt!
  backingRatio: BigDecimal!
  pauseLevel: Int!
}

type Account @entity {
  id: ID!
  balance: BigInt!
  roles: [String!]!
}

type MintEvent @entity {
  id: ID!
  account: Account!
  amount: BigInt!
  timestamp: BigInt!
}
```

---

## 6. Integrations Manual

### 6.1 Chainlink Oracle

```typescript
const oracle = await deploy('BackingOracle', {
  chainlinkFeeds: [
    { asset: 'USDC', feed: '0x...' },
  ],
  stalenessThreshold: 3600,
});

await policy.setOracleSource(oracle.address);
```

### 6.2 Gnosis Safe

```typescript
await policy.grantRole(ADMIN_ROLE, safeAddress);
await policy.renounceRole(ADMIN_ROLE, deployer.address);
```

### 6.3 Tenderly

```typescript
const simulation = await sdk.tenderly.simulate({
  from: minter,
  to: policyAddress,
  data: policy.interface.encodeFunctionData('mint', [amount, recipient]),
});
```

---

## 7. Task System Manual

### Task Types

| Task Type | Description | Duration |
|-----------|-------------|----------|
| `MINT` | Mint new tokens | 1-2 blocks |
| `BURN` | Burn tokens | 1-2 blocks |
| `REDEEM` | Queue redemption | 1-2 blocks |
| `BRIDGE_INITIATE` | Start cross-chain | 1-2 blocks |
| `PAUSE` | Trigger pause | Immediate |
| `UPGRADE` | Upgrade contract | 48h timelock |

### Execution Protocol

```typescript
async function executeTask(task: Task): Promise<TaskResult> {
  // 1. Validate
  for (const validation of task.validations) {
    if (!await runValidation(validation)) {
      return { success: false, error: validation.error };
    }
  }

  // 2. Simulate
  const sim = await tenderly.simulate(task);
  if (!sim.success) return { success: false, error: sim.errorMessage };

  // 3. Execute with retry
  for (let i = 0; i < maxRetries; i++) {
    try {
      const tx = await executeTransaction(task);
      const receipt = await tx.wait();
      return { success: true, receipt };
    } catch (e) {
      if (!shouldRetry(e)) throw e;
      await sleep(backoff[i]);
    }
  }
}
```

---

## 8. THE INTAKE COMMAND

### Running Intake

```bash
# Interactive mode
npx securemint intake

# From config file
npx securemint intake --config intake-answers.json

# Dry-run (validation only)
npx securemint intake --dry-run
```

### Outputs

- `config.json` - Machine-readable configuration
- `RUN_PLAN.md` - Deployment steps and gates
- `CHECKLIST.md` - Pre/post flight checklists
- `TEST_PLAN.md` - Smoke tests to run

---

## 9. Preflight Checks

### Hard Gates (Blockers)

| Check | Command | Expected |
|-------|---------|----------|
| RPC Connectivity | `curl $RPC_URL ...` | Response < 1s |
| Deployer Balance | `cast balance $DEPLOYER` | >= 0.5 ETH |
| Oracle Feed | `cast call $ORACLE ...` | Fresh timestamp |
| Safe Deployed | `cast call $SAFE ...` | Threshold >= 3 |

### Running Preflight

```bash
make preflight
```

---

## 10. QA Pack

### Smoke Tests

| ID | Test | Expected |
|----|------|----------|
| SM-01 | Deploy token | Address returned |
| SM-02 | Deploy policy | Address returned |
| SM-03 | Oracle check | Non-zero value |
| SM-04 | Basic mint | totalSupply increases |
| SM-05 | Basic burn | totalSupply decreases |
| SM-06 | Pause trigger | Level changes |
| SM-07 | API health | 200 OK |

### Negative Tests

| ID | Test | Expected Error |
|----|------|----------------|
| NEG-01 | Mint without role | `AccessControl: account missing role` |
| NEG-02 | Mint during pause | `Paused(2)` |
| NEG-03 | Mint exceeds backing | `InsufficientBacking` |
| NEG-04 | Mint exceeds epoch | `EpochCapacityExceeded` |

---

## 11. Troubleshooting + Runbook

### Common Issues

#### Mints Failing with "InsufficientBacking"

```bash
# Check oracle backing value
cast call $ORACLE_ADDRESS "getLatestBacking()"

# Check current supply
cast call $TOKEN_ADDRESS "totalSupply()"

# Compare: backing should be >= totalSupply + mintAmount
```

#### Transactions Stuck Pending

```bash
# Check gas prices
cast gas-price --rpc-url $RPC_URL

# Check pending tx
cast tx $TX_HASH
```

### Incident Response (First 5 Minutes)

```
MINUTE 0-1: ASSESS
├── Check monitoring dashboard
├── Identify affected component
└── Determine severity

MINUTE 1-2: CONTAIN
├── If P0: Trigger Emergency Pause L4
├── Notify on-call team
└── Create incident channel

MINUTE 3-5: INVESTIGATE
├── Gather logs
├── Check recent changes
└── Begin remediation
```

---

## 12. FAQ + Examples Library

### FAQ

**Q: What is the minimum backing ratio?**
A: 100% (1:1). The system prevents minting if totalSupply + mintAmount > totalBacking.

**Q: How often does the oracle update?**
A: Depends on the Chainlink feed. Most update every 1 hour or on 0.5% deviation.

**Q: Can I use my own oracle?**
A: Yes, implement IBackingOracle interface and register via governance.

**Q: What happens if the oracle goes down?**
A: Minting is automatically paused when oracle data becomes stale (L2 pause).

### Example: Complete Mint Flow

```typescript
import { SecureMintSDK } from '@securemint/sdk';

async function completeMintFlow() {
  const sdk = new SecureMintSDK({ /* config */ });
  const amount = 1000n * 10n ** 18n;
  const recipient = '0x...';

  // Check eligibility
  const check = await sdk.policy.checkMintEligibility(amount, recipient);
  if (!check.canMint) throw new Error(check.reason);

  // Simulate
  const sim = await sdk.policy.simulateMint(amount, recipient);

  // Execute
  const tx = await sdk.policy.mint(amount, recipient);
  const receipt = await tx.wait();

  // Verify
  const newSupply = await sdk.token.totalSupply();
  console.log('Minted! New supply:', newSupply.toString());
}
```

---

## 13. Pre-Launch Readiness Checklist

### Go-Live Criteria

- [ ] All tests passing (coverage ≥ 95%)
- [ ] Security audit completed
- [ ] Admin is multi-sig (3/5 minimum)
- [ ] Timelock configured
- [ ] Monitoring dashboards ready
- [ ] Alerting configured
- [ ] On-call schedule created
- [ ] Runbook documented
- [ ] Incident response tested

### Sign-off Required

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Security Lead | | | |
| Compliance | | | |
| Operations | | | |

---

*Document Version: 1.0.0*
*Last Updated: 2024-12-01*
*Maintained by: SecureMint Core Team*
