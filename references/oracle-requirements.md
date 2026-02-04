# Oracle / Proof-of-Reserve Requirements

## Supported Backing Verification Modes

### Mode A: On-Chain Collateral

For tokens backed by on-chain assets (e.g., overcollateralized stablecoins, wrapped assets).

**Required Components:**

1. **Price Oracles for Collateral Valuation**
   - Use established oracle networks (Chainlink, Pyth, etc.)
   - Multiple oracle sources recommended for critical assets
   - Fallback oracle configuration required

2. **LTV / Collateral Ratio Enforcement**
   ```solidity
   // Example: 150% collateralization requirement
   uint256 constant COLLATERAL_RATIO = 15000; // 150.00% in basis points

   function canMint(uint256 amount) internal view returns (bool) {
       uint256 newSupply = totalSupply() + amount;
       uint256 requiredBacking = (newSupply * COLLATERAL_RATIO) / 10000;
       return getCollateralValue() >= requiredBacking;
   }
   ```

3. **Staleness Checks**
   - Maximum age for price data: 1 hour (configurable)
   - Reject minting if price data older than threshold
   ```solidity
   uint256 constant MAX_ORACLE_AGE = 3600; // 1 hour

   function isOracleHealthy() public view returns (bool) {
       (, , uint256 updatedAt, , ) = oracle.latestRoundData();
       return block.timestamp - updatedAt <= MAX_ORACLE_AGE;
   }
   ```

4. **Deviation Bounds**
   - Flag anomalies if price moves >5% in single update
   - Pause minting on detected manipulation
   ```solidity
   uint256 constant MAX_DEVIATION = 500; // 5% in basis points
   ```

5. **Emergency Pause on Oracle Failure**
   - Auto-pause if oracle returns zero
   - Auto-pause if oracle timestamp is stale
   - Auto-pause if price deviation exceeds bounds

### Mode B: Off-Chain / Cross-Chain Reserves (Preferred for Stablecoins)

For tokens backed by off-chain assets (fiat, treasuries) or cross-chain reserves.

**Required Components:**

1. **Proof-of-Reserve Oracle Feed**
   - Chainlink Proof-of-Reserve feeds (preferred)
   - Third-party attestation oracles (with multiple attestors)
   - Cross-chain bridge oracle feeds

2. **Continuous Enforcement**
   - NOT one-time attestation
   - Real-time reserve checking on every mint
   ```solidity
   function mint(address to, uint256 amount) external {
       uint256 reserves = IProofOfReserve(porOracle).getReserves();
       uint256 newSupply = totalSupply() + amount;
       require(reserves >= newSupply, "Insufficient reserves");
       // ... mint logic
   }
   ```

3. **Reserve Mismatch Detection**
   - Monitor for: `reported_reserves < totalSupply`
   - Auto-pause on any mismatch
   - Alert DAO / emergency council

## Gold Standard Pattern

The recommended implementation combines:

1. **Proof-of-Reserve Gating mint()**
   - Every mint checks oracle before execution
   - No mint without verified backing

2. **Circuit Breaker on Oracle Failure**
   - Automatic pause if oracle unhealthy
   - No human intervention required

3. **No Human Discretion in Normal Operation**
   - Minting is purely algorithmic
   - Admin cannot override backing checks
   - Admin can only pause/unpause

## Oracle Health Checks

Every oracle integration MUST implement:

```solidity
interface IOracleHealthCheck {
    /// @notice Returns true if oracle data is fresh and valid
    function isHealthy() external view returns (bool);

    /// @notice Returns the age of the latest data in seconds
    function getDataAge() external view returns (uint256);

    /// @notice Returns true if price is within acceptable deviation
    function isPriceValid() external view returns (bool);
}
```

## Failure Modes and Mitigations

| Failure Mode | Detection | Mitigation |
|--------------|-----------|------------|
| Oracle returns zero | `price == 0` | Auto-pause mint |
| Stale data | `age > MAX_AGE` | Auto-pause mint |
| Flash loan manipulation | Deviation check | Use TWAP + deviation bounds |
| Oracle compromise | Multi-oracle divergence | Pause + governance escalation |
| Reserve shortfall | `reserves < supply` | Immediate pause + DAO alert |

## Integration Checklist

- [ ] Primary oracle feed configured
- [ ] Fallback oracle configured (if applicable)
- [ ] Staleness threshold set
- [ ] Deviation bounds configured
- [ ] Health check function implemented
- [ ] Auto-pause on failure implemented
- [ ] Multi-oracle comparison (for high-value protocols)
- [ ] TWAP configured (for manipulation resistance)
- [ ] Monitoring and alerting configured
