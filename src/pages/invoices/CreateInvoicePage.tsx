import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { createInvoice } from '@/services/invoiceService';
import { getClients } from '@/services/clientService';
import { getEvents } from '@/services/eventService';
import type { CreateInvoiceInput, CreateInvoiceItemInput, Client, Event, Outlet, InvoiceType } from '@/types';
import { DEFAULT_GST_RATE } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/utils/format';
import {
  DEFAULT_TERMS_AND_CONDITIONS,
  INVOICE_NUMBER_FORMATS,
  type InvoiceNumberFormat,
} from '@/config/companyProfile';

export default function CreateInvoicePage() {
  useDocumentTitle('Create Invoice');

  const navigate = useNavigate();
  const { user, outlets } = useAuth();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('subscription');
  const [outletId, setOutletId] = useState('');
  const [clientId, setClientId] = useState('');
  const [eventId, setEventId] = useState('');
  const [items, setItems] = useState<CreateInvoiceItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: DEFAULT_GST_RATE },
  ]);
  const [termsAndConditions, setTermsAndConditions] = useState(DEFAULT_TERMS_AND_CONDITIONS);
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState<InvoiceNumberFormat>('default');

  const availableOutlets: Outlet[] = outlets || [];

  useEffect(() => {
    // Auto-fill outlet for managers
    if (user?.role === 'manager' && outlets && outlets.length === 1) {
      setOutletId(outlets[0].id);
    }
    setLoading(false);
  }, [user, outlets]);

  useEffect(() => {
    if (outletId) {
      loadClientsAndEvents();
    }
  }, [outletId, invoiceType]);

  async function loadClientsAndEvents() {
    if (!user?.id || !outletId) return;

    try {
      // Load clients based on invoice type
      const clientType = invoiceType === 'subscription' ? 'corporate' : 'event';
      const clientsData = await getClients(user.id, { client_type: clientType });
      const filteredClients = clientsData.filter(c => c.outlet_id === outletId);
      setClients(filteredClients);

      // Load completed events for event invoices
      if (invoiceType === 'event') {
        const eventsData = await getEvents(user.id, { status: 'completed', outlet_id: outletId });
        setEvents(eventsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: DEFAULT_GST_RATE }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, field: keyof CreateInvoiceItemInput, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  /**
   * PREVIEW CALCULATION ONLY
   * This displays estimated totals to the user before submission.
   * The backend (invoiceService.ts) recalculates using identical logic.
   * After save, all displays use the stored database values.
   */
  function calculateTotals() {
    let subtotal = 0;
    let taxTotal = 0;

    items.forEach(item => {
      // Step 1: Round line_total (qty * unit_price) to 2 decimals
      const lineTotal = Math.round(item.quantity * item.unit_price * 100) / 100;
      // Step 2: Calculate tax from the ROUNDED line_total, then round
      const taxAmount = Math.round(lineTotal * (item.tax_rate / 100) * 100) / 100;
      // Step 3: Accumulate rounded values
      subtotal += lineTotal;
      taxTotal += taxAmount;
    });

    // Step 4: Round the sums (in case of floating-point accumulation errors)
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round((subtotal + taxTotal) * 100) / 100,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;

    // Validation
    if (!outletId) {
      setError('Outlet is required');
      return;
    }
    if (!clientId) {
      setError('Client is required');
      return;
    }
    if (invoiceType === 'event' && !eventId) {
      setError('Event is required for event invoices');
      return;
    }
    if (items.some(item => !item.description.trim())) {
      setError('All items must have a description');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const input: CreateInvoiceInput = {
        invoice_type: invoiceType,
        client_id: clientId,
        outlet_id: outletId,
        event_id: invoiceType === 'event' ? eventId : null,
        items,
        terms_and_conditions: termsAndConditions,
        invoice_number_format: invoiceNumberFormat,
      };

      await createInvoice(user.id, input);
      showToast('Invoice created successfully', 'success');
      navigate('/invoices');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create invoice';
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

  const totals = calculateTotals();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Invoice</h1>
        <p className="text-muted-foreground mt-1">Generate a new invoice</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {availableOutlets.length === 0 && (
        <Alert variant="warning">
          <strong>No outlets found!</strong>
          <p className="mt-2">
            {user?.role === 'admin'
              ? 'You need to create at least one outlet.'
              : 'No outlets assigned. Contact your administrator.'}
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Type & Basic Info */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Type */}
            <Select
              label="Invoice Type"
              value={invoiceType}
              onChange={(e) => {
                setInvoiceType(e.target.value as InvoiceType);
                setClientId('');
                setEventId('');
              }}
              required
            >
              <option value="subscription">Subscription</option>
              <option value="event">Event</option>
            </Select>

            {/* Outlet */}
            {user?.role === 'admin' ? (
              <Select
                label="Outlet"
                value={outletId}
                onChange={(e) => {
                  setOutletId(e.target.value);
                  setClientId('');
                  setEventId('');
                }}
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
                <Input value={availableOutlets[0]?.name || 'No outlet'} disabled />
              </div>
            )}

            {/* Client */}
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              disabled={!outletId}
            >
              <option value="">{outletId ? 'Select Client' : 'Select outlet first'}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>

            {/* Event (for event invoices) */}
            {invoiceType === 'event' && (
              <Select
                label="Event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required
              >
                <option value="">Select Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.event_name} - {event.event_date}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {clients.length === 0 && outletId && (
            <Alert variant="warning" className="mt-4">
              No {invoiceType === 'subscription' ? 'corporate' : 'event'} clients found for this outlet.
            </Alert>
          )}

          {invoiceType === 'event' && events.length === 0 && outletId && (
            <Alert variant="warning" className="mt-4">
              No completed events found for this outlet.
            </Alert>
          )}
        </Card>

        {/* Invoice Items */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Invoice Items</h2>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              + Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end border-b pb-4">
                <div className="col-span-12 md:col-span-5">
                  <Input
                    label="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Item description"
                    required
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input
                    label="Qty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input
                    label="Price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <Select
                    label="Tax %"
                    value={item.tax_rate.toString()}
                    onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value))}
                    required
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </Select>
                </div>
                <div className="col-span-1">
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Totals Summary */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Invoice Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax Total:</span>
              <span className="font-medium">{formatCurrency(totals.taxTotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Grand Total:</span>
              <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </Card>

        {/* Invoice Number Format */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Invoice Number Format</h2>
          <div className="space-y-3">
            <Select
              label="Format"
              value={invoiceNumberFormat}
              onChange={(e) => setInvoiceNumberFormat(e.target.value as InvoiceNumberFormat)}
            >
              {INVOICE_NUMBER_FORMATS.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label} — {fmt.description}
                </option>
              ))}
            </Select>
            <p className="text-sm text-muted-foreground">
              Preview: <span className="font-mono font-medium">{INVOICE_NUMBER_FORMATS.find(f => f.value === invoiceNumberFormat)?.example}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              The sequence number (NNNN) is auto-generated by the system and cannot be changed.
            </p>
          </div>
        </Card>

        {/* Terms & Conditions */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Terms & Conditions</h2>
          <div className="space-y-2">
            <textarea
              id="terms-and-conditions"
              className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Enter terms and conditions..."
            />
            <p className="text-xs text-muted-foreground">
              These terms will be printed on the invoice PDF. You can edit the default text above.
              Once saved, these terms are locked to this invoice.
            </p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/invoices')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
