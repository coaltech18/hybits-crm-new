// ============================================================================
// VENDOR FORM PAGE (New/Edit)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VendorFormData } from '@/types/billing';
import { BillingService } from '@/services/billingService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';

const VendorFormPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id as string | undefined;
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<VendorFormData>({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
    status: 'active',
    notes: ''
  });

  useEffect(() => {
    if (isEdit && id) {
      loadVendor(id);
    }
  }, [id, isEdit]);

  const loadVendor = async (vendorId: string) => {
    try {
      setLoading(true);
      setError(null);
      const vendor = await BillingService.getVendorById(vendorId);
      setFormData({
        name: vendor.name,
        contact_person: vendor.contact_person || '',
        phone: vendor.phone,
        email: vendor.email || '',
        address: vendor.address || '',
        gst_number: vendor.gst_number || '',
        status: vendor.status,
        notes: vendor.notes || ''
      });
    } catch (err: any) {
      console.error('Error loading vendor:', err);
      setError(err.message || 'Failed to load vendor');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Vendor name is required');
      return;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isEdit && id) {
        await BillingService.updateVendor(id, formData);
        alert('Vendor updated successfully!');
      } else {
        await BillingService.createVendor(formData);
        alert('Vendor created successfully!');
      }

      navigate('/vendors');
    } catch (err: any) {
      console.error('Error saving vendor:', err);
      setError(err.message || 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof VendorFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEdit ? 'Edit Vendor' : 'Add New Vendor'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEdit ? 'Update vendor information' : 'Register a new vendor'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/vendors')}
        >
          <Icon name="arrow-left" size={20} className="mr-2" />
          Back to Vendors
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="alert-triangle" size={20} className="text-red-600 mr-3" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Vendor Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Vendor Name"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Rasoi Ghar, Sri Lakshmi Mess"
            />

            <Input
              label="Contact Person"
              value={formData.contact_person || ''}
              onChange={(e) => handleChange('contact_person', e.target.value)}
              placeholder="Person to coordinate with"
            />

            <PhoneInput
              label="Phone Number"
              required
              value={formData.phone}
              onChange={(full) => handleChange('phone', full)}
              placeholder="98765 43210"
            />

            <Input
              label="Email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="vendor@example.com"
            />

            <div className="md:col-span-2">
              <Input
                label="Address"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Operational location"
              />
            </div>

            <Input
              label="GST Number"
              value={formData.gst_number || ''}
              onChange={(e) => handleChange('gst_number', e.target.value)}
              placeholder="27ABCDE1234F1Z5"
            />

            {isEdit && (
              <Select
                label="Status"
                value={formData.status || 'active'}
                onChange={(value) => handleChange('status', value as 'active' | 'paused' | 'terminated')}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'terminated', label: 'Terminated' }
                ]}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Internal comments, e.g. 'Prefers weekly billing'"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/vendors')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            <Icon name="save" size={20} className="mr-2" />
            {isEdit ? 'Update Vendor' : 'Create Vendor'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default VendorFormPage;

