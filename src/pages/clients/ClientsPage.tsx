import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getClients } from '@/services/clientService';
import type { Client, ClientFilters } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';

export function ClientsPage() {
  useDocumentTitle('Clients');

  const navigate = useNavigate();
  const { user, isAccountant, isAuthReady } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ClientFilters>({
    is_active: true,
  });

  useEffect(() => {
    if (!isAuthReady) return;
    loadClients();
  }, [isAuthReady, filters, user]);
  const loadClients = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await getClients(user.id, filters);
      setClients(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Clients</h1>
          <p className="text-brand-text/70 mt-1">Manage your client database</p>
        </div>
        {!isAccountant && (
          <Link to="/clients/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search by name or phone..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />

          <Select
            value={filters.client_type || ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                client_type: e.target.value as any,
              })
            }
            options={[
              { value: '', label: 'All Types' },
              { value: 'corporate', label: 'Corporate' },
              { value: 'event', label: 'Event' },
            ]}
          />

          <Select
            value={filters.is_active ? 'true' : 'false'}
            onChange={(e) =>
              setFilters({
                ...filters,
                is_active: e.target.value === 'true',
              })
            }
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
        </div>
      </Card>

      {/* Error */}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && clients.length === 0 && (
        <Card>
          <EmptyState
            icon={Users}
            title="No clients found"
            description={!isAccountant ? "Create your first client to get started." : "No clients match your current filters."}
            action={!isAccountant ? { label: 'Add Client', onClick: () => navigate('/clients/new') } : undefined}
          />
        </Card>
      )}

      {/* Clients Table */}
      {!isLoading && !error && clients.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brand-bg border-b border-brand-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outlet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-brand-border">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-brand-primary/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-brand-text">
                        {client.name}
                      </div>
                      {client.contact_person && (
                        <div className="text-sm text-brand-text/70">
                          {client.contact_person}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={
                          client.client_type === 'corporate'
                            ? 'info'
                            : 'warning'
                        }
                      >
                        {client.client_type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                      {client.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                      {client.outlets?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={client.is_active ? 'success' : 'danger'}
                      >
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Link
                        to={`/clients/${client.id}`}
                        className="text-brand-primary hover:text-brand-primaryDark"
                      >
                        View
                      </Link>
                      {!isAccountant && (
                        <Link
                          to={`/clients/${client.id}/edit`}
                          className="text-brand-primary hover:text-brand-primaryDark"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
