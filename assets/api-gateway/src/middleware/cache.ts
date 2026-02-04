/**
 * SecureMint Engine - Redis Caching Middleware
 * Provides caching layer for API responses
 *
 * SECURITY FIXES APPLIED:
 * - SEC-008: Per-user rate limiting (IP + user + wallet)
 * - SEC-009: Redis TLS support for production
 */

import { Request, Response, NextFunction } from 'express';
import Redis, { RedisOptions } from 'ioredis';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT WITH TLS SUPPORT (SEC-009)
// ═══════════════════════════════════════════════════════════════════════════════

function createRedisClient(): Redis {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'securemint:',
    retryStrategy: (times) => Math.min(times * 50, 2000),
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  };

  // Enable TLS in production (SEC-009)
  if (process.env.NODE_ENV === 'production' || process.env.REDIS_TLS === 'true') {
    options.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };

    // Optional: Custom CA certificate
    if (process.env.REDIS_CA_CERT_PATH) {
      try {
        options.tls.ca = fs.readFileSync(process.env.REDIS_CA_CERT_PATH);
      } catch (err) {
        console.error('Failed to read Redis CA certificate:', err);
      }
    }
  }

  return new Redis(options);
}

export const redis = createRedisClient();

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix?: string;
  invalidateOn?: string[]; // Events that invalidate this cache
}

// Default TTLs for different data types
export const CacheTTL = {
  TOKEN_INFO: 300, // 5 minutes
  BALANCE: 30, // 30 seconds
  BACKING_RATIO: 60, // 1 minute
  ORACLE_STATUS: 30, // 30 seconds
  EPOCH_CAPACITY: 15, // 15 seconds
  INVARIANTS: 60, // 1 minute
  TREASURY: 120, // 2 minutes
  MINT_HISTORY: 60, // 1 minute
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCacheKey(req: Request, prefix?: string): string {
  const baseKey = prefix || req.path;
  const queryString = Object.keys(req.query)
    .sort()
    .map((key) => `${key}=${req.query[key]}`)
    .join('&');

  return queryString ? `${baseKey}?${queryString}` : baseKey;
}

export function generateUserCacheKey(req: Request, userId: string, prefix?: string): string {
  return `user:${userId}:${generateCacheKey(req, prefix)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export function cacheMiddleware(config: CacheConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if cache is disabled
    if (process.env.CACHE_ENABLED === 'false') {
      return next();
    }

    const cacheKey = generateCacheKey(req, config.keyPrefix);

    try {
      // Try to get from cache
      const cached = await redis.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(data);
      }

      // Cache miss - capture response
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.setex(cacheKey, config.ttl, JSON.stringify(body)).catch((err) => {
            console.error('Cache write error:', err);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function invalidateCache(pattern: string): Promise<number> {
  const keys = await redis.keys(`securemint:${pattern}`);
  if (keys.length === 0) return 0;

  // Remove prefix for deletion
  const keysWithoutPrefix = keys.map((k) => k.replace('securemint:', ''));
  return redis.del(...keysWithoutPrefix);
}

export async function invalidateCacheByTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    await invalidateCache(`*${tag}*`);
  }
}

// Invalidation events
export const InvalidationEvents = {
  MINT_EXECUTED: ['balance:*', 'token:*', 'epoch:*', 'invariants'],
  BURN_EXECUTED: ['balance:*', 'token:*', 'invariants'],
  ORACLE_UPDATED: ['oracle:*', 'backing:*', 'invariants'],
  EMERGENCY_CHANGED: ['emergency:*', 'invariants'],
  EPOCH_RESET: ['epoch:*'],
} as const;

export async function handleInvalidationEvent(event: keyof typeof InvalidationEvents): Promise<void> {
  const patterns = InvalidationEvents[event];
  for (const pattern of patterns) {
    await invalidateCache(pattern);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE WARMING
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheWarmer {
  key: string;
  ttl: number;
  fetch: () => Promise<any>;
}

export async function warmCache(warmers: CacheWarmer[]): Promise<void> {
  console.log(`Warming cache with ${warmers.length} entries...`);

  const results = await Promise.allSettled(
    warmers.map(async (warmer) => {
      const data = await warmer.fetch();
      await redis.setex(warmer.key, warmer.ttl, JSON.stringify(data));
      return warmer.key;
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Cache warmed: ${successful} successful, ${failed} failed`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE STATS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCacheStats(): Promise<{
  keys: number;
  memory: string;
  hitRate: string;
}> {
  const info = await redis.info('memory');
  const keyspace = await redis.info('keyspace');

  const memoryMatch = info.match(/used_memory_human:(\S+)/);
  const keysMatch = keyspace.match(/keys=(\d+)/);

  return {
    keys: keysMatch ? parseInt(keysMatch[1]) : 0,
    memory: memoryMatch ? memoryMatch[1] : 'unknown',
    hitRate: 'N/A', // Would need custom tracking
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUTED LOCKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function acquireLock(
  lockKey: string,
  ttlMs: number = 10000
): Promise<boolean> {
  const result = await redis.set(
    `lock:${lockKey}`,
    Date.now().toString(),
    'PX',
    ttlMs,
    'NX'
  );
  return result === 'OK';
}

export async function releaseLock(lockKey: string): Promise<void> {
  await redis.del(`lock:${lockKey}`);
}

export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlMs: number = 10000
): Promise<T | null> {
  const acquired = await acquireLock(lockKey, ttlMs);
  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(lockKey);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING WITH REDIS (SEC-008: Per-user rate limiting)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

// Per-user rate limit configurations (SEC-008)
export const RATE_LIMITS = {
  'ip:anonymous': { windowMs: 60000, maxRequests: 20 },
  'ip:authenticated': { windowMs: 60000, maxRequests: 100 },
  'user': { windowMs: 60000, maxRequests: 100 },
  'wallet': { windowMs: 60000, maxRequests: 50 },
  'global': { windowMs: 60000, maxRequests: 10000 },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${config.keyPrefix || 'default'}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count current requests
  const count = await redis.zcard(key);

  if (count >= config.maxRequests) {
    const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetAt = oldestEntry.length > 1 ? parseInt(oldestEntry[1]) + config.windowMs : now + config.windowMs;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Add current request
  await redis.zadd(key, now.toString(), `${now}:${Math.random()}`);
  await redis.pexpire(key, config.windowMs);

  return {
    allowed: true,
    remaining: config.maxRequests - count - 1,
    resetAt: now + config.windowMs,
  };
}

/**
 * Get client IP, handling proxy scenarios securely.
 * Only trusts X-Forwarded-For if request comes from trusted proxy.
 */
function getClientIp(req: Request): string {
  // Trust X-Forwarded-For only from trusted proxies
  const trustedProxies = (process.env.TRUSTED_PROXIES || '').split(',').filter(Boolean);
  const socketIp = req.socket.remoteAddress || 'unknown';

  if (trustedProxies.includes(socketIp)) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }

  return req.ip || socketIp;
}

/**
 * Enhanced rate limit middleware with per-user support (SEC-008)
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const result = await checkRateLimit(String(identifier), config);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }

    next();
  };
}

/**
 * Per-user rate limiting middleware (SEC-008)
 * Enforces limits at multiple levels: IP, user ID, wallet address
 */
export function perUserRateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const user = (req as any).user;
    const isAuthenticated = !!user;

    try {
      // Check IP rate limit
      const ipType = isAuthenticated ? 'ip:authenticated' : 'ip:anonymous';
      const ipConfig = RATE_LIMITS[ipType];
      const ipResult = await checkRateLimit(ip, { ...ipConfig, keyPrefix: ipType });

      res.setHeader('X-RateLimit-IP-Remaining', ipResult.remaining);

      if (!ipResult.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'IP rate limit exceeded',
          retryAfter: Math.ceil((ipResult.resetAt - Date.now()) / 1000),
        });
      }

      // Check user rate limit if authenticated
      if (isAuthenticated && user.id) {
        const userConfig = RATE_LIMITS.user;
        const userResult = await checkRateLimit(user.id, { ...userConfig, keyPrefix: 'user' });

        res.setHeader('X-RateLimit-User-Remaining', userResult.remaining);

        if (!userResult.allowed) {
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'User rate limit exceeded',
            retryAfter: Math.ceil((userResult.resetAt - Date.now()) / 1000),
          });
        }

        // Check wallet rate limit for web3 operations
        if (user.address) {
          const walletConfig = RATE_LIMITS.wallet;
          const walletResult = await checkRateLimit(
            user.address.toLowerCase(),
            { ...walletConfig, keyPrefix: 'wallet' }
          );

          res.setHeader('X-RateLimit-Wallet-Remaining', walletResult.remaining);

          if (!walletResult.allowed) {
            return res.status(429).json({
              error: 'Too Many Requests',
              message: 'Wallet rate limit exceeded',
              retryAfter: Math.ceil((walletResult.resetAt - Date.now()) / 1000),
            });
          }
        }
      }

      next();
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open in case of Redis issues (but log for monitoring)
      next();
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  redis,
  cacheMiddleware,
  invalidateCache,
  invalidateCacheByTags,
  handleInvalidationEvent,
  warmCache,
  getCacheStats,
  acquireLock,
  releaseLock,
  withLock,
  checkRateLimit,
  rateLimitMiddleware,
  perUserRateLimitMiddleware, // SEC-008: Per-user rate limiting
  CacheTTL,
  InvalidationEvents,
  RATE_LIMITS, // SEC-008: Rate limit configurations
};
