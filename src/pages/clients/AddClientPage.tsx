import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { createClient } from '@/services/clientService';
import { supabase } from '@/lib/supabase';
import type { CreateClientInput, ClientType, Outlet } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { validateGSTIN, validatePhone } from '@/utils/validation';

export function AddClientPage() {
  useDocumentTitle('Add Client');

  const navigate = useNavigate();
  const { user, isAdmin, isManager, outlets: managerOutlets, selectedOutlet } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<CreateClientInput>({
    outlet_id: isManager && selectedOutlet ? selectedOutlet : '',
    client_type: 'corporate',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: '',
    billing_address: '',
  });

  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadAllOutlets();
    } else if (isManager) {
      setAllOutlets(managerOutlets);
    }
  }, [isAdmin, isManager, managerOutlets]);

  const loadAllOutlets = async () => {
    const { data } = await supabase.from('outlets').select('*').eq('is_active', true);
    if (data) setAllOutlets(data);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Client name must be at least 2 characters';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.valid) {
        newErrors.phone = phoneValidation.error!;
      }
    }

    if (formData.gstin && formData.gstin.trim()) {
      const gstinValidation = validateGSTIN(formData.gstin);
      if (!gstinValidation.valid) {
        newErrors.gstin = gstinValidation.error!;
      }
    }

    if (!formData.outlet_id) {
      newErrors.outlet_id = 'Please select an outlet';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;

    setSubmitError('');
    setIsLoading(true);

    try {
      await createClient(user.id, formData);
      showToast('Client created successfully', 'success');
      navigate('/clients');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create client';
      setSubmitError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Add Client</h1>
          <p className="text-brand-text/70 mt-1">Create a new client record</p>
        </div>
      </div>

      {submitError && <Alert variant="error">{submitError}</Alert>}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Type */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-text mb-2">
                Client Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="client_type"
                    value="corporate"
                    checked={formData.client_type === 'corporate'}
                    onChange={(e) =>
                      setFormData({ ...formData, client_type: e.target.value as ClientType })
                    }
                    className="mr-2"
                  />
                  <span>Corporate (Subscriptions)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="client_type"
                    value="event"
                    checked={formData.client_type === 'event'}
                    onChange={(e) =>
                      setFormData({ ...formData, client_type: e.target.value as ClientType })
                    }
                    className="mr-2"
                  />
                  <span>Event (One-time)</span>
                </label>
              </div>
            </div>

            {/* Outlet */}
            {isAdmin ? (
              <div className="md:col-span-2">
                <Select
                  label="Outlet"
                  required
                  value={formData.outlet_id}
                  onChange={(e) => setFormData({ ...formData, outlet_id: e.target.value })}
                  error={errors.outlet_id}
                  options={[
                    { value: '', label: 'Select outlet' },
                    ...allOutlets.map((o) => ({ value: o.id, label: o.name })),
                  ]}
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <Input
                  label="Outlet"
                  value={allOutlets.find((o) => o.id === formData.outlet_id)?.name || ''}
                  disabled
                />
              </div>
            )}

            {/* Name */}
            <Input
              label="Client Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={errors.name}
              placeholder="Enter client name"
            />

            {/* Contact Person */}
            <Input
              label="Contact Person"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="Enter contact person name"
            />

            {/* Phone */}
            <Input
              label="Phone Number"
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={errors.phone}
              placeholder="+91 98765 43210"
            />

            {/* Email */}
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@example.com"
            />

            {/* GSTIN (only for corporate) */}
            {formData.client_type === 'corporate' && (
              <div className="md:col-span-2">
                <Input
                  label="GSTIN"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  error={errors.gstin}
                  placeholder="27AABCU9603R1ZV"
                  helperText="15-character GST number (optional)"
                />
              </div>
            )}

            {/* Billing Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-text mb-1">
                Billing Address
              </label>
              <textarea
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows={3}
                className="block w-full px-3 py-2 border border-brand-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="Enter billing address"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="secondary" onClick={() => navigate('/clients')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Client
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
