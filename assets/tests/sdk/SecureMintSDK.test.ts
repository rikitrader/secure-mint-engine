/**
 * SecureMint SDK - Unit Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      name: jest.fn().mockResolvedValue('SecureMint USD'),
      symbol: jest.fn().mockResolvedValue('smUSD'),
      decimals: jest.fn().mockResolvedValue(6),
      totalSupply: jest.fn().mockResolvedValue(BigInt('1000000000000')),
      balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000')),
    })),
    formatUnits: jest.fn().mockImplementation((value, decimals) => {
      return (Number(value) / Math.pow(10, decimals)).toString();
    }),
    parseUnits: jest.fn().mockImplementation((value, decimals) => {
      return BigInt(Number(value) * Math.pow(10, decimals));
    }),
    isAddress: jest.fn().mockReturnValue(true),
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  },
}));

// Import after mocking
import { SecureMintSDK } from '../../sdk/src/SecureMintSDK';

describe('SecureMintSDK', () => {
  let sdk: SecureMintSDK;
  const mockConfig = {
    rpcUrl: 'http://localhost:8545',
    tokenAddress: '0x1234567890123456789012345678901234567890',
    policyAddress: '0x2345678901234567890123456789012345678901',
    oracleAddress: '0x3456789012345678901234567890123456789012',
    treasuryAddress: '0x4567890123456789012345678901234567890123',
  };

  beforeEach(() => {
    sdk = new SecureMintSDK(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create SDK instance with valid config', () => {
      expect(sdk).toBeDefined();
    });

    it('should throw error with invalid RPC URL', () => {
      expect(() => {
        new SecureMintSDK({ ...mockConfig, rpcUrl: '' });
      }).toThrow();
    });

    it('should throw error with invalid token address', () => {
      expect(() => {
        new SecureMintSDK({ ...mockConfig, tokenAddress: 'invalid' });
      }).toThrow();
    });
  });

  describe('token operations', () => {
    it('should get token info', async () => {
      const tokenInfo = await sdk.getTokenInfo();
      expect(tokenInfo.name).toBe('SecureMint USD');
      expect(tokenInfo.symbol).toBe('smUSD');
      expect(tokenInfo.decimals).toBe(6);
    });

    it('should get total supply', async () => {
      const totalSupply = await sdk.getTotalSupply();
      expect(totalSupply).toBeDefined();
    });

    it('should get balance for address', async () => {
      const balance = await sdk.getBalance('0x1234567890123456789012345678901234567890');
      expect(balance).toBeDefined();
    });

    it('should format balance correctly', async () => {
      const formatted = await sdk.getFormattedBalance('0x1234567890123456789012345678901234567890');
      expect(formatted).toBe('1000');
    });
  });

  describe('oracle operations', () => {
    it('should get backing data', async () => {
      const backing = await sdk.getBacking();
      expect(backing).toBeDefined();
    });

    it('should check oracle staleness', async () => {
      const isStale = await sdk.isOracleStale();
      expect(typeof isStale).toBe('boolean');
    });

    it('should calculate backing ratio', async () => {
      const ratio = await sdk.getBackingRatio();
      expect(ratio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mint operations', () => {
    it('should check if mint is allowed', async () => {
      const canMint = await sdk.canMint(
        '0x1234567890123456789012345678901234567890',
        '1000000'
      );
      expect(typeof canMint.allowed).toBe('boolean');
    });

    it('should simulate mint', async () => {
      const simulation = await sdk.simulateMint(
        '0x1234567890123456789012345678901234567890',
        '1000000'
      );
      expect(simulation).toBeDefined();
      expect(simulation.success).toBeDefined();
    });

    it('should get epoch capacity', async () => {
      const capacity = await sdk.getEpochCapacity();
      expect(capacity).toBeDefined();
      expect(capacity.total).toBeDefined();
      expect(capacity.used).toBeDefined();
      expect(capacity.remaining).toBeDefined();
    });
  });

  describe('invariant checks', () => {
    it('should check all invariants', async () => {
      const results = await sdk.checkInvariants();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(4);
    });

    it('should check solvency invariant (INV-SM-1)', async () => {
      const result = await sdk.checkSolvencyInvariant();
      expect(result.id).toBe('INV-SM-1');
      expect(typeof result.passed).toBe('boolean');
    });

    it('should check rate limit invariant (INV-SM-2)', async () => {
      const result = await sdk.checkRateLimitInvariant();
      expect(result.id).toBe('INV-SM-2');
      expect(typeof result.passed).toBe('boolean');
    });
  });

  describe('treasury operations', () => {
    it('should get treasury balances', async () => {
      const balances = await sdk.getTreasuryBalances();
      expect(balances).toBeDefined();
      expect(balances.tier1).toBeDefined();
      expect(balances.tier2).toBeDefined();
      expect(balances.tier3).toBeDefined();
      expect(balances.tier4).toBeDefined();
    });

    it('should get total reserves', async () => {
      const reserves = await sdk.getTotalReserves();
      expect(reserves).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle RPC errors gracefully', async () => {
      // Mock RPC failure
      jest.spyOn(sdk as any, 'provider', 'get').mockReturnValue({
        getNetwork: jest.fn().mockRejectedValue(new Error('RPC Error')),
      });

      await expect(sdk.getTokenInfo()).rejects.toThrow();
    });

    it('should handle contract call errors', async () => {
      // Mock contract failure
      jest.spyOn(sdk as any, 'tokenContract', 'get').mockReturnValue({
        totalSupply: jest.fn().mockRejectedValue(new Error('Contract Error')),
      });

      await expect(sdk.getTotalSupply()).rejects.toThrow();
    });
  });
});

describe('SecureMintSDK - Integration Style Tests', () => {
  describe('complete mint flow', () => {
    it('should validate complete mint workflow', async () => {
      const sdk = new SecureMintSDK({
        rpcUrl: 'http://localhost:8545',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        policyAddress: '0x2345678901234567890123456789012345678901',
        oracleAddress: '0x3456789012345678901234567890123456789012',
        treasuryAddress: '0x4567890123456789012345678901234567890123',
      });

      // Step 1: Check invariants
      const invariants = await sdk.checkInvariants();
      expect(invariants.every(i => i.passed)).toBe(true);

      // Step 2: Check capacity
      const capacity = await sdk.getEpochCapacity();
      expect(BigInt(capacity.remaining)).toBeGreaterThan(0n);

      // Step 3: Simulate mint
      const recipient = '0x1234567890123456789012345678901234567890';
      const amount = '1000000';
      const simulation = await sdk.simulateMint(recipient, amount);
      expect(simulation.success).toBe(true);
    });
  });
});
