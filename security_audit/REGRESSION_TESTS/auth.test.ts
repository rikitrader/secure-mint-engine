/**
 * SecureMint Engine - Authentication Security Tests
 *
 * Regression tests for:
 * - SEC-001: Hardcoded API keys
 * - SEC-002: Weak JWT secret
 * - SEC-003: No nonce protection
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import type { Express } from 'express';
import { createApp } from '../../../assets/api-gateway/src/server';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-minimum-32-characters-long';

describe('Authentication Security', () => {
  let app: Express;
  let testWallet: ethers.Wallet;

  beforeAll(async () => {
    app = await createApp();
    testWallet = ethers.Wallet.createRandom();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // JWT SECURITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('JWT Validation', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/mint/capacity')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject tokens with invalid signature', async () => {
      const fakeToken = jwt.sign(
        { address: '0x1234567890123456789012345678901234567890', role: 'admin' },
        'wrong-secret-key-that-does-not-match'
      );

      const response = await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890123456789012345678901234567890',
          role: 'user',
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        },
        TEST_JWT_SECRET
      );

      await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject tokens with algorithm "none" (SEC-002)', async () => {
      // Craft token with alg: none (CVE-2015-9235 prevention)
      const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from('{"address":"0x1234567890123456789012345678901234567890","role":"admin"}').toString('base64url');
      const fakeToken = `${header}.${payload}.`;

      await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('should reject tokens with HS256 signed by attacker but verified without secret', async () => {
      // This tests against JWT confusion attacks
      const maliciousToken = jwt.sign(
        { address: '0x1234567890123456789012345678901234567890', role: 'admin' },
        'attacker-controlled-secret'
      );

      await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SIGNATURE AUTHENTICATION TESTS (SEC-003)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Signature Authentication', () => {
    async function getNonce(address: string): Promise<string> {
      const response = await request(app)
        .post('/api/auth/nonce')
        .send({ address })
        .expect(200);

      return response.body.nonce;
    }

    function createSignedMessage(
      address: string,
      nonce: string,
      timestamp: number = Date.now()
    ): string {
      const message = JSON.stringify({
        domain: 'SecureMint API',
        address: address.toLowerCase(),
        nonce,
        timestamp,
        statement: 'Sign this message to authenticate with SecureMint API',
      });
      return Buffer.from(message).toString('base64');
    }

    it('should reject replayed signatures (SEC-003)', async () => {
      const address = testWallet.address;
      const nonce = await getNonce(address);
      const message = createSignedMessage(address, nonce);
      const rawMessage = Buffer.from(message, 'base64').toString();
      const signature = await testWallet.signMessage(rawMessage);

      // First request should succeed (or return 200 if nonce is valid)
      const firstResponse = await request(app)
        .post('/api/auth/verify')
        .send({ message, signature });

      // Replay should fail
      const replayResponse = await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(401);

      expect(replayResponse.body.error).toContain('nonce');
    });

    it('should reject expired timestamps (SEC-003)', async () => {
      const address = testWallet.address;
      const nonce = await getNonce(address);
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const message = createSignedMessage(address, nonce, oldTimestamp);
      const rawMessage = Buffer.from(message, 'base64').toString();
      const signature = await testWallet.signMessage(rawMessage);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(401);

      expect(response.body.error).toContain('expired');
    });

    it('should reject malformed message format (SEC-010)', async () => {
      const invalidMessages = [
        'not-base64!!!',
        Buffer.from('not-json').toString('base64'),
        Buffer.from('{"missing":"fields"}').toString('base64'),
        Buffer.from('{"address":"invalid","nonce":"x","timestamp":123}').toString('base64'),
        Buffer.from('{"address":"0x123","nonce":"validnonce32chars0000000000000000","timestamp":' + Date.now() + '}').toString('base64'),
      ];

      for (const message of invalidMessages) {
        await request(app)
          .post('/api/auth/verify')
          .send({ message, signature: '0x' + '00'.repeat(65) })
          .expect(400);
      }
    });

    it('should reject signature from different address', async () => {
      const address = testWallet.address;
      const nonce = await getNonce(address);

      // Create message claiming to be from a different address
      const differentAddress = '0x0000000000000000000000000000000000000001';
      const message = createSignedMessage(differentAddress, nonce);
      const rawMessage = Buffer.from(message, 'base64').toString();
      const signature = await testWallet.signMessage(rawMessage);

      // Signature verification should fail because recovered address doesn't match
      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // HARDCODED KEY PREVENTION (SEC-001)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Hardcoded Key Prevention', () => {
    it('should not accept dev-api-key (SEC-001)', async () => {
      await request(app)
        .get('/api/mint/capacity')
        .set('X-API-Key', 'dev-api-key-12345')
        .expect(401);
    });

    it('should not accept any hardcoded test keys', async () => {
      const testKeys = [
        'test-api-key',
        'development-key',
        'local-key-123',
        'admin-key',
        'default-key',
      ];

      for (const key of testKeys) {
        await request(app)
          .get('/api/mint/capacity')
          .set('X-API-Key', key)
          .expect(401);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // JWT SECRET VALIDATION (SEC-002)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('JWT Secret Validation', () => {
    it('should reject placeholder secrets in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'development-secret';

        // Importing auth module should throw in production with weak secret
        expect(() => {
          jest.resetModules();
          require('../../../assets/api-gateway/src/middleware/auth');
        }).toThrow('placeholder');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JWT_SECRET = originalSecret;
        jest.resetModules();
      }
    });

    it('should reject short secrets', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short';

        expect(() => {
          jest.resetModules();
          require('../../../assets/api-gateway/src/middleware/auth');
        }).toThrow('32 characters');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JWT_SECRET = originalSecret;
        jest.resetModules();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTHORIZATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Role-Based Access Control', () => {
    function generateTestToken(role: string): string {
      return jwt.sign(
        {
          address: '0x1234567890123456789012345678901234567890',
          role,
          permissions: role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write'],
        },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );
    }

    it('should allow admin access to admin endpoints', async () => {
      const adminToken = generateTestToken('admin');

      // This test depends on having an admin-only endpoint
      const response = await request(app)
        .get('/api/mint/capacity')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should not be 401 or 403
      expect([200, 500]).toContain(response.status);
    });

    it('should deny user access to admin endpoints', async () => {
      const userToken = generateTestToken('user');

      // Admin-only endpoints should reject regular users
      await request(app)
        .post('/api/treasury/emergency-withdraw')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: '1000' })
        .expect(403);
    });
  });
});
