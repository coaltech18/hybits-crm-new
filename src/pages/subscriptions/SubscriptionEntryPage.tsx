// ============================================================================
// SUBSCRIPTION ENTRY PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Vendor, 
  SubscriptionItem, 
  SubscriptionEntryFormData, 
  SubscriptionCalculation 
} from '@/types/billing';
import { BillingService } from '@/services/billingService';
import ItemsTable from '@/components/subscriptions/ItemsTable';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import MoneyInput from '@/components/ui/MoneyInput';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

const SubscriptionEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vendorParam = searchParams.get('vendor');
  const { getCurrentOutletId } = useAuth();
  
  // Vendors list (fetched)
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [formData, setFormData] = useState<SubscriptionEntryFormData>({
    vendor_id: vendorParam || '',
    plan_type: '30k',
    subscription_start: new Date().toISOString().split('T')[0] || '',
    items: [{
      name: '',
      size: '',
      price_per_piece: 0,
      quantity: 0
    }],
    security_deposit_amount: 0
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await BillingService.getVendors();
        if (isMounted) {
          setVendors(data);
        }
      } catch (e) {
        // Ignore for now; page has its own error UI
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [calculation, setCalculation] = useState<SubscriptionCalculation>({
    total_dish_value: 0,
    monthly_fee: 30000
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize items from form data
  useEffect(() => {
    const initialItems: SubscriptionItem[] = formData.items.map((item, index) => ({
      id: `item_${index}`,
      ...item,
      total: item.price_per_piece * item.quantity
    }));
    setItems(initialItems);
  }, []);

  // Calculate totals when items or plan change
  useEffect(() => {
    const totalDishValue = items.reduce((sum, item) => sum + item.total, 0);
    const monthlyFees = {
      '30k': 30000,
      '40k': 40000,
      '60k': 60000,
      'custom': calculation.monthly_fee
    } as const;

    setCalculation(prev => ({
      total_dish_value: totalDishValue,
      monthly_fee: formData.plan_type === 'custom' ? prev.monthly_fee : monthlyFees[formData.plan_type]
    }));
  }, [items, formData.plan_type]);

  // When switching to custom plan, reset monthly fee to 0
  useEffect(() => {
    if (formData.plan_type === 'custom') {
      setCalculation(prev => ({ ...prev, monthly_fee: 0 }));
    }
  }, [formData.plan_type]);

  const handleVendorChange = (vendorId: string) => {
    setFormData(prev => ({
      ...prev,
      vendor_id: vendorId
    }));
  };

  const handlePlanTypeChange = (planType: string) => {
    setFormData(prev => ({
      ...prev,
      plan_type: planType as '30k' | '40k' | '60k' | 'custom'
    }));
  };

  const handleItemsChange = (newItems: SubscriptionItem[]) => {
    setItems(newItems);
    
    // Update form data with new items (without id and total)
    const formItems = newItems.map(item => ({
      name: item.name,
      ...(item.size !== undefined && { size: item.size }),
      price_per_piece: item.price_per_piece,
      quantity: item.quantity
    }));
    
    setFormData(prev => ({
      ...prev,
      items: formItems
    }));
  };

  const handleTotalChange = (total: number) => {
    // Mark parameter as intentionally unused to satisfy noUnusedParameters
    void total;
  };

  // security deposit change is handled inline via MoneyInput

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vendor_id) {
      setError('Please select a vendor');
      return;
    }

    if (items.some(item => !item.name || item.quantity <= 0 || item.price_per_piece <= 0)) {
      setError('Please fill in all item details correctly');
      return;
    }

    if (formData.security_deposit_amount <= 0) {
      setError('Please enter a valid security deposit amount');
      return;
    }

    if (formData.plan_type === 'custom' && (calculation.monthly_fee <= 0 || !calculation.monthly_fee)) {
      setError('Please enter a valid monthly fee for custom plan');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current outlet ID for multi-tenant isolation
      const currentOutletId = getCurrentOutletId();
      if (!currentOutletId) {
        setError('Please select an outlet before creating a subscription');
        return;
      }

      // Save to Supabase
      await BillingService.createVendorSubscription(
        {
          ...formData,
          outlet_id: currentOutletId,
          ...(formData.plan_type === 'custom' && { monthly_fee: calculation.monthly_fee })
        },
        items.map(i => ({
          name: i.name,
          ...(i.size !== undefined && { size: i.size }),
          price_per_piece: i.price_per_piece,
          quantity: i.quantity
        }))
      );

      alert('Subscription created successfully!');
      navigate('/subscriptions');
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      setError(err.message || 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const selectedVendor = vendors.find(v => v.id === formData.vendor_id);

  const vendorOptions = vendors.map(vendor => ({
    value: vendor.id,
    label: vendor.name
  }));

  const planTypeOptions = [
    { value: '30k', label: '₹30,000/month' },
    { value: '40k', label: '₹40,000/month' },
    { value: '60k', label: '₹60,000/month' },
    { value: 'custom', label: 'Custom Amount' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">New Subscription Entry</h1>
          <p className="text-muted-foreground mt-2">
            Create a new vendor subscription with itemized billing
          </p>
        </div>
        
        <Button
          variant="outline"
          onClick={() => navigate('/subscriptions')}
        >
          <Icon name="arrow-left" size={20} className="mr-2" />
          Back to Subscriptions
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Vendor Details Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Vendor Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Select
                label="Vendor"
                required
                options={vendorOptions}
                value={formData.vendor_id}
                onChange={handleVendorChange}
                placeholder="Select a vendor"
              />
              <div className="mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/vendors/new')}>
                  <Icon name="plus" size={14} className="mr-1" /> Add Vendor
                </Button>
              </div>
            </div>
            
            <div>
              <Select
                label="Subscription Plan"
                required
                options={planTypeOptions}
                value={formData.plan_type}
                onChange={handlePlanTypeChange}
              />
            </div>
            
            <div>
              <Input
                label="Subscription Start Date"
                type="date"
                required
                value={formData.subscription_start}
                onChange={(e) => setFormData(prev => ({ ...prev, subscription_start: e.target.value }))}
              />
            </div>
            
            <div>
              {formData.plan_type === 'custom' ? (
                <MoneyInput
                  label="Monthly Fee"
                  value={calculation.monthly_fee}
                  onValueChange={(val) => setCalculation(prev => ({ ...prev, monthly_fee: val || 0 }))}
                  placeholder="Enter custom amount"
                  required
                />
              ) : (
                <Input
                  label="Monthly Fee"
                  value={`₹${calculation.monthly_fee.toLocaleString()}`}
                  readOnly
                  className="bg-muted"
                />
              )}
            </div>
          </div>

          {/* Selected Vendor Info */}
          {selectedVendor && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-foreground mb-2">Vendor Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contact Person:</span>
                  <span className="ml-2 text-foreground">{selectedVendor.contact_person}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2 text-foreground">{selectedVendor.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-2 text-foreground">{selectedVendor.phone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">GSTIN:</span>
                  <span className="ml-2 text-foreground">{selectedVendor.gst_number || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Items Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <ItemsTable
            items={items}
            onItemsChange={handleItemsChange}
            onTotalChange={handleTotalChange}
          />
        </div>

        {/* Security Deposit Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Security Deposit (for damages/losses)</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Enter deposit amount
                </label>
                <MoneyInput
                  value={formData.security_deposit_amount}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, security_deposit_amount: val || 0 }))}
                  placeholder="0"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This is a refundable amount collected once per vendor.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Subscription Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                ₹{calculation.total_dish_value.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Dish Value</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                ₹{formData.security_deposit_amount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Security Deposit</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                ₹{calculation.monthly_fee.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Monthly Fee</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/subscriptions')}
            disabled={loading}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            loading={loading}
            disabled={!formData.vendor_id || items.length === 0}
          >
            <Icon name="save" size={20} className="mr-2" />
            Create Subscription
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SubscriptionEntryPage;
