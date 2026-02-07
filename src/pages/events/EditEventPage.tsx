import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getEventById, updateEvent } from '@/services/eventService';
import type { Event, UpdateEventInput } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Dynamic document title
  const [pageTitle, setPageTitle] = useState('Edit Event');
  useDocumentTitle(pageTitle);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<UpdateEventInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getEventById(id);

      if (!data) {
        setError('Event not found');
        return;
      }

      setEvent(data);
      setPageTitle(`Edit ${data.event_name}`);

      // Initialize form with current values
      setFormData({
        event_name: data.event_name,
        event_type: data.event_type || '',
        event_date: data.event_date,
        guest_count: data.guest_count || undefined,
        notes: data.notes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof UpdateEventInput, value: any) {
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

    if (formData.guest_count !== undefined && formData.guest_count <= 0) {
      newErrors.guest_count = 'Guest count must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm() || !user?.id || !id) return;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error">Event not found</Alert>
      </div>
    );
  }

  const canEdit = event.status === 'planned';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Event</h1>
        <p className="text-muted-foreground mt-1">
          Update event: {event.event_name}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!canEdit && (
        <Alert variant="warning">
          This event cannot be edited because it is {event.status}.
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Read-only fields */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-sm text-muted-foreground">Event Info (Read-only)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <p className="text-sm">{event.clients?.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Outlet</label>
                <p className="text-sm">{event.outlets?.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <p className="text-sm capitalize">{event.status}</p>
              </div>
            </div>
          </div>

          {canEdit && (
            <>
              {/* Event Name */}
              <Input
                label="Event Name"
                value={formData.event_name}
                onChange={(e) => handleChange('event_name', e.target.value)}
                error={errors.event_name}
                required
              />

              {/* Event Type */}
              <Input
                label="Event Type (Optional)"
                value={formData.event_type}
                onChange={(e) => handleChange('event_type', e.target.value)}
              />

              {/* Event Date */}
              <Input
                label="Event Date"
                type="date"
                value={formData.event_date}
                onChange={(e) => handleChange('event_date', e.target.value)}
                required
              />

              {/* Guest Count */}
              <Input
                label="Guest Count (Optional)"
                type="number"
                min={1}
                value={formData.guest_count || ''}
                onChange={(e) => handleChange('guest_count', parseInt(e.target.value) || undefined)}
                error={errors.guest_count}
              />

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Additional notes about this event"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/events/${id}`)}
              disabled={submitting}
            >
              Cancel
            </Button>
            {canEdit && (
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
