import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Package, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createSubscription } from '@/services/subscriptionService';
import { getClients } from '@/services/clientService';
import { getInventoryItems } from '@/services/inventoryService';
import type { CreateSubscriptionInput, Client, BillingCycle, Outlet, InventoryItem } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { getTodayISO } from '@/utils/billingDate';

export default function AddSubscriptionPage() {
  const navigate = useNavigate();
  const { user, outlets } = useAuth(); // ✅ Get outlets from auth context root

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // V1: Standard Dishware Kit
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
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

  // Get available outlets from auth context (works for all roles)
  const availableOutlets: Outlet[] = outlets || [];

  useEffect(() => {
    loadClients();

    // Auto-fill outlet for managers with single outlet
    if (user?.role === 'manager' && outlets && outlets.length === 1) {
      setFormData((prev) => ({ ...prev, outlet_id: outlets[0].id }));
    }
  }, [user, outlets]);

  useEffect(() => {
    // Reload clients and inventory when outlet changes
    if (formData.outlet_id) {
      loadClients();
      loadInventoryItems();
    }
  }, [formData.outlet_id]);

  async function loadClients() {
    if (!user?.id) {
      setLoading(false); // ✅ Always set loading to false
      return;
    }

    try {
      setLoading(true);
      const clientsData = await getClients(user.id, { client_type: 'corporate' });

      // Filter clients by selected outlet if outlet is selected
      const filteredClients = formData.outlet_id
        ? clientsData.filter((c) => c.outlet_id === formData.outlet_id)
        : clientsData;

      setClients(filteredClients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  // V1: Load inventory items for selected outlet
  async function loadInventoryItems() {
    if (!user?.id || !formData.outlet_id) {
      setInventoryItems([]);
      return;
    }

    try {
      setLoadingInventory(true);
      const items = await getInventoryItems(user.id, {
        outlet_id: formData.outlet_id,
        is_active: true
      });
      setInventoryItems(items);
    } catch (err) {
      console.warn('Failed to load inventory items:', err);
      setInventoryItems([]);
    } finally {
      setLoadingInventory(false);
    }
  }

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

  function handleChange(field: keyof CreateSubscriptionInput, value: any) {
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

    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      // V1: Include inventory items in subscription data
      const subscriptionData: CreateSubscriptionInput = {
        ...formData,
        inventoryItems: selectedInventory.length > 0
          ? selectedInventory.map(item => ({
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
          }))
          : undefined,
      };

      await createSubscription(user.id, subscriptionData);
      navigate('/subscriptions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Subscription</h1>
        <p className="text-muted-foreground mt-1">Create a new subscription for a corporate client</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Warning when no outlets exist */}
      {availableOutlets.length === 0 && (
        <Alert variant="warning">
          <strong>No outlets found!</strong>
          <p className="mt-2">
            {user?.role === 'admin'
              ? 'You need to create at least one outlet before you can create subscriptions. Please go to Outlets page to create one.'
              : 'No outlets have been assigned to you. Please contact your administrator.'}
          </p>
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Outlet Selection */}
          {user?.role === 'admin' ? (
            <Select
              label="Outlet"
              value={formData.outlet_id}
              onChange={(e) => handleChange('outlet_id', e.target.value)}
              error={errors.outlet_id}
              required
            >
              <option value="">Select Outlet</option>
              {availableOutlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </option>
              ))}
            </Select>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Outlet</label>
              <Input
                value={availableOutlets[0]?.name || 'No outlet assigned'}
                disabled
              />
            </div>
          )}

          {/* Client Selection */}
          <Select
            label="Client"
            value={formData.client_id}
            onChange={(e) => handleChange('client_id', e.target.value)}
            error={errors.client_id}
            required
            disabled={!formData.outlet_id}
          >
            <option value="">
              {formData.outlet_id ? 'Select Client' : 'Select outlet first'}
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} - {client.phone}
              </option>
            ))}
          </Select>

          {clients.length === 0 && formData.outlet_id && (
            <Alert variant="warning">
              No corporate clients found for this outlet. Please create a client first.
            </Alert>
          )}

          {/* Billing Cycle */}
          <Select
            label="Billing Cycle"
            value={formData.billing_cycle}
            onChange={(e) => handleChange('billing_cycle', e.target.value as BillingCycle)}
            error={errors.billing_cycle}
            required
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>

          {/* Billing Day (for monthly) */}
          {formData.billing_cycle === 'monthly' && (
            <Input
              label="Billing Day (1-28)"
              type="number"
              min={1}
              max={28}
              value={formData.billing_day || ''}
              onChange={(e) => handleChange('billing_day', parseInt(e.target.value) || undefined)}
              error={errors.billing_day}
              placeholder="Enter day of month (1-28)"
              required
              helperText="Day of the month when invoice will be generated (1-28 works for all months)"
            />
          )}

          {/* Start Date */}
          <Input
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleChange('start_date', e.target.value)}
            error={errors.start_date}
            min={user?.role === 'manager' ? getTodayISO() : undefined}
            required
            helperText={
              user?.role === 'manager'
                ? 'Cannot select past dates'
                : 'Admins can create past-dated subscriptions for migration purposes'
            }
          />

          {/* Quantity */}
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
            error={errors.quantity}
            required
          />

          {/* Price Per Unit */}
          <Input
            label="Price Per Unit"
            type="number"
            min={0}
            step="0.01"
            value={formData.price_per_unit}
            onChange={(e) => handleChange('price_per_unit', parseFloat(e.target.value) || 0)}
            error={errors.price_per_unit}
            required
          />

          {/* Total Display */}
          {formData.quantity > 0 && formData.price_per_unit > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total per billing cycle:</span>
                <span className="text-2xl font-bold">
                  ₹{(formData.quantity * formData.price_per_unit).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Notes - REQUIRED for V1 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Pricing Notes / Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.notes ? 'border-red-500' : ''
                }`}
              placeholder="Explain the pricing basis: negotiations, ESG goals, client size, special terms, etc."
              required
            />
            {errors.notes && (
              <p className="text-red-500 text-sm mt-1">{errors.notes}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Document the rationale for this pricing for audit and reference.
            </p>
          </div>

          {/* Questionnaire Section - Collapsible */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowQuestionnaire(!showQuestionnaire)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div>
                <span className="font-medium">Client Questionnaire (Optional)</span>
                <p className="text-sm text-muted-foreground">
                  Additional reference data for ops planning and ESG reporting
                </p>
              </div>
              {showQuestionnaire ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {showQuestionnaire && (
              <div className="border-t p-4 space-y-4 bg-muted/30">
                <p className="text-sm text-muted-foreground italic">
                  This data is for reference only. It does NOT affect pricing calculations.
                </p>

                {/* Usage Volume */}
                <Input
                  label="Daily Usage Volume (approximate)"
                  type="number"
                  min={0}
                  placeholder="e.g., 500 meals/day"
                  onChange={(e) => handleChange('questionnaire', {
                    ...formData.questionnaire,
                    daily_volume: parseInt(e.target.value) || 0
                  })}
                />

                {/* Peak Challenges */}
                <div>
                  <label className="block text-sm font-medium mb-2">Peak Time Challenges</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Describe any peak hour challenges..."
                    onChange={(e) => handleChange('questionnaire', {
                      ...formData.questionnaire,
                      peak_challenges: e.target.value
                    })}
                  />
                </div>

                {/* Washing Facility */}
                <Select
                  label="Washing Facility Available?"
                  onChange={(e) => handleChange('questionnaire', {
                    ...formData.questionnaire,
                    has_washing_facility: e.target.value === 'yes'
                  })}
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes - On-site washing</option>
                  <option value="no">No - Need pickup/delivery</option>
                </Select>

                {/* ESG Priority */}
                <Select
                  label="ESG Priority Level"
                  onChange={(e) => handleChange('questionnaire', {
                    ...formData.questionnaire,
                    esg_priority: e.target.value
                  })}
                >
                  <option value="">Select...</option>
                  <option value="high">High - Key sustainability initiative</option>
                  <option value="medium">Medium - Part of broader goals</option>
                  <option value="low">Low - Cost-driven decision</option>
                </Select>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium mb-2">Additional Context</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Any other relevant information..."
                    onChange={(e) => handleChange('questionnaire', {
                      ...formData.questionnaire,
                      additional_context: e.target.value
                    })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* V1: Standard Dishware Kit Section */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowInventory(!showInventory)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium">Standard Dishware Kit (Optional)</span>
                  <p className="text-sm text-muted-foreground">
                    Define inventory items for this subscription
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedInventory.length > 0 && (
                  <span className="text-sm bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    {selectedInventory.length} items
                  </span>
                )}
                {showInventory ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {showInventory && (
              <div className="border-t p-4 space-y-4 bg-muted/30">
                <p className="text-sm text-muted-foreground italic">
                  Select dishware items for operational planning. This does NOT affect pricing.
                </p>

                {/* Item selector */}
                {formData.outlet_id ? (
                  <>
                    <div className="flex gap-2">
                      <Select
                        className="flex-1"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddInventoryItem(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        disabled={loadingInventory}
                      >
                        <option value="">
                          {loadingInventory ? 'Loading items...' : 'Select an item to add...'}
                        </option>
                        {inventoryItems
                          .filter(item => !selectedInventory.some(s => s.inventoryItemId === item.id))
                          .map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.category}) - {item.available_quantity} available
                            </option>
                          ))}
                      </Select>
                    </div>

                    {/* Selected items list */}
                    {selectedInventory.length > 0 ? (
                      <div className="space-y-2">
                        {selectedInventory.map((item) => (
                          <div
                            key={item.inventoryItemId}
                            className="flex items-center gap-3 p-3 bg-background rounded-lg border"
                          >
                            <div className="flex-1">
                              <span className="font-medium">{item.itemName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-muted-foreground">Qty:</label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleUpdateInventoryQuantity(
                                  item.inventoryItemId,
                                  parseInt(e.target.value) || 1
                                )}
                                className="w-20"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveInventoryItem(item.inventoryItemId)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No items selected. Add items from the dropdown above.
                      </p>
                    )}

                    {inventoryItems.length === 0 && !loadingInventory && (
                      <p className="text-sm text-amber-600 text-center py-2">
                        No inventory items found for this outlet. Create items in Inventory first.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select an outlet first to see available inventory items.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/subscriptions')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Subscription'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
