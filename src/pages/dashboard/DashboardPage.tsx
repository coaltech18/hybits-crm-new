import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { getDashboardStats, DashboardStats } from '@/services/dashboardService';
import { Users, FileText, Calendar, IndianRupee, AlertCircle } from 'lucide-react';

// ================================================================
// DASHBOARD PAGE
// ================================================================
// Displays real-time statistics for admin dashboard.
// All data fetched from database via dashboardService.
// ================================================================

export function DashboardPage() {
  // Set document title
  useDocumentTitle('Dashboard');

  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getDashboardStats(user.id);
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [user?.id]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-text">Dashboard</h1>
        <p className="text-brand-text/70 mt-1">
          Welcome back, {user?.full_name}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Stats Cards */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Total Clients */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text/70">Total Clients</p>
                <p className="text-3xl font-bold text-brand-primary mt-2">
                  {formatNumber(stats.totalClients)}
                </p>
                <p className="text-xs text-brand-text/50 mt-1">Active clients</p>
              </div>
              <div className="p-2 bg-brand-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-brand-primary" />
              </div>
            </div>
          </Card>

          {/* Active Subscriptions */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text/70">Active Subscriptions</p>
                <p className="text-3xl font-bold text-brand-primary mt-2">
                  {formatNumber(stats.activeSubscriptions)}
                </p>
                <p className="text-xs text-brand-text/50 mt-1">Recurring billing</p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Calendar className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </Card>

          {/* Total Invoices */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text/70">Total Invoices</p>
                <p className="text-3xl font-bold text-brand-primary mt-2">
                  {formatNumber(stats.totalInvoices)}
                </p>
                <p className="text-xs text-brand-text/50 mt-1">Issued invoices</p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </Card>

          {/* Outstanding Amount */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text/70">Outstanding</p>
                <p className="text-3xl font-bold text-orange-500 mt-2">
                  {formatCurrency(stats.outstandingAmount)}
                </p>
                <p className="text-xs text-brand-text/50 mt-1">Pending collection</p>
              </div>
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </Card>

          {/* Current Month Revenue */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text/70">This Month</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency(stats.currentMonthRevenue)}
                </p>
                <p className="text-xs text-brand-text/50 mt-1">Revenue (invoiced)</p>
              </div>
              <div className="p-2 bg-green-600/10 rounded-lg">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
