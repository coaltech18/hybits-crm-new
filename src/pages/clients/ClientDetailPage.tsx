import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Power, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getClientById, deactivateClient, reactivateClient } from '@/services/clientService';
import type { Client } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAccountant } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Client Details');
  useDocumentTitle(pageTitle);

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isToggling, setIsToggling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  const loadClient = async () => {
    if (!id) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await getClientById(id);
      if (data) {
        setClient(data);
        setPageTitle(data.name);
      } else {
        setError('Client not found or you do not have access');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load client');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user || !client || !id) return;

    setIsToggling(true);
    setError('');

    try {
      if (client.is_active) {
        await deactivateClient(user.id, id);
        showToast('Client deactivated', 'success');
      } else {
        await reactivateClient(user.id, id);
        showToast('Client reactivated', 'success');
      }
      // Reload client to get updated status
      await loadClient();
      setShowConfirm(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update client status';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-6">
        <Alert variant="error">{error || 'Client not found'}</Alert>
        <Button variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog - Deactivate/Reactivate */}
      <ConfirmDialog
        isOpen={showConfirm}
        title={client?.is_active ? 'Deactivate Client?' : 'Reactivate Client?'}
        message={client?.is_active
          ? 'This client will be marked as inactive. They will not appear in active client lists and cannot be used for new subscriptions or events.'
          : 'This client will be marked as active again and can be used for subscriptions and events.'
        }
        confirmLabel={client?.is_active ? 'Deactivate' : 'Reactivate'}
        variant={client?.is_active ? 'danger' : 'info'}
        isLoading={isToggling}
        onConfirm={handleToggleStatus}
        onCancel={() => setShowConfirm(false)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-brand-text">{client.name}</h1>
            <p className="text-brand-text/70 mt-1">Client Details</p>
          </div>
        </div>
        {!isAccountant && (
          <div className="flex items-center gap-2">
            <Link to={`/clients/${client.id}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              variant={client.is_active ? 'outline' : 'primary'}
              onClick={() => setShowConfirm(true)}
              title={client.is_active ? 'Deactivate client' : 'Reactivate client'}
            >
              {client.is_active ? (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reactivate
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-brand-text mb-4">Basic Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Client Type</dt>
              <dd className="mt-1">
                <Badge variant={client.client_type === 'corporate' ? 'info' : 'warning'}>
                  {client.client_type}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Status</dt>
              <dd className="mt-1">
                <Badge variant={client.is_active ? 'success' : 'danger'}>
                  {client.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Outlet</dt>
              <dd className="mt-1 text-sm text-brand-text">{client.outlets?.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Created At</dt>
              <dd className="mt-1 text-sm text-brand-text">
                {new Date(client.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-brand-text mb-4">Contact Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Contact Person</dt>
              <dd className="mt-1 text-sm text-brand-text">{client.contact_person || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Phone</dt>
              <dd className="mt-1 text-sm text-brand-text">{client.phone}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-brand-text/70">Email</dt>
              <dd className="mt-1 text-sm text-brand-text">{client.email || '-'}</dd>
            </div>
            {client.gstin && (
              <div>
                <dt className="text-sm font-medium text-brand-text/70">GSTIN</dt>
                <dd className="mt-1 text-sm text-brand-text font-mono">{client.gstin}</dd>
              </div>
            )}
          </dl>
        </Card>

        {client.billing_address && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold text-brand-text mb-4">Billing Address</h2>
            <p className="text-sm text-brand-text whitespace-pre-line">{client.billing_address}</p>
          </Card>
        )}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-brand-text mb-4">Related Records</h2>
        <p className="text-sm text-brand-text/70">
          Subscriptions, events, and invoices will appear here in future phases.
        </p>
      </Card>
    </div>
  );
}
