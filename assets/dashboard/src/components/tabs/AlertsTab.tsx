'use client';

import { useAlertsData } from '@/hooks/useAlertsData';
import { useAlertConfig } from '@/hooks/useAlertConfig';
import { format } from 'date-fns';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Settings,
  Webhook,
  Mail,
  MessageSquare,
} from 'lucide-react';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  acknowledged: boolean;
  details?: Record<string, any>;
}

export function AlertsTab() {
  const { data: alerts, isLoading } = useAlertsData();
  const { data: config } = useAlertConfig();

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityClass = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'border-red-600/50 bg-red-600/10';
      case 'error':
        return 'border-red-500/50 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'info':
      default:
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const unacknowledgedCount = alerts?.filter((a) => !a.acknowledged).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Alerts & Notifications</h2>
          <p className="text-muted-foreground">
            System alerts and webhook integrations
          </p>
        </div>
        {unacknowledgedCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <Bell className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-500">
              {unacknowledgedCount} unacknowledged
            </span>
          </div>
        )}
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['critical', 'error', 'warning', 'info'].map((severity) => {
          const count = alerts?.filter((a) => a.severity === severity).length || 0;
          return (
            <div
              key={severity}
              className={`p-4 rounded-lg border ${getSeverityClass(severity as AlertSeverity)}`}
            >
              <div className="flex items-center justify-between">
                {getSeverityIcon(severity as AlertSeverity)}
                <span className="text-2xl font-bold">{count}</span>
              </div>
              <p className="text-sm mt-2 capitalize">{severity}</p>
            </div>
          );
        })}
      </div>

      {/* Alert List */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Alerts</h3>
          <button className="text-sm text-primary hover:underline">
            Mark all as read
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getSeverityClass(alert.severity)} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <p className="font-medium">{alert.type}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.message}
                      </p>
                      {alert.details && (
                        <div className="mt-2 text-xs font-mono bg-muted/50 p-2 rounded">
                          {JSON.stringify(alert.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {format(alert.timestamp, 'MMM d, HH:mm:ss')}
                    </p>
                    {!alert.acknowledged && (
                      <button className="mt-2 text-xs text-primary hover:underline">
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No alerts - system operating normally</p>
          </div>
        )}
      </div>

      {/* Webhook Configuration */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Alert Integrations</h3>
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">
            Add Integration
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Discord */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />
              <span className="font-medium">Discord</span>
              {config?.discord?.enabled ? (
                <span className="ml-auto text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
                  Active
                </span>
              ) : (
                <span className="ml-auto text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Send alerts to Discord channels via webhooks
            </p>
            <button className="w-full py-2 border border-border rounded-lg text-sm hover:bg-accent">
              Configure
            </button>
          </div>

          {/* Slack */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-5 h-5 text-[#4A154B]" />
              <span className="font-medium">Slack</span>
              {config?.slack?.enabled ? (
                <span className="ml-auto text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
                  Active
                </span>
              ) : (
                <span className="ml-auto text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Post alerts to Slack channels
            </p>
            <button className="w-full py-2 border border-border rounded-lg text-sm hover:bg-accent">
              Configure
            </button>
          </div>

          {/* PagerDuty */}
          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="w-5 h-5 text-[#06AC38]" />
              <span className="font-medium">PagerDuty</span>
              {config?.pagerduty?.enabled ? (
                <span className="ml-auto text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
                  Active
                </span>
              ) : (
                <span className="ml-auto text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Trigger incidents for critical alerts
            </p>
            <button className="w-full py-2 border border-border rounded-lg text-sm hover:bg-accent">
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Alert Rules */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Alert Rules</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Oracle Staleness</p>
              <p className="text-xs text-muted-foreground">
                Alert when oracle data exceeds staleness threshold
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">
                Critical
              </span>
              <input type="checkbox" checked readOnly className="toggle" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Health Factor Below 100%</p>
              <p className="text-xs text-muted-foreground">
                Alert when backing drops below supply
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">
                Critical
              </span>
              <input type="checkbox" checked readOnly className="toggle" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Emergency Alert Level</p>
              <p className="text-xs text-muted-foreground">
                Alert when system enters EMERGENCY or SHUTDOWN
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded">
                Critical
              </span>
              <input type="checkbox" checked readOnly className="toggle" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Large Mint/Redemption</p>
              <p className="text-xs text-muted-foreground">
                Alert on transactions exceeding threshold
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">
                Warning
              </span>
              <input type="checkbox" checked readOnly className="toggle" />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Governance Proposal</p>
              <p className="text-xs text-muted-foreground">
                Notify on new or executed proposals
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
                Info
              </span>
              <input type="checkbox" checked readOnly className="toggle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
