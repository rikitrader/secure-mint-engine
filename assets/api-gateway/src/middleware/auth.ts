/**
 * SecureMint Engine - Authentication Middleware
 *
 * SECURITY FIXES APPLIED:
 * - SEC-001: Removed hardcoded API keys
 * - SEC-002: Required strong JWT secret with startup validation
 * - SEC-003: Implemented nonce protection with Redis
 * - SEC-010: Added Zod schema validation for JSON parsing
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { z } from 'zod';
import crypto from 'crypto';
import Redis from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// JWT SECRET VALIDATION (SEC-002)
// ═══════════════════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET;

function validateJwtSecret(): void {
  if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  if (JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
  }
  const FORBIDDEN_SECRETS = ['development-secret', 'change-me', 'your-secret-here', 'placeholder'];
  if (FORBIDDEN_SECRETS.some(s => JWT_SECRET.toLowerCase().includes(s))) {
    throw new Error('FATAL: JWT_SECRET appears to be a placeholder value');
  }
}

// Validate at module load (fail fast in production)
if (process.env.NODE_ENV === 'production') {
  validateJwtSecret();
}

// Use validated secret or fallback for non-production
const VALIDATED_JWT_SECRET = JWT_SECRET || 'development-secret-only-for-local-testing-32chars';

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT FOR NONCE TRACKING (SEC-003)
// ═══════════════════════════════════════════════════════════════════════════════

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  keyPrefix: 'securemint:auth:',
  // Enable TLS in production (SEC-009)
  ...(process.env.NODE_ENV === 'production' && {
    tls: { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' }
  })
});

const NONCE_TTL = 300; // 5 minutes
const NONCE_PREFIX = 'nonce:';

// ═══════════════════════════════════════════════════════════════════════════════
// ZOD SCHEMA VALIDATION (SEC-010)
// ═══════════════════════════════════════════════════════════════════════════════

const SignedMessageSchema = z.object({
  domain: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  nonce: z.string().min(32).max(128),
  timestamp: z.number().int().positive(),
  statement: z.string().optional(),
  chainId: z.number().int().positive().optional(),
}).strict();

type SignedMessage = z.infer<typeof SignedMessageSchema>;

interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
    role: string;
    permissions: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// JWT AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'No authorization header' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme.toLowerCase() === 'bearer') {
    try {
      const decoded = jwt.verify(token, VALIDATED_JWT_SECRET) as any;
      req.user = {
        address: decoded.address,
        role: decoded.role || 'user',
        permissions: decoded.permissions || [],
      };
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  }

  if (scheme.toLowerCase() === 'signature') {
    try {
      const [message, signature] = token.split(':');

      // Parse and validate message with Zod
      let messageData: SignedMessage;
      try {
        const decoded = Buffer.from(message, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        const result = SignedMessageSchema.safeParse(parsed);

        if (!result.success) {
          const errors = result.error.errors.map(e => e.message).join(', ');
          res.status(400).json({ error: `Invalid message format: ${errors}` });
          return;
        }
        messageData = result.data;
      } catch {
        res.status(400).json({ error: 'Failed to decode message' });
        return;
      }

      const { address, nonce, timestamp } = messageData;

      // Verify timestamp
      if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
        res.status(401).json({ error: 'Signature expired' });
        return;
      }

      // Verify nonce exists
      const nonceKey = `${NONCE_PREFIX}${address}:${nonce}`;
      const nonceExists = await redis.get(nonceKey);
      if (!nonceExists) {
        res.status(401).json({ error: 'Invalid or expired nonce' });
        return;
      }

      // Consume nonce (single-use)
      const deleted = await redis.del(nonceKey);
      if (deleted !== 1) {
        res.status(401).json({ error: 'Nonce already used' });
        return;
      }

      // Verify signature
      const decodedMessage = Buffer.from(message, 'base64').toString();
      const signerAddress = ethers.verifyMessage(decodedMessage, signature);

      if (signerAddress.toLowerCase() !== address.toLowerCase()) {
        res.status(401).json({ error: 'Signature does not match claimed address' });
        return;
      }

      req.user = {
        address: signerAddress,
        role: 'user',
        permissions: ['read', 'write'],
      };

      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  res.status(401).json({ error: 'Unsupported authentication scheme' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NONCE MANAGEMENT (SEC-003)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a new nonce for signature authentication.
 * The nonce is stored in Redis with a 5-minute TTL.
 */
export async function generateNonce(address: string): Promise<string> {
  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid Ethereum address format');
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  const key = `${NONCE_PREFIX}${address.toLowerCase()}:${nonce}`;

  // Store nonce with TTL
  await redis.set(key, '1', 'EX', NONCE_TTL);

  return nonce;
}

/**
 * Check if a nonce exists (without consuming it)
 */
export async function verifyNonceExists(address: string, nonce: string): Promise<boolean> {
  const key = `${NONCE_PREFIX}${address.toLowerCase()}:${nonce}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API KEY AUTHENTICATION (SEC-001: Removed hardcoded keys)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * API Key validation middleware.
 * Keys must be validated against database (no hardcoded keys).
 */
export async function apiKeyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  // Production: require database validation
  if (process.env.NODE_ENV === 'production') {
    res.status(501).json({
      error: 'API key authentication requires database setup',
    });
    return;
  }

  // Development only: allow env-configured key
  if (process.env.ALLOW_DEV_API_KEY === 'true' && apiKey === process.env.DEV_API_KEY) {
    req.user = {
      address: '0x0000000000000000000000000000000000000001',
      role: 'admin',
      permissions: ['read', 'write', 'admin'],
    };
    next();
    return;
  }

  res.status(401).json({ error: 'Invalid API key' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasPermission = permissions.every((p) =>
      req.user!.permissions.includes(p)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export function generateToken(
  address: string,
  role: string = 'user',
  permissions: string[] = ['read', 'write']
): string {
  return jwt.sign(
    { address, role, permissions },
    VALIDATED_JWT_SECRET,
    {
      expiresIn: '24h',
      algorithm: 'HS256', // Explicitly set algorithm to prevent "alg: none" attacks
    }
  );
}

/**
 * Generate a message for the user to sign, including a server-generated nonce.
 * This prevents replay attacks by ensuring each signature is unique.
 */
export async function generateMessageToSign(address: string): Promise<{
  message: string;
  nonce: string;
  expiresAt: number;
}> {
  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid Ethereum address format');
  }

  // Generate unique nonce and store in Redis
  const nonce = await generateNonce(address);
  const timestamp = Date.now();
  const expiresAt = timestamp + (NONCE_TTL * 1000);

  const message = JSON.stringify({
    domain: 'SecureMint API',
    address: address.toLowerCase(),
    nonce,
    timestamp,
    statement: 'Sign this message to authenticate with SecureMint API',
  });

  return { message, nonce, expiresAt };
}

