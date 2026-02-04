# SecureMint Engine - Security Checklist: Stack A

**Stack:** Next.js 14 + Node API + Postgres + WalletConnect v2
**Router:** App Router
**Auth:** JWT + Ethereum Signature (SIWE-like)

---

## A1) Framework Security

### Next.js Security
- [ ] **CSP Headers** - Content Security Policy configured via `next.config.js`
- [ ] **CORS Origins** - Whitelist only trusted domains in production
- [ ] **API Routes Protection** - All `/api/*` routes require authentication
- [ ] **Server Components** - Sensitive data fetched server-side only
- [ ] **Middleware Auth** - Auth check in `middleware.ts` for protected routes
- [ ] **Environment Variables** - No `NEXT_PUBLIC_` prefix for secrets

### Express/Node API Security
- [ ] **Helmet.js** - Security headers enabled (HSTS, X-Frame-Options, etc.)
- [ ] **Body Parser Limits** - Max payload size configured (10MB default)
- [ ] **Request ID Tracking** - Unique ID for each request for audit trail
- [ ] **Graceful Shutdown** - SIGTERM handler for clean connection closing

---

## A2) Authentication & Sessions

### JWT Security (SEC-002)
- [ ] **Strong Secret** - JWT_SECRET >= 32 characters, not placeholder
- [ ] **Startup Validation** - Server refuses to start with weak secret
- [ ] **Algorithm Fixed** - Explicitly set `HS256`, no `alg: none` accepted
- [ ] **Short Expiry** - Token lifetime <= 24 hours
- [ ] **Refresh Rotation** - Refresh tokens rotated on each use
- [ ] **Token Revocation** - Blacklist stored in Redis for logout

### Signature Authentication (SEC-003)
- [ ] **Nonce Protection** - Server-generated nonce stored in Redis
- [ ] **Nonce Single-Use** - Nonce deleted after verification
- [ ] **Nonce TTL** - 5-minute expiration on nonces
- [ ] **Timestamp Check** - Message timestamp within 5 minutes
- [ ] **Address Recovery** - Verify recovered address matches claim
- [ ] **Replay Protection** - Signature cannot be reused

### RBAC Model
- [ ] **Role Hierarchy** - admin > operator > user
- [ ] **Permission Checks** - Every endpoint validates permissions
- [ ] **Admin Endpoints** - Separate routes for admin operations
- [ ] **Audit Logging** - All admin actions logged with timestamp

---

## A3) WalletConnect Integration

### Connection Security
- [ ] **v2 Protocol** - Using WalletConnect v2 (not deprecated v1)
- [ ] **Chain Allowlist** - Only permitted chains: ETH, Polygon, Arbitrum, Optimism, Base
- [ ] **Domain Separation** - EIP-712 typed data with unique domain (SEC-014)
- [ ] **Session Validation** - Verify session is valid before operations

### Message Signing
- [ ] **EIP-712 Migration** - Typed structured data signing (not personal_sign)
- [ ] **Domain Binding** - Include chainId, verifyingContract, name, version
- [ ] **Message Preview** - Users see exactly what they're signing
- [ ] **Gas Estimation** - Display estimated gas before signing

---

## A4) Postgres Security

### Connection Security
- [ ] **TLS Connection** - `ssl: true` in connection config for production
- [ ] **Connection Pooling** - Prisma pool configured with limits
- [ ] **Least Privilege** - DB user has minimum required permissions
- [ ] **No Raw Queries** - All queries via Prisma ORM (parameterized)

### Data Protection
- [ ] **RLS Enabled** - Row-Level Security for multi-tenant data
- [ ] **Encryption at Rest** - Database-level encryption enabled
- [ ] **PII Handling** - Personal data encrypted or hashed
- [ ] **Audit Trail** - `created_at`, `updated_at` on all tables

### Backup & Recovery
- [ ] **Automated Backups** - Daily automated backups
- [ ] **Point-in-Time Recovery** - Transaction logs retained
- [ ] **Backup Encryption** - Backups encrypted with separate key

---

## A5) Redis Security (SEC-009)

### Connection Security
- [ ] **TLS Enabled** - `tls: { rejectUnauthorized: true }` in production
- [ ] **Password Auth** - REDIS_PASSWORD environment variable set
- [ ] **Key Prefix** - Namespace all keys with `securemint:`
- [ ] **Network Isolation** - Redis not exposed to public internet

### Data Security
- [ ] **TTL on All Keys** - No indefinite key storage
- [ ] **Sensitive Data** - No plaintext secrets in Redis
- [ ] **Session Encryption** - Session data encrypted before storage

---

## A6) API Security

### Input Validation (SEC-010)
- [ ] **Zod Schemas** - All inputs validated with strict schemas
- [ ] **Address Validation** - Ethereum addresses match `0x[a-fA-F0-9]{40}`
- [ ] **Amount Validation** - BigInt parsing with positive checks
- [ ] **Unknown Fields Rejected** - `.strict()` on all schemas

### Rate Limiting (SEC-008)
- [ ] **Per-IP Limits** - 20 req/min anonymous, 100 authenticated
- [ ] **Per-User Limits** - 100 req/min per user ID
- [ ] **Per-Wallet Limits** - 50 req/min per wallet address
- [ ] **Global Limits** - 10,000 req/min total
- [ ] **X-Forwarded-For** - Only trusted from known proxies

### GraphQL Security (SEC-007)
- [ ] **Introspection Disabled** - Disabled in production
- [ ] **Query Depth Limit** - Max depth of 10 levels
- [ ] **Query Complexity** - Limit query complexity score
- [ ] **Persisted Queries** - Only allow pre-registered queries in prod

### Error Handling
- [ ] **Generic Errors** - No stack traces in production responses
- [ ] **Error Logging** - Full errors logged server-side
- [ ] **Rate Limit Messages** - Clear retry-after headers

---

## A7) Critical Flows Security

### Login/Sign-In
- [ ] Nonce generated server-side
- [ ] Signature verified against nonce
- [ ] JWT issued with appropriate claims
- [ ] Failed attempts rate-limited

### Deposits (Treasury)
- [ ] Transaction verified before processing
- [ ] Amount bounds checked
- [ ] Duplicate detection
- [ ] Admin notification on large deposits

### Withdrawals (Redemption)
- [ ] User ownership verified
- [ ] Amount within user balance
- [ ] Tiered limits enforced
- [ ] Timelock for large amounts

### Admin Controls
- [ ] Multi-factor authentication required
- [ ] All actions logged
- [ ] Approval workflow for sensitive operations
- [ ] Session timeout after inactivity

### Webhook Processing
- [ ] Signature verification on incoming webhooks
- [ ] Idempotency keys for deduplication
- [ ] Retry logic with exponential backoff
- [ ] Dead letter queue for failed webhooks

---

## A8) Secrets Management (SEC-001, SEC-005)

### Environment Variables
- [ ] **No Hardcoded Keys** - Zero secrets in codebase
- [ ] **Env Validation** - Startup fails if required vars missing
- [ ] **Placeholder Detection** - Reject placeholder values in production
- [ ] **Rotation Support** - Keys can be rotated without downtime

### Production Secrets
- [ ] **External KMS** - AWS KMS, HashiCorp Vault, or similar
- [ ] **Encryption Keys** - Stored in HSM for production
- [ ] **Access Audit** - All secret access logged
- [ ] **Least Privilege** - Services only access needed secrets

---

## A9) Dependency Security

### npm Audit
- [ ] **High Severity Block** - CI fails on high/critical vulnerabilities
- [ ] **Lockfile Committed** - `package-lock.json` in version control
- [ ] **Automatic Updates** - Dependabot or Renovate configured
- [ ] **License Compliance** - No GPL dependencies in proprietary code

### Supply Chain
- [ ] **Package Integrity** - `npm ci` used in CI (not `npm install`)
- [ ] **Verified Publishers** - Prefer verified npm packages
- [ ] **Minimal Dependencies** - Regular audit of unused dependencies

---

## A10) CI/CD Security (SEC-006)

### Security Gates
- [ ] **Blocking Mode** - No `continue-on-error: true` on security steps
- [ ] **npm audit** - Runs on every PR
- [ ] **ESLint Security** - `eslint-plugin-security` rules enforced
- [ ] **Secrets Scan** - TruffleHog or similar on every commit
- [ ] **SAST** - Static analysis with configurable severity

### Branch Protection
- [ ] **Required Reviews** - At least 1 approval before merge
- [ ] **Status Checks** - All security checks must pass
- [ ] **No Force Push** - Disabled on main/develop branches
- [ ] **Signed Commits** - GPG signatures required

---

## Verification Commands

```bash
# Check for hardcoded secrets
grep -rE "dev-api-key|0x[a-fA-F0-9]{64}" --include="*.ts" --include="*.js" .

# Verify JWT secret strength
[ ${#JWT_SECRET} -ge 32 ] && echo "PASS" || echo "FAIL: JWT_SECRET too short"

# Check npm vulnerabilities
npm audit --audit-level=high

# Test GraphQL introspection
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
# Should fail in production

# Test rate limiting
for i in {1..25}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/mint/capacity
done
# Should see 429 responses after limit
```

---

*Checklist Version: 1.0*
*Generated: 2024-02-04*
*Stack: A (Next.js + Node API + Postgres + WalletConnect)*
