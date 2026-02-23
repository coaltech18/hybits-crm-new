import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getInvoiceById, updateInvoice } from '@/services/invoiceService';
import type { Invoice, CreateInvoiceItemInput } from '@/types';
import { DEFAULT_GST_RATE } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/utils/format';

export default function EditInvoicePage() {
    useDocumentTitle('Edit Invoice');

    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editable form state
    const [items, setItems] = useState<CreateInvoiceItemInput[]>([]);
    const [termsAndConditions, setTermsAndConditions] = useState('');

    useEffect(() => {
        loadInvoice();
    }, [id]);

    async function loadInvoice() {
        if (!id) return;

        try {
            setLoading(true);
            const data = await getInvoiceById(id);

            if (!data) {
                setError('Invoice not found');
                return;
            }

            // Block editing non-draft invoices
            if (data.status !== 'draft') {
                showToast('Only draft invoices can be edited', 'error');
                navigate(`/invoices/${id}`);
                return;
            }

            setInvoice(data);

            // Pre-populate editable fields
            setItems(
                data.invoice_items?.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    tax_rate: item.tax_rate,
                })) || [{ description: '', quantity: 1, unit_price: 0, tax_rate: DEFAULT_GST_RATE }]
            );

            setTermsAndConditions(data.terms_and_conditions || '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load invoice');
        } finally {
            setLoading(false);
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

    function updateItem(index: number, field: keyof CreateInvoiceItemInput, value: string | number) {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    }

    /**
     * PREVIEW CALCULATION ONLY
     * Backend recalculates using identical logic on save.
     */
    function calculateTotals() {
        let subtotal = 0;
        let taxTotal = 0;

        items.forEach(item => {
            const lineTotal = Math.round(item.quantity * item.unit_price * 100) / 100;
            const taxAmount = Math.round(lineTotal * (item.tax_rate / 100) * 100) / 100;
            subtotal += lineTotal;
            taxTotal += taxAmount;
        });

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            taxTotal: Math.round(taxTotal * 100) / 100,
            grandTotal: Math.round((subtotal + taxTotal) * 100) / 100,
        };
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!user?.id || !id) return;

        // Validation
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
            });

            showToast('Invoice updated successfully', 'success');
            navigate(`/invoices/${id}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update invoice';
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

    if (!invoice) {
        return (
            <div className="max-w-4xl mx-auto">
                <Alert variant="error">{error || 'Invoice not found'}</Alert>
            </div>
        );
    }

    const totals = calculateTotals();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Edit Invoice</h1>
                <p className="text-muted-foreground mt-1">
                    Editing draft invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span>
                </p>
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            {/* Locked Fields (Read-Only) */}
            <Card>
                <h2 className="text-lg font-semibold mb-4">Invoice Details (Locked)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-muted-foreground">Invoice Type</label>
                        <p className="font-medium capitalize">{invoice.invoice_type}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-muted-foreground">Outlet</label>
                        <p className="font-medium">
                            {invoice.outlets?.name} ({invoice.outlets?.code})
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-muted-foreground">Client</label>
                        <p className="font-medium">{invoice.clients?.name}</p>
                    </div>
                    {invoice.events && (
                        <div>
                            <label className="block text-sm font-medium mb-1 text-muted-foreground">Event</label>
                            <p className="font-medium">{invoice.events.event_name}</p>
                        </div>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    These fields cannot be changed after invoice creation.
                </p>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Editable Items */}
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

                {/* Totals */}
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
                    </div>
                </Card>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/invoices/${id}`)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
