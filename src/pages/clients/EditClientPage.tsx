import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getClientById, updateClient } from '@/services/clientService';
import type { Client, UpdateClientInput, ClientType, ClientGstType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { validateGSTIN, validatePhone } from '@/utils/validation';

export function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<UpdateClientInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  const loadClient = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const data = await getClientById(id);
      if (data) {
        setClient(data);
        setFormData({
          name: data.name,
          contact_person: data.contact_person || '',
          phone: data.phone,
          email: data.email || '',
          gstin: data.gstin || '',
          billing_address: data.billing_address || '',
          gst_type: data.gst_type || null,
        });
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to load client');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name && formData.name?.trim().length < 2) {
      newErrors.name = 'Client name must be at least 2 characters';
    }

    if (formData.phone) {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.valid) {
        newErrors.phone = phoneValidation.error!;
      }
    }

    if (formData.gstin && formData.gstin?.trim()) {
      const gstinValidation = validateGSTIN(formData.gstin);
      if (!gstinValidation.valid) {
        newErrors.gstin = gstinValidation.error!;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !validateForm()) return;

    setSubmitError('');
    setIsSaving(true);

    try {
      await updateClient(user.id, id, formData);
      navigate(`/clients/${id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to update client');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Alert variant="error">Client not found or you do not have access</Alert>
        <Button variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Edit Client</h1>
          <p className="text-brand-text/70 mt-1">{client.name}</p>
        </div>
      </div>

      {submitError && <Alert variant="error">{submitError}</Alert>}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Type (admin only) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-text mb-2">
                Client Type
                {!isAdmin && (
                  <span className="ml-2 text-xs text-brand-text/70">(Admin only)</span>
                )}
              </label>
              {isAdmin ? (
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="client_type"
                      value="corporate"
                      checked={
                        (formData.client_type || client.client_type) === 'corporate'
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          client_type: e.target.value as ClientType,
                        })
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
                      checked={(formData.client_type || client.client_type) === 'event'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          client_type: e.target.value as ClientType,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Event (One-time)</span>
                  </label>
                </div>
              ) : (
                <div className="px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-sm capitalize">
                  {client.client_type}
                </div>
              )}
            </div>

            {/* Outlet (disabled for managers) */}
            <div className="md:col-span-2">
              <Input
                label={`Outlet ${!isAdmin ? '(Admin only)' : ''}`}
                value={client.outlets?.name || ''}
                disabled
              />
            </div>

            {/* Name */}
            <Input
              label="Client Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={errors.name}
            />

            {/* Contact Person */}
            <Input
              label="Contact Person"
              value={formData.contact_person}
              onChange={(e) =>
                setFormData({ ...formData, contact_person: e.target.value })
              }
            />

            {/* Phone */}
            <Input
              label="Phone Number"
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={errors.phone}
            />

            {/* Email */}
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            {/* GSTIN (only for corporate) */}
            {(formData.client_type || client.client_type) === 'corporate' && (
              <div className="md:col-span-2">
                <Input
                  label="GSTIN"
                  value={formData.gstin}
                  onChange={(e) =>
                    setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                  }
                  error={errors.gstin}
                  placeholder="27AABCU9603R1ZV"
                />
              </div>
            )}

            {/* GST Type for Reports */}
            <div className="md:col-span-2">
              <Select
                label="GST Type (for Reports)"
                value={formData.gst_type || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gst_type: (e.target.value || null) as ClientGstType | null,
                  })
                }
              >
                <option value="">-- Select GST Type --</option>
                <option value="domestic">Domestic</option>
                <option value="sez">SEZ</option>
                <option value="export">Export</option>
              </Select>
              <p className="text-xs text-brand-text/60 mt-1">
                Used for GST Working Reports. Select based on client's GST classification.
              </p>
            </div>

            {/* Billing Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-brand-text mb-1">
                Billing Address
              </label>
              <textarea
                value={formData.billing_address}
                onChange={(e) =>
                  setFormData({ ...formData, billing_address: e.target.value })
                }
                rows={3}
                className="block w-full px-3 py-2 border border-brand-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/clients/${id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
