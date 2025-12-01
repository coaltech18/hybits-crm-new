// ============================================================================
// OVERDUE RUNNER PAGE (Admin)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { runMarkOverdue, fetchOverdueInvoices, OverdueInvoice } from '@/services/overdueService';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

const OverdueRunnerPage: React.FC = () => {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);
  const [overdues, setOverdues] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  // Load recent overdue invoices on mount
  useEffect(() => {
    loadOverdueInvoices();
  }, []);

  const loadOverdueInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOverdueInvoices(10);
      setOverdues(data);
    } catch (err: any) {
      console.error('Error loading overdue invoices:', err);
      setError(err.message || 'Failed to load overdue invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runMarkOverdue();
      setUpdatedCount(result.updatedCount);
      setLastRunTime(new Date());
      
      // Reload overdue invoices to show updated list
      await loadOverdueInvoices();
      
      // Show success message
      alert(`Successfully marked ${result.updatedCount} invoice(s) as overdue.`);
    } catch (err: any) {
      console.error('Error running overdue routine:', err);
      setError(err.message || 'Failed to run overdue routine');
      alert('Error: ' + (err.message || String(err)));
    } finally {
      setRunning(false);
    }
  };

  // Check if user has admin or manager role
  const hasPermission = user?.role === 'admin' || user?.role === 'manager';

  if (!hasPermission) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Access denied. This page is only available to administrators and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Overdue Invoices Runner</h1>
        <p className="text-gray-600">
          Manually trigger the overdue invoice marking routine. This will mark all invoices with past due dates 
          and unpaid/partial payment status as overdue.
        </p>
      </div>

      {/* Action Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Run Overdue Routine</h2>
            <p className="text-sm text-gray-600">
              Click the button below to mark overdue invoices now.
            </p>
          </div>
          <Button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2"
          >
            {running ? (
              <>
                <Icon name="loader" className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Icon name="refresh-cw" />
                <span>Run Overdue Routine Now</span>
              </>
            )}
          </Button>
        </div>

        {updatedCount !== null && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Successfully marked <strong>{updatedCount}</strong> invoice(s) as overdue.
            </p>
            {lastRunTime && (
              <p className="text-sm text-green-600 mt-1">
                Last run: {lastRunTime.toLocaleString()}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}
      </div>

      {/* Recent Overdue Invoices Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Overdue Invoices</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing the last 10 invoices marked as overdue.
          </p>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <Icon name="loader" className="animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600 mt-2">Loading overdue invoices...</p>
          </div>
        ) : overdues.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No overdue invoices found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outlet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {overdues.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number || invoice.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.order_id ? invoice.order_id.substring(0, 8) + '...' : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.customer_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.outlet_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        {invoice.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scheduling Instructions */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Scheduling Instructions</h3>
        <p className="text-sm text-blue-800 mb-4">
          To schedule this routine to run automatically daily at 02:00, use one of the following methods:
        </p>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Option 1: Using pg_cron (if available)</h4>
            <pre className="bg-blue-100 p-3 rounded text-xs overflow-x-auto">
{`SELECT cron.schedule(
  'daily_mark_overdue',
  '0 2 * * *',
  $$SELECT public.mark_overdue_invoices();$$
);`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-blue-900 mb-2">Option 2: Using Supabase Platform Scheduler</h4>
            <p className="text-sm text-blue-800 mb-2">
              Create a new scheduled job in Supabase Dashboard:
            </p>
            <pre className="bg-blue-100 p-3 rounded text-xs overflow-x-auto">
{`SELECT public.mark_overdue_invoices();`}
            </pre>
            <p className="text-sm text-blue-800 mt-2">
              Set schedule: <code className="bg-blue-200 px-1 rounded">0 2 * * *</code> (02:00 daily) and use service key / privileged role.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-blue-900 mb-2">Option 3: Using OS Cron (calls edge function)</h4>
            <pre className="bg-blue-100 p-3 rounded text-xs overflow-x-auto">
{`# crontab entry (runs daily at 02:00)
0 2 * * * curl -X POST "https://<your-project>.supabase.co/functions/v1/run-mark-overdue" \\
  -H "Authorization: Bearer <SERVICE_KEY>"`}
            </pre>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Important:</strong> Only an operator with access to service keys should schedule the job. 
              Do NOT bake service keys into code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverdueRunnerPage;

