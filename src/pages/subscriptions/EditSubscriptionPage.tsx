import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getSubscriptionById,
  updateSubscription,
  isSubscriptionPriceLocked,
} from '@/services/subscriptionService';
import type { Subscription, UpdateSubscriptionInput, BillingCycle } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { formatDate } from '@/utils/billingDate';
import { formatCurrency } from '@/utils/format';
import { CollapsibleSection, FormSection, StickyActions, ValueReadout } from './SubscriptionFormParts';
import { PlannedKit, QuestionnaireAnswers } from './SubscriptionReference';

// ================================================================
// EDIT SUBSCRIPTION — the same sectioned sheet as "New subscription".
// Client, outlet and start date are fixed; the cycle, quantity, price
// and pricing notes can change. A price change asks for a reason, and
// the price locks once finalized subscription invoices exist.
// The questionnaire and kit are shown read-only (not editable here).
// ================================================================

export default function EditSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Edit subscription');
  useDocumentTitle(pageTitle);

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // V1: Track if finalized invoices exist (blocks price change)
  const [hasFinalizedInvoices, setHasFinalizedInvoices] = useState(false);
  const [checkingInvoices, setCheckingInvoices] = useState(true);
  // The lock check itself failed: the price stays locked, but say why honestly
  const [lockCheckFailed, setLockCheckFailed] = useState(false);

  // V1: Price change modal
  const [showPriceChangeModal, setShowPriceChangeModal] = useState(false);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  const [originalPrice, setOriginalPrice] = useState<number>(0);

  // Form state
  const [formData, setFormData] = useState<UpdateSubscriptionInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Presentational: the read-only questionnaire/kit panel
  const [showReference, setShowReference] = useState(false);

  // Only the latest load may write state (the :id can change while a load is in flight).
  const requestId = useRef(0);

  const loadSubscription = useCallback(async () => {
    if (!id) return;
    const req = ++requestId.current;

    try {
      setLoading(true);
      setError(null);
      setErrors({});
      setSubscription(null);
      const data = await getSubscriptionById(id);
      if (req !== requestId.current) return;

      if (!data) {
        setError('Subscription not found');
        return;
      }

      setSubscription(data);
      setOriginalPrice(data.price_per_unit);
      setPageTitle(`Edit subscription · ${data.clients?.name || 'Details'}`);

      // Initialize form with current values
      setFormData({
        billing_cycle: data.billing_cycle,
        billing_day: data.billing_day || undefined,
        quantity: data.quantity,
        price_per_unit: data.price_per_unit,
        notes: data.notes || '',
      });

      // V1: Check if finalized invoices exist (lock the price on any doubt)
      setCheckingInvoices(true);
      setLockCheckFailed(false);
      try {
        const locked = await isSubscriptionPriceLocked(data);
        if (req !== requestId.current) return;
        setHasFinalizedInvoices(locked);
      } catch {
        if (req !== requestId.current) return;
        setHasFinalizedInvoices(true);
        setLockCheckFailed(true);
      } finally {
        if (req === requestId.current) setCheckingInvoices(false);
      }
    } catch (err) {
      if (req === requestId.current) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
      }
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  function handleChange<K extends keyof UpdateSubscriptionInput>(
    field: K,
    value: UpdateSubscriptionInput[K]
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    if (error) {
      setError(null);
    }
  }

  // Only send fields that actually differ from the stored subscription
  function buildChanges(): UpdateSubscriptionInput {
    if (!subscription) return {};
    const changes: UpdateSubscriptionInput = {};

    const cycle = formData.billing_cycle ?? subscription.billing_cycle;
    if (cycle !== subscription.billing_cycle) {
      changes.billing_cycle = cycle;
    }

    const day = cycle === 'monthly' ? formData.billing_day ?? null : null;
    if (day !== subscription.billing_day) {
      changes.billing_day = day;
    }

    if (formData.quantity !== undefined && formData.quantity !== subscription.quantity) {
      changes.quantity = formData.quantity;
    }

    if (formData.price_per_unit !== undefined && formData.price_per_unit !== subscription.price_per_unit) {
      changes.price_per_unit = formData.price_per_unit;
    }

    if (formData.notes !== undefined && formData.notes.trim() !== (subscription.notes || '').trim()) {
      changes.notes = formData.notes.trim();
    }

    return changes;
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (formData.billing_cycle === 'monthly') {
      if (!formData.billing_day || formData.billing_day < 1 || formData.billing_day > 28) {
        newErrors.billing_day = 'Billing day must be between 1 and 28';
      }
    }

    if (formData.quantity !== undefined && formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (formData.price_per_unit !== undefined && formData.price_per_unit < 0) {
      newErrors.price_per_unit = 'Price must be 0 or greater';
    }

    // V1: Pricing notes are mandatory (same rule as on create)
    if (!formData.notes || !formData.notes.trim()) {
      newErrors.notes = 'Pricing notes / justification is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // V1: Check if price changed and prompt for reason
  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault();

    if (submitting || !validateForm()) return;

    // Check if price changed
    const priceChanged = buildChanges().price_per_unit !== undefined;

    if (priceChanged) {
      // Show modal to get reason
      setShowPriceChangeModal(true);
    } else {
      // No price change, submit directly
      submitForm();
    }
  }

  async function submitForm(reason?: string) {
    if (!user?.id || !id || submitting) return;

    const updateData = buildChanges();

    if (Object.keys(updateData).length === 0) {
      showToast('No changes to save', 'info');
      navigate(`/subscriptions/${id}`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // V1: Include price change reason if provided
      if (reason && updateData.price_per_unit !== undefined) {
        updateData.price_change_reason = reason;
      }

      await updateSubscription(user.id, id, updateData);
      showToast('Subscription updated successfully', 'success');
      navigate(`/subscriptions/${id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update subscription';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setShowPriceChangeModal(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePriceChangeConfirm() {
    if (!priceChangeReason.trim()) {
      return; // Button should be disabled, but double-check
    }
    setShowPriceChangeModal(false);
    submitForm(priceChangeReason.trim());
  }

  if (loading) {
    return (
      <div className="max-w-3xl" role="status" aria-label="Loading subscription">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="mb-2 h-8 w-64 max-w-full" />
        <Skeleton className="mb-8 h-4 w-48" />
        <div className="sheet space-y-4 p-6">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-3xl">
        <PageHeader back={{ to: '/subscriptions', label: 'Subscriptions' }} title="Subscription not found" />
        <Alert variant="error">{error || 'Subscription not found'}</Alert>
        <LinkButton to="/subscriptions" variant="outline" className="mt-4">
          Back to subscriptions
        </LinkButton>
      </div>
    );
  }

  const priceChanged = formData.price_per_unit !== undefined &&
    formData.price_per_unit !== originalPrice;
  const isCancelled = subscription.status === 'cancelled';
  const clientName = subscription.clients?.name || 'Unknown client';

  function closePriceModal() {
    setShowPriceChangeModal(false);
    setPriceChangeReason('');
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ to: `/subscriptions/${id}`, label: clientName }}
        title="Edit subscription"
        description={[clientName, subscription.outlets?.name].filter(Boolean).join(' · ')}
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {isCancelled && (
        <Alert variant="warning" className="mb-6">
          This subscription is cancelled and can no longer be changed.
        </Alert>
      )}

      <form onSubmit={handleSubmitClick} className="sheet divide-y divide-rule">
        {/* Fixed facts */}
        <FormSection title="Subscription" description="These are fixed once the subscription is created.">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Fact label="Client">{clientName}</Fact>
            <Fact label="Outlet">{subscription.outlets?.name || '—'}</Fact>
            <Fact label="Start date">{formatDate(subscription.start_date, 'long')}</Fact>
            <Fact label="Status">
              <StatusBadge kind="subscription" status={subscription.status} />
            </Fact>
            {subscription.status === 'active' && (
              <Fact label="Next billing date (planned)">
                {formatDate(subscription.next_billing_date, 'long')}
                <span className="block text-sm font-normal text-ink-muted">Worked out from the cycle; it can't be set by hand.</span>
              </Fact>
            )}
          </dl>
        </FormSection>

        {!isCancelled && (
          <>
            <FormSection title="Billing cycle" description="Changes apply to future invoices only.">
              <div className="grid gap-5 md:grid-cols-2">
                <Select
                  label="Billing cycle"
                  value={formData.billing_cycle}
                  onChange={(e) => handleChange('billing_cycle', e.target.value as BillingCycle)}
                  error={errors.billing_cycle}
                  required
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>

                {formData.billing_cycle === 'monthly' && (
                  <Input
                    label="Billing day (1–28)"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={28}
                    value={formData.billing_day || ''}
                    onChange={(e) => handleChange('billing_day', parseInt(e.target.value) || undefined)}
                    error={errors.billing_day}
                    required
                    helperText="Day of the month for the planned next billing date."
                  />
                )}
              </div>
            </FormSection>

            <FormSection title="Quantity and price" description="Past invoices keep their own amounts.">
              {hasFinalizedInvoices && !checkingInvoices && (
                <Alert variant={lockCheckFailed ? 'warning' : 'info'} className="mb-5">
                  <p className="font-semibold">Price locked</p>
                  <p className="mt-0.5">
                    {lockCheckFailed
                      ? "Couldn't check this client's invoices, so the price per unit is locked to be safe. Reload the page to try again."
                      : "Finalized subscription invoices exist for this client, so the price per unit can't change."}
                  </p>
                </Alert>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                  error={errors.quantity}
                  required
                  helperText="Units billed each cycle."
                />
                <div>
                  <Input
                    label="Price per unit (₹)"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={formData.price_per_unit}
                    onChange={(e) => handleChange('price_per_unit', parseFloat(e.target.value) || 0)}
                    error={errors.price_per_unit}
                    required
                    disabled={hasFinalizedInvoices}
                    helperText={hasFinalizedInvoices ? undefined : 'Changing it will ask for a reason.'}
                  />
                  {hasFinalizedInvoices && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      {lockCheckFailed ? 'Locked: invoice check failed' : 'Locked: finalized invoices exist'}
                    </p>
                  )}
                  {priceChanged && !hasFinalizedInvoices && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-partial">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Was {formatCurrency(originalPrice)}. You'll be asked for a reason.
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <ValueReadout quantity={formData.quantity ?? 0} price={formData.price_per_unit ?? 0} />
                </div>
                <div className="md:col-span-2">
                  <Textarea
                    label="Pricing notes"
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={3}
                    error={errors.notes}
                    placeholder="Negotiations, ESG goals, client size, special terms…"
                    required
                    helperText="Why this price? Kept for audit and reference."
                  />
                </div>
              </div>
            </FormSection>
          </>
        )}

        <CollapsibleSection
          title="Questionnaire and planned kit"
          description="Recorded when the subscription was created. Shown for reference; they can't be changed here."
          open={showReference}
          onToggle={() => setShowReference((v) => !v)}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Questionnaire answers</h3>
              <QuestionnaireAnswers subscription={subscription} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Planned dishware kit</h3>
              <PlannedKit subscription={subscription} />
            </div>
          </div>
        </CollapsibleSection>

        <StickyActions>
          <Button type="button" variant="outline" onClick={() => navigate(`/subscriptions/${id}`)} disabled={submitting}>
            {isCancelled ? 'Back to subscription' : 'Cancel'}
          </Button>
          {!isCancelled && (
            <Button type="submit" disabled={submitting} isLoading={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </StickyActions>
      </form>

      {/* Price change: a reason is required and goes into the price history */}
      <Modal
        isOpen={showPriceChangeModal}
        onClose={closePriceModal}
        dismissable={!submitting}
        title="Confirm the price change"
        maxWidth="md"
      >
        <p className="text-sm text-ink-muted">
          The price per unit changes from{' '}
          <span className="amount font-semibold text-ink">{formatCurrency(originalPrice)}</span> to{' '}
          <span className="amount font-semibold text-ink">{formatCurrency(formData.price_per_unit)}</span>.
        </p>
        <div className="mt-4">
          <Textarea
            label="Reason for the change"
            value={priceChangeReason}
            onChange={(e) => setPriceChangeReason(e.target.value)}
            rows={3}
            placeholder="Contract renegotiation, volume adjustment, correcting an error…"
            required
            helperText="Recorded in the price history."
            data-autofocus
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={closePriceModal} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handlePriceChangeConfirm} disabled={!priceChangeReason.trim() || submitting}>
            {submitting ? 'Saving…' : 'Confirm price change'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
