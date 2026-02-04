# SecureMint Engine - Security Test Plan

**Version:** 1.0
**Date:** 2024-02-04

---

## 1. Test Strategy Overview

### Scope
- API Gateway security (authentication, authorization, input validation)
- Smart contract security (access control, invariants, economic attacks)
- Infrastructure security (secrets, CI/CD, dependencies)

### Test Types
1. **Unit Tests** - Individual security controls
2. **Integration Tests** - Authentication flows, contract interactions
3. **Fuzz Tests** - Contract invariants, input boundaries
4. **Regression Tests** - Previously identified vulnerabilities

---

## 2. API Security Tests

### 2.1 Authentication Tests

```typescript
// File: security_audit/REGRESSION_TESTS/auth.test.ts

describe('Authentication Security', () => {
  describe('JWT Validation', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/mint/capacity')
        .expect(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject tokens with invalid signature', async () => {
      const fakeToken = jwt.sign({ userId: '123' }, 'wrong-secret');
      const response = await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: '123', exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      );
      await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject tokens with algorithm "none"', async () => {
      // Craft token with alg: none (CVE prevention)
      const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from('{"userId":"admin"}').toString('base64url');
      const fakeToken = `${header}.${payload}.`;

      await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });
  });

  describe('Signature Authentication', () => {
    it('should reject replayed signatures', async () => {
      const nonce = await getNonce(testAddress);
      const message = createSignedMessage(testAddress, nonce);
      const signature = await wallet.signMessage(message);

      // First request should succeed
      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(200);

      // Replay should fail
      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(401);
    });

    it('should reject expired timestamps', async () => {
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 min ago
      const message = createSignedMessage(testAddress, nonce, oldTimestamp);
      const signature = await wallet.signMessage(message);

      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(401);
    });

    it('should reject malformed message format', async () => {
      const invalidMessages = [
        'not-base64',
        Buffer.from('not-json').toString('base64'),
        Buffer.from('{"missing":"fields"}').toString('base64'),
        Buffer.from('{"address":"invalid","nonce":"x","timestamp":123}').toString('base64')
      ];

      for (const message of invalidMessages) {
        await request(app)
          .post('/api/auth/verify')
          .send({ message, signature: '0x...' })
          .expect(400);
      }
    });
  });

  describe('Hardcoded Key Prevention', () => {
    it('should not accept dev-api-key', async () => {
      await request(app)
        .get('/api/mint/capacity')
        .set('X-API-Key', 'dev-api-key-12345')
        .expect(401);
    });
  });
});
```

### 2.2 Rate Limiting Tests

```typescript
// File: security_audit/REGRESSION_TESTS/rate-limit.test.ts

describe('Rate Limiting', () => {
  it('should enforce per-IP limits', async () => {
    const requests = Array(25).fill(null).map(() =>
      request(app)
        .get('/api/mint/capacity')
        .set('X-Forwarded-For', '192.168.1.100')
    );

    const responses = await Promise.all(requests);
    const blocked = responses.filter(r => r.status === 429);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it('should enforce per-user limits separately', async () => {
    // User A should have independent limit from User B
    const userAToken = generateToken('user-a');
    const userBToken = generateToken('user-b');

    // Exhaust User A limit
    for (let i = 0; i < 105; i++) {
      await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${userAToken}`);
    }

    // User B should still work
    const response = await request(app)
      .get('/api/mint/capacity')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);
  });

  it('should not trust spoofed X-Forwarded-For from untrusted source', async () => {
    // Direct connection with spoofed header should use socket IP
    const responses = [];
    for (let i = 0; i < 25; i++) {
      const r = await request(app)
        .get('/api/mint/capacity')
        .set('X-Forwarded-For', `192.168.1.${i}`); // Spoofed
      responses.push(r);
    }

    // Should be rate limited despite different X-Forwarded-For
    const blocked = responses.filter(r => r.status === 429);
    expect(blocked.length).toBeGreaterThan(0);
  });
});
```

### 2.3 Input Validation Tests

```typescript
// File: security_audit/REGRESSION_TESTS/input-validation.test.ts

describe('Input Validation', () => {
  describe('Address Validation', () => {
    it('should reject invalid Ethereum addresses', async () => {
      const invalidAddresses = [
        '',
        '0x',
        '0x123',
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        'not-an-address',
        '0x' + 'a'.repeat(41), // Too long
      ];

      for (const addr of invalidAddresses) {
        await request(app)
          .post('/api/mint/simulate')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ recipient: addr, amount: '1000000000000000000' })
          .expect(400);
      }
    });
  });

  describe('Amount Validation', () => {
    it('should reject negative amounts', async () => {
      await request(app)
        .post('/api/mint/simulate')
        .send({ recipient: validAddress, amount: '-1' })
        .expect(400);
    });

    it('should reject zero amounts', async () => {
      await request(app)
        .post('/api/mint/simulate')
        .send({ recipient: validAddress, amount: '0' })
        .expect(400);
    });

    it('should reject non-numeric amounts', async () => {
      await request(app)
        .post('/api/mint/simulate')
        .send({ recipient: validAddress, amount: 'abc' })
        .expect(400);
    });
  });

  describe('GraphQL Security', () => {
    it('should reject introspection in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/graphql')
        .send({
          query: `{ __schema { types { name } } }`
        });

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Introspection');
    });

    it('should enforce query depth limits', async () => {
      const deepQuery = `{
        mint { history { mint { history { mint { history { id } } } } } }
      }`;

      await request(app)
        .post('/graphql')
        .send({ query: deepQuery })
        .expect(400);
    });
  });
});
```

---

## 3. Smart Contract Security Tests

### 3.1 Access Control Tests (Foundry)

```solidity
// File: assets/contracts/test/security/AccessControl.t.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../SecureMintPolicy.sol";

contract AccessControlTest is Test {
    SecureMintPolicy policy;
    address admin = address(1);
    address minter = address(2);
    address attacker = address(3);
    address user = address(4);

    function setUp() public {
        vm.startPrank(admin);
        policy = new SecureMintPolicy();
        policy.grantRole(policy.MINTER_ROLE(), minter);
        vm.stopPrank();
    }

    function test_OnlyMinterCanMint() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        policy.mint(user, 1000e18);
        vm.stopPrank();
    }

    function test_OnlyGuardianCanPause() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        policy.pause();
        vm.stopPrank();
    }

    function test_OnlyGovernorCanChangeParameters() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        policy.proposeEpochCapChange(1000000e18);
        vm.stopPrank();
    }

    function test_RoleCannotBeGrantedByNonAdmin() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        policy.grantRole(policy.MINTER_ROLE(), attacker);
        vm.stopPrank();
    }
}
```

### 3.2 Invariant Tests (Foundry)

```solidity
// File: assets/contracts/test/security/Invariants.t.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../SecureMintPolicy.sol";
import "../../BackedToken.sol";
import "../../BackingOraclePoR.sol";

contract InvariantTest is Test {
    SecureMintPolicy policy;
    BackedToken token;
    BackingOraclePoR oracle;

    function setUp() public {
        // Setup contracts...
    }

    /// @notice Token supply should never exceed backing
    function invariant_SupplyNeverExceedsBacking() public {
        uint256 totalSupply = token.totalSupply();
        uint256 backingValue = oracle.getTotalBackingValue();
        assertLe(totalSupply, backingValue, "INV-SM-1: Supply exceeds backing");
    }

    /// @notice Minting should be blocked when oracle is stale
    function invariant_NoMintWithStaleOracle() public {
        if (oracle.isStale()) {
            vm.expectRevert("Oracle data is stale");
            policy.mint(address(this), 1e18);
        }
    }

    /// @notice Emergency pause should block all minting
    function invariant_PauseBlocksMinting() public {
        if (policy.paused()) {
            vm.expectRevert("Pausable: paused");
            policy.mint(address(this), 1e18);
        }
    }

    /// @notice Total minted in epoch should not exceed epoch cap
    function invariant_EpochCapRespected() public {
        uint256 epochMinted = policy.currentEpochMinted();
        uint256 epochCap = policy.epochMintCap();
        assertLe(epochMinted, epochCap, "Epoch cap exceeded");
    }
}
```

### 3.3 Reentrancy Tests

```solidity
// File: assets/contracts/test/security/Reentrancy.t.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../RedemptionEngine.sol";

contract ReentrancyAttacker {
    RedemptionEngine target;
    uint256 attackCount;

    constructor(address _target) {
        target = RedemptionEngine(_target);
    }

    receive() external payable {
        if (attackCount < 3) {
            attackCount++;
            target.redeem(1e18);
        }
    }

    function attack() external {
        target.redeem(1e18);
    }
}

contract ReentrancyTest is Test {
    RedemptionEngine redemption;
    ReentrancyAttacker attacker;

    function setUp() public {
        redemption = new RedemptionEngine();
        attacker = new ReentrancyAttacker(address(redemption));
    }

    function test_RedemptionBlocksReentrancy() public {
        vm.expectRevert("ReentrancyGuard: reentrant call");
        attacker.attack();
    }
}
```

---

## 4. Infrastructure Security Tests

### 4.1 Secrets Detection Test

```bash
#!/bin/bash
# File: security_audit/REGRESSION_TESTS/secrets-scan.sh

echo "Checking for hardcoded secrets..."

# Check for private key patterns
if grep -rE "0x[a-fA-F0-9]{64}" --include="*.ts" --include="*.js" --include="*.env*" .; then
    echo "FAIL: Potential private key pattern found"
    exit 1
fi

# Check for hardcoded API keys
if grep -rE "dev-api-key|test-api-key" --include="*.ts" --include="*.js" .; then
    echo "FAIL: Hardcoded API key found"
    exit 1
fi

# Check for JWT secrets
if grep -rE "development-secret|change.*production" --include="*.ts" --include="*.js" .; then
    echo "FAIL: Placeholder secret found in code"
    exit 1
fi

echo "PASS: No hardcoded secrets detected"
```

### 4.2 CI Security Validation

```yaml
# File: security_audit/REGRESSION_TESTS/ci-validation.yml

name: Validate CI Security
on: [push, pull_request]

jobs:
  validate-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check security workflow is blocking
        run: |
          # Ensure continue-on-error is not present in security steps
          if grep -q "continue-on-error: true" .github/workflows/security.yml; then
            echo "FAIL: Security workflow has continue-on-error"
            exit 1
          fi
          echo "PASS: Security workflow is blocking"

      - name: Check npm audit configuration
        run: |
          # Ensure npm audit fails on high severity
          if ! grep -q "audit-level=high" .github/workflows/security.yml; then
            echo "FAIL: npm audit not configured to fail on high"
            exit 1
          fi
          echo "PASS: npm audit configured correctly"
```

---

## 5. Test Execution Matrix

| Test Suite | Framework | Frequency | Blocking |
|------------|-----------|-----------|----------|
| Auth Tests | Jest | Every PR | Yes |
| Rate Limit Tests | Jest | Every PR | Yes |
| Input Validation | Jest | Every PR | Yes |
| Contract Access Control | Foundry | Every PR | Yes |
| Contract Invariants | Foundry | Every PR | Yes |
| Reentrancy Tests | Foundry | Every PR | Yes |
| Secrets Scan | Bash/grep | Every PR | Yes |
| Dependency Audit | npm audit | Daily + PR | Yes (High+) |
| SAST (Slither) | Slither | Every PR | Yes |

---

## 6. Test Coverage Requirements

| Component | Minimum Coverage | Current |
|-----------|-----------------|---------|
| API Gateway | 80% | TBD |
| Auth Middleware | 95% | TBD |
| Smart Contracts | 90% | TBD |
| SDK | 75% | TBD |

---

*Test Plan maintained by Security Team*
*Last updated: 2024-02-04*
