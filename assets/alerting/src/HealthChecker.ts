import { Contract, JsonRpcProvider } from 'ethers';

export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  checks: {
    oracle: { healthy: boolean; message: string };
    backing: { healthy: boolean; message: string };
    alertLevel: { healthy: boolean; message: string };
    treasury: { healthy: boolean; message: string };
    governance: { healthy: boolean; message: string };
  };
  metrics: {
    healthFactor: number;
    totalSupply: bigint;
    totalBacking: bigint;
    alertLevel: number;
    treasuryReserves: bigint;
    oracleAge: number;
  };
}

export interface HealthCheckerConfig {
  rpcUrl: string;
  contracts: {
    token: string;
    policy: string;
    oracle: string;
    treasury: string;
    emergencyPause: string;
  };
  thresholds: {
    healthFactorWarning: number;
    healthFactorCritical: number;
    oracleStaleness: number;
    alertLevelWarning: number;
  };
}

const POLICY_ABI = ['function paused() external view returns (bool)'];
const TOKEN_ABI = ['function totalSupply() external view returns (uint256)'];
const ORACLE_ABI = [
  'function latestBacking() external view returns (uint256 backing, uint256 timestamp)',
  'function stalenessThreshold() external view returns (uint256)',
];
const TREASURY_ABI = ['function totalReserves() external view returns (uint256)'];
const EMERGENCY_ABI = ['function currentAlertLevel() external view returns (uint8)'];

export class HealthChecker {
  private provider: JsonRpcProvider;
  private config: HealthCheckerConfig;

  constructor(config: HealthCheckerConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl);
  }

  async check(): Promise<HealthStatus> {
    const checks = {
      oracle: { healthy: true, message: 'OK' },
      backing: { healthy: true, message: 'OK' },
      alertLevel: { healthy: true, message: 'OK' },
      treasury: { healthy: true, message: 'OK' },
      governance: { healthy: true, message: 'OK' },
    };

    const metrics = {
      healthFactor: 100,
      totalSupply: 0n,
      totalBacking: 0n,
      alertLevel: 0,
      treasuryReserves: 0n,
      oracleAge: 0,
    };

    try {
      // Check oracle
      const oracleContract = new Contract(
        this.config.contracts.oracle,
        ORACLE_ABI,
        this.provider
      );
      const [backing, timestamp] = await oracleContract.latestBacking();
      const stalenessThreshold = await oracleContract.stalenessThreshold();

      const now = Math.floor(Date.now() / 1000);
      const oracleAge = now - Number(timestamp);
      metrics.oracleAge = oracleAge;
      metrics.totalBacking = backing;

      if (oracleAge > Number(stalenessThreshold)) {
        checks.oracle = {
          healthy: false,
          message: `Oracle data stale by ${oracleAge - Number(stalenessThreshold)} seconds`,
        };
      }

      // Check token supply
      const tokenContract = new Contract(
        this.config.contracts.token,
        TOKEN_ABI,
        this.provider
      );
      metrics.totalSupply = await tokenContract.totalSupply();

      // Calculate health factor
      if (metrics.totalSupply > 0n) {
        const backingNorm = backing * BigInt(10 ** 12);
        metrics.healthFactor =
          Number((backingNorm * 10000n) / metrics.totalSupply) / 100;

        if (metrics.healthFactor < this.config.thresholds.healthFactorCritical) {
          checks.backing = {
            healthy: false,
            message: `Critical: Health factor at ${metrics.healthFactor.toFixed(2)}%`,
          };
        } else if (
          metrics.healthFactor < this.config.thresholds.healthFactorWarning
        ) {
          checks.backing = {
            healthy: true,
            message: `Warning: Health factor at ${metrics.healthFactor.toFixed(2)}%`,
          };
        }
      }

      // Check alert level
      const emergencyContract = new Contract(
        this.config.contracts.emergencyPause,
        EMERGENCY_ABI,
        this.provider
      );
      const alertLevel = await emergencyContract.currentAlertLevel();
      metrics.alertLevel = Number(alertLevel);

      if (metrics.alertLevel >= 3) {
        checks.alertLevel = {
          healthy: false,
          message: `System in ${
            ['NORMAL', 'ELEVATED', 'RESTRICTED', 'EMERGENCY', 'SHUTDOWN'][
              metrics.alertLevel
            ]
          } mode`,
        };
      } else if (
        metrics.alertLevel >= this.config.thresholds.alertLevelWarning
      ) {
        checks.alertLevel = {
          healthy: true,
          message: `Elevated alert level: ${metrics.alertLevel}`,
        };
      }

      // Check treasury
      const treasuryContract = new Contract(
        this.config.contracts.treasury,
        TREASURY_ABI,
        this.provider
      );
      metrics.treasuryReserves = await treasuryContract.totalReserves();

      if (metrics.treasuryReserves === 0n) {
        checks.treasury = {
          healthy: false,
          message: 'Treasury has zero reserves',
        };
      }
    } catch (error) {
      checks.oracle = {
        healthy: false,
        message: `Failed to check: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    const healthy = Object.values(checks).every((c) => c.healthy);

    return {
      healthy,
      timestamp: new Date(),
      checks,
      metrics,
    };
  }

  async runPeriodically(
    intervalMs: number,
    callback: (status: HealthStatus) => void
  ): Promise<() => void> {
    const checkAndReport = async () => {
      const status = await this.check();
      callback(status);
    };

    await checkAndReport();
    const interval = setInterval(checkAndReport, intervalMs);

    return () => clearInterval(interval);
  }
}
