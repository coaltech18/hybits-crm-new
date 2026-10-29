import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { createEvent } from '@/services/eventService';
import { getClients } from '@/services/clientService';
import type { CreateEventInput, Client, Outlet } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { todayISO } from '@/utils/date';

export default function AddEventPage() {
  useDocumentTitle('New event');

  const navigate = useNavigate();
  const { user, outlets } = useAuth();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateEventInput>({
    outlet_id: '',
    client_id: '',
    event_name: '',
    event_type: '',
    event_date: todayISO(),
    guest_count: undefined,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get available outlets
  const availableOutlets: Outlet[] = outlets || [];
  const singleOutletId = availableOutlets.length === 1 ? availableOutlets[0].id : '';

  // Auto-fill the outlet when the user has exactly one (any role)
  useEffect(() => {
    if (singleOutletId) {
      setFormData((prev) =>
        prev.outlet_id === singleOutletId ? prev : { ...prev, outlet_id: singleOutletId, client_id: '' }
      );
    }
  }, [singleOutletId]);

  // Load the selected outlet's event clients; ignore responses for an outlet
  // that is no longer selected.
  const userId = user?.id;
  const outletId = formData.outlet_id;
  useEffect(() => {
    if (!userId || !outletId) {
      setClients([]);
      setClientsLoading(false);
      return;
    }

    let stale = false;
    setClientsLoading(true);
    getClients(userId, { client_type: 'event', outlet_id: outletId })
      .then((data) => {
        if (!stale) setClients(data.filter((c) => c.outlet_id === outletId));
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : 'Failed to load clients');
      })
      .finally(() => {
        if (!stale) setClientsLoading(false);
      });

    return () => {
      stale = true;
    };
  }, [userId, outletId]);

  function clearFieldError(field: string) {
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }

  function handleChange<K extends keyof CreateEventInput>(field: K, value: CreateEventInput[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  }

  function handleOutletChange(value: string) {
    // The previous client belongs to the old outlet
    setFormData((prev) => ({ ...prev, outlet_id: value, client_id: '' }));
    clearFieldError('outlet_id');
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.outlet_id) {
      newErrors.outlet_id = 'Outlet is required';
    }

    if (!formData.client_id) {
      newErrors.client_id = 'Client is required';
    }

    if (!formData.event_name || formData.event_name.trim() === '') {
      newErrors.event_name = 'Event name is required';
    }

    if (!formData.event_date) {
      newErrors.event_date = 'Event date is required';
    }

    if (
      formData.guest_count !== undefined &&
      (!Number.isInteger(formData.guest_count) || formData.guest_count <= 0)
    ) {
      newErrors.guest_count = 'Guest count must be a whole number greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (submitting || !validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      const created = await createEvent(user.id, formData);
      showToast('Event created successfully', 'success');
      navigate(`/events/${created.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const isPastDate = !!formData.event_date && formData.event_date < todayISO();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ to: '/events', label: 'Events' }}
        title="New event"
        description="Book a one-off event for an event client. You can send dishware to it once it is saved."
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Warning when no outlets exist */}
      {availableOutlets.length === 0 && (
        <Alert variant="warning" className="mb-6">
          <p className="font-semibold">No outlets found</p>
          <p className="mt-1">
            {user?.role === 'admin'
              ? 'You need to create at least one outlet before you can create events.'
              : 'No outlets have been assigned to you. Please contact your administrator.'}
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="sheet">
        <div className="space-y-6 p-5 sm:p-6">
          {/* Booking */}
          <section aria-labelledby="booking-h" className="space-y-4">
            <div>
              <h2 id="booking-h" className="text-lg font-semibold text-ink">Booking</h2>
              <p className="text-sm text-ink-muted">The outlet that supplies the dishware, and the client being billed.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Outlet: a choice only when there is more than one */}
              {availableOutlets.length > 1 ? (
                <Select
                  label="Outlet"
                  value={formData.outlet_id}
                  onChange={(e) => handleOutletChange(e.target.value)}
                  error={errors.outlet_id}
                  required
                >
                  <option value="">Select outlet</option>
                  {availableOutlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} ({outlet.code})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  label="Outlet"
                  value={availableOutlets[0]?.name || 'No outlet assigned'}
                  error={errors.outlet_id}
                  disabled
                />
              )}

              <Select
                label="Client"
                value={formData.client_id}
                onChange={(e) => handleChange('client_id', e.target.value)}
                error={errors.client_id}
                required
                disabled={!formData.outlet_id || clientsLoading}
              >
                <option value="">
                  {!formData.outlet_id
                    ? 'Select outlet first'
                    : clientsLoading
                      ? 'Loading clients…'
                      : 'Select client'}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.phone}
                  </option>
                ))}
              </Select>
            </div>

            {clients.length === 0 && formData.outlet_id && !clientsLoading && (
              <Alert variant="warning">
                No event clients found for this outlet.{' '}
                <Link to="/clients/new" className="font-semibold underline">
                  Create an event client
                </Link>{' '}
                first.
              </Alert>
            )}
          </section>

          {/* Event */}
          <section aria-labelledby="event-h" className="space-y-4 border-t border-rule pt-6">
            <h2 id="event-h" className="text-lg font-semibold text-ink">Event</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label="Event name"
                  value={formData.event_name}
                  onChange={(e) => handleChange('event_name', e.target.value)}
                  error={errors.event_name}
                  placeholder="e.g. Kumar–Priya wedding"
                  required
                />
              </div>

              <Input
                label="Event type (optional)"
                value={formData.event_type}
                onChange={(e) => handleChange('event_type', e.target.value)}
                placeholder="e.g. Wedding, birthday, corporate"
              />

              <DateInput
                label="Event date"
                value={formData.event_date}
                onChange={(e) => handleChange('event_date', e.target.value)}
                error={errors.event_date}
                helperText={isPastDate ? 'This date is in the past. Check it before saving.' : undefined}
                required
              />

              <Input
                label="Guest count (optional)"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={formData.guest_count ?? ''}
                onChange={(e) =>
                  handleChange('guest_count', e.target.value === '' ? undefined : Number(e.target.value))
                }
                error={errors.guest_count}
                placeholder="Expected number of guests"
              />
            </div>
          </section>

          {/* Notes */}
          <section aria-labelledby="notes-h" className="space-y-4 border-t border-rule pt-6">
            <h2 id="notes-h" className="text-lg font-semibold text-ink">Notes</h2>
            <Textarea
              label="Notes (optional)"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              placeholder="Venue, timings, anything the dispatch team should know"
            />
          </section>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-sheet border-t border-rule bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
          <Button type="button" variant="outline" onClick={() => navigate('/events')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} disabled={submitting || availableOutlets.length === 0}>
            {submitting ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      </form>
    </div>
  );
}
