'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { OracleTab } from '@/components/tabs/OracleTab';
import { TreasuryTab } from '@/components/tabs/TreasuryTab';
import { GovernanceTab } from '@/components/tabs/GovernanceTab';
import { AlertsTab } from '@/components/tabs/AlertsTab';

type Tab = 'overview' | 'oracle' | 'treasury' | 'governance' | 'alerts';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'oracle':
        return <OracleTab />;
      case 'treasury':
        return <TreasuryTab />;
      case 'governance':
        return <GovernanceTab />;
      case 'alerts':
        return <AlertsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 p-6">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
