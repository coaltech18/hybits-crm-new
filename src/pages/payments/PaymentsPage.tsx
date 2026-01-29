import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getPayments, deletePayment } from '@/services/paymentService';
import type { Payment, PaymentMethod } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/utils/format';
import { formatDate } from '@/utils/billingDate';

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    amount: number;
    invoiceNumber: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id, paymentMethod, dateFrom, dateTo, showDeleted]);

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {
        is_active: showDeleted ? undefined : true,
      };
      if (paymentMethod) filters.payment_method = paymentMethod;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const data = await getPayments(user.id, filters);
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(paymentId: string) {
    if (!user?.id) return;

    try {
      setActionLoading(paymentId);
      setError(null);

      await deletePayment(user.id, paymentId);
      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment');
    } finally {
      setActionLoading(null);
    }
  }

  function clearFilters() {
    setPaymentMethod('');
    setDateFrom('');
    setDateTo('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Calculate summary
  const activePayments = payments.filter(p => p.is_active);
  const totalAmount = activePayments.reduce((sum, p) => sum + p.amount, 0);
  const todayPayments = activePayments.filter(
    p => p.payment_date === new Date().toISOString().split('T')[0]
  );
  const todayTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage payments received
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Today's Payments</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(todayTotal)}</p>
          <p className="text-xs text-muted-foreground">{todayPayments.length} transactions</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Total (Filtered)</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-muted-foreground">{activePayments.length} payments</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">All Records</p>
          <p className="text-2xl font-bold">{payments.length}</p>
          <p className="text-xs text-muted-foreground">
            {payments.filter(p => !p.is_active).length} deleted
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
          >
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </Select>

          <Input
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <Input
            label="To Date"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <div className="flex flex-col justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Show deleted</span>
            </label>
            {(paymentMethod || dateFrom || dateTo) && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Payments Table */}
      <Card>
        {payments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Invoice #</th>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Method</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Reference</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className={`border-b hover:bg-muted/50 ${
                      !payment.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-sm">
                      {formatDate(payment.payment_date, 'short')}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/invoices/${payment.invoice_id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {payment.invoice_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm">{payment.client_name}</td>
                    <td className="py-3 px-4 text-sm capitalize">
                      {payment.payment_method.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {payment.reference_number || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {payment.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Deleted</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {user?.role !== 'accountant' && payment.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setConfirmDelete({
                                id: payment.id,
                                amount: payment.amount,
                                invoiceNumber: payment.invoice_number || 'Unknown',
                              })
                            }
                            disabled={actionLoading === payment.id}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this payment?
              <span className="block mt-2 font-medium">
                Amount: {formatCurrency(confirmDelete.amount)}
              </span>
              <span className="block">Invoice: {confirmDelete.invoiceNumber}</span>
              <span className="block mt-2 text-orange-600">
                This will mark the payment as inactive. The invoice balance will be recalculated.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={!!actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={!!actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
