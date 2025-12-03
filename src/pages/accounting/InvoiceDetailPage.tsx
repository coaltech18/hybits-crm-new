// ============================================================================
// INVOICE DETAIL PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { InvoiceService, Invoice } from '@/services/invoiceService';
import { PaymentService, Payment } from '@/services/paymentService';
import { OrderService } from '@/services/orderService';
import { AuditService, InvoiceCreationAudit } from '@/services/auditService';
import RecordPaymentModal from '@/components/accounting/RecordPaymentModal';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';
import { supabase } from '@/lib/supabase';

const InvoiceDetailPage: React.FC = () => {
  const params = useParams();
  const id = params.id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [hasFailedAttempts, setHasFailedAttempts] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditEntries, setAuditEntries] = useState<InvoiceCreationAudit[]>([]);

  useEffect(() => {
    if (id) {
      loadInvoice();
      loadPayments();
    }
  }, [id]);

  useEffect(() => {
    // Check for order_id and failed attempts when invoice loads
    if (invoice) {
      checkOrderAndFailedAttempts();
    }
  }, [invoice]);

  const checkOrderAndFailedAttempts = async () => {
    if (!invoice) return;

    try {
      // Fetch invoice with order_id
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('order_id')
        .eq('id', invoice.id)
        .single();

      if (invoiceData?.order_id) {
        setOrderId(invoiceData.order_id);
        const hasFailed = await AuditService.hasFailedInvoiceCreation(invoiceData.order_id);
        setHasFailedAttempts(hasFailed);
      }
    } catch (err) {
      console.error('Error checking order and failed attempts:', err);
    }
  };

  const loadInvoice = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const invoiceData = await InvoiceService.getInvoice(id);
      setInvoice(invoiceData);
      
      // Check for order_id after invoice loads
      if (invoiceData) {
        const { data: invoiceWithOrder } = await supabase
          .from('invoices')
          .select('order_id')
          .eq('id', id)
          .single();
        
        if (invoiceWithOrder?.order_id) {
          setOrderId(invoiceWithOrder.order_id);
          const hasFailed = await AuditService.hasFailedInvoiceCreation(invoiceWithOrder.order_id);
          setHasFailedAttempts(hasFailed);
        }
      }
    } catch (err: any) {
      console.error('Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
      
      // If invoice not found, check if there's an order_id in URL params or check for order
      // This handles the case where invoice creation failed
      if (err.message?.includes('not found')) {
        // Try to find order_id from URL or other means
        // For now, we'll rely on the user to provide order_id via URL param if needed
      }
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

  const handleRetryInvoiceCreation = async () => {
    if (!orderId) return;

    try {
      setIsRetrying(true);
      await OrderService.recreateInvoiceForOrder(orderId);
      
      // Show success message
      alert('Invoice recreated successfully');
      
      // Reload invoice
      await loadInvoice();
      await checkOrderAndFailedAttempts();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to recreate invoice';
      alert(`Invoice recreate failed: ${errorMsg.substring(0, 200)}`);
      
      // Open audit modal
      await loadAuditEntries();
      setShowAuditModal(true);
    } finally {
      setIsRetrying(false);
    }
  };

  const loadAuditEntries = async () => {
    if (!orderId) return;

    try {
      const entries = await AuditService.fetchInvoiceCreationAuditForOrder(orderId, 5);
      setAuditEntries(entries);
    } catch (err) {
      console.error('Error loading audit entries:', err);
    }
  };

  const handleOpenAuditModal = async () => {
    await loadAuditEntries();
    setShowAuditModal(true);
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
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

      await response.json();
      
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

          {/* Retry Invoice Creation Button - Show if order exists and has failed attempts or no invoice */}
          {orderId && (hasFailedAttempts || !invoice) && (
            <>
              <Button 
                onClick={handleRetryInvoiceCreation} 
                disabled={isRetrying}
                variant="outline"
              >
                {isRetrying ? (
                  <>
                    <Icon name="loader" size={20} className="mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <Icon name="refresh-cw" size={20} className="mr-2" />
                    Retry Invoice Creation
                  </>
                )}
              </Button>
              <Button 
                onClick={handleOpenAuditModal}
                variant="outline"
              >
                <Icon name="file-text" size={20} className="mr-2" />
                View Audit Log
              </Button>
            </>
          )}
         </div>
      </div>

      {/* Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Invoice Creation Audit Log</h2>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="x" size={24} />
              </button>
            </div>
            
            {auditEntries.length === 0 ? (
              <p className="text-muted-foreground">No audit entries found.</p>
            ) : (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Attempt</th>
                      <th className="text-left p-2 text-foreground">Status</th>
                      <th className="text-left p-2 text-foreground">Error</th>
                      <th className="text-left p-2 text-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border">
                        <td className="p-2 text-foreground">{entry.attempt_integer}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            entry.success 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {entry.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground text-xs">
                          {entry.error_message ? (
                            <span title={entry.error_message}>
                              {entry.error_message.length > 50 
                                ? entry.error_message.substring(0, 50) + '...' 
                                : entry.error_message}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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

