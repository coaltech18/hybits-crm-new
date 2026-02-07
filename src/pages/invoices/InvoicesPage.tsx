import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getInvoices, issueInvoice, cancelInvoice } from '@/services/invoiceService';
import type { Invoice, InvoiceType, InvoiceStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency } from '@/utils/format';

export default function InvoicesPage() {
  useDocumentTitle('Invoices');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<InvoiceType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'issue' | 'cancel';
    invoiceId: string;
    invoiceNumber: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id, selectedType, selectedStatus]);

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (selectedType) filters.invoice_type = selectedType;
      if (selectedStatus) filters.status = selectedStatus;

      const data = await getInvoices(user.id, filters);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'issue' | 'cancel', invoiceId: string) {
    if (!user?.id) return;

    try {
      setActionLoading(invoiceId);

      if (action === 'issue') {
        await issueInvoice(user.id, invoiceId);
        showToast('Invoice issued successfully', 'success');
      } else if (action === 'cancel') {
        await cancelInvoice(user.id, invoiceId);
        showToast('Invoice cancelled', 'success');
      }

      setConfirmAction(null);
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${action} invoice`;
      showToast(errorMessage, 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: InvoiceStatus) {
    const variants = {
      draft: 'default' as const,
      issued: 'success' as const,
      cancelled: 'secondary' as const,
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  }

  function getTypeBadge(type: InvoiceType) {
    const colors = {
      subscription: 'bg-brand-primary/20 text-brand-primary',
      event: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colors[type]}`}>
        {type.toUpperCase()}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage subscription and event invoices
          </p>
        </div>
        {user?.role !== 'accountant' && (
          <Link to="/invoices/create">
            <Button>+ Create Invoice</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Invoice Type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as InvoiceType | '')}
          >
            <option value="">All Types</option>
            <option value="subscription">Subscription</option>
            <option value="event">Event</option>
          </Select>

          <Select
            label="Status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as InvoiceStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          {(selectedType || selectedStatus) && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedType('');
                  setSelectedStatus('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Empty State */}
      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description={user?.role !== 'accountant' ? "Create your first invoice to start billing." : "No invoices match your current filters."}
            action={user?.role !== 'accountant' ? { label: 'Create Invoice', onClick: () => navigate('/invoices/create') } : undefined}
          />
        </Card>
      ) : (
        /* Invoices Table */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4">Invoice #</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Client</th>
                  <th className="text-left py-3 px-4">Event</th>
                  <th className="text-right py-3 px-4">Subtotal</th>
                  <th className="text-right py-3 px-4">Tax</th>
                  <th className="text-right py-3 px-4">Total</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="text-brand-primary hover:underline font-medium"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4">{getTypeBadge(invoice.invoice_type)}</td>
                    <td className="py-3 px-4 text-sm">
                      {invoice.clients?.name || 'Unknown Client'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {invoice.events?.event_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(invoice.subtotal)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(invoice.tax_total)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatCurrency(invoice.grand_total)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(invoice.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {user?.role !== 'accountant' && invoice.status === 'draft' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'issue',
                                  invoiceId: invoice.id,
                                  invoiceNumber: invoice.invoice_number,
                                })
                              }
                              disabled={actionLoading === invoice.id}
                            >
                              Issue
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'cancel',
                                  invoiceId: invoice.id,
                                  invoiceNumber: invoice.invoice_number,
                                })
                              }
                              disabled={actionLoading === invoice.id}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        <Link to={`/invoices/${invoice.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmation Dialog - Issue */}
      <ConfirmDialog
        isOpen={confirmAction?.type === 'issue'}
        title="Issue Invoice?"
        message={`Are you sure you want to issue invoice ${confirmAction?.invoiceNumber}? Once issued, the invoice cannot be edited.`}
        confirmLabel="Yes, Issue"
        variant="info"
        isLoading={!!actionLoading}
        onConfirm={() => confirmAction && handleAction('issue', confirmAction.invoiceId)}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirmation Dialog - Cancel */}
      <ConfirmDialog
        isOpen={confirmAction?.type === 'cancel'}
        title="Cancel Invoice?"
        message={`Are you sure you want to cancel invoice ${confirmAction?.invoiceNumber}? This action cannot be undone.`}
        confirmLabel="Yes, Cancel Invoice"
        variant="danger"
        isLoading={!!actionLoading}
        onConfirm={() => confirmAction && handleAction('cancel', confirmAction.invoiceId)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
