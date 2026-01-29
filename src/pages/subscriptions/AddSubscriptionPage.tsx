import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createSubscription } from '@/services/subscriptionService';
import { getClients } from '@/services/clientService';
import type { CreateSubscriptionInput, Client, BillingCycle, Outlet } from '@/types';
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
    // Reload clients when outlet changes
    if (formData.outlet_id) {
      loadClients();
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      await createSubscription(user.id, formData);
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Additional notes about this subscription"
            />
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
