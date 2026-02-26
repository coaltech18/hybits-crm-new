import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, MoreVertical, Eye, Pencil, Download, XCircle, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getInvoices, finalizeInvoice, cancelInvoice } from '@/services/invoiceService';
import { downloadInvoicePDF } from '@/utils/invoicePdfGenerator';
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
    type: 'finalize' | 'cancel';
    invoiceId: string;
    invoiceNumber: string;
  } | null>(null);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [user?.id, selectedType, selectedStatus]);

  // Open dropdown positioned relative to viewport via trigger button rect
  const handleDropdownToggle = useCallback((invoiceId: string) => {
    if (openDropdown === invoiceId) {
      setOpenDropdown(null);
      setDropdownPos(null);
      return;
    }
    const btn = triggerRefs.current.get(invoiceId);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.right - 192, // 192px = w-48 dropdown width, right-aligned
      });
    }
    setOpenDropdown(invoiceId);
  }, [openDropdown]);

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    if (!openDropdown) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // Ignore clicks on the trigger button itself
      const triggerBtn = triggerRefs.current.get(openDropdown!);
      if (triggerBtn?.contains(target)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpenDropdown(null);
        setDropdownPos(null);
      }
    }
    function handleScroll() {
      setOpenDropdown(null);
      setDropdownPos(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [openDropdown]);

  async function loadData() {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const filters: Record<string, string> = {};
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

  async function handleAction(action: 'finalize' | 'cancel', invoiceId: string) {
    if (!user?.id) return;

    try {
      setActionLoading(invoiceId);

      if (action === 'finalize') {
        await finalizeInvoice(user.id, invoiceId);
        showToast('Invoice finalized successfully', 'success');
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
    const variants: Record<InvoiceStatus, 'default' | 'success' | 'secondary' | 'destructive'> = {
      draft: 'default',
      finalized: 'success',
      partially_paid: 'default',
      paid: 'success',
      cancelled: 'secondary',
    };
    const label = status.replace('_', ' ').toUpperCase();
    return <Badge variant={variants[status] || 'default'}>{label}</Badge>;
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
            <option value="finalized">Finalized</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
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
                      {/* Dropdown Trigger */}
                      <div className="flex justify-center">
                        <button
                          ref={(el) => { if (el) triggerRefs.current.set(invoice.id, el); }}
                          type="button"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400"
                          onClick={() => handleDropdownToggle(invoice.id)}
                          disabled={actionLoading === invoice.id}
                          aria-haspopup="true"
                          aria-expanded={openDropdown === invoice.id}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Portal-rendered Dropdown Menu — renders outside table to escape overflow clipping */}
      {openDropdown && dropdownPos && (() => {
        const activeInvoice = invoices.find(inv => inv.id === openDropdown);
        if (!activeInvoice) return null;

        const menuItemClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer transition-colors duration-100';

        return createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] w-48 rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
            }}
          >
            <div className="py-1">
              {/* View */}
              <button
                className={menuItemClass}
                onClick={() => {
                  setOpenDropdown(null);
                  navigate(`/invoices/${activeInvoice.id}`);
                }}
              >
                <Eye className="h-4 w-4 text-gray-400" />
                View
              </button>

              {/* Edit — draft only */}
              {user?.role !== 'accountant' && activeInvoice.status === 'draft' && (
                <button
                  className={menuItemClass}
                  onClick={() => {
                    setOpenDropdown(null);
                    navigate(`/invoices/${activeInvoice.id}/edit`);
                  }}
                >
                  <Pencil className="h-4 w-4 text-gray-400" />
                  Edit
                </button>
              )}

              {/* Download */}
              <button
                className={menuItemClass}
                onClick={async () => {
                  setOpenDropdown(null);
                  await downloadInvoicePDF(activeInvoice);
                }}
              >
                <Download className="h-4 w-4 text-gray-400" />
                {activeInvoice.status === 'draft' ? 'Download Draft' : 'Download Invoice'}
              </button>

              {/* Finalize — draft only */}
              {user?.role !== 'accountant' && activeInvoice.status === 'draft' && (
                <button
                  className={menuItemClass}
                  onClick={() => {
                    setOpenDropdown(null);
                    setConfirmAction({
                      type: 'finalize',
                      invoiceId: activeInvoice.id,
                      invoiceNumber: activeInvoice.invoice_number,
                    });
                  }}
                >
                  <FileText className="h-4 w-4 text-gray-400" />
                  Finalize & Issue
                </button>
              )}

              {/* Cancel — draft only */}
              {user?.role !== 'accountant' && activeInvoice.status === 'draft' && (
                <button
                  className={`${menuItemClass} !text-red-600 hover:!text-red-700 hover:!bg-red-50`}
                  onClick={() => {
                    setOpenDropdown(null);
                    setConfirmAction({
                      type: 'cancel',
                      invoiceId: activeInvoice.id,
                      invoiceNumber: activeInvoice.invoice_number,
                    });
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Invoice
                </button>
              )}

              {/* Separator + Duplicate */}
              <div className="border-t border-gray-100 my-1" />
              <button
                className={menuItemClass}
                onClick={() => {
                  setOpenDropdown(null);
                  navigate(`/invoices/create?duplicate=${activeInvoice.id}`);
                }}
              >
                <Copy className="h-4 w-4 text-gray-400" />
                Duplicate
              </button>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Confirmation Dialog - Finalize */}
      <ConfirmDialog
        isOpen={confirmAction?.type === 'finalize'}
        title="Finalize & Issue Invoice?"
        message={`Are you sure you want to finalize invoice ${confirmAction?.invoiceNumber}? After finalization, this invoice cannot be edited.`}
        confirmLabel="Yes, Finalize"
        variant="info"
        isLoading={!!actionLoading}
        onConfirm={() => confirmAction && handleAction('finalize', confirmAction.invoiceId)}
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
