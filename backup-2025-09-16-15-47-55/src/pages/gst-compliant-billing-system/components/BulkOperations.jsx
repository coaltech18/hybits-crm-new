import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';

const BulkOperations = ({ selectedInvoices, onBulkAction, onClose }) => {
  const [selectedOperation, setSelectedOperation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const operationOptions = [
    { value: 'email', label: 'Send Email Invoices', icon: 'Mail' },
    { value: 'reminder', label: 'Send Payment Reminders', icon: 'Bell' },
    { value: 'export', label: 'Export to Excel', icon: 'FileSpreadsheet' },
    { value: 'mark-paid', label: 'Mark as Paid', icon: 'CheckCircle' },
    { value: 'apply-discount', label: 'Apply Bulk Discount', icon: 'Percent' },
    { value: 'update-terms', label: 'Update Payment Terms', icon: 'Calendar' },
    { value: 'generate-pdf', label: 'Generate PDF Batch', icon: 'FileText' },
    { value: 'cancel', label: 'Cancel Invoices', icon: 'X' }
  ];

  const mockInvoiceDetails = [
    { id: 1, number: 'INV-2024-001', customer: 'Rajesh Enterprises', amount: 25680, status: 'pending' },
    { id: 2, number: 'INV-2024-002', customer: 'Mumbai Caterers Ltd', amount: 45200, status: 'partial' },
    { id: 3, number: 'INV-2024-003', customer: 'Golden Events', amount: 18900, status: 'pending' },
    { id: 4, number: 'INV-2024-005', customer: 'Celebration Hub', amount: 32400, status: 'overdue' },
    { id: 5, number: 'INV-2024-007', customer: 'Elite Catering', amount: 56700, status: 'pending' }
  ];

  const selectedInvoiceDetails = mockInvoiceDetails?.filter(inv => 
    selectedInvoices?.includes(inv?.id)
  );

  const handleExecute = async () => {
    if (!selectedOperation || selectedInvoices?.length === 0) return;

    setIsProcessing(true);
    setProcessedCount(0);

    // Simulate processing with progress
    for (let i = 0; i <= selectedInvoices?.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setProcessedCount(i);
    }

    setIsProcessing(false);
    onBulkAction(selectedOperation, selectedInvoices);
  };

  const getOperationIcon = (operation) => {
    const config = operationOptions?.find(op => op?.value === operation);
    return config ? config?.icon : 'Settings';
  };

  const getOperationDescription = (operation) => {
    const descriptions = {
      'email': 'Send invoice PDFs to customer email addresses',
      'reminder': 'Send payment reminder notifications via email and SMS',
      'export': 'Export selected invoices to Excel spreadsheet',
      'mark-paid': 'Mark all selected invoices as fully paid',
      'apply-discount': 'Apply percentage discount to selected invoices',
      'update-terms': 'Update payment terms for selected invoices',
      'generate-pdf': 'Generate PDF files for all selected invoices',
      'cancel': 'Cancel selected invoices (irreversible action)'
    };
    return descriptions?.[operation] || 'Perform bulk operation on selected invoices';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const totalAmount = selectedInvoiceDetails?.reduce((sum, inv) => sum + inv?.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Bulk Operations</h2>
            <p className="text-sm text-muted-foreground">
              {selectedInvoices?.length} invoice{selectedInvoices?.length > 1 ? 's' : ''} selected
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Operation Selection */}
          <div>
            <Select
              label="Select Operation"
              options={operationOptions}
              value={selectedOperation}
              onChange={setSelectedOperation}
              placeholder="Choose bulk operation..."
            />
            {selectedOperation && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Icon name={getOperationIcon(selectedOperation)} size={16} className="text-primary" />
                  <span className="font-medium text-foreground">
                    {operationOptions?.find(op => op?.value === selectedOperation)?.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getOperationDescription(selectedOperation)}
                </p>
              </div>
            )}
          </div>

          {/* Selected Invoices Summary */}
          <div>
            <h3 className="font-medium text-foreground mb-3">Selected Invoices</h3>
            <div className="bg-muted/50 rounded-lg p-3 mb-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold text-primary">{selectedInvoices?.length}</p>
                  <p className="text-xs text-muted-foreground">Invoices</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-success">{formatCurrency(totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">Total Value</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-accent">
                    {new Set(selectedInvoiceDetails.map(inv => inv.customer))?.size}
                  </p>
                  <p className="text-xs text-muted-foreground">Customers</p>
                </div>
              </div>
            </div>

            {/* Invoice List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedInvoiceDetails?.map((invoice) => (
                <div key={invoice?.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-foreground">{invoice?.number}</div>
                    <div className="text-xs text-muted-foreground">{invoice?.customer}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm text-foreground">{formatCurrency(invoice?.amount)}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${
                      invoice?.status === 'paid' ? 'bg-success/20 text-success' :
                      invoice?.status === 'overdue' ? 'bg-error/20 text-error' :
                      invoice?.status === 'partial'? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning'
                    }`}>
                      {invoice?.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Processing Progress */}
          {isProcessing && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="animate-spin">
                  <Icon name="Loader2" size={20} className="text-primary" />
                </div>
                <span className="font-medium text-foreground">Processing...</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(processedCount / selectedInvoices?.length) * 100}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {processedCount} of {selectedInvoices?.length} invoices processed
              </div>
            </div>
          )}

          {/* Operation-specific Options */}
          {selectedOperation === 'apply-discount' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-3">Discount Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Discount Type</label>
                  <select className="w-full p-2 border border-border rounded bg-input text-foreground">
                    <option>Percentage</option>
                    <option>Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Discount Value</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-border rounded bg-input text-foreground"
                    placeholder="Enter value"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedOperation === 'update-terms' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-3">Payment Terms</h4>
              <select className="w-full p-2 border border-border rounded bg-input text-foreground">
                <option>15 days</option>
                <option>30 days</option>
                <option>45 days</option>
                <option>60 days</option>
                <option>Immediate</option>
              </select>
            </div>
          )}

          {/* Warning for Destructive Actions */}
          {selectedOperation === 'cancel' && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Icon name="AlertTriangle" size={16} className="text-error" />
                <span className="font-medium text-error">Warning: Irreversible Action</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Cancelling invoices cannot be undone. This will permanently mark the selected invoices as cancelled.
              </p>
              <div className="mt-3">
                <Checkbox label="I understand this action cannot be reversed" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {selectedInvoices?.length} invoice{selectedInvoices?.length > 1 ? 's' : ''} will be affected
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleExecute}
              disabled={!selectedOperation || isProcessing}
              loading={isProcessing}
              iconName={selectedOperation ? getOperationIcon(selectedOperation) : 'Play'}
              iconPosition="left"
            >
              {isProcessing ? 'Processing...' : 'Execute Operation'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkOperations;