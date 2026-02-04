# SecureMint Engine - Remediation Plan

**Status:** Active
**Owner:** Security Team
**Last Updated:** 2024-02-04

---

## Executive Summary

This document outlines the remediation plan for 24 security findings identified in the SecureMint Engine audit. Fixes are prioritized by severity and business impact.

---

## Phase 1: Critical Fixes (Week 1) - BLOCKING DEPLOYMENT

### SEC-001: Remove Hardcoded API Keys
**File:** `assets/api-gateway/src/middleware/auth.ts`

**Current Code (VULNERABLE):**
```typescript
// Line 103 - REMOVE THIS ENTIRELY
const devApiKeys = ['dev-api-key-12345'];
if (devApiKeys.includes(apiKey)) {
  return { userId: 'dev', role: 'admin' };
}
```

**Fixed Code:**
```typescript
// Remove hardcoded keys - validate against database only
const hashedKey = await bcrypt.hash(apiKey, 10);
const keyRecord = await db.apiKey.findUnique({
  where: { keyHash: hashedKey }
});
if (!keyRecord || !keyRecord.active) {
  throw new AuthenticationError('Invalid API key');
}
return { userId: keyRecord.userId, role: keyRecord.role };
```

**Verification:**
```bash
grep -r "dev-api-key" --include="*.ts" assets/
# Should return no results
```

---

### SEC-002: Require Strong JWT Secret
**File:** `assets/api-gateway/src/middleware/auth.ts`

**Current Code (VULNERABLE):**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
```

**Fixed Code:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;

// Startup validation
function validateJwtSecret(): void {
  if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  if (JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
  }
  if (JWT_SECRET === 'development-secret' || JWT_SECRET.includes('change')) {
    throw new Error('FATAL: JWT_SECRET appears to be a placeholder value');
  }
}

// Call at module load
validateJwtSecret();
```

**Verification:**
```bash
unset JWT_SECRET && npm start
# Server should refuse to start with clear error
```

---

### SEC-003: Implement Nonce Protection
**File:** `assets/api-gateway/src/middleware/auth.ts`

**New Nonce System:**
```typescript
import { Redis } from 'ioredis';

const NONCE_TTL = 300; // 5 minutes
const NONCE_PREFIX = 'auth:nonce:';

// Generate nonce endpoint
async function generateNonce(address: string): Promise<string> {
  const nonce = crypto.randomBytes(32).toString('hex');
  const key = `${NONCE_PREFIX}${address}:${nonce}`;
  await redis.set(key, '1', 'EX', NONCE_TTL);
  return nonce;
}

// Verify and invalidate nonce
async function verifyNonce(address: string, nonce: string): Promise<boolean> {
  const key = `${NONCE_PREFIX}${address}:${nonce}`;
  const result = await redis.del(key);
  return result === 1; // Returns 1 if key existed and was deleted
}

// Updated signature verification
async function verifySignature(message: string, signature: string): Promise<AuthResult> {
  const parsed = SignedMessageSchema.safeParse(JSON.parse(
    Buffer.from(message, 'base64').toString()
  ));

  if (!parsed.success) {
    throw new AuthenticationError('Invalid message format');
  }

  const { address, nonce, timestamp } = parsed.data;

  // Verify nonce (single-use)
  if (!await verifyNonce(address, nonce)) {
    throw new AuthenticationError('Invalid or expired nonce');
  }

  // Verify timestamp
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    throw new AuthenticationError('Message timestamp expired');
  }

  // Verify signature
  const recoveredAddress = ethers.verifyMessage(message, signature);
  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    throw new AuthenticationError('Invalid signature');
  }

  return { address, authenticated: true };
}
```

---

### SEC-004: Validate Signed Transactions
**File:** `assets/api-gateway/src/routes/mint.ts`

**Fixed Code:**
```typescript
import { ethers } from 'ethers';

// Transaction execution with signature verification
router.post('/execute', authMiddleware, async (req, res) => {
  const { signedTransaction } = req.body;

  // Decode the signed transaction
  const tx = ethers.Transaction.from(signedTransaction);

  // Verify the signer is authorized
  const signer = tx.from;
  if (!signer) {
    return res.status(400).json({ error: 'Cannot determine transaction signer' });
  }

  // Check signer is the authenticated user
  if (signer.toLowerCase() !== req.user.address.toLowerCase()) {
    return res.status(403).json({ error: 'Transaction signer mismatch' });
  }

  // Verify transaction targets our contract
  if (tx.to?.toLowerCase() !== MINT_CONTRACT_ADDRESS.toLowerCase()) {
    return res.status(400).json({ error: 'Invalid transaction target' });
  }

  // Verify chain ID
  if (tx.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
    return res.status(400).json({ error: 'Invalid chain ID' });
  }

  // Broadcast the pre-signed transaction
  const receipt = await provider.broadcastTransaction(signedTransaction);

  return res.json({
    success: true,
    txHash: receipt.hash
  });
});
```

---

### SEC-005: Fix Private Key Patterns
**File:** `assets/.env.example`

**Fixed Content:**
```bash
# ============================================================
# PRIVATE KEYS - NEVER COMMIT REAL VALUES
# ============================================================
# Use a secure key management solution in production:
# - AWS KMS / Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
# - Hardware Security Module (HSM)

# Placeholder format that cannot be confused with real keys
DEPLOYER_PRIVATE_KEY=0x_YOUR_DEPLOYER_KEY_HERE_DO_NOT_USE_REAL_KEY
OPERATOR_PRIVATE_KEY=0x_YOUR_OPERATOR_KEY_HERE_DO_NOT_USE_REAL_KEY

# ============================================================
# JWT SECRET - Generate a secure random value
# ============================================================
# Generate with: openssl rand -base64 48
JWT_SECRET=GENERATE_SECURE_RANDOM_VALUE_MIN_32_CHARS
```

---

## Phase 2: High Priority Fixes (Week 2) - Before Mainnet

### SEC-006: Make CI Security Blocking
**File:** `assets/.github/workflows/security.yml`

**Fixed Workflow:**
```yaml
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Slither
        id: slither
        # REMOVED: continue-on-error: true
        run: |
          slither . --json slither-output.json

      - name: Run npm audit
        id: npm-audit
        run: |
          npm audit --audit-level=high
          # Fails on high/critical vulnerabilities

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: security-reports
          path: |
            slither-output.json

      # Summary step that enforces policy
      - name: Security Gate
        if: always()
        run: |
          if [ "${{ steps.slither.outcome }}" == "failure" ]; then
            echo "::error::Slither found security issues"
            exit 1
          fi
          if [ "${{ steps.npm-audit.outcome }}" == "failure" ]; then
            echo "::error::npm audit found high/critical vulnerabilities"
            exit 1
          fi
```

---

### SEC-007: Disable GraphQL Introspection
**File:** `assets/api-gateway/src/server.ts`

**Fixed Code:**
```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  plugins: [
    // Disable introspection via plugin as backup
    {
      async requestDidStart() {
        return {
          async didResolveOperation({ request, document }) {
            if (process.env.NODE_ENV === 'production') {
              const isIntrospection = request.operationName === 'IntrospectionQuery' ||
                document.definitions.some(def =>
                  def.kind === 'OperationDefinition' &&
                  def.selectionSet.selections.some(sel =>
                    sel.kind === 'Field' && sel.name.value === '__schema'
                  )
                );
              if (isIntrospection) {
                throw new GraphQLError('Introspection is disabled');
              }
            }
          }
        };
      }
    }
  ]
});
```

---

### SEC-008: Per-User Rate Limiting
**File:** `assets/api-gateway/src/middleware/cache.ts`

**Fixed Rate Limiting:**
```typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'ip:anonymous': { windowMs: 60000, maxRequests: 20 },
  'ip:authenticated': { windowMs: 60000, maxRequests: 100 },
  'user': { windowMs: 60000, maxRequests: 100 },
  'wallet': { windowMs: 60000, maxRequests: 50 },
  'global': { windowMs: 60000, maxRequests: 10000 }
};

async function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = RATE_LIMITS[type];
  const key = `ratelimit:${type}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count current requests
  const count = await redis.zcard(key);

  if (count >= config.maxRequests) {
    const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetAt = oldestEntry.length > 1
      ? parseInt(oldestEntry[1]) + config.windowMs
      : now + config.windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  // Add current request
  await redis.zadd(key, now.toString(), `${now}:${Math.random()}`);
  await redis.expire(key, Math.ceil(config.windowMs / 1000));

  return {
    allowed: true,
    remaining: config.maxRequests - count - 1,
    resetAt: now + config.windowMs
  };
}

// Middleware
export const rateLimitMiddleware = async (req, res, next) => {
  const ip = getClientIp(req);
  const isAuthenticated = !!req.user;

  // Check IP rate limit
  const ipType = isAuthenticated ? 'ip:authenticated' : 'ip:anonymous';
  const ipResult = await checkRateLimit(ip, ipType);

  if (!ipResult.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Check user rate limit if authenticated
  if (isAuthenticated) {
    const userResult = await checkRateLimit(req.user.id, 'user');
    if (!userResult.allowed) {
      return res.status(429).json({ error: 'User rate limit exceeded' });
    }

    // Check wallet rate limit for web3 operations
    if (req.user.address) {
      const walletResult = await checkRateLimit(req.user.address, 'wallet');
      if (!walletResult.allowed) {
        return res.status(429).json({ error: 'Wallet rate limit exceeded' });
      }
    }
  }

  next();
};
```

---

### SEC-009: Enable Redis TLS
**File:** `assets/api-gateway/src/middleware/cache.ts`

**Fixed Redis Connection:**
```typescript
import Redis from 'ioredis';
import fs from 'fs';

function createRedisClient(): Redis {
  const options: Redis.RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'securemint:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  };

  // Enable TLS in production
  if (process.env.NODE_ENV === 'production' || process.env.REDIS_TLS === 'true') {
    options.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };

    // Optional: Custom CA certificate
    if (process.env.REDIS_CA_CERT_PATH) {
      options.tls.ca = fs.readFileSync(process.env.REDIS_CA_CERT_PATH);
    }
  }

  const client = new Redis(options);

  client.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  return client;
}

export const redis = createRedisClient();
```

---

### SEC-010: JSON Schema Validation
**File:** `assets/api-gateway/src/middleware/auth.ts`

**Fixed Validation:**
```typescript
import { z } from 'zod';

// Define strict schema for signed messages
const SignedMessageSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  nonce: z.string().min(32).max(128),
  timestamp: z.number().int().positive(),
  action: z.enum(['authenticate', 'sign_transaction', 'approve']).optional(),
  chainId: z.number().int().positive().optional(),
}).strict(); // Reject unknown fields

type SignedMessage = z.infer<typeof SignedMessageSchema>;

// Safe message parsing
function parseSignedMessage(base64Message: string): SignedMessage {
  try {
    const decoded = Buffer.from(base64Message, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    const result = SignedMessageSchema.safeParse(parsed);

    if (!result.success) {
      const errors = result.error.errors.map(e => e.message).join(', ');
      throw new ValidationError(`Invalid message format: ${errors}`);
    }

    return result.data;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('Failed to decode message');
  }
}
```

---

## Phase 3: Medium Priority Fixes (Week 3-4)

### SEC-011 - SEC-017: Implementation Details

Detailed implementation for medium-priority fixes available in:
- `security_audit/REGRESSION_TESTS/` - Test implementations
- Individual fix branches in repository

---

## Verification Checklist

### Phase 1 Verification
- [ ] No hardcoded API keys in codebase (`grep -r "dev-api-key"`)
- [ ] Server refuses to start without valid JWT_SECRET
- [ ] Nonce endpoint returns unique values
- [ ] Replayed signatures are rejected
- [ ] Only signed transactions are broadcast
- [ ] No private key patterns in example files

### Phase 2 Verification
- [ ] CI fails on Slither findings
- [ ] CI fails on high/critical npm vulnerabilities
- [ ] GraphQL introspection disabled in production
- [ ] Per-user rate limits enforced
- [ ] Redis connection uses TLS in production
- [ ] Invalid message formats return 400 error

---

## Rollback Procedures

Each fix includes a rollback procedure in case of issues:

1. **Configuration Rollback:** Revert environment variables
2. **Code Rollback:** `git revert <commit-sha>`
3. **Database Rollback:** Run down migration
4. **Contract Rollback:** Use proxy admin to upgrade (if applicable)

---

*Document maintained by Security Team*
*Review schedule: Weekly during remediation, monthly thereafter*
