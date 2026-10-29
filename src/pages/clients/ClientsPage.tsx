import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getClients } from '@/services/clientService';
import type { Client, ClientFilters, ClientType } from '@/types';
import { LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton, TableSkeleton } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPhone } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ClientActiveBadge, ClientTypeBadge } from './ClientParts';

// ================================================================
// CLIENTS — the client register.
// Count line → filters (search, type, active/inactive) → ledger.
// ================================================================

const count = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export function ClientsPage() {
  useDocumentTitle('Clients');

  const navigate = useNavigate();
  const { user, isAdmin, isManager, isAuthReady } = useAuth();
  const canEdit = isAdmin || isManager;
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ClientFilters>({
    is_active: true,
  });

  // Debounce the search text so each keystroke does not fire a request
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search || ''), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Only the latest request may update the table
  const requestSeq = useRef(0);
  const userId = user?.id;
  const { client_type: clientType, is_active: isActive } = filters;

  const loadClients = useCallback(async () => {
    if (!userId) return;
    const seq = ++requestSeq.current;

    setIsLoading(true);
    setError('');

    try {
      const data = await getClients(userId, {
        client_type: clientType,
        is_active: isActive,
        search: debouncedSearch,
      });
      if (seq === requestSeq.current) setClients(data);
    } catch (err: unknown) {
      if (seq === requestSeq.current) {
        setError(err instanceof Error ? err.message : 'Failed to load clients');
      }
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [userId, clientType, isActive, debouncedSearch]);

  useEffect(() => {
    if (!isAuthReady) return;
    loadClients();
  }, [isAuthReady, loadClients]);

  const statusWord = filters.is_active ? 'active' : 'inactive';
  const typeWord = filters.client_type === 'corporate' ? ' corporate' : filters.client_type === 'event' ? ' event' : '';
  const isFiltered = Boolean((filters.search || '').trim() || filters.client_type);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="The client register for your outlets: corporate subscribers and event bookings."
        actions={
          canEdit && (
            <LinkButton to="/clients/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New client
            </LinkButton>
          )
        }
      />

      {/* Filters stay mounted while the list reloads */}
      <Card padding="sm" className="mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="relative md:flex-1">
            <Input
              label="Search"
              type="search"
              placeholder="Name or phone"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9"
            />
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-ink-faint" aria-hidden="true" />
          </div>

          <div className="md:w-48">
            <Select
              label="Type"
              value={filters.client_type || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  client_type: (e.target.value || undefined) as ClientType | undefined,
                })
              }
              options={[
                { value: '', label: 'All types' },
                { value: 'corporate', label: 'Corporate' },
                { value: 'event', label: 'Event' },
              ]}
            />
          </div>

          <div role="group" aria-labelledby="client-status-label" className="shrink-0">
            <span id="client-status-label" className="mb-1.5 block text-sm font-semibold text-ink">
              Status
            </span>
            <div className="inline-flex h-10 rounded-lg border border-rule-strong bg-paper-sunk p-0.5">
              {([true, false] as const).map((active) => {
                const pressed = filters.is_active === active;
                return (
                  <button
                    key={String(active)}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => setFilters({ ...filters, is_active: active })}
                    className={cn(
                      'rounded-md px-4 text-sm font-semibold transition-colors',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-logo',
                      pressed ? 'bg-white text-ink shadow-sheet' : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    {active ? 'Active' : 'Inactive'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Count line */}
      <div className="mb-3 min-h-[1.5rem] text-sm text-ink-muted" aria-live="polite">
        {isLoading ? (
          <Skeleton className="inline-block h-4 w-40 align-middle" />
        ) : error ? null : (
          <>
            <span className="tabular font-semibold text-ink">{count(clients.length)}</span>{' '}
            {statusWord}
            {typeWord} client{clients.length === 1 ? '' : 's'}
            {debouncedSearch.trim() ? ` matching “${debouncedSearch.trim()}”` : ''}
          </>
        )}
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {!error && (
        <Card padding="none" className="overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={isFiltered ? 'No clients match these filters' : filters.is_active ? 'No active clients yet' : 'No inactive clients'}
              description={
                isFiltered
                  ? 'Try a different name or phone number, or clear the type filter.'
                  : filters.is_active
                    ? canEdit
                      ? 'Register a client to start raising invoices and sending dishware.'
                      : 'Clients registered at your outlets will be listed here.'
                    : 'Clients you deactivate are kept here, with their history intact.'
              }
              action={canEdit ? { label: 'New client', onClick: () => navigate('/clients/new') } : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Type</th>
                    <th scope="col">Outlet</th>
                    <th scope="col">Status</th>
                    {canEdit && <th scope="col" data-nolabel className="w-px"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className={client.is_active ? undefined : 'row-void'}>
                      <td className="max-w-[18rem]">
                        <Link
                          to={`/clients/${client.id}`}
                          className="inline-block max-w-full truncate align-top font-semibold text-ink hover:text-brand-primary"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="max-w-[16rem]">
                        <div className="min-w-0">
                          <span className="block truncate">{client.contact_person || '—'}</span>
                          {client.phone && (
                            <span className="tabular block whitespace-nowrap text-ink-muted">{formatPhone(client.phone)}</span>
                          )}
                        </div>
                      </td>
                      <td><ClientTypeBadge type={client.client_type} /></td>
                      <td className="cell-hide-sm whitespace-nowrap">{client.outlets?.name || '—'}</td>
                      <td><ClientActiveBadge active={client.is_active} /></td>
                      {canEdit && (
                        <td className="text-right">
                          <Link
                            to={`/clients/${client.id}/edit`}
                            className="text-sm font-semibold text-brand-primary hover:underline"
                            aria-label={`Edit ${client.name}`}
                          >
                            Edit
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
