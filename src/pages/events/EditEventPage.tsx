import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getEventById, updateEvent } from '@/services/eventService';
import type { Event, UpdateEventInput } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Edit event');
  useDocumentTitle(pageTitle);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<UpdateEventInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Only the latest load may write state (the :id can change while a load is in flight).
  const requestId = useRef(0);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    const req = ++requestId.current;

    try {
      setLoading(true);
      setError(null);
      setErrors({});
      setEvent(null);
      const data = await getEventById(id);
      if (req !== requestId.current) return;

      if (!data) {
        setError('Event not found or you do not have access');
        return;
      }

      setEvent(data);
      setPageTitle(`Edit ${data.event_name}`);

      // Initialize form with current values
      setFormData({
        event_name: data.event_name,
        event_type: data.event_type || '',
        event_date: data.event_date,
        guest_count: data.guest_count ?? null,
        notes: data.notes || '',
      });
    } catch (err) {
      if (req === requestId.current) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      }
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  function handleChange<K extends keyof UpdateEventInput>(field: K, value: UpdateEventInput[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (formData.event_name !== undefined && formData.event_name.trim() === '') {
      newErrors.event_name = 'Event name is required';
    }

    if (formData.event_date !== undefined && !formData.event_date) {
      newErrors.event_date = 'Event date is required';
    }

    if (
      formData.guest_count != null &&
      (!Number.isInteger(formData.guest_count) || formData.guest_count <= 0)
    ) {
      newErrors.guest_count = 'Guest count must be a whole number greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (submitting || !validateForm() || !user?.id || !id) return;

    try {
      setSubmitting(true);
      setError(null);

      await updateEvent(user.id, id, formData);
      showToast('Event updated successfully', 'success');
      navigate(`/events/${id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update event';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const backTo = { to: `/events/${id}`, label: 'Event' };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl" role="status" aria-label="Loading event">
        <PageHeader back={backTo} title="Edit event" />
        <div className="sheet space-y-5 p-5 sm:p-6">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={{ to: '/events', label: 'Events' }} title="Edit event" />
        <Alert variant="error">{error || 'Event not found'}</Alert>
      </div>
    );
  }

  const canEdit = event.status === 'planned';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ to: `/events/${id}`, label: event.event_name }}
        title="Edit event"
        description={event.event_name}
      />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {!canEdit && (
        <Alert variant="warning" className="mb-6">
          This event cannot be edited because it is {event.status}.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="sheet">
        <div className="space-y-6 p-5 sm:p-6">
          {/* Booking (fixed once created) */}
          <section aria-labelledby="booking-h" className="space-y-4">
            <div>
              <h2 id="booking-h" className="text-lg font-semibold text-ink">Booking</h2>
              <p className="text-sm text-ink-muted">The client and outlet cannot be changed after an event is created.</p>
            </div>
            <dl className="grid grid-cols-1 gap-4 rounded-lg bg-paper-sunk px-4 py-3 sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-sm text-ink-muted">Client</dt>
                <dd className="truncate font-medium text-ink">{event.clients?.name}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sm text-ink-muted">Outlet</dt>
                <dd className="truncate font-medium text-ink">{event.outlets?.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Status</dt>
                <dd className="mt-0.5"><StatusBadge kind="event" status={event.status} /></dd>
              </div>
            </dl>
          </section>

          {canEdit && (
            <>
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
                      required
                    />
                  </div>

                  <Input
                    label="Event type (optional)"
                    value={formData.event_type}
                    onChange={(e) => handleChange('event_type', e.target.value)}
                  />

                  <DateInput
                    label="Event date"
                    value={formData.event_date ?? ''}
                    onChange={(e) => handleChange('event_date', e.target.value)}
                    error={errors.event_date}
                    required
                  />

                  {/* Guest count (empty clears it) */}
                  <Input
                    label="Guest count (optional)"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={formData.guest_count ?? ''}
                    onChange={(e) =>
                      handleChange('guest_count', e.target.value === '' ? null : Number(e.target.value))
                    }
                    error={errors.guest_count}
                    helperText="Leave empty to clear it."
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
            </>
          )}
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-sheet border-t border-rule bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
          <Button type="button" variant="outline" onClick={() => navigate(`/events/${id}`)} disabled={submitting}>
            {canEdit ? 'Cancel' : 'Back to event'}
          </Button>
          {canEdit && (
            <Button type="submit" isLoading={submitting} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
