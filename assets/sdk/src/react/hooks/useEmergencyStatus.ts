import { useState, useEffect, useCallback } from 'react';
import { Contract } from 'ethers';
import { useSecureMintContext } from '../context/SecureMintProvider';
import { HookState, AlertLevel, EmergencyStatus } from '../types';

// ABI fragments for EmergencyPause
const EMERGENCY_ABI = [
  'function currentAlertLevel() external view returns (uint8)',
  'function lastLevelChange() external view returns (uint256)',
  'function lastChangedBy() external view returns (address)',
  'function lastChangeReason() external view returns (string)',
  'function levelRestrictions(uint8 level) external view returns (bool canMint, bool canRedeem, bool canTransfer, bool canGovernance)',
  'event AlertLevelChanged(uint8 previousLevel, uint8 newLevel, address changedBy, string reason)',
];

// Alert level names
const ALERT_LEVELS: AlertLevel[] = ['NORMAL', 'ELEVATED', 'RESTRICTED', 'EMERGENCY', 'SHUTDOWN'];

// Level restrictions descriptions
const LEVEL_RESTRICTIONS: Record<AlertLevel, string[]> = {
  NORMAL: [],
  ELEVATED: ['Increased monitoring', 'Rate limits may apply'],
  RESTRICTED: ['Minting restricted', 'Large redemptions delayed'],
  EMERGENCY: ['Minting paused', 'Redemptions paused', 'Only governance transfers'],
  SHUTDOWN: ['All operations paused', 'Emergency recovery mode'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY STATUS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmergencyStatus(): HookState<EmergencyStatus> {
  const { provider, config, isCorrectChain } = useSecureMintContext();
  const [state, setState] = useState<HookState<EmergencyStatus>>({
    data: null,
    isLoading: true,
    error: null,
    refetch: async () => {},
  });

  const fetchStatus = useCallback(async () => {
    if (!provider || !isCorrectChain) {
      setState(prev => ({ ...prev, isLoading: false, error: new Error('Not connected to correct chain') }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const emergencyContract = new Contract(config.contracts.emergencyPause, EMERGENCY_ABI, provider);

      const currentLevel = await emergencyContract.currentAlertLevel();
      const levelNumber = Number(currentLevel);

      // Try to get additional info (may not be available on all implementations)
      let lastChange: Date | null = null;
      let changedBy: string | null = null;
      let reason: string | null = null;

      try {
        const [lastChangeTime, lastChangedBy, lastReason] = await Promise.all([
          emergencyContract.lastLevelChange(),
          emergencyContract.lastChangedBy(),
          emergencyContract.lastChangeReason(),
        ]);

        if (lastChangeTime > 0n) {
          lastChange = new Date(Number(lastChangeTime) * 1000);
        }
        changedBy = lastChangedBy;
        reason = lastReason;
      } catch {
        // These functions may not exist on all implementations
      }

      const alertLevel = levelNumber < ALERT_LEVELS.length
        ? ALERT_LEVELS[levelNumber]
        : 'SHUTDOWN';

      const status: EmergencyStatus = {
        currentLevel: alertLevel,
        levelNumber,
        isPaused: levelNumber >= 3, // EMERGENCY or SHUTDOWN
        lastChange,
        changedBy,
        reason,
        restrictions: LEVEL_RESTRICTIONS[alertLevel],
      };

      setState({ data: status, isLoading: false, error: null, refetch: fetchStatus });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch emergency status'),
        refetch: fetchStatus,
      }));
    }
  }, [provider, config, isCorrectChain]);

  useEffect(() => {
    fetchStatus();

    // More frequent updates for emergency status
    const interval = setInterval(fetchStatus, config.refreshInterval || 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, config.refreshInterval]);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY ALERT HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmergencyAlert {
  show: boolean;
  level: AlertLevel;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export function useEmergencyAlert(): EmergencyAlert {
  const { data: status } = useEmergencyStatus();

  if (!status || status.currentLevel === 'NORMAL') {
    return {
      show: false,
      level: 'NORMAL',
      message: '',
      severity: 'info',
    };
  }

  const severityMap: Record<AlertLevel, 'info' | 'warning' | 'error' | 'critical'> = {
    NORMAL: 'info',
    ELEVATED: 'warning',
    RESTRICTED: 'warning',
    EMERGENCY: 'error',
    SHUTDOWN: 'critical',
  };

  const messageMap: Record<AlertLevel, string> = {
    NORMAL: '',
    ELEVATED: 'System is under elevated monitoring. Some operations may be delayed.',
    RESTRICTED: 'System operations are restricted. Large transactions may be delayed.',
    EMERGENCY: 'EMERGENCY: System operations are paused. Please wait for resolution.',
    SHUTDOWN: 'CRITICAL: System is in emergency shutdown mode. All operations suspended.',
  };

  return {
    show: true,
    level: status.currentLevel,
    message: messageMap[status.currentLevel],
    severity: severityMap[status.currentLevel],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATION AVAILABILITY HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperationAvailability {
  canMint: boolean;
  canRedeem: boolean;
  canTransfer: boolean;
  canGovernance: boolean;
}

export function useOperationAvailability(): OperationAvailability {
  const { data: status } = useEmergencyStatus();

  if (!status) {
    return {
      canMint: true,
      canRedeem: true,
      canTransfer: true,
      canGovernance: true,
    };
  }

  // Define availability based on alert level
  const availabilityByLevel: Record<AlertLevel, OperationAvailability> = {
    NORMAL: {
      canMint: true,
      canRedeem: true,
      canTransfer: true,
      canGovernance: true,
    },
    ELEVATED: {
      canMint: true,
      canRedeem: true,
      canTransfer: true,
      canGovernance: true,
    },
    RESTRICTED: {
      canMint: false,
      canRedeem: true,
      canTransfer: true,
      canGovernance: true,
    },
    EMERGENCY: {
      canMint: false,
      canRedeem: false,
      canTransfer: false,
      canGovernance: true,
    },
    SHUTDOWN: {
      canMint: false,
      canRedeem: false,
      canTransfer: false,
      canGovernance: false,
    },
  };

  return availabilityByLevel[status.currentLevel];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmergency() {
  const status = useEmergencyStatus();
  const alert = useEmergencyAlert();
  const availability = useOperationAvailability();

  return {
    ...status,
    alert,
    availability,
    isOperational: !status.data?.isPaused,
  };
}
