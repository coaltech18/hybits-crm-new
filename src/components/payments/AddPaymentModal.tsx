import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createPayment } from '@/services/paymentService';
import type { Invoice, PaymentMethod } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { formatCurrency, roundCurrency, settleBalance, SETTLEMENT_TOLERANCE } from '@/utils/format';
import { todayISO, toLocalISODate } from '@/utils/date';

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
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard: `submitting` state is not updated until re-render,
  // so a fast double click could otherwise record the payment twice.
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Local (IST) calendar dates; toISOString() would give the UTC date.
  const [today] = useState(todayISO);
  const minDate = invoice.issued_at ? toLocalISODate(new Date(invoice.issued_at)) : undefined;

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(today);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Presentational only: the settled balance shown at the top and used by
  // the "Pay full balance" shortcut, which just fills the amount field.
  const balanceDue = settleBalance(maxAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || submittingRef.current) return;

    // Round to 2 decimal places immediately to prevent floating-point drift
    const amountNum = roundCurrency(parseFloat(amount));

    // Validation
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (amountNum > roundCurrency(maxAmount + SETTLEMENT_TOLERANCE)) {
      setError(`Payment amount cannot exceed balance due (${formatCurrency(settleBalance(maxAmount))})`);
      return;
    }

    if (!paymentDate || paymentDate > today) {
      setError('Payment date cannot be in the future');
      return;
    }

    if (minDate && paymentDate < minDate) {
      setError('Payment date cannot be before the invoice date');
      return;
    }

    try {
      submittingRef.current = true;
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

      // The DB moves the invoice status with the payment; onSuccess re-fetches the invoice.
      showToast('Payment recorded', 'success');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record payment"
      description={`Against invoice ${invoice.invoice_number ?? '(unnumbered)'}`}
      maxWidth="lg"
      dismissable={!submitting}
    >
      {/* Balance first: the figure the payment is measured against. */}
      <div className="mb-5 rounded-lg border border-rule bg-paper-sunk px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Balance due</div>
        <div className={`amount mt-1 text-3xl font-bold tracking-tight ${balanceDue > 0 ? 'text-ink' : 'text-stamp'}`}>
          {formatCurrency(balanceDue)}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-3 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-ink-muted">Invoice</dt>
            <dd className="serial truncate font-medium text-ink">{invoice.invoice_number ?? '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-ink-muted">Invoice total</dt>
            <dd className="amount font-medium text-ink">{formatCurrency(invoice.grand_total)}</dd>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className="text-ink-muted">Client</dt>
            <dd className="truncate font-medium text-ink">{invoice.clients?.name ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount, with a shortcut that only fills the field. */}
        <div>
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={roundCurrency(maxAmount + SETTLEMENT_TOLERANCE)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            data-autofocus
            helperText={`Up to ${formatCurrency(balanceDue)}`}
          />
          {balanceDue > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-3 mt-1 text-brand-primary hover:text-brand-primaryDark"
              onClick={() => setAmount(balanceDue.toFixed(2))}
              disabled={submitting}
            >
              Pay full balance ({formatCurrency(balanceDue)})
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            required
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </Select>

          <DateInput
            label="Payment date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            min={minDate}
            max={today}
            required
          />
        </div>

        <Input
          label="Reference"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="UPI transaction ID, cheque number…"
          helperText="Optional"
        />

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering about this payment"
          helperText="Optional"
        />

        {/* Action bar, pinned to the bottom of the scrolling dialog body. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-rule bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} isLoading={submitting}>
            {submitting ? 'Recording…' : 'Record payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
