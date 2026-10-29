import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
    getInvoiceById,
    updateInvoice,
    InvoicePartialSaveError,
    MIN_INVOICE_DATE,
} from '@/services/invoiceService';
import type { Invoice, UpdateInvoiceItemInput } from '@/types';
import { DEFAULT_GST_RATE } from '@/types';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusStamp';
import { FormActionBar, FormSection, GrandTotalSummary, LineItemsEditor, TotalsPanel } from './InvoiceFormParts';
import { INVOICE_TYPE_LABEL } from './invoiceDisplay';
import { calcInvoiceTotals } from '@/utils/format';
import { todayISO, toLocalISODate } from '@/utils/date';

const emptyItem = (): UpdateInvoiceItemInput => ({
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: DEFAULT_GST_RATE,
});

export default function EditInvoicePage() {
    useDocumentTitle('Edit invoice');

    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editable form state (existing rows keep their id so saves update them in place)
    const [items, setItems] = useState<UpdateInvoiceItemInput[]>([]);
    const [termsAndConditions, setTermsAndConditions] = useState('');
    // Invoice date (local, not UTC). Back-date it to re-enter a historical invoice.
    const today = todayISO();
    const [issuedAt, setIssuedAt] = useState(today);

    const loadInvoice = useCallback(async () => {
        if (!id) return;

        try {
            setLoading(true);
            const data = await getInvoiceById(id);

            if (!data) {
                setInvoice(null);
                setError('Invoice not found or you do not have access');
                return;
            }

            // Block editing non-draft invoices
            if (data.status !== 'draft') {
                showToast('Only draft invoices can be edited', 'error');
                navigate(`/invoices/${id}`);
                return;
            }

            setInvoice(data);

            // Pre-populate editable fields; an item-less draft gets one blank row
            const mapped = (data.invoice_items ?? []).map(item => ({
                id: item.id,
                description: item.description,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                tax_rate: Number(item.tax_rate),
            }));
            setItems(mapped.length > 0 ? mapped : [emptyItem()]);

            setTermsAndConditions(data.terms_and_conditions || '');
            setIssuedAt(toLocalISODate(new Date(data.issued_at ?? data.created_at)));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load invoice');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, showToast]);

    useEffect(() => {
        void loadInvoice();
    }, [loadInvoice]);

    function addItem() {
        setItems([...items, emptyItem()]);
    }

    function removeItem(index: number) {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    }

    function updateItem<K extends keyof UpdateInvoiceItemInput>(
        index: number,
        field: K,
        value: UpdateInvoiceItemInput[K]
    ) {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!user?.id || !id || submitting) return;

        // Validation
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

            await updateInvoice(user.id, id, {
                items,
                terms_and_conditions: termsAndConditions,
                issued_at: issuedAt,
            });

            showToast('Invoice updated successfully', 'success');
            navigate(`/invoices/${id}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update invoice';
            showToast(errorMessage, 'error');
            if (err instanceof InvoicePartialSaveError) {
                // Re-read the stored rows so a retry can't insert new lines twice
                await loadInvoice();
            }
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    }

    const back = { to: id ? `/invoices/${id}` : '/invoices', label: 'Back to invoice' };

    if (loading) {
        return (
            <div>
                <PageHeader back={back} title="Edit draft" />
                <div className="sheet space-y-4 p-5 sm:p-6" role="status" aria-label="Loading invoice">
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

    if (!invoice) {
        return (
            <div>
                <PageHeader back={{ to: '/invoices', label: 'Invoices' }} title="Edit draft" />
                <Alert variant="error">{error || 'Invoice not found'}</Alert>
            </div>
        );
    }

    // PREVIEW ONLY: same exact paise maths as invoiceService; stored values are authoritative.
    const totals = calcInvoiceTotals(items);
    const gstType = invoice.client_gst_type_snap ?? invoice.clients?.gst_type ?? null;
    const totalsProps = {
        subtotal: totals.subtotal,
        taxTotal: totals.tax_total,
        grandTotal: totals.grand_total,
        lineCount: items.length,
        gstType,
    };

    return (
        <div>
            <PageHeader
                back={back}
                title={
                    <>
                        Edit <span className="serial">{invoice.invoice_number || 'draft'}</span>
                    </>
                }
                meta={<StatusBadge kind="invoice" status={invoice.status} />}
                description="Change the date, lines and terms. Client, outlet and type were fixed when the draft was created."
            />

            {error && <Alert variant="error" className="mb-6">{error}</Alert>}

            <form onSubmit={handleSubmit}>
                <div className="sheet max-w-5xl">
                    {/* 1. Bill to (locked) */}
                    <FormSection first title="Bill to" description="Fixed when the draft was created.">
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm text-ink-muted">Client</dt>
                                <dd className="mt-0.5 font-medium text-ink">{invoice.clients?.name ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-ink-muted">Outlet</dt>
                                <dd className="mt-0.5 font-medium text-ink">
                                    {invoice.outlets?.name}{' '}
                                    {invoice.outlets?.code && <span className="serial text-ink-muted">({invoice.outlets.code})</span>}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm text-ink-muted">Invoice type</dt>
                                <dd className="mt-0.5 font-medium text-ink">{INVOICE_TYPE_LABEL[invoice.invoice_type] ?? invoice.invoice_type}</dd>
                            </div>
                            {invoice.events && (
                                <div>
                                    <dt className="text-sm text-ink-muted">Event</dt>
                                    <dd className="mt-0.5 font-medium text-ink">{invoice.events.event_name}</dd>
                                </div>
                            )}
                        </dl>
                    </FormSection>

                    {/* 2. Date */}
                    <FormSection title="Invoice date">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <DateInput
                                label="Invoice date"
                                value={issuedAt}
                                min={MIN_INVOICE_DATE}
                                max={today}
                                onChange={(e) => setIssuedAt(e.target.value)}
                                required
                                helperText="Back-date this to re-enter a past invoice. Drives reports and GST sheets. Locked once finalized."
                            />
                        </div>
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

                    {/* 4. Terms */}
                    <FormSection title="Terms and conditions">
                        <Textarea
                            id="terms-and-conditions"
                            label="Terms and conditions"
                            className="min-h-[160px]"
                            value={termsAndConditions}
                            onChange={(e) => setTermsAndConditions(e.target.value)}
                            placeholder="Enter terms and conditions"
                            helperText="Printed on the invoice PDF."
                        />
                    </FormSection>

                    <FormActionBar summary={<GrandTotalSummary grandTotal={totals.grand_total} lineCount={items.length} />}>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate(`/invoices/${id}`)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting} isLoading={submitting}>
                            {submitting ? 'Saving…' : 'Save changes'}
                        </Button>
                    </FormActionBar>
                </div>
            </form>
        </div>
    );
}
