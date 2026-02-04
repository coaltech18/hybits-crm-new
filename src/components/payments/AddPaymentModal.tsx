import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createPayment } from '@/services/paymentService';
import type { Invoice, PaymentMethod } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { formatCurrency, roundCurrency, settleBalance, SETTLEMENT_TOLERANCE } from '@/utils/format';

interface AddPaymentModalProps {
  invoice: Invoice;
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPaymentModal({
  invoice,
  maxAmount,
  onClose,
  onSuccess,
}: AddPaymentModalProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;

    // Round to 2 decimal places immediately to prevent floating-point drift
    const amountNum = roundCurrency(parseFloat(amount));

    // Validation
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (amountNum > maxAmount + SETTLEMENT_TOLERANCE) {
      setError(`Payment amount cannot exceed balance due (${formatCurrency(settleBalance(maxAmount))})`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await createPayment(user.id, {
        invoice_id: invoice.id,
        amount: amountNum,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Record Payment</h2>

        {/* Invoice Info */}
        <div className="bg-muted p-4 rounded-md mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Invoice</p>
              <p className="font-semibold">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Client</p>
              <p className="font-semibold">{invoice.clients?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Invoice Total</p>
              <p className="font-semibold">{formatCurrency(invoice.grand_total)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Balance Due</p>
              <p className="font-semibold text-orange-600">{formatCurrency(settleBalance(maxAmount))}</p>
            </div>
          </div>
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <Input
            label="Payment Amount"
            type="number"
            min="0.01"
            step="0.01"
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            helperText={`Maximum: ${formatCurrency(settleBalance(maxAmount))}`}
          />

          {/* Payment Method */}
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            required
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </Select>

          {/* Payment Date */}
          <Input
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />

          {/* Reference Number */}
          <Input
            label="Reference Number"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Transaction ID, Cheque number, etc."
            helperText="Optional"
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              className="w-full border rounded-md p-2 min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes (optional)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
