import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brand-text">Dashboard</h1>
        <p className="text-brand-text/70 mt-1">
          Welcome back, {user?.full_name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-brand-text">Total Clients</h3>
          <p className="text-3xl font-bold text-brand-primary mt-2">--</p>
          <p className="text-sm text-brand-text/70 mt-1">Coming in Phase 2</p>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-brand-text">Active Subscriptions</h3>
          <p className="text-3xl font-bold text-brand-primary mt-2">--</p>
          <p className="text-sm text-brand-text/70 mt-1">Coming in Phase 3</p>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-brand-text">Recent Invoices</h3>
          <p className="text-3xl font-bold text-brand-primary mt-2">--</p>
          <p className="text-sm text-brand-text/70 mt-1">Coming in Phase 5</p>
        </Card>
      </div>
    </div>
  );
}
