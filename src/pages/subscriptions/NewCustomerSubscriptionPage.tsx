// ============================================================================
// NEW CUSTOMER SUBSCRIPTION PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerSubscriptionFormData } from '@/types/billing';
import { Customer } from '@/types';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CustomerSelector from '@/components/ui/CustomerSelector';
import Icon from '@/components/AppIcon';

const NewCustomerSubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { getCurrentOutletId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState<CustomerSubscriptionFormData>({
    customer_id: '',
    start_date: new Date().toISOString().split('T')[0] || '',
    quantity_per_day: 0,
    unit_price: 0,
    security_deposit: 0,
    gst_rate: 18
  });

  useEffect(() => {
    // Customers will be loaded by CustomerSelector component
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }

    if (formData.quantity_per_day <= 0 || formData.unit_price <= 0) {
      alert('Quantity per day and unit price must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      const outletId = getCurrentOutletId();
      
      if (!outletId) {
        alert('Outlet not selected');
        return;
      }

      const subscription = await BillingService.createCustomerSubscription({
        ...formData,
        customer_id: selectedCustomer.id,
        outlet_id: outletId
      });

      // Optionally create initial deposit payment
      if (formData.security_deposit > 0) {
        try {
          await BillingService.createSubscriptionPayment({
            subscription_id: subscription.id,
            outlet_id: outletId,
            payment_date: new Date().toISOString().split('T')[0] || '',
            amount: formData.security_deposit,
            payment_method: 'cash',
            notes: 'Initial security deposit'
          });
        } catch (err) {
          console.error('Error creating deposit payment:', err);
          // Don't fail the whole operation if payment creation fails
        }
      }

      navigate(`/subscriptions/customer/${subscription.id}`);
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      alert(err.message || 'Failed to create subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Customer Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Create a subscription for daily-delivered items
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/subscriptions/customer')}>
          <Icon name="arrow-left" size={16} className="mr-2" />
          Back
        </Button>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Customer *
            </label>
            <CustomerSelector
              value={selectedCustomer}
              onChange={(customer) => {
                setSelectedCustomer(customer);
                setFormData({ ...formData, customer_id: customer?.id || '' });
              }}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Subscription Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Start Date *"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
              disabled={isSubmitting}
            />
            <Input
              type="date"
              label="End Date (Optional)"
              value={formData.end_date || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setFormData({ ...formData, end_date: val });
                } else {
                  const { end_date, ...rest } = formData;
                  setFormData(rest as CustomerSubscriptionFormData);
                }
              }}
              disabled={isSubmitting}
            />
            <Input
              type="number"
              label="Quantity Per Day *"
              value={formData.quantity_per_day}
              onChange={(e) => setFormData({ ...formData, quantity_per_day: parseInt(e.target.value) || 0 })}
              min={1}
              required
              disabled={isSubmitting}
            />
            <Input
              type="number"
              label="Unit Price (₹) *"
              value={formData.unit_price}
              onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
              min={0}
              step={0.01}
              required
              disabled={isSubmitting}
            />
            <Input
              type="number"
              label="Security Deposit (₹)"
              value={formData.security_deposit}
              onChange={(e) => setFormData({ ...formData, security_deposit: parseFloat(e.target.value) || 0 })}
              min={0}
              step={0.01}
              disabled={isSubmitting}
            />
            <Select
              options={[
                { value: 0, label: '0%' },
                { value: 5, label: '5%' },
                { value: 12, label: '12%' },
                { value: 18, label: '18%' },
                { value: 28, label: '28%' }
              ]}
              value={formData.gst_rate || 18}
              onChange={(value) => setFormData({ ...formData, gst_rate: parseInt(value) })}
              label="GST Rate (%)"
              disabled={isSubmitting}
            />
          </div>

          {/* Monthly Amount Preview */}
          {formData.quantity_per_day > 0 && formData.unit_price > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated Monthly Amount:</span>
                <span className="text-lg font-semibold text-foreground">
                  ₹{(formData.quantity_per_day * formData.unit_price * 30).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/subscriptions/customer')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Subscription'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCustomerSubscriptionPage;

