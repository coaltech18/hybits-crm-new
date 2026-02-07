import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { createEvent } from '@/services/eventService';
import { getClients } from '@/services/clientService';
import type { CreateEventInput, Client, Outlet } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { getTodayISO } from '@/utils/billingDate';

export default function AddEventPage() {
  useDocumentTitle('Add Event');

  const navigate = useNavigate();
  const { user, outlets } = useAuth();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateEventInput>({
    outlet_id: '',
    client_id: '',
    event_name: '',
    event_type: '',
    event_date: getTodayISO(),
    guest_count: undefined,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get available outlets
  const availableOutlets: Outlet[] = outlets || [];

  useEffect(() => {
    loadClients();

    // Auto-fill outlet for managers with single outlet
    if (user?.role === 'manager' && outlets && outlets.length === 1) {
      setFormData((prev) => ({ ...prev, outlet_id: outlets[0].id }));
    }
  }, [user, outlets]);

  useEffect(() => {
    // Reload clients when outlet changes
    if (formData.outlet_id) {
      loadClients();
    }
  }, [formData.outlet_id]);

  async function loadClients() {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const clientsData = await getClients(user.id, { client_type: 'event' });

      // Filter clients by selected outlet if outlet is selected
      const filteredClients = formData.outlet_id
        ? clientsData.filter((c) => c.outlet_id === formData.outlet_id)
        : clientsData;

      setClients(filteredClients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof CreateEventInput, value: any) {
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

    if (formData.guest_count !== undefined && formData.guest_count <= 0) {
      newErrors.guest_count = 'Guest count must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      await createEvent(user.id, formData);
      showToast('Event created successfully', 'success');
      navigate('/events');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event';
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Event</h1>
        <p className="text-muted-foreground mt-1">Create a new event booking</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Warning when no outlets exist */}
      {availableOutlets.length === 0 && (
        <Alert variant="warning">
          <strong>No outlets found!</strong>
          <p className="mt-2">
            {user?.role === 'admin'
              ? 'You need to create at least one outlet before you can create events.'
              : 'No outlets have been assigned to you. Please contact your administrator.'}
          </p>
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Outlet Selection */}
          {user?.role === 'admin' ? (
            <Select
              label="Outlet"
              value={formData.outlet_id}
              onChange={(e) => handleChange('outlet_id', e.target.value)}
              error={errors.outlet_id}
              required
            >
              <option value="">Select Outlet</option>
              {availableOutlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outlet.code})
                </option>
              ))}
            </Select>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Outlet</label>
              <Input
                value={availableOutlets[0]?.name || 'No outlet assigned'}
                disabled
              />
            </div>
          )}

          {/* Client Selection */}
          <Select
            label="Client"
            value={formData.client_id}
            onChange={(e) => handleChange('client_id', e.target.value)}
            error={errors.client_id}
            required
            disabled={!formData.outlet_id}
          >
            <option value="">
              {formData.outlet_id ? 'Select Client' : 'Select outlet first'}
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} - {client.phone}
              </option>
            ))}
          </Select>

          {clients.length === 0 && formData.outlet_id && (
            <Alert variant="warning">
              No event clients found for this outlet. Please create a client first.
            </Alert>
          )}

          {/* Event Name */}
          <Input
            label="Event Name"
            value={formData.event_name}
            onChange={(e) => handleChange('event_name', e.target.value)}
            error={errors.event_name}
            placeholder="e.g., Kumar-Priya Wedding"
            required
          />

          {/* Event Type */}
          <Input
            label="Event Type (Optional)"
            value={formData.event_type}
            onChange={(e) => handleChange('event_type', e.target.value)}
            placeholder="e.g., Wedding, Birthday, Corporate Event"
          />

          {/* Event Date */}
          <Input
            label="Event Date"
            type="date"
            value={formData.event_date}
            onChange={(e) => handleChange('event_date', e.target.value)}
            error={errors.event_date}
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
            placeholder="Expected number of guests"
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

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/events')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
