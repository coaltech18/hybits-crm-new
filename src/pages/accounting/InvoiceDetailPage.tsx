// ============================================================================
// INVOICE DETAIL PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { InvoiceService, Invoice } from '@/services/invoiceService';
import { PaymentService, Payment } from '@/services/paymentService';
import RecordPaymentModal from '@/components/accounting/RecordPaymentModal';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';
import { hasPermission } from '@/utils/permissions';
import { supabase } from '@/lib/supabase';

const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadInvoice();
      loadPayments();
    }
  }, [id]);

  const loadInvoice = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const invoiceData = await InvoiceService.getInvoice(id);
      setInvoice(invoiceData);
    } catch (err: any) {
      console.error('Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    if (!id) return;

    try {
      const paymentsData = await PaymentService.getPaymentsForInvoice(id);
      setPayments(paymentsData);
    } catch (err: any) {
      console.error('Error loading payments:', err);
    }
  };

  const handlePaymentRecorded = () => {
    setShowRecordPaymentModal(false);
    loadInvoice();
    loadPayments();
  };

  const handleGeneratePdf = async () => {
    if (!id || !user) return;

    try {
      setGeneratingPdf(true);
      setPdfError(null);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token');
      }

      // Call Edge Function
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/generate-invoice-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const { url, key } = await response.json();
      
      // Reload invoice to get updated PDF fields
      await loadInvoice();
      
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setPdfError(err.message || 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = () => {
    if (invoice?.invoice_pdf_url) {
      const link = document.createElement('a');
      link.href = invoice.invoice_pdf_url;
      link.download = `invoice_${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Cash',
      upi: 'UPI',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      online: 'Online'
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error || 'Invoice not found'}
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/accounting/invoices')}>
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/accounting/invoices')}>
            <Icon name="arrow-left" size={16} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoice {invoice.invoice_number}</h1>
            <p className="text-muted-foreground mt-1">
              {invoice.customer_name} • {new Date(invoice.invoice_date).toLocaleDateString()}
            </p>
          </div>
        </div>
         <div className="flex space-x-2">
           {/* PDF Generation/View Buttons */}
           {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'accountant') && (
             <>
               {invoice?.invoice_pdf_url ? (
                 <>
                   <Button variant="outline" onClick={handleDownloadPdf}>
                     <Icon name="download" size={20} className="mr-2" />
                     Download PDF
                   </Button>
                   <a
                     href={invoice.invoice_pdf_url}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                   >
                     <Icon name="external-link" size={20} className="mr-2" />
                     Open PDF
                   </a>
                 </>
               ) : (
                 <Button onClick={handleGeneratePdf} disabled={generatingPdf}>
                   {generatingPdf ? (
                     <>
                       <Icon name="loader" size={20} className="mr-2 animate-spin" />
                       Generating...
                     </>
                   ) : (
                     <>
                       <Icon name="file-text" size={20} className="mr-2" />
                       Generate PDF
                     </>
                   )}
                 </Button>
               )}
             </>
           )}
           
           {/* Record Payment Button */}
          <Button onClick={() => setShowRecordPaymentModal(true)}>
            <Icon name="plus" size={20} className="mr-2" />
            Record Payment
          </Button>
         </div>
      </div>

      {/* Invoice Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Number:</span>
                <span className="font-medium text-foreground">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date:</span>
                <span className="font-medium text-foreground">
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span className="font-medium text-foreground">
                  {new Date(invoice.due_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{invoice.customer_name}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-medium text-foreground">₹{invoice.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Received:</span>
                <span className="font-medium text-foreground">
                  ₹{(invoice.payment_received || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance Due:</span>
                <span className="font-medium text-foreground">
                  ₹{((invoice.total_amount - (invoice.payment_received || 0))).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Status:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(invoice.payment_status)}`}>
                  {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      {invoice.items && invoice.items.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Invoice Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    GST Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      ₹{item.rate.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.gst_rate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      ₹{((item.quantity * item.rate) * (1 + item.gst_rate / 100)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* PDF Error Message */}
        {pdfError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">PDF Generation Error</h3>
                <p className="text-sm text-red-700 dark:text-red-300">{pdfError}</p>
              </div>
            </div>
          </div>
        )}

        {/* PDF Viewer */}
        {invoice?.invoice_pdf_url && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Invoice PDF</h3>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                    <Icon name="download" size={16} className="mr-2" />
                    Download
                  </Button>
                  <a
                    href={invoice.invoice_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="external-link" size={16} className="mr-2" />
                    Open in New Tab
                  </a>
                </div>
              </div>
            </div>
            <div className="p-6">
              <iframe
                src={invoice.invoice_pdf_url}
                className="w-full border border-border rounded-lg"
                style={{ height: '800px' }}
                title="Invoice PDF"
              />
            </div>
          </div>
      )}

      {/* Payment History */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Payment History</h3>
        </div>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Reference Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      ₹{payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {getPaymentMethodLabel(payment.payment_method)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {payment.reference_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            No payments recorded yet.
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <RecordPaymentModal
          isOpen={showRecordPaymentModal}
          onClose={() => setShowRecordPaymentModal(false)}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
};

export default InvoiceDetailPage;

