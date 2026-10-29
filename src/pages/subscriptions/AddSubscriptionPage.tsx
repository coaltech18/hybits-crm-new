import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { createSubscription } from '@/services/subscriptionService';
import { getClients } from '@/services/clientService';
import { getInventoryItems } from '@/services/inventoryService';
import type { CreateSubscriptionInput, Client, BillingCycle, Outlet, InventoryItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/ui/PageHeader';
import { getTodayISO } from '@/utils/billingDate';
import { CollapsibleSection, FormSection, StickyActions, ValueReadout } from './SubscriptionFormParts';

// ================================================================
// NEW SUBSCRIPTION — one sheet in sections:
// client & outlet → billing cycle → quantity & price (live value per
// cycle) → questionnaire (optional) → planned dishware kit (optional).
// ================================================================

export default function AddSubscriptionPage() {
  useDocumentTitle('New subscription');

  const navigate = useNavigate();
  const { user, outlets } = useAuth(); // outlets come from the auth context
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // V1: Standard Dishware Kit (a plan only; it does not reserve or move stock)
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<Array<{
    inventoryItemId: string;
    itemName: string;
    quantity: number;
  }>>([]);

  // Form state
  const [formData, setFormData] = useState<CreateSubscriptionInput>({
    outlet_id: '',
    client_id: '',
    billing_cycle: 'monthly',
    start_date: getTodayISO(),
    quantity: 1,
    price_per_unit: 0,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Outlets from auth context: all active outlets for admins, assigned ones for managers
  const availableOutlets: Outlet[] = useMemo(() => outlets || [], [outlets]);
  const isAdmin = user?.role === 'admin';
  // Admins and multi-outlet managers must pick an outlet
  const canPickOutlet = isAdmin || availableOutlets.length > 1;

  const userId = user?.id;
  const outletId = formData.outlet_id;

  // Auto-select the outlet only when exactly one is available
  useEffect(() => {
    if (availableOutlets.length === 1) {
      const only = availableOutlets[0].id;
      setFormData((prev) => (prev.outlet_id ? prev : { ...prev, outlet_id: only }));
    }
  }, [availableOutlets]);

  // Load corporate clients and inventory items for the selected outlet.
  // Responses for a previous outlet are ignored.
  useEffect(() => {
    if (!userId || !outletId) {
      setClients([]);
      setInventoryItems([]);
      return;
    }

    let stale = false;
    setLoadingClients(true);
    setLoadingInventory(true);
    setInventoryError(null);

    getClients(userId, { client_type: 'corporate', outlet_id: outletId })
      .then((data) => {
        if (!stale) setClients(data.filter((c) => c.outlet_id === outletId));
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : 'Failed to load clients');
      })
      .finally(() => {
        if (!stale) setLoadingClients(false);
      });

    getInventoryItems(userId, { outlet_id: outletId, is_active: true })
      .then((items) => {
        if (!stale) setInventoryItems(items);
      })
      .catch((err: unknown) => {
        if (!stale) {
          setInventoryItems([]);
          setInventoryError(err instanceof Error ? err.message : 'Failed to load inventory items');
        }
      })
      .finally(() => {
        if (!stale) setLoadingInventory(false);
      });

    return () => {
      stale = true;
    };
  }, [userId, outletId]);

  // V1: Add inventory item to selection
  function handleAddInventoryItem(itemId: string) {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    // Check if already selected
    if (selectedInventory.some(s => s.inventoryItemId === itemId)) {
      return; // Already selected
    }

    setSelectedInventory(prev => [...prev, {
      inventoryItemId: itemId,
      itemName: item.name,
      quantity: 1,
    }]);
  }

  // V1: Update quantity for selected item
  function handleUpdateInventoryQuantity(itemId: string, quantity: number) {
    setSelectedInventory(prev => prev.map(item =>
      item.inventoryItemId === itemId
        ? { ...item, quantity: Math.max(1, quantity) }
        : item
    ));
  }

  // V1: Remove inventory item from selection
  function handleRemoveInventoryItem(itemId: string) {
    setSelectedInventory(prev => prev.filter(item => item.inventoryItemId !== itemId));
  }

  function handleChange<K extends keyof CreateSubscriptionInput>(
    field: K,
    value: CreateSubscriptionInput[K]
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
  }

  // Changing outlet invalidates the chosen client and kit items (they belong to the old outlet)
  function handleOutletChange(newOutletId: string) {
    setFormData((prev) => ({ ...prev, outlet_id: newOutletId, client_id: '' }));
    setSelectedInventory([]);
    setClients([]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.outlet_id;
      delete next.client_id;
      return next;
    });
  }

  function handleQuestionnaireChange(key: string, value: unknown) {
    setFormData((prev) => {
      const next = { ...(prev.questionnaire || {}) };
      if (value === undefined || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return { ...prev, questionnaire: Object.keys(next).length > 0 ? next : undefined };
    });
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.outlet_id) {
      newErrors.outlet_id = 'Outlet is required';
    }

    if (!formData.client_id) {
      newErrors.client_id = 'Client is required';
    }

    if (!formData.billing_cycle) {
      newErrors.billing_cycle = 'Billing cycle is required';
    }

    if (formData.billing_cycle === 'monthly') {
      if (!formData.billing_day || formData.billing_day < 1 || formData.billing_day > 28) {
        newErrors.billing_day = 'Billing day must be between 1 and 28';
      }
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (formData.price_per_unit === undefined || formData.price_per_unit < 0) {
      newErrors.price_per_unit = 'Price must be 0 or greater';
    }

    // V1: Notes required for pricing justification
    if (!formData.notes || formData.notes.trim().length === 0) {
      newErrors.notes = 'Notes/reason is required for pricing justification';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (submitting || !validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      // V1: Include inventory items in subscription data
      const subscriptionData: CreateSubscriptionInput = {
        ...formData,
        inventoryItems: selectedInventory.length > 0
          ? selectedInventory.map(item => ({
            inventoryItemId: item.inventoryItemId,
            itemName: item.itemName,
            quantity: item.quantity,
          }))
          : undefined,
      };

      await createSubscription(user.id, subscriptionData);
      showToast('Subscription created successfully', 'success');
      navigate('/subscriptions');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create subscription';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedOutletName = availableOutlets.find((o) => o.id === formData.outlet_id)?.name;

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ to: '/subscriptions', label: 'Subscriptions' }}
        title="New subscription"
        description="Record a corporate client's billing cycle, quantity and agreed price. Invoices are raised by hand from the subscription."
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {availableOutlets.length === 0 && (
        <Alert variant="warning" className="mb-6">
          <p className="font-semibold">No outlets available</p>
          <p className="mt-1">
            {user?.role === 'admin'
              ? 'Create at least one outlet on the Outlets page before adding subscriptions.'
              : 'No outlets have been assigned to you. Ask your administrator to assign one.'}
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="sheet divide-y divide-rule">
        {/* 1. Client & outlet */}
        <FormSection title="Client and outlet" description="Only corporate clients of the chosen outlet can subscribe.">
          <div className="grid gap-5 md:grid-cols-2">
            {canPickOutlet ? (
              <Select
                label="Outlet"
                value={formData.outlet_id}
                onChange={(e) => handleOutletChange(e.target.value)}
                error={errors.outlet_id}
                required
              >
                <option value="">Select an outlet</option>
                {availableOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code})
                  </option>
                ))}
              </Select>
            ) : (
              <Input label="Outlet" value={selectedOutletName || 'No outlet assigned'} disabled error={errors.outlet_id} />
            )}

            <Select
              label="Client"
              value={formData.client_id}
              onChange={(e) => handleChange('client_id', e.target.value)}
              error={errors.client_id}
              required
              disabled={!formData.outlet_id || loadingClients}
            >
              <option value="">
                {!formData.outlet_id ? 'Select an outlet first' : loadingClients ? 'Loading clients…' : 'Select a client'}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.phone}
                </option>
              ))}
            </Select>
          </div>

          {clients.length === 0 && formData.outlet_id && !loadingClients && (
            <Alert variant="warning" className="mt-4">
              This outlet has no corporate clients yet. Add the client first, then come back to create the subscription.
            </Alert>
          )}
        </FormSection>

        {/* 2. Billing cycle */}
        <FormSection title="Billing cycle" description="Sets the planned next billing date. Nothing is invoiced automatically.">
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
                placeholder="Day of the month"
                required
                helperText="Day of the month for the planned next billing date."
              />
            )}

            <DateInput
              label="Start date"
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              error={errors.start_date}
              min={user?.role === 'manager' ? getTodayISO() : undefined}
              required
              helperText={
                user?.role === 'manager'
                  ? 'Today or later.'
                  : 'Admins can back-date a subscription when migrating records.'
              }
            />
          </div>
        </FormSection>

        {/* 3. Quantity & price */}
        <FormSection title="Quantity and price" description="The agreed rate. Record why this price was chosen.">
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
            />
            <div className="md:col-span-2">
              <ValueReadout quantity={formData.quantity} price={formData.price_per_unit} />
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

        {/* 4. Questionnaire (optional, collapsible) */}
        <CollapsibleSection
          title="Client questionnaire"
          description="Reference for operations planning and ESG reporting. Does not affect price."
          open={showQuestionnaire}
          onToggle={() => setShowQuestionnaire(!showQuestionnaire)}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Daily usage (approx.)"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="e.g. 500 meals a day"
              value={formData.questionnaire?.daily_volume ?? ''}
              onChange={(e) => handleQuestionnaireChange(
                'daily_volume',
                e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0
              )}
            />
            <Select
              label="Washing facility"
              value={
                formData.questionnaire?.has_washing_facility === true
                  ? 'yes'
                  : formData.questionnaire?.has_washing_facility === false
                    ? 'no'
                    : ''
              }
              onChange={(e) => handleQuestionnaireChange(
                'has_washing_facility',
                e.target.value === '' ? undefined : e.target.value === 'yes'
              )}
            >
              <option value="">Not answered</option>
              <option value="yes">Yes, on-site washing</option>
              <option value="no">No, needs pickup and delivery</option>
            </Select>
            <Select
              label="ESG priority"
              value={formData.questionnaire?.esg_priority ?? ''}
              onChange={(e) => handleQuestionnaireChange('esg_priority', e.target.value)}
            >
              <option value="">Not answered</option>
              <option value="high">High: a key sustainability initiative</option>
              <option value="medium">Medium: part of broader goals</option>
              <option value="low">Low: a cost-driven decision</option>
            </Select>
            <div className="md:col-span-2">
              <Textarea
                label="Peak-time challenges"
                rows={2}
                placeholder="Rush hours, shift changes, events…"
                value={formData.questionnaire?.peak_challenges ?? ''}
                onChange={(e) => handleQuestionnaireChange('peak_challenges', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Additional context"
                rows={2}
                placeholder="Anything else the outlet should know"
                value={formData.questionnaire?.additional_context ?? ''}
                onChange={(e) => handleQuestionnaireChange('additional_context', e.target.value)}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* 5. Planned dishware kit (optional, collapsible) */}
        <CollapsibleSection
          title="Planned dishware kit"
          description="The dishes this client usually needs. A plan only: it does not reserve or send stock."
          open={showInventory}
          onToggle={() => setShowInventory(!showInventory)}
          badge={
            selectedInventory.length > 0 ? (
              <span className="rounded-md border border-final-rule bg-final-tint px-2 py-0.5 text-xs font-semibold text-final">
                {selectedInventory.length} item{selectedInventory.length === 1 ? '' : 's'}
              </span>
            ) : undefined
          }
        >
          {formData.outlet_id ? (
            <div className="space-y-4">
              <Select
                label="Add an item"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddInventoryItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={loadingInventory}
                helperText="When dishes actually go out, use Allocate dishware on the subscription."
              >
                <option value="">{loadingInventory ? 'Loading items…' : 'Choose an item to add'}</option>
                {inventoryItems
                  .filter((item) => !selectedInventory.some((s) => s.inventoryItemId === item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category}) · {item.available_quantity} available
                    </option>
                  ))}
              </Select>

              {inventoryError && (
                <Alert variant="error">Could not load inventory items: {inventoryError}</Alert>
              )}

              {inventoryItems.length === 0 && !loadingInventory && !inventoryError && (
                <Alert variant="warning">This outlet has no inventory items yet. Add them in Inventory first.</Alert>
              )}

              {selectedInventory.length > 0 ? (
                <ul className="divide-y divide-rule rounded-lg border border-rule">
                  {selectedInventory.map((item) => (
                    <li key={item.inventoryItemId} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink">{item.itemName}</span>
                      <div className="w-24 shrink-0">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateInventoryQuantity(item.inventoryItemId, parseInt(e.target.value) || 1)}
                          aria-label={`Planned pieces of ${item.itemName}`}
                          className="text-right"
                        />
                      </div>
                      <span className="text-sm text-ink-muted">pcs</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInventoryItem(item.inventoryItemId)}
                        aria-label={`Remove ${item.itemName}`}
                        className="hover:bg-danger-tint hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-rule-strong px-4 py-5 text-center text-sm text-ink-muted">
                  No items planned yet. Choose one above.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Select an outlet first to see its inventory items.</p>
          )}
        </CollapsibleSection>

        <StickyActions>
          <Button type="button" variant="outline" onClick={() => navigate('/subscriptions')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} isLoading={submitting}>
            {submitting ? 'Creating…' : 'Create subscription'}
          </Button>
        </StickyActions>
      </form>
    </div>
  );
}
