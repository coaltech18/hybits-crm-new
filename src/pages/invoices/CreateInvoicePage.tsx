import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  createInvoice,
  getInvoiceById,
  getInvoicedEventIds,
  MIN_INVOICE_DATE,
} from '@/services/invoiceService';
import { getClients, getClientById } from '@/services/clientService';
import { getEvents, getEventById } from '@/services/eventService';
import { getSubscriptionById } from '@/services/subscriptionService';
import type { CreateInvoiceInput, CreateInvoiceItemInput, Client, Event, Outlet, InvoiceType } from '@/types';
import { DEFAULT_GST_RATE } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/utils/cn';
import { FormActionBar, FormSection, GrandTotalSummary, LineItemsEditor, TotalsPanel } from './InvoiceFormParts';
import { INVOICE_SEQUENCE_PLACEHOLDER, invoiceNumberPrefixPreview } from './invoiceDisplay';
import { calcInvoiceTotals } from '@/utils/format';
import { todayISO } from '@/utils/date';
import { formatDate } from '@/utils/billingDate';
import {
  DEFAULT_TERMS_AND_CONDITIONS,
  INVOICE_NUMBER_FORMATS,
  type InvoiceNumberFormat,
} from '@/config/companyProfile';

const emptyItem = (): CreateInvoiceItemInput => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  tax_rate: DEFAULT_GST_RATE,
});

const TYPE_OPTIONS = [
  { value: 'subscription', label: 'Subscription', hint: 'Corporate client on a recurring plan' },
  { value: 'event', label: 'Event', hint: 'A completed one-off booking' },
] as const;

function isInvoiceNumberFormat(value: string | null): value is InvoiceNumberFormat {
  return INVOICE_NUMBER_FORMATS.some(f => f.value === value);
}

export default function CreateInvoicePage() {
  useDocumentTitle('New invoice');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, outlets, selectedOutlet } = useAuth();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [invoicedEventIds, setInvoicedEventIds] = useState<Set<string>>(new Set());
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill sources: ?duplicate=<invoiceId>, ?event=<eventId> (or event_id),
  // ?subscription_id=<subscriptionId>, ?client=<clientId> (or client_id),
  // and plain ?type= / ?outlet_id= hints.
  const duplicateId = searchParams.get('duplicate');
  const eventParam = searchParams.get('event') || searchParams.get('event_id');
  const clientParam = searchParams.get('client') || searchParams.get('client_id');
  const typeParam = searchParams.get('type');
  const outletParam = searchParams.get('outlet_id');
  const subscriptionParam = searchParams.get('subscription_id');
  const [prefilling, setPrefilling] = useState(Boolean(duplicateId || eventParam || subscriptionParam || clientParam));
  const prefillStarted = useRef(false);

  // Form state
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('subscription');
  const [outletId, setOutletId] = useState('');
  const [clientId, setClientId] = useState('');
  const [eventId, setEventId] = useState('');
  // Subscription being billed (invoices.subscription_id, 042). Only sent while
  // the form still points at that subscription's client and outlet.
  const [subscriptionLink, setSubscriptionLink] = useState<{ id: string; client_id: string; outlet_id: string } | null>(null);
  const [items, setItems] = useState<CreateInvoiceItemInput[]>([emptyItem()]);
  const [termsAndConditions, setTermsAndConditions] = useState(DEFAULT_TERMS_AND_CONDITIONS);
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState<InvoiceNumberFormat>('default');
  // Invoice date. Defaults to today (local, not UTC); back-date it to re-enter a historical invoice.
  const today = todayISO();
  const [issuedAt, setIssuedAt] = useState(today);

  const availableOutlets: Outlet[] = outlets || [];

  // Default outlet: the only one available, else the session's selected outlet
  useEffect(() => {
    if (outlets && outlets.length === 1) {
      setOutletId(outlets[0].id);
    } else if (selectedOutlet && outlets?.some(o => o.id === selectedOutlet)) {
      setOutletId(prev => prev || selectedOutlet);
    }
  }, [outlets, selectedOutlet]);

  // Prefill from a source invoice, event or client (runs once)
  useEffect(() => {
    if (prefillStarted.current) return;
    const allowedOutletIds = new Set((outlets || []).map(o => o.id));

    if (!duplicateId && !eventParam && !subscriptionParam && !clientParam) {
      // Only simple hints: apply them without any lookup
      if (typeParam || outletParam) {
        prefillStarted.current = true;
        if (typeParam === 'event' || typeParam === 'subscription') setInvoiceType(typeParam);
        if (outletParam && allowedOutletIds.has(outletParam)) setOutletId(outletParam);
      }
      return;
    }
    prefillStarted.current = true;

    const outletError = 'That record belongs to an outlet you do not have access to.';

    async function prefill() {
      try {
        if (duplicateId) {
          const source = await getInvoiceById(duplicateId);
          if (!source) throw new Error('The invoice to duplicate was not found or you do not have access.');
          if (!allowedOutletIds.has(source.outlet_id)) throw new Error(outletError);

          setInvoiceType(source.invoice_type);
          setOutletId(source.outlet_id);
          setClientId(source.client_id);
          // The source event is normally already invoiced; keep it only when
          // re-issuing a cancelled invoice.
          setEventId(source.status === 'cancelled' && source.event_id ? source.event_id : '');
          if (source.invoice_type === 'subscription' && source.subscription_id) {
            setSubscriptionLink({ id: source.subscription_id, client_id: source.client_id, outlet_id: source.outlet_id });
          }
          const sourceItems = (source.invoice_items || []).map(item => ({
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            tax_rate: Number(item.tax_rate),
          }));
          setItems(sourceItems.length > 0 ? sourceItems : [emptyItem()]);
          setTermsAndConditions(source.terms_and_conditions ?? DEFAULT_TERMS_AND_CONDITIONS);
          if (isInvoiceNumberFormat(source.invoice_number_format)) {
            setInvoiceNumberFormat(source.invoice_number_format);
          }
          showToast(`Copied from ${source.invoice_number}. Review and save as a new draft.`, 'info');
        } else if (eventParam) {
          const event = await getEventById(eventParam);
          if (!event) throw new Error('Event not found or you do not have access.');
          if (!allowedOutletIds.has(event.outlet_id)) throw new Error(outletError);
          if (event.status !== 'completed') throw new Error('Only completed events can be invoiced.');

          setInvoiceType('event');
          setOutletId(event.outlet_id);
          setClientId(event.client_id);
          setEventId(event.id);
          setItems([{ ...emptyItem(), description: `${event.event_name} (${formatDate(event.event_date)})` }]);
        } else if (subscriptionParam) {
          const subscription = await getSubscriptionById(subscriptionParam);
          if (!subscription) throw new Error('Subscription not found or you do not have access.');
          if (!allowedOutletIds.has(subscription.outlet_id)) throw new Error(outletError);

          setInvoiceType('subscription');
          setOutletId(subscription.outlet_id);
          setClientId(subscription.client_id);
          setSubscriptionLink({
            id: subscription.id,
            client_id: subscription.client_id,
            outlet_id: subscription.outlet_id,
          });
        } else if (clientParam) {
          const client = await getClientById(clientParam);
          if (!client) throw new Error('Client not found or you do not have access.');
          if (!allowedOutletIds.has(client.outlet_id)) throw new Error(outletError);

          setInvoiceType(client.client_type === 'corporate' ? 'subscription' : 'event');
          setOutletId(client.outlet_id);
          setClientId(client.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to prefill the invoice');
      } finally {
        setPrefilling(false);
      }
    }

    void prefill();
  }, [duplicateId, eventParam, subscriptionParam, clientParam, typeParam, outletParam, outlets, showToast]);

  // Load clients and events for the outlet + type. Each run cancels the
  // previous one so a slow earlier response can't overwrite a newer one.
  useEffect(() => {
    setClients([]);
    setEvents([]);
    setInvoicedEventIds(new Set());

    if (!user?.id || !outletId) {
      setOptionsLoading(false);
      return;
    }

    let cancelled = false;
    const userId = user.id;
    setOptionsLoading(true);

    async function load() {
      try {
        const clientType = invoiceType === 'subscription' ? 'corporate' : 'event';
        const clientsData = await getClients(userId, { client_type: clientType });
        if (cancelled) return;
        setClients(clientsData.filter(c => c.outlet_id === outletId));

        if (invoiceType === 'event') {
          const [eventsData, invoiced] = await Promise.all([
            getEvents(userId, { status: 'completed', outlet_id: outletId }),
            getInvoicedEventIds(outletId),
          ]);
          if (cancelled) return;
          // getEvents ignores outlet_id for managers, so filter here too
          setEvents(eventsData.filter(e => e.outlet_id === outletId));
          setInvoicedEventIds(invoiced);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, outletId, invoiceType]);

  function addItem() {
    setItems([...items, emptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem<K extends keyof CreateInvoiceItemInput>(
    index: number,
    field: K,
    value: CreateInvoiceItemInput[K]
  ) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  const linkedSubscriptionId =
    subscriptionLink &&
    invoiceType === 'subscription' &&
    subscriptionLink.client_id === clientId &&
    subscriptionLink.outlet_id === outletId
      ? subscriptionLink.id
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || submitting) return;

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
    if (invoiceType === 'event' && invoicedEventIds.has(eventId)) {
      setError('This event already has an invoice. Cancel that invoice first to bill it again.');
      return;
    }
    if (items.length === 0) {
      setError('At least one invoice item is required');
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
        subscription_id: linkedSubscriptionId,
        items,
        terms_and_conditions: termsAndConditions,
        invoice_number_format: invoiceNumberFormat,
        issued_at: issuedAt,
      };

      const created = await createInvoice(user.id, input);
      showToast(`Draft ${created.invoice_number} created`, 'success');
      // Open the new draft so it can be checked and finalized straight away
      navigate(`/invoices/${created.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create invoice';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <PageHeader
      back={{ to: '/invoices', label: 'Invoices' }}
      title="New invoice"
      description="Saved as a draft. You can change it until you finalize it."
    />
  );

  if (prefilling) {
    return (
      <div>
        {header}
        <div className="sheet space-y-4 p-5 sm:p-6" role="status" aria-label="Loading the invoice details">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  // PREVIEW ONLY: same exact paise maths as invoiceService; stored values are authoritative.
  const totals = calcInvoiceTotals(items);
  const clientEvents = clientId ? events.filter(ev => ev.client_id === clientId) : [];
  // Presentation only: the chosen client's supply type drives the CGST/SGST vs IGST preview.
  const selectedClient = clients.find(c => c.id === clientId);
  // Same prefix the database will build from this format, outlet and invoice date.
  const numberPrefix = invoiceNumberPrefixPreview(
    invoiceNumberFormat,
    availableOutlets.find(o => o.id === outletId)?.code,
    issuedAt || today
  );

  const totalsProps = {
    subtotal: totals.subtotal,
    taxTotal: totals.tax_total,
    grandTotal: totals.grand_total,
    lineCount: items.length,
    gstType: selectedClient ? selectedClient.gst_type : undefined,
  };

  return (
    <div>
      {header}

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {availableOutlets.length === 0 && (
        <Alert variant="warning" className="mb-6">
          <p className="font-semibold">No outlets found.</p>
          <p className="mt-1">
            {user?.role === 'admin'
              ? 'You need to create at least one outlet.'
              : 'No outlets assigned. Contact your administrator.'}
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="sheet max-w-5xl">
          {/* 1. Bill to */}
          <FormSection first title="Bill to" description="Who the invoice is for and which outlet raises it.">
            <fieldset>
              <legend className="mb-1.5 block text-sm font-semibold text-ink">
                Invoice type<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                      invoiceType === opt.value
                        ? 'border-brand-primary bg-final-tint/50'
                        : 'border-rule-strong hover:border-ink-faint'
                    )}
                  >
                    <input
                      type="radio"
                      name="invoice-type"
                      value={opt.value}
                      checked={invoiceType === opt.value}
                      onChange={(e) => {
                        setInvoiceType(e.target.value as InvoiceType);
                        setClientId('');
                        setEventId('');
                      }}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                      <span className="block text-sm text-ink-muted">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Outlet: a choice whenever the user has more than one */}
              {availableOutlets.length > 1 ? (
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
                  <option value="">Select outlet</option>
                  {availableOutlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} ({outlet.code})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="invoice-outlet"
                  label="Outlet"
                  value={availableOutlets[0] ? `${availableOutlets[0].name} (${availableOutlets[0].code})` : 'No outlet'}
                  disabled
                />
              )}

              <Select
                label="Client"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setEventId('');
                }}
                required
                disabled={!outletId || optionsLoading}
                helperText={linkedSubscriptionId ? 'Billed against this client’s subscription.' : undefined}
              >
                <option value="">
                  {!outletId ? 'Select outlet first' : optionsLoading ? 'Loading clients…' : 'Select client'}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </div>

            {!optionsLoading && clients.length === 0 && outletId && (
              <Alert variant="warning" className="mt-4">
                No {invoiceType === 'subscription' ? 'corporate' : 'event'} clients found for this outlet.
              </Alert>
            )}
          </FormSection>

          {/* 2. Event and date */}
          <FormSection
            title={invoiceType === 'event' ? 'Event and date' : 'Invoice date'}
            description={invoiceType === 'event' ? 'Only completed events can be invoiced.' : undefined}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {invoiceType === 'event' && (
                <Select
                  label="Event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  required
                  disabled={!clientId || optionsLoading}
                >
                  <option value="">{clientId ? 'Select event' : 'Select client first'}</option>
                  {clientEvents.map((event) => {
                    const invoiced = invoicedEventIds.has(event.id);
                    return (
                      <option key={event.id} value={event.id} disabled={invoiced && event.id !== eventId}>
                        {event.event_name} - {formatDate(event.event_date)}
                        {invoiced ? ' (already invoiced)' : ''}
                      </option>
                    );
                  })}
                </Select>
              )}

              <DateInput
                label="Invoice date"
                value={issuedAt}
                min={MIN_INVOICE_DATE}
                max={today}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
                helperText="Back-date this to re-enter a past invoice. Drives the invoice number, reports and GST sheets."
              />
            </div>

            {!optionsLoading && invoiceType === 'event' && clientId && clientEvents.length === 0 && (
              <Alert variant="warning" className="mt-4">
                No completed events found for this client.
              </Alert>
            )}

            {invoiceType === 'event' && eventId && invoicedEventIds.has(eventId) && (
              <Alert variant="warning" className="mt-4">
                This event already has an invoice. Cancel that invoice first to bill it again.
              </Alert>
            )}
          </FormSection>

          {/* 3. Line items */}
          <FormSection title="Line items" description="Amounts work out as you type, rounded to the paisa per line.">
            <LineItemsEditor
              items={items}
              lines={totals.items}
              onChange={updateItem}
              onAdd={addItem}
              onRemove={removeItem}
            />
            <TotalsPanel {...totalsProps} className="mt-6" />
          </FormSection>

          {/* 4. Numbering and terms */}
          <FormSection title="Number format and terms">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Number format"
                value={invoiceNumberFormat}
                onChange={(e) => setInvoiceNumberFormat(e.target.value as InvoiceNumberFormat)}
                helperText="The sequence number (NNNN) is set by the system and cannot be changed."
              >
                {INVOICE_NUMBER_FORMATS.map((fmt) => (
                  <option key={fmt.value} value={fmt.value}>
                    {fmt.label} — {fmt.description}
                  </option>
                ))}
              </Select>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Invoice no.</p>
                <p
                  className="serial flex h-10 items-center rounded-lg border border-dashed border-rule-strong bg-paper px-3 font-semibold text-ink"
                  aria-label={`${numberPrefix} followed by the next number, assigned when saved`}
                >
                  {numberPrefix}
                  <span className="text-ink-muted" aria-hidden="true">{INVOICE_SEQUENCE_PLACEHOLDER}</span>
                </p>
                <p className="mt-1.5 text-sm text-ink-muted">
                  The running number is assigned when saved.{' '}
                  {invoiceNumberFormat === 'outlet_fy'
                    ? 'Built from the outlet code and financial year.'
                    : invoiceNumberFormat === 'outlet_short'
                      ? 'Built from the outlet code.'
                      : invoiceNumberFormat === 'fy_only'
                        ? 'Built from the financial year of the invoice date.'
                        : 'Built from the invoice date.'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Textarea
                id="terms-and-conditions"
                label="Terms and conditions"
                className="min-h-[160px]"
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Enter terms and conditions"
                helperText="Printed on the invoice PDF. Edit the default text if this invoice needs different terms."
              />
            </div>
          </FormSection>

          <FormActionBar summary={<GrandTotalSummary grandTotal={totals.grand_total} lineCount={items.length} />}>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/invoices')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || prefilling} isLoading={submitting}>
              {submitting ? 'Saving draft…' : 'Save draft'}
            </Button>
          </FormActionBar>
        </div>
      </form>
    </div>
  );
}
