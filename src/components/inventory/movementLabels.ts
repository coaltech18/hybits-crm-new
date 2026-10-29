import type { MovementType } from '@/types';

// ================================================================
// MOVEMENT TYPE LABELS (shared by Movements, Item Detail and Reports)
// ================================================================

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  stock_in: 'Added',
  allocation: 'Sent out',
  return: 'Returned',
  return_damaged: 'Returned damaged',
  damage: 'Damaged',
  loss: 'Lost',
  disposal: 'Disposed',
  send_to_repair: 'Sent to repair',
  return_from_repair: 'Back from repair',
  adjustment: 'Adjustment',
};

// Carbon-copy state tints (text / tint / rule). Pair with `border` for the rule.
export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  stock_in: 'bg-final-tint text-final border-final-rule',
  allocation: 'bg-info-tint text-info border-info-rule',
  return: 'bg-stamp-tint text-stamp border-stamp-rule',
  return_damaged: 'bg-partial-tint text-partial border-partial-rule',
  damage: 'bg-partial-tint text-partial border-partial-rule',
  loss: 'bg-overdue-tint text-overdue border-overdue-rule',
  disposal: 'bg-overdue-tint text-overdue border-overdue-rule',
  send_to_repair: 'bg-void-tint text-void border-void-rule',
  return_from_repair: 'bg-void-tint text-void border-void-rule',
  adjustment: 'bg-draft-tint text-draft border-draft-rule',
};

/** Options for movement-type filters, in display order. */
export const MOVEMENT_TYPE_OPTIONS = (Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map(
  (value) => ({ value, label: MOVEMENT_TYPE_LABELS[value] })
);

export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type as MovementType] ?? type.replace(/_/g, ' ');
}
