// ============================================================================
// SUBSCRIPTION ENTRY PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Vendor, 
  SubscriptionItem, 
  SubscriptionEntryFormData, 
  SubscriptionCalculation 
} from '@/types/billing';
import ItemsTable from '@/components/subscriptions/ItemsTable';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

const SubscriptionEntryPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Mock vendors data - in real app, this would come from API
  const [vendors] = useState<Vendor[]>([
    {
      id: 'vendor1',
      name: 'Rasoi Ghar',
      contact_person: 'Rajesh Kumar',
      email: 'rajesh@rasoighar.com',
      phone: '+91 98765 43210',
      address: '123 Main Street, Mumbai',
      gstin: '27ABCDE1234F1Z5',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'vendor2',
      name: 'Spice Kitchen',
      contact_person: 'Priya Sharma',
      email: 'priya@spicekitchen.com',
      phone: '+91 87654 32109',
      address: '456 Park Avenue, Delhi',
      gstin: '07FGHIJ5678K2L6',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]);

  const [formData, setFormData] = useState<SubscriptionEntryFormData>({
    vendor_id: '',
    plan_type: '30k',
    subscription_start: new Date().toISOString().split('T')[0],
    items: [{
      name: '',
      size: '',
      price_per_piece: 0,
      quantity: 0
    }],
    deposit_manual: undefined
  });

  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [calculation, setCalculation] = useState<SubscriptionCalculation>({
    total_dish_value: 0,
    deposit_auto: 0,
    deposit_manual: undefined,
    final_deposit: 0,
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

  // Calculate totals when items change
  useEffect(() => {
    const totalDishValue = items.reduce((sum, item) => sum + item.total, 0);
    const depositAuto = totalDishValue * 0.5; // 50% of total dish value
    const finalDeposit = formData.deposit_manual !== undefined ? formData.deposit_manual : depositAuto;
    
    // Set monthly fee based on plan type
    const monthlyFees = {
      '30k': 30000,
      '40k': 40000,
      '60k': 60000,
      'custom': 0
    };

    setCalculation({
      total_dish_value: totalDishValue,
      deposit_auto: depositAuto,
      deposit_manual: formData.deposit_manual,
      final_deposit: finalDeposit,
      monthly_fee: monthlyFees[formData.plan_type]
    });
  }, [items, formData.deposit_manual, formData.plan_type]);

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
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
      size: item.size,
      price_per_piece: item.price_per_piece,
      quantity: item.quantity
    }));
    
    setFormData(prev => ({
      ...prev,
      items: formItems
    }));
  };

  const handleTotalChange = (total: number) => {
    // This is handled by the useEffect above
  };

  const handleManualDepositChange = (value: string) => {
    const depositValue = value === '' ? undefined : Number(value);
    setFormData(prev => ({
      ...prev,
      deposit_manual: depositValue
    }));
  };

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

    try {
      setLoading(true);
      setError(null);

      // Here you would call your API to save the subscription
      console.log('Saving subscription:', {
        ...formData,
        items: items,
        calculation
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

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
              <Input
                label="Monthly Fee"
                value={`₹${calculation.monthly_fee.toLocaleString()}`}
                readOnly
                className="bg-muted"
              />
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
                  <span className="ml-2 text-foreground">{selectedVendor.gstin || 'N/A'}</span>
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
          <h2 className="text-xl font-semibold text-foreground mb-6">Security Deposit</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Auto-calculated Deposit (50% of total dish value)
                </label>
                <Input
                  value={`₹${calculation.deposit_auto.toLocaleString()}`}
                  readOnly
                  className="bg-muted"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Manual Override (if negotiated)
                </label>
                <Input
                  type="number"
                  value={formData.deposit_manual || ''}
                  onChange={(e) => handleManualDepositChange(e.target.value)}
                  placeholder="Enter custom deposit amount"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">Final Deposit Amount:</span>
                <span className="text-2xl font-bold text-primary">
                  ₹{calculation.final_deposit.toLocaleString()}
                </span>
              </div>
              
              {formData.deposit_manual !== undefined && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Manual override applied (Auto: ₹{calculation.deposit_auto.toLocaleString()})
                </div>
              )}
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
                ₹{calculation.final_deposit.toLocaleString()}
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
