import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { createClient } from '@/services/clientService';
import { supabase } from '@/lib/supabase';
import type { CreateClientInput, ClientType, ClientGstType, Outlet } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { validateGSTIN, validatePhone, validateEmail } from '@/utils/validation';
import { ClientTypeChoice, FormActionBar, FormSection } from './ClientParts';

export function AddClientPage() {
  useDocumentTitle('New client');

  const navigate = useNavigate();
  const { user, isAdmin, isManager, outlets: managerOutlets, selectedOutlet } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<CreateClientInput>({
    outlet_id: selectedOutlet ?? (isManager && managerOutlets.length === 1 ? managerOutlets[0].id : ''),
    client_type: 'corporate',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: '',
    billing_address: '',
    gst_type: 'domestic',
  });

  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Admins and multi-outlet managers must pick an outlet
  const canPickOutlet = isAdmin || managerOutlets.length > 1;

  useEffect(() => {
    if (isAdmin) {
      let stale = false;
      supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .then(({ data, error }) => {
          if (stale) return;
          if (error) {
            setSubmitError(`Failed to load outlets: ${error.message}`);
            return;
          }
          setAllOutlets(data || []);
        });
      return () => {
        stale = true;
      };
    }
    if (isManager) {
      setAllOutlets(managerOutlets);
    }
  }, [isAdmin, isManager, managerOutlets]);

  // Auto-select the outlet only when exactly one is available
  useEffect(() => {
    if (allOutlets.length === 1) {
      const only = allOutlets[0].id;
      setFormData((prev) => (prev.outlet_id ? prev : { ...prev, outlet_id: only }));
    }
  }, [allOutlets]);

  const handleTypeChange = (type: ClientType) => {
    setFormData((prev) => ({
      ...prev,
      client_type: type,
      // GSTIN and GST type are corporate-only
      gstin: type === 'event' ? '' : prev.gstin,
      gst_type: type === 'event' ? null : prev.gst_type ?? 'domestic',
    }));
    if (type === 'event' && errors.gstin) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.gstin;
        return next;
      });
    }
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

    const emailValidation = validateEmail(formData.email || '');
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error!;
    }

    if (formData.client_type === 'corporate' && formData.gstin && formData.gstin.trim()) {
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
    if (isLoading || !user || !validateForm()) return;

    setSubmitError('');
    setIsLoading(true);

    try {
      const isCorporate = formData.client_type === 'corporate';
      await createClient(user.id, {
        ...formData,
        gstin: isCorporate ? formData.gstin : undefined,
        gst_type: isCorporate ? formData.gst_type : null,
      });
      showToast('Client created successfully', 'success');
      navigate('/clients');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create client';
      setSubmitError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ to: '/clients', label: 'Clients' }}
        title="New client"
        description="Register a corporate subscriber or an event booking with an outlet."
      />

      {submitError && <Alert variant="error" className="mb-6">{submitError}</Alert>}

      <form onSubmit={handleSubmit} className="sheet">
        <FormSection id="client-type-h" title="Client type" description="Decides how this client is billed.">
          <ClientTypeChoice value={formData.client_type} onChange={handleTypeChange} />
        </FormSection>

        <FormSection id="client-outlet-h" title="Outlet" description="The outlet that serves and bills this client.">
          {canPickOutlet ? (
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
          ) : (
            <Input
              label="Outlet"
              value={allOutlets.find((o) => o.id === formData.outlet_id)?.name || 'No outlet assigned'}
              disabled
              error={errors.outlet_id}
            />
          )}
        </FormSection>

        <FormSection id="client-contact-h" title="Contact">
          <Input
            label="Client name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            placeholder="Company or family name"
          />

          <Input
            label="Contact person"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            placeholder="Who to call"
          />

          <Input
            label="Phone number"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            error={errors.phone}
            placeholder="+91 98765 43210"
          />

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
            placeholder="accounts@example.com"
          />
        </FormSection>

        {/* GSTIN and GST type apply to corporate clients only */}
        {formData.client_type === 'corporate' && (
          <FormSection id="client-tax-h" title="Tax details" description="Printed on invoices and used to file GST.">
            <Input
              label="GSTIN"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              error={errors.gstin}
              placeholder="27AAPFU0939F1ZV"
              helperText="15 characters. Leave blank if the client is not registered."
              className="serial"
              autoCapitalize="characters"
              spellCheck={false}
            />

            <Select
              label="GST type"
              value={formData.gst_type || 'domestic'}
              onChange={(e) =>
                setFormData({ ...formData, gst_type: e.target.value as ClientGstType })
              }
              helperText="Decides which GST working sheet this client's invoices appear in."
            >
              <option value="domestic">Domestic</option>
              <option value="sez">SEZ</option>
              <option value="export">Export</option>
            </Select>
          </FormSection>
        )}

        <FormSection id="client-address-h" title="Address">
          <div className="md:col-span-2">
            <Textarea
              label="Billing address"
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              rows={3}
              placeholder="Building, street, area, city, PIN"
              helperText="Printed on the client's invoices."
            />
          </div>
        </FormSection>

        <FormActionBar>
          <LinkButton to="/clients" variant="outline">
            Cancel
          </LinkButton>
          <Button type="submit" isLoading={isLoading}>
            Create client
          </Button>
        </FormActionBar>
      </form>
    </div>
  );
}
