/**
 * SecureMint Engine - Mint Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ethers } from 'ethers';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const mintValidation = [
  body('recipient')
    .isString()
    .custom((value) => ethers.isAddress(value))
    .withMessage('Invalid recipient address'),
  body('amount')
    .isString()
    .custom((value) => {
      try {
        const bn = BigInt(value);
        return bn > 0n;
      } catch {
        return false;
      }
    })
    .withMessage('Amount must be a positive integer string'),
];

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/mint/simulate
 * Simulate a mint operation without executing
 */
router.post('/simulate', mintValidation, validate, async (req: Request, res: Response) => {
  try {
    const { recipient, amount } = req.body;

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const policyAddress = process.env.POLICY_ADDRESS!;

    const policyAbi = [
      'function canMint(address recipient, uint256 amount) view returns (bool, string)',
      'function epochCapacity() view returns (uint256)',
      'function epochMintedAmount() view returns (uint256)',
    ];

    const policy = new ethers.Contract(policyAddress, policyAbi, provider);

    // Check if mint is allowed
    const [canMint, reason] = await policy.canMint(recipient, amount);
    const [epochCapacity, epochMinted] = await Promise.all([
      policy.epochCapacity(),
      policy.epochMintedAmount(),
    ]);

    const simulation = {
      success: canMint,
      reason: canMint ? 'Mint simulation successful' : reason,
      recipient,
      amount,
      estimatedGas: '150000',
      epochCapacity: epochCapacity.toString(),
      epochMinted: epochMinted.toString(),
      remainingCapacity: (epochCapacity - epochMinted).toString(),
      timestamp: new Date().toISOString(),
    };

    res.json(simulation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mint/execute
 * Execute a mint operation (requires signed transaction)
 *
 * SECURITY FIX (SEC-004): Validate signed transaction before broadcast
 * - Verify signer matches authenticated user
 * - Verify transaction targets our contract
 * - Verify chain ID matches expected chain
 */
router.post('/execute', mintValidation, validate, async (req: Request, res: Response) => {
  try {
    const { recipient, amount, signedTransaction } = req.body;

    if (!signedTransaction) {
      return res.status(400).json({ error: 'Signed transaction required' });
    }

    // Get expected configuration
    const MINT_CONTRACT_ADDRESS = process.env.POLICY_ADDRESS;
    const EXPECTED_CHAIN_ID = parseInt(process.env.CHAIN_ID || '1');

    if (!MINT_CONTRACT_ADDRESS) {
      return res.status(500).json({ error: 'Contract address not configured' });
    }

    // Decode and verify the signed transaction (SEC-004)
    let tx: ethers.Transaction;
    try {
      tx = ethers.Transaction.from(signedTransaction);
    } catch {
      return res.status(400).json({ error: 'Invalid signed transaction format' });
    }

    // Verify the signer is authorized (SEC-004)
    const signer = tx.from;
    if (!signer) {
      return res.status(400).json({ error: 'Cannot determine transaction signer' });
    }

    // Get authenticated user from request
    const user = (req as any).user;
    if (!user || !user.address) {
      return res.status(401).json({ error: 'User address not authenticated' });
    }

    // Check signer matches authenticated user (SEC-004)
    if (signer.toLowerCase() !== user.address.toLowerCase()) {
      return res.status(403).json({
        error: 'Transaction signer mismatch',
        details: 'Transaction must be signed by authenticated user'
      });
    }

    // Verify transaction targets our contract (SEC-004)
    if (!tx.to || tx.to.toLowerCase() !== MINT_CONTRACT_ADDRESS.toLowerCase()) {
      return res.status(400).json({
        error: 'Invalid transaction target',
        details: 'Transaction must target the mint policy contract'
      });
    }

    // Verify chain ID (SEC-004)
    if (tx.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
      return res.status(400).json({
        error: 'Invalid chain ID',
        details: `Expected chain ID ${EXPECTED_CHAIN_ID}, got ${tx.chainId}`
      });
    }

    // All security checks passed - broadcast the transaction
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const txResponse = await provider.broadcastTransaction(signedTransaction);
    const receipt = await txResponse.wait();

    res.json({
      success: receipt?.status === 1,
      transactionHash: txResponse.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed.toString(),
      verifiedSigner: signer,
      verifiedTarget: tx.to,
      verifiedChainId: Number(tx.chainId),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mint/capacity
 * Get current epoch minting capacity
 */
router.get('/capacity', async (req: Request, res: Response) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const policyAddress = process.env.POLICY_ADDRESS!;

    const policyAbi = [
      'function epochCapacity() view returns (uint256)',
      'function epochMintedAmount() view returns (uint256)',
      'function epochDuration() view returns (uint256)',
      'function currentEpoch() view returns (uint256)',
    ];

    const policy = new ethers.Contract(policyAddress, policyAbi, provider);

    const [capacity, minted, duration, currentEpoch] = await Promise.all([
      policy.epochCapacity(),
      policy.epochMintedAmount(),
      policy.epochDuration(),
      policy.currentEpoch(),
    ]);

    res.json({
      epochCapacity: capacity.toString(),
      epochMinted: minted.toString(),
      remainingCapacity: (capacity - minted).toString(),
      utilizationPercent: Number(minted * 10000n / capacity) / 100,
      epochDuration: duration.toString(),
      currentEpoch: currentEpoch.toString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mint/history
 * Get mint history (paginated)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', address } = req.query;

    // Would query from database or indexer
    const history: any[] = [];

    res.json({
      data: history,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mint/batch
 * Batch mint simulation
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'Requests array required' });
    }

    if (requests.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 requests per batch' });
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const policyAddress = process.env.POLICY_ADDRESS!;

    const policyAbi = [
      'function canMint(address recipient, uint256 amount) view returns (bool, string)',
    ];

    const policy = new ethers.Contract(policyAddress, policyAbi, provider);

    const results = await Promise.all(
      requests.map(async (req: any, index: number) => {
        try {
          const [canMint, reason] = await policy.canMint(req.recipient, req.amount);
          return {
            index,
            recipient: req.recipient,
            amount: req.amount,
            canMint,
            reason: canMint ? 'OK' : reason,
          };
        } catch (error: any) {
          return {
            index,
            recipient: req.recipient,
            amount: req.amount,
            canMint: false,
            reason: error.message,
          };
        }
      })
    );

    const successful = results.filter((r) => r.canMint);
    const failed = results.filter((r) => !r.canMint);

    res.json({
      total: requests.length,
      successful: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as mintRoutes };
