import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FilePlus2, Mail, Pencil, Phone, Power, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getClientById, deactivateClient, reactivateClient } from '@/services/clientService';
import type { Client, ClientGstType } from '@/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatPhone } from '@/utils/format';
import { ClientActiveBadge, ClientTypeBadge } from './ClientParts';

// ================================================================
// CLIENT DETAIL — one page of the client register.
// Header (name, type, status, next action) → details sheet.
// ================================================================

const GST_TYPE_LABEL: Record<ClientGstType, string> = {
  domestic: 'Domestic',
  sez: 'SEZ',
  export: 'Export',
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BACK = { to: '/clients', label: 'Clients' };

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Client Details');
  useDocumentTitle(pageTitle);

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isToggling, setIsToggling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Errors from deactivate/reactivate; `error` is for load failures only
  const [actionError, setActionError] = useState('');

  // Only the latest load may write state (the :id can change while a load is in flight).
  const requestId = useRef(0);

  // `silent` refreshes in place after an action: no skeleton, and a failed
  // refresh keeps the current page instead of replacing it with an error.
  const loadClient = useCallback(async (silent = false) => {
    if (!id) return;
    const reqId = ++requestId.current;

    if (!silent) {
      setIsLoading(true);
      setError('');
    }

    try {
      const data = await getClientById(id);
      if (reqId !== requestId.current) return;
      if (data) {
        setClient(data);
        setPageTitle(data.name);
      } else if (!silent) {
        setError('Client not found or you do not have access');
      }
    } catch (err: unknown) {
      if (reqId !== requestId.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load client';
      if (silent) {
        showToast(`Could not refresh the client: ${message}`, 'warning');
      } else {
        setError(message);
      }
    } finally {
      if (!silent && reqId === requestId.current) setIsLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  const handleToggleStatus = async () => {
    if (isToggling || !user || !client || !id) return;

    setIsToggling(true);
    setActionError('');

    try {
      if (client.is_active) {
        await deactivateClient(user.id, id);
        showToast('Client deactivated', 'success');
      } else {
        await reactivateClient(user.id, id);
        showToast('Client reactivated', 'success');
      }
      // Refresh in place so the page (and this dialog) stay mounted
      await loadClient(true);
      setShowConfirm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update client status';
      setActionError(errorMessage);
      setShowConfirm(false);
      showToast(errorMessage, 'error');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return <ClientDetailSkeleton />;
  }

  if (error || !client) {
    return (
      <div>
        <PageHeader back={BACK} title="Client not found" />
        <Alert variant="error">{error || 'Client not found'}</Alert>
      </div>
    );
  }

  const isCorporate = client.client_type === 'corporate';
  const invoiceType = isCorporate ? 'subscription' : 'event';
  const phoneHref = client.phone ? `tel:${client.phone.replace(/[^\d+]/g, '')}` : '';

  return (
    <div>
      {/* Confirmation Dialog - Deactivate/Reactivate */}
      <ConfirmDialog
        isOpen={showConfirm}
        title={client.is_active ? 'Deactivate this client?' : 'Reactivate this client?'}
        message={client.is_active
          ? 'This client will be marked as inactive. They will not appear in active client lists and cannot be used for new subscriptions or events.'
          : 'This client will be marked as active again and can be used for subscriptions and events.'
        }
        confirmLabel={client.is_active ? 'Deactivate' : 'Reactivate'}
        variant={client.is_active ? 'danger' : 'info'}
        isLoading={isToggling}
        onConfirm={handleToggleStatus}
        onCancel={() => setShowConfirm(false)}
      />

      <PageHeader
        back={BACK}
        title={client.name}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <ClientTypeBadge type={client.client_type} />
            <ClientActiveBadge active={client.is_active} />
          </div>
        }
        actions={
          canEdit && (
            <>
              <LinkButton to={`/invoices/create?client_id=${encodeURIComponent(client.id)}&type=${invoiceType}`}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                New invoice
              </LinkButton>
              <LinkButton to={`/clients/${client.id}/edit`} variant="outline">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </LinkButton>
              <Button variant="ghost" onClick={() => setShowConfirm(true)}>
                {client.is_active ? (
                  <>
                    <Power className="h-4 w-4" aria-hidden="true" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reactivate
                  </>
                )}
              </Button>
            </>
          )
        }
      />

      {actionError && <Alert variant="error" className="mb-6">{actionError}</Alert>}

      <section className="sheet" aria-labelledby="client-details-h">
        <h2 id="client-details-h" className="border-b border-rule px-5 py-4 text-lg font-semibold text-ink sm:px-6">
          Details
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          <Detail label="Contact person">{client.contact_person || '—'}</Detail>
          <Detail label="Phone">
            {client.phone ? (
              <a href={phoneHref} className="tabular inline-flex items-center gap-1.5 text-brand-primary hover:underline">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {formatPhone(client.phone)}
              </a>
            ) : (
              '—'
            )}
          </Detail>
          <Detail label="Email">
            {client.email ? (
              <a href={`mailto:${client.email}`} className="inline-flex max-w-full items-center gap-1.5 text-brand-primary hover:underline">
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-all">{client.email}</span>
              </a>
            ) : (
              '—'
            )}
          </Detail>
          <Detail label="GSTIN">
            {client.gstin ? (
              <span className="serial">{client.gstin}</span>
            ) : (
              <span className="font-normal text-ink-muted">{isCorporate ? 'Not registered' : 'Not applicable'}</span>
            )}
          </Detail>
          <Detail label="GST type">
            {client.gst_type ? (
              GST_TYPE_LABEL[client.gst_type] ?? client.gst_type
            ) : (
              <span className="font-normal text-ink-muted">Not set</span>
            )}
          </Detail>
          <Detail label="Outlet">
            {client.outlets?.name || '—'}
            {client.outlets?.code && <span className="serial ml-2 font-normal text-ink-muted">{client.outlets.code}</span>}
          </Detail>
          <Detail label="Billing address" className="sm:col-span-2">
            {client.billing_address ? (
              <span className="whitespace-pre-line">{client.billing_address}</span>
            ) : (
              <span className="font-normal text-ink-muted">Not given</span>
            )}
          </Detail>
          <Detail label="Created">{fmtDate(client.created_at)}</Detail>
        </dl>
      </section>
    </div>
  );
}

function Detail({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function ClientDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading client">
      <PageHeader back={BACK} title={<span className="skeleton inline-block h-8 w-64 max-w-full rounded-md align-middle" aria-hidden="true" />} />
      <div className="sheet">
        <div className="border-b border-rule px-5 py-4 sm:px-6">
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
