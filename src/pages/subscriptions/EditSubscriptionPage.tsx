import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionById, updateSubscription } from '@/services/subscriptionService';
import type { Subscription, UpdateSubscriptionInput, BillingCycle } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

export default function EditSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<UpdateSubscriptionInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSubscription();
  }, [id]);

  async function loadSubscription() {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getSubscriptionById(id);

      if (!data) {
        setError('Subscription not found');
        return;
      }

      setSubscription(data);

      // Initialize form with current values
      setFormData({
        billing_cycle: data.billing_cycle,
        billing_day: data.billing_day || undefined,
        quantity: data.quantity,
        price_per_unit: data.price_per_unit,
        notes: data.notes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof UpdateSubscriptionInput, value: any) {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm() || !user?.id || !id) return;

    try {
      setSubmitting(true);
      setError(null);

      await updateSubscription(user.id, id, formData);
      navigate(`/subscriptions/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
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

  if (!subscription) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error">Subscription not found</Alert>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Update subscription for {subscription.clients?.name}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {subscription.status === 'cancelled' && (
        <Alert variant="warning">
          This subscription has been cancelled and cannot be modified.
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Read-only fields */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-sm text-muted-foreground">Subscription Info (Read-only)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <p className="text-sm">{subscription.clients?.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Outlet</label>
                <p className="text-sm">{subscription.outlets?.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <p className="text-sm">{new Date(subscription.start_date).toLocaleDateString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <p className="text-sm capitalize">{subscription.status}</p>
              </div>

              {subscription.status === 'active' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Next Billing Date</label>
                  <p className="text-sm">{new Date(subscription.next_billing_date).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Auto-calculated, cannot be manually edited)
                  </p>
                </div>
              )}
            </div>
          </div>

          {subscription.status !== 'cancelled' && (
            <>
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
                  required
                  helperText="Day of the month when invoice will be generated"
                />
              )}

              {/* Quantity */}
              <Input
                label="Quantity"
                type="number"
                min={1}
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                error={errors.quantity}
                required
                helperText="Changes affect future invoices only"
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
                helperText="Changes affect future invoices only"
              />

              {/* Total Display */}
              {formData.quantity && formData.price_per_unit !== undefined && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total per billing cycle:</span>
                    <span className="text-2xl font-bold">
                      ₹{(formData.quantity * formData.price_per_unit).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Price/quantity changes apply to future invoices only. Past invoices remain unchanged.
                  </p>
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
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/subscriptions/${id}`)}
              disabled={submitting}
            >
              Cancel
            </Button>
            {subscription.status !== 'cancelled' && (
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
