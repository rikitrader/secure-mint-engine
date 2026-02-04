'use client';

import {
  LayoutDashboard,
  Database,
  Vault,
  Vote,
  Bell,
  Settings,
  ExternalLink,
} from 'lucide-react';

type Tab = 'overview' | 'oracle' | 'treasury' | 'governance' | 'alerts';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'oracle', label: 'Oracle', icon: <Database className="w-5 h-5" /> },
  { id: 'treasury', label: 'Treasury', icon: <Vault className="w-5 h-5" /> },
  { id: 'governance', label: 'Governance', icon: <Vote className="w-5 h-5" /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="w-5 h-5" /> },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 min-h-[calc(100vh-73px)] border-r border-border bg-card">
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-8 border-t border-border">
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quick Links
          </h3>
          <ul className="space-y-1">
            <li>
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Documentation
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Subgraph Explorer
              </a>
            </li>
            <li>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </aside>
  );
}
