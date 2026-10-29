import { getSubscriptionKit } from '@/services/subscriptionService';
import type { Subscription } from '@/types';

// ================================================================
// SUBSCRIPTION REFERENCE DATA — read-only views of the questionnaire
// answers and the planned dishware kit (questionnaire.standard_kit).
// Both are planning notes: they never affect price or move stock.
// Shared by the detail page and the edit page.
// ================================================================

const ESG_LABELS: Record<string, string> = {
  high: 'High: a key sustainability initiative',
  medium: 'Medium: part of broader goals',
  low: 'Low: a cost-driven decision',
};

const KNOWN_LABELS: Record<string, string> = {
  daily_volume: 'Daily usage (approx.)',
  peak_challenges: 'Peak-time challenges',
  has_washing_facility: 'Washing facility',
  esg_priority: 'ESG priority',
  additional_context: 'Additional context',
};

const humanize = (key: string) => {
  const s = key.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function answerText(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (key === 'has_washing_facility' && typeof value === 'boolean') {
    return value ? 'Yes, on-site washing' : 'No, needs pickup and delivery';
  }
  if (key === 'esg_priority' && typeof value === 'string') return ESG_LABELS[value] ?? humanize(value);
  if (key === 'daily_volume') {
    const n = Number(value);
    return Number.isFinite(n) ? `${new Intl.NumberFormat('en-IN').format(n)} a day` : String(value);
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

/** Questionnaire answers as a definition list. Known keys first, then any extra plain answers. */
export function QuestionnaireAnswers({ subscription }: { subscription: Pick<Subscription, 'questionnaire'> }) {
  const q = subscription.questionnaire ?? {};
  const keys = [
    ...Object.keys(KNOWN_LABELS),
    ...Object.keys(q).filter((k) => !(k in KNOWN_LABELS) && k !== 'standard_kit'),
  ];
  const rows = keys
    .map((k) => ({ key: k, label: KNOWN_LABELS[k] ?? humanize(k), text: answerText(k, q[k]) }))
    .filter((r): r is { key: string; label: string; text: string } => r.text !== null);

  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">No questionnaire answers were recorded.</p>;
  }

  return (
    <dl className="divide-y divide-rule">
      {rows.map((r) => (
        <div key={r.key} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm text-ink-muted">{r.label}</dt>
          <dd className="whitespace-pre-wrap break-words text-sm font-medium text-ink">{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The planned dishware kit: item and planned pieces. */
export function PlannedKit({ subscription }: { subscription: Pick<Subscription, 'questionnaire'> }) {
  const kit = getSubscriptionKit(subscription);

  if (kit.length === 0) {
    return <p className="text-sm text-ink-muted">No dishware kit was planned.</p>;
  }

  const total = kit.reduce((sum, k) => sum + k.quantity, 0);
  const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);

  return (
    <ul className="divide-y divide-rule">
      {kit.map((k) => (
        <li key={k.inventory_item_id} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
          <span className="min-w-0 break-words text-sm text-ink">{k.item_name || 'Inventory item'}</span>
          <span className="tabular shrink-0 text-sm font-semibold text-ink">{fmt(k.quantity)} pcs</span>
        </li>
      ))}
      <li className="flex items-baseline justify-between gap-4 pt-2.5">
        <span className="text-sm text-ink-muted">{kit.length} item{kit.length === 1 ? '' : 's'} planned</span>
        <span className="tabular shrink-0 text-sm font-semibold text-ink-muted">{fmt(total)} pcs</span>
      </li>
    </ul>
  );
}
