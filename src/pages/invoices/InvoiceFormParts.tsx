import React, { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ClientGstType, CreateInvoiceItemInput } from '@/types';
import { Button } from '@/components/ui/Button';
import { fieldBase, fieldState } from '@/components/ui/Input';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { gstBreakup } from './invoiceDisplay';

// ================================================================
// INVOICE FORM PARTS — shared by Create and Edit.
// Sections on one sheet, line items as an editable ledger with a live
// per-line amount, a bill-style totals block, and the sticky action bar
// that keeps the grand total in view while lines are edited.
// Purely presentational: every value and handler comes from the page.
// ================================================================

/** One titled section of the form sheet; sections after the first get a hairline. */
export function FormSection({
  title, description, action, children, first = false,
}: { title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('px-5 sm:px-6', first ? 'pt-5 sm:pt-6' : 'mt-6 border-t border-rule pt-6')}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Sticky bottom bar of the form sheet: a live summary on the left, Cancel then Save on the right. */
export function FormActionBar({ summary, children }: { summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-b-sheet border-t border-rule bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
      {summary && <div className="w-full min-w-0 sm:mr-auto sm:w-auto">{summary}</div>}
      {children}
    </div>
  );
}

/** The live grand total, for the sticky action bar. */
export function GrandTotalSummary({ grandTotal, lineCount }: { grandTotal: number; lineCount: number }) {
  return (
    <p className="text-sm text-ink-muted">
      Grand total{' '}
      <span className="amount text-lg font-bold text-ink">{formatCurrency(grandTotal)}</span>
      <span className="hidden sm:inline"> · {lineCount} line{lineCount === 1 ? '' : 's'}</span>
    </p>
  );
}

const GST_RATES = ['0', '5', '12', '18'];
// One ledger row per line from xl; below that each line wraps to two rows.
const ROW_GRID = 'xl:grid-cols-[2rem_minmax(0,1fr)_5.5rem_7.5rem_5.5rem_8rem_2.5rem]';

type LineField = keyof CreateInvoiceItemInput;

interface LineItemsEditorProps {
  items: CreateInvoiceItemInput[];
  /** Per-line amounts from calcInvoiceTotals(items), same order as items. */
  lines: { line_total: number; tax_amount: number }[];
  onChange: <K extends LineField>(index: number, field: K, value: CreateInvoiceItemInput[K]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Line items as an editable ledger: header row from xl, labelled fields on smaller screens. */
export function LineItemsEditor({ items, lines, onChange, onAdd, onRemove }: LineItemsEditorProps) {
  const uid = useId();
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-rule">
        <div
          className={cn(
            'hidden gap-3 border-b border-rule bg-paper-sunk px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted xl:grid',
            ROW_GRID
          )}
          aria-hidden="true"
        >
          <span>#</span>
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit price</span>
          <span>GST %</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ol className="divide-y divide-rule">
          {items.map((item, index) => {
            const id = `${uid}-line-${index}`;
            const line = lines[index] ?? { line_total: 0, tax_amount: 0 };
            return (
              <li
                key={index}
                className={cn('grid grid-cols-6 items-start gap-3 px-3 py-3 sm:grid-cols-12 xl:items-center', ROW_GRID)}
              >
                <span className="tabular col-span-6 text-xs font-semibold text-ink-muted sm:col-span-12 xl:col-span-1 xl:text-sm">
                  <span className="xl:hidden">Line </span>
                  {index + 1}
                </span>

                <div className="col-span-6 sm:col-span-12 xl:col-span-1">
                  <LineLabel htmlFor={`${id}-desc`} line={index + 1}>Description</LineLabel>
                  <input
                    id={`${id}-desc`}
                    className={cn(fieldBase, fieldState(), 'h-10')}
                    value={item.description}
                    onChange={(e) => onChange(index, 'description', e.target.value)}
                    placeholder="Item description"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-3 xl:col-span-1">
                  <LineLabel htmlFor={`${id}-qty`} line={index + 1}>Qty</LineLabel>
                  <input
                    id={`${id}-qty`}
                    className={cn(fieldBase, fieldState(), 'tabular h-10 text-right')}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => onChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-3 xl:col-span-1">
                  <LineLabel htmlFor={`${id}-price`} line={index + 1}>Unit price</LineLabel>
                  <input
                    id={`${id}-price`}
                    className={cn(fieldBase, fieldState(), 'tabular h-10 text-right')}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => onChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-2 xl:col-span-1">
                  <LineLabel htmlFor={`${id}-gst`} line={index + 1}>GST %</LineLabel>
                  <select
                    id={`${id}-gst`}
                    className={cn(fieldBase, fieldState(), 'h-10 cursor-pointer')}
                    value={item.tax_rate.toString()}
                    onChange={(e) => onChange(index, 'tax_rate', parseFloat(e.target.value))}
                    required
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-5 flex items-baseline justify-between gap-3 sm:col-span-3 sm:block sm:text-right xl:col-span-1">
                  <span className="text-xs font-semibold text-ink-muted sm:mb-1 sm:block xl:hidden">Amount</span>
                  <span className="block text-right">
                    <span className="amount block text-sm font-semibold text-ink">{formatCurrency(line.line_total)}</span>
                    <span className="amount block text-xs text-ink-muted">+ {formatCurrency(line.tax_amount)} GST</span>
                  </span>
                </div>

                <div className="col-span-1 flex justify-end sm:col-span-1 sm:self-end xl:self-center">
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 px-0 hover:text-danger"
                      onClick={() => onRemove(index)}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onAdd}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add line
      </Button>
    </div>
  );
}

function LineLabel({ htmlFor, line, children }: { htmlFor: string; line: number; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink-muted xl:sr-only">
      {children}
      <span className="sr-only">, line {line}</span>
    </label>
  );
}

interface TotalsPanelProps {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lineCount: number;
  /** The bill-to party's GST type; `undefined` until a client is chosen. */
  gstType?: ClientGstType | null;
  className?: string;
}

/** Live totals, right-aligned like the foot of a bill. Shows the CGST/SGST or IGST split once the supply type is known. */
export function TotalsPanel({ subtotal, taxTotal, grandTotal, lineCount, gstType, className }: TotalsPanelProps) {
  const split = gstType === undefined ? null : gstBreakup(taxTotal, gstType);
  return (
    <div className={cn('ml-auto w-full max-w-sm', className)} aria-label="Invoice totals" role="group">
      <dl className="space-y-2 text-sm">
        <Row label={`Subtotal (${lineCount} line${lineCount === 1 ? '' : 's'})`} value={subtotal} />
        {split === null ? (
          <Row label="GST" value={taxTotal} />
        ) : split.igst ? (
          <Row label="IGST" value={split.igstAmount} />
        ) : (
          <>
            <Row label="CGST" value={split.cgst} />
            <Row label="SGST" value={split.sgst} />
          </>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3">
          <dt className="font-bold text-ink">Grand total</dt>
          <dd className="amount text-xl font-bold text-ink">{formatCurrency(grandTotal)}</dd>
        </div>
      </dl>
      {split === null && <p className="mt-2 text-right text-xs text-ink-muted">The CGST/SGST or IGST split shows once a client is chosen.</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="amount font-medium text-ink">{formatCurrency(value)}</dd>
    </div>
  );
}
