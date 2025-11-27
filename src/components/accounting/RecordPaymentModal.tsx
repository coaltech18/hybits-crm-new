// ============================================================================
// RECORD PAYMENT MODAL COMPONENT
// ============================================================================

import React, { useState } from 'react';
import { PaymentService, PaymentFormData } from '@/services/paymentService';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber?: string;
  onPaymentRecorded: () => void;
}

const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  onPaymentRecorded
}) => {
  const { currentOutlet } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PaymentFormData>({
    invoice_id: invoiceId,
    amount: 0,
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0] || '',
    reference_number: '',
    notes: ''
  });

  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'online', label: 'Online' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate amount
    if (formData.amount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);

      await PaymentService.createPayment({
        ...formData,
        ...(currentOutlet?.id && { outlet_id: currentOutlet.id })
      });

      // Reset form
      setFormData({
        invoice_id: invoiceId,
        amount: 0,
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0] || '',
        reference_number: '',
        notes: ''
      });

      // Close modal and trigger refresh
      onPaymentRecorded();
      onClose();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setFormData({
        invoice_id: invoiceId,
        amount: 0,
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0] || '',
        reference_number: '',
        notes: ''
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Record Payment</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {invoiceNumber ? `Invoice: ${invoiceNumber}` : 'Record a new payment'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step={0.01}
              min={0.01}
              required
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <Select
              options={paymentMethodOptions}
              value={formData.payment_method}
              onChange={(value) => setFormData({ ...formData, payment_method: value as PaymentFormData['payment_method'] })}
              required
            />
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              required
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            />
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Reference Number
            </label>
            <Input
              type="text"
              value={formData.reference_number || ''}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              placeholder="Transaction ID, cheque number, etc."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this payment..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Icon name="loader" size={16} className="mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Icon name="check" size={16} className="mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal;

