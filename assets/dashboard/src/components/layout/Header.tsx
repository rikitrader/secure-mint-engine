'use client';

import { useSystemStatus } from '@/hooks/useSystemStatus';
import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function Header() {
  const { data: status, isLoading } = useSystemStatus();

  const getStatusIcon = () => {
    if (isLoading) return <div className="w-3 h-3 bg-gray-500 rounded-full animate-pulse" />;

    switch (status?.alertLevel) {
      case 'NORMAL':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'ELEVATED':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'RESTRICTED':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'EMERGENCY':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'SHUTDOWN':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-3 h-3 bg-gray-500 rounded-full" />;
    }
  };

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    return status?.alertLevel || 'Unknown';
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">SecureMint</h1>
          <span className="text-sm text-muted-foreground">Monitoring Dashboard</span>
        </div>

        <div className="flex items-center gap-6">
          {/* System Status */}
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>

          {/* Health Factor */}
          {status && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Health:</span>
              <span
                className={`text-sm font-bold ${
                  status.healthFactor >= 100
                    ? 'text-green-500'
                    : status.healthFactor >= 95
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}
              >
                {status.healthFactor.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Network */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-muted-foreground">
              {status?.network || 'Mainnet'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
