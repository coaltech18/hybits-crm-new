import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import KPICard from './components/KPICard';
import RevenueChart from './components/RevenueChart';
import ActivityFeed from './components/ActivityFeed';
import QuickActions from './components/QuickActions';
import PendingApprovals from './components/PendingApprovals';
import InventoryOverview from './components/InventoryOverview';
import FilterToolbar from './components/FilterToolbar';
import Icon from '../../components/AppIcon.tsx';
import Button from '../../components/ui/Button.tsx';

interface KPIData {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
  subtitle: string;
}

interface Filters {
  dateRange: string;
  location: string;
  metric: string;
}

const ExecutiveDashboard: React.FC = () => {
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [_filters, setFilters] = useState<Filters>({
    dateRange: '30d',
    location: 'all',
    metric: 'revenue'
  });

  // Mock KPI data
  const kpiData: KPIData[] = [
    {
      title: 'Total Revenue',
      value: '₹4,25,000',
      change: '+12.5%',
      changeType: 'positive',
      icon: 'TrendingUp',
      subtitle: 'This month'
    },
    {
      title: 'Active Orders',
      value: '156',
      change: '+8.2%',
      changeType: 'positive',
      icon: 'ShoppingCart',
      subtitle: 'Currently processing'
    },
    {
      title: 'Customer Satisfaction',
      value: '4.8/5',
      change: '+0.3',
      changeType: 'positive',
      icon: 'Star',
      subtitle: 'Average rating'
    },
    {
      title: 'Inventory Utilization',
      value: '78%',
      change: '-2.1%',
      changeType: 'negative',
      icon: 'Package',
      subtitle: 'Current usage'
    },
    {
      title: 'GST Compliance',
      value: '100%',
      change: '0%',
      changeType: 'neutral',
      icon: 'FileText',
      subtitle: 'Returns filed'
    },
    {
      title: 'Cash Flow',
      value: '₹1,85,000',
      change: '+15.8%',
      changeType: 'positive',
      icon: 'DollarSign',
      subtitle: 'Net positive'
    }
  ];

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleFilterChange = (newFilters: Filters): void => {
    setFilters(newFilters);
    // In a real app, this would trigger data refetch
    console.log('Filters changed:', newFilters);
  };

  const handleExport = (format: string): void => {
    console.log(`Exporting dashboard data as ${format}`);
    // In a real app, this would trigger export functionality
  };

  const handleRefresh = (): void => {
    setLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleApproval = (approval: any): void => {
    console.log('Approved:', approval);
    // In a real app, this would update the approval status
  };

  const handleRejection = (approval: any): void => {
    console.log('Rejected:', approval);
    // In a real app, this would update the approval status
  };

  const handleQuickAction = (actionId: string): void => {
    console.log('Quick action clicked:', actionId);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      // await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSearch = (query: string): void => {
    console.log('Search query:', query);
    // In a real app, this would handle search
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        onLogout={handleLogout}
        onSearch={handleSearch}
      />
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Executive Dashboard</h1>
              <p className="text-muted-foreground">
                Comprehensive business intelligence and operational oversight for Hybits CRM
              </p>
            </div>
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Icon name="Clock" size={16} />
                <span>Last updated: {new Date()?.toLocaleTimeString()}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                loading={loading}
                iconName="RefreshCw"
                iconPosition="left"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <FilterToolbar
            onFilterChange={handleFilterChange}
            onExport={handleExport}
            onRefresh={handleRefresh}
          />

          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {kpiData?.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi?.title}
                value={kpi?.value}
                change={kpi?.change}
                changeType={kpi?.changeType}
                icon={kpi?.icon}
                subtitle={kpi?.subtitle}
                loading={loading}
              />
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Revenue Chart - Takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-foreground">Revenue Trends</h3>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">Line</Button>
                    <Button variant="outline" size="sm">Area</Button>
                  </div>
                </div>
                <RevenueChart type="area" height={350} />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-lg p-6">
              <QuickActions onActionClick={handleQuickAction} />
            </div>
          </div>

          {/* Secondary Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Activity Feed */}
            <div className="bg-card border border-border rounded-lg p-6">
              <ActivityFeed maxItems={8} />
            </div>

            {/* Pending Approvals */}
            <div className="bg-card border border-border rounded-lg p-6">
              <PendingApprovals
                onApprove={handleApproval}
                onReject={handleRejection}
              />
            </div>

            {/* Inventory Overview */}
            <div className="bg-card border border-border rounded-lg p-6">
              <InventoryOverview showChart={true} />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between text-sm text-muted-foreground">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <span>© {new Date()?.getFullYear()} Hybits CRM. All rights reserved.</span>
                <span>•</span>
                <span>Version 2.1.0</span>
              </div>
              <div className="flex items-center space-x-4">
                <button className="hover:text-foreground transition-colors">Support</button>
                <span>•</span>
                <button className="hover:text-foreground transition-colors">Documentation</button>
                <span>•</span>
                <button className="hover:text-foreground transition-colors">API Status</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExecutiveDashboard;
