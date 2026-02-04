import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getInvoiceById, issueInvoice, cancelInvoice } from '@/services/invoiceService';
import { getPaymentSummary } from '@/services/paymentService';
import { downloadInvoicePDF } from '@/utils/invoicePdfGenerator';
import type { Invoice, Payment, PaymentStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, roundCurrency } from '@/utils/format';
import { formatDate } from '@/utils/billingDate';
import AddPaymentModal from '@/components/payments/AddPaymentModal';
import { Download } from 'lucide-react';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'issue' | 'cancel' | null>(null);

  // Payment state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{
    amount_paid: number;
    balance_due: number;
    payment_status: PaymentStatus;
  } | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);

  useEffect(() => {
    loadInvoice();
    loadPayments();
  }, [id]);

  async function loadInvoice() {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getInvoiceById(id);

      if (!data) {
        setError('Invoice not found or you do not have access');
        return;
      }

      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    if (!id) return;

    try {
      const summary = await getPaymentSummary(id);
      setPayments(summary.payments);
      setPaymentSummary({
        amount_paid: summary.amount_paid,
        balance_due: summary.balance_due,
        payment_status: summary.payment_status,
      });
    } catch (err) {
      // Silently fail if payments can't be loaded
      console.error('Failed to load payments:', err);
    }
  }

  async function handleAction(action: 'issue' | 'cancel') {
    if (!user?.id || !id) return;

    try {
      setActionLoading(true);
      setError(null);

      if (action === 'issue') {
        await issueInvoice(user.id, id);
      } else if (action === 'cancel') {
        await cancelInvoice(user.id, id);
      }

      setConfirmAction(null);
      await loadInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} invoice`);
    } finally {
      setActionLoading(false);
    }
  }

  function handlePaymentAdded() {
    setShowAddPayment(false);
    loadPayments();
  }

  function getPaymentStatusBadge(status: PaymentStatus) {
    const variants = {
      unpaid: 'destructive' as const,
      partially_paid: 'default' as const,
      paid: 'success' as const,
    };
    return <Badge variant={variants[status]}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">{error || 'Invoice not found'}</Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const statusVariants = {
    draft: 'default' as const,
    issued: 'success' as const,
    cancelled: 'secondary' as const,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoice {invoice.invoice_number}</h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {invoice.invoice_type} Invoice
          </p>
        </div>
        <div className="flex gap-2">
          {/* Download PDF button - always visible for issued invoices */}
          {invoice.status === 'issued' && (
            <Button
              variant="outline"
              onClick={() => downloadInvoicePDF(invoice)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          )}
          {user?.role !== 'accountant' && invoice.status === 'draft' && (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirmAction('issue')}
                disabled={actionLoading}
              >
                Issue Invoice
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmAction('cancel')}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Invoice Status */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Status</h2>
            <Badge variant={statusVariants[invoice.status]} className="mt-2">
              {invoice.status.toUpperCase()}
            </Badge>
          </div>
          {invoice.issued_at && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Issued On</p>
              <p className="font-medium">{formatDate(invoice.issued_at, 'long')}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Client & Outlet Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Bill To</h2>
          <div className="space-y-2">
            <p className="font-medium text-lg">{invoice.clients?.name}</p>
            <p className="text-sm text-muted-foreground">{invoice.clients?.phone}</p>
            <p className="text-sm text-muted-foreground">{invoice.clients?.email}</p>
            {invoice.clients?.gstin && (
              <p className="text-sm">
                <span className="font-medium">GSTIN:</span> {invoice.clients?.gstin}
              </p>
            )}
            {invoice.clients?.billing_address && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {invoice.clients?.billing_address}
              </p>
            )}
            <p className="text-sm mt-2">
              <span className="font-medium">GST Type:</span>{' '}
              <Badge variant={
                invoice.clients?.gst_type === 'sez' ? 'default' :
                  invoice.clients?.gst_type === 'export' ? 'secondary' : 'success'
              }>
                {invoice.clients?.gst_type?.toUpperCase() || 'DOMESTIC'}
              </Badge>
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">From</h2>
          <div className="space-y-2">
            <p className="font-medium text-lg">{invoice.outlets?.name}</p>
            <p className="text-sm text-muted-foreground">{invoice.outlets?.code}</p>
            <p className="text-sm text-muted-foreground">{invoice.outlets?.phone}</p>
            <p className="text-sm text-muted-foreground">{invoice.outlets?.email}</p>
            {invoice.outlets?.gstin && (
              <p className="text-sm">
                <span className="font-medium">GSTIN:</span> {invoice.outlets?.gstin}
              </p>
            )}
            {invoice.outlets?.address && (
              <p className="text-sm text-muted-foreground">
                {invoice.outlets?.address}, {invoice.outlets?.city}, {invoice.outlets?.state}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Event Info (for event invoices) */}
      {invoice.invoice_type === 'event' && invoice.events && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Event Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Event Name</p>
              <p className="font-medium">{invoice.events.event_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Event Date</p>
              <p className="font-medium">{formatDate(invoice.events.event_date, 'long')}</p>
            </div>
            {invoice.events.event_type && (
              <div>
                <p className="text-sm text-muted-foreground">Event Type</p>
                <p className="font-medium">{invoice.events.event_type}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Invoice Items */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Invoice Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 px-2">Description</th>
                <th className="text-right py-2 px-2">Qty</th>
                <th className="text-right py-2 px-2">Unit Price</th>
                <th className="text-right py-2 px-2">Amount</th>
                <th className="text-right py-2 px-2">Tax %</th>
                <th className="text-right py-2 px-2">Tax</th>
                <th className="text-right py-2 px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_items?.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 px-2">{item.description}</td>
                  <td className="text-right py-2 px-2">{item.quantity}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(item.line_total)}</td>
                  <td className="text-right py-2 px-2">{item.tax_rate}%</td>
                  <td className="text-right py-2 px-2">{formatCurrency(item.tax_amount)}</td>
                  <td className="text-right py-2 px-2 font-medium">
                    {formatCurrency(item.line_total + item.tax_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 space-y-2 border-t pt-4">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax Total:</span>
            <span className="font-medium">{formatCurrency(invoice.tax_total)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold border-t pt-2">
            <span>Grand Total:</span>
            <span className="font-bold">{formatCurrency(invoice.grand_total)}</span>
          </div>
        </div>
      </Card>

      {/* Payments Received */}
      {invoice.status === 'issued' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Payments Received</h2>
              {paymentSummary && (
                <div className="flex items-center gap-2 mt-1">
                  {getPaymentStatusBadge(paymentSummary.payment_status)}
                </div>
              )}
            </div>
            {user?.role !== 'accountant' && paymentSummary && paymentSummary.balance_due > 0 && (
              <Button onClick={() => setShowAddPayment(true)}>
                Record Payment
              </Button>
            )}
          </div>

          {/* Payment Summary */}
          {paymentSummary && (
            <div className="bg-muted p-4 rounded-md mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(paymentSummary.amount_paid)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className="text-lg font-semibold text-orange-600">
                    {formatCurrency(paymentSummary.balance_due)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Total</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(invoice.grand_total)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payments Table */}
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Method</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-left py-2 px-2">Reference</th>
                    <th className="text-right py-2 px-2">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => {
                    // Calculate running balance - use roundCurrency to prevent drift
                    const paymentsUpTo = payments.slice(index);
                    const amountPaid = roundCurrency(paymentsUpTo.reduce((sum, p) => sum + p.amount, 0));
                    const balanceAfter = roundCurrency(invoice.grand_total - amountPaid);

                    return (
                      <tr key={payment.id} className="border-b">
                        <td className="py-2 px-2 text-sm">
                          {formatDate(payment.payment_date, 'short')}
                        </td>
                        <td className="py-2 px-2 text-sm capitalize">
                          {payment.payment_method.replace('_', ' ')}
                        </td>
                        <td className="text-right py-2 px-2 font-medium text-green-600">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="py-2 px-2 text-sm text-muted-foreground">
                          {payment.reference_number || '-'}
                        </td>
                        <td className="text-right py-2 px-2 font-medium">
                          {formatCurrency(balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No payments recorded yet
            </p>
          )}
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Created:</span>{' '}
            <span className="font-medium">{new Date(invoice.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated:</span>{' '}
            <span className="font-medium">{new Date(invoice.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Add Payment Modal */}
      {showAddPayment && invoice && (
        <AddPaymentModal
          invoice={invoice}
          maxAmount={paymentSummary?.balance_due || 0}
          onClose={() => setShowAddPayment(false)}
          onSuccess={handlePaymentAdded}
        />
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">
              Confirm {confirmAction === 'issue' ? 'Issue' : 'Cancel'}
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to {confirmAction} this invoice?
              {confirmAction === 'issue' && (
                <span className="block mt-2 text-muted-foreground">
                  Once issued, the invoice cannot be edited.
                </span>
              )}
              {confirmAction === 'cancel' && (
                <span className="block mt-2 text-destructive font-medium">
                  This action cannot be undone. The invoice will be marked as cancelled.
                </span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={confirmAction === 'cancel' ? 'destructive' : 'default'}
                onClick={() => handleAction(confirmAction)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : `Yes, ${confirmAction}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
