# Formal Invariants for SecureMintEngine

## Overview

These invariants MUST be registered with MonetaryFormalVerificationEngine and continuously monitored. Any violation triggers immediate pause and DAO escalation.

## Core Invariants

### INV-SM-1: BackingAlwaysCoversSupply

**Definition:**
```
∀t: backing(t) >= required_backing(totalSupply(t))
```

**Implementation:**
```solidity
function checkBackingInvariant() public view returns (bool) {
    uint256 currentBacking = getVerifiedBacking();
    uint256 requiredBacking = calculateRequiredBacking(totalSupply());
    return currentBacking >= requiredBacking;
}
```

**Violation Response:**
1. Immediately pause all minting
2. Block new deposits (if applicable)
3. Allow redemptions to reduce supply
4. Emit critical alert to DAO
5. Snapshot evidence for audit trail

---

### INV-SM-2: OracleHealthRequired

**Definition:**
```
mint_allowed ⟺ oracle_healthy == true
```

**Implementation:**
```solidity
modifier requireHealthyOracle() {
    require(backingOracle.isHealthy(), "Oracle unhealthy");
    require(block.timestamp - backingOracle.lastUpdate() <= MAX_ORACLE_AGE, "Oracle stale");
    _;
}

function mint(address to, uint256 amount) external requireHealthyOracle {
    // ... mint logic
}
```

**Health Conditions:**
- Oracle data age < MAX_ORACLE_AGE
- Oracle price != 0
- Oracle deviation within bounds
- Oracle not flagged as compromised

**Violation Response:**
1. Automatically block all minting
2. Continue allowing burns/redemptions
3. Emit oracle failure event
4. Monitor for recovery

---

### INV-SM-3: MintIsBounded

**Definition:**
```
minted(epoch) <= epoch_cap ∧ totalSupply <= global_cap
```

**Implementation:**
```solidity
uint256 public immutable GLOBAL_SUPPLY_CAP;
uint256 public immutable EPOCH_MINT_CAP;
uint256 public currentEpochMinted;
uint256 public lastEpochTimestamp;

modifier enforceMintBounds(uint256 amount) {
    // Check global cap
    require(totalSupply() + amount <= GLOBAL_SUPPLY_CAP, "Global cap exceeded");

    // Reset epoch if needed
    if (block.timestamp >= lastEpochTimestamp + EPOCH_DURATION) {
        currentEpochMinted = 0;
        lastEpochTimestamp = block.timestamp;
    }

    // Check epoch cap
    require(currentEpochMinted + amount <= EPOCH_MINT_CAP, "Epoch cap exceeded");
    _;

    currentEpochMinted += amount;
}
```

**Violation Response:**
1. Revert transaction (pre-emptive)
2. If somehow bypassed: immediate pause
3. Investigation required before resume

---

### INV-SM-4: NoBypassPath

**Definition:**
```
∀contract, ∀role: mint(amount) ⟹ caller == SecureMintPolicy
```

**Implementation:**
```solidity
// In BackedToken.sol
address public immutable secureMintPolicy;

modifier onlySecureMint() {
    require(msg.sender == secureMintPolicy, "Only SecureMint can mint");
    _;
}

function mint(address to, uint256 amount) external onlySecureMint {
    _mint(to, amount);
}
```

**Verification:**
- No other address has mint capability
- No upgrade path that could add mint capability
- No delegatecall that could bypass check
- Admin cannot mint directly

**Violation Response:**
1. CRITICAL: Contract compromise assumed
2. Immediate full pause
3. DAO emergency session
4. Potential contract migration required

---

## Invariant Monitoring

### On-Chain Monitoring

```solidity
event InvariantViolation(
    string indexed invariantId,
    uint256 timestamp,
    bytes details
);

function checkAllInvariants() public view returns (bool) {
    return checkBackingInvariant()
        && backingOracle.isHealthy()
        && totalSupply() <= GLOBAL_SUPPLY_CAP;
}

function enforceInvariants() external {
    if (!checkAllInvariants()) {
        _pause();
        emit InvariantViolation("MULTI", block.timestamp, "");
    }
}
```

### Off-Chain Monitoring

Required monitoring infrastructure:
- Real-time invariant checking (every block)
- Alert system for violations
- Historical invariant tracking
- Anomaly detection for near-violations

---

## Formal Verification Requirements

Before deployment, these invariants SHOULD be verified using:

1. **Static Analysis Tools**
   - Slither
   - Mythril
   - Certora (recommended for formal proofs)

2. **Invariant Testing**
   - Foundry invariant tests
   - Echidna fuzzing

3. **Manual Audit**
   - Focus on bypass paths
   - Check upgrade mechanisms
   - Verify access control

---

## Invariant Registration

To register with MonetaryFormalVerificationEngine:

```solidity
interface IMonetaryFormalVerification {
    function registerInvariant(
        string calldata id,
        address target,
        bytes4 checkSelector,
        uint8 severity // 0=INFO, 1=WARNING, 2=CRITICAL, 3=FATAL
    ) external;
}

// Registration
formalVerification.registerInvariant(
    "INV-SM-1",
    address(this),
    this.checkBackingInvariant.selector,
    3 // FATAL
);
```
