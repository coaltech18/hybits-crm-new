import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getClientById, updateClient, getClientUsageCounts } from '@/services/clientService';
import type { Client, UpdateClientInput, ClientType, ClientGstType } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { validateGSTIN, validatePhone, validateEmail } from '@/utils/validation';
import { ClientTypeChoice, ClientTypeReadout, FormActionBar, FormSection } from './ClientParts';

export function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Edit client');
  useDocumentTitle(pageTitle);

  const [client, setClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<UpdateClientInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Type changes are blocked once the client has subscriptions, events or invoices
  // (the DB rules on those rows would then reject every later update).
  // null = unknown (still loading or failed): treat as locked.
  const [hasLinkedRecords, setHasLinkedRecords] = useState<boolean | null>(null);

  // Only the latest load may write state (the :id can change while a load is in flight).
  const requestId = useRef(0);

  const loadClient = useCallback(async () => {
    if (!id) return;
    const reqId = ++requestId.current;

    setIsLoading(true);
    setSubmitError('');
    setErrors({});
    setClient(null);
    setHasLinkedRecords(null);
    try {
      const data = await getClientById(id);
      if (reqId !== requestId.current) return;
      if (data) {
        setClient(data);
        setPageTitle(`Edit ${data.name}`);
        setFormData({
          name: data.name,
          contact_person: data.contact_person || '',
          phone: data.phone,
          email: data.email || '',
          gstin: data.gstin || '',
          billing_address: data.billing_address || '',
          gst_type: data.gst_type || null,
        });

        try {
          const usage = await getClientUsageCounts(id);
          if (reqId !== requestId.current) return;
          setHasLinkedRecords(usage.subscriptions + usage.events + usage.invoices > 0);
        } catch {
          if (reqId === requestId.current) setHasLinkedRecords(null);
        }
      }
    } catch (err: unknown) {
      if (reqId === requestId.current) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to load client');
      }
    } finally {
      if (reqId === requestId.current) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const effectiveType: ClientType | undefined = formData.client_type || client?.client_type;
  const typeLocked = hasLinkedRecords !== false;

  const handleTypeChange = (type: ClientType) => {
    setFormData((prev) => ({
      ...prev,
      client_type: type,
      gstin: type === 'event' ? '' : prev.gstin,
      // GST type applies to corporate clients only (same rule as Add client)
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

    if (formData.name !== undefined && formData.name.trim().length < 2) {
      newErrors.name = 'Client name must be at least 2 characters';
    }

    if (formData.phone !== undefined) {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.valid) {
        newErrors.phone = phoneValidation.error!;
      }
    }

    const emailValidation = validateEmail(formData.email || '');
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error!;
    }

    if (effectiveType === 'corporate' && formData.gstin && formData.gstin.trim()) {
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
    if (isSaving || !user || !id || !client || !validateForm()) return;

    setSubmitError('');
    setIsSaving(true);

    try {
      const payload: UpdateClientInput = { ...formData };
      // Only send a type change when it really changes and is allowed
      if (!isAdmin || typeLocked || payload.client_type === client.client_type) {
        delete payload.client_type;
      }
      // GSTIN and GST type apply to corporate clients only
      if (effectiveType !== 'corporate') {
        delete payload.gstin;
        payload.gst_type = null;
      }
      await updateClient(user.id, id, payload);
      showToast('Client updated successfully', 'success');
      navigate(`/clients/${id}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update client';
      setSubmitError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const back = { to: `/clients/${id}`, label: client?.name || 'Client' };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading client">
        <PageHeader back={{ to: '/clients', label: 'Clients' }} title="Edit client" />
        <div className="sheet">
          {Array.from({ length: 3 }, (_, section) => (
            <div key={section} className="border-t border-rule px-5 py-6 first:border-t-0 sm:px-6">
              <Skeleton className="mb-5 h-6 w-32" />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {Array.from({ length: 2 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader back={{ to: '/clients', label: 'Clients' }} title="Client not found" />
        <Alert variant="error">{submitError || 'Client not found or you do not have access'}</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader back={back} title="Edit client" description={client.name} />

      {submitError && <Alert variant="error" className="mb-6">{submitError}</Alert>}

      <form onSubmit={handleSubmit} className="sheet">
        <FormSection id="client-type-h" title="Client type" description="Decides how this client is billed.">
          {/* Client type: admins only, and only before any linked records exist */}
          {isAdmin && !typeLocked ? (
            <ClientTypeChoice value={effectiveType} onChange={handleTypeChange} />
          ) : (
            <ClientTypeReadout
              type={client.client_type}
              note={
                !isAdmin
                  ? 'Only an admin can change the client type.'
                  : hasLinkedRecords === null
                    ? 'Type cannot be changed right now: linked records could not be checked.'
                    : 'Type cannot be changed because this client already has subscriptions, events or invoices.'
              }
            />
          )}
        </FormSection>

        <FormSection id="client-outlet-h" title="Outlet">
          <Input
            label="Outlet"
            value={client.outlets?.name || ''}
            disabled
            helperText="A client stays with the outlet it was registered at."
          />
        </FormSection>

        <FormSection id="client-contact-h" title="Contact">
          <Input
            label="Client name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />

          <Input
            label="Contact person"
            value={formData.contact_person}
            onChange={(e) =>
              setFormData({ ...formData, contact_person: e.target.value })
            }
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
          />

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />
        </FormSection>

        {/* GSTIN and GST type apply to corporate clients only */}
        {effectiveType === 'corporate' && (
          <FormSection id="client-tax-h" title="Tax details" description="Printed on invoices and used to file GST.">
            <Input
              label="GSTIN"
              value={formData.gstin}
              onChange={(e) =>
                setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
              }
              error={errors.gstin}
              placeholder="27AAPFU0939F1ZV"
              helperText="15 characters. Leave blank if the client is not registered."
              className="serial"
              autoCapitalize="characters"
              spellCheck={false}
            />

            <Select
              label="GST type"
              value={formData.gst_type || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gst_type: (e.target.value || null) as ClientGstType | null,
                })
              }
              helperText="Decides which GST working sheet this client's invoices appear in."
            >
              <option value="">Not set</option>
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
              onChange={(e) =>
                setFormData({ ...formData, billing_address: e.target.value })
              }
              rows={3}
              helperText="Printed on the client's invoices."
            />
          </div>
        </FormSection>

        <FormActionBar>
          <LinkButton to={`/clients/${id}`} variant="outline">
            Cancel
          </LinkButton>
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        </FormActionBar>
      </form>
    </div>
  );
}
