import { useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';
import { useDialog } from './Modal';

// ================================================================
// CONFIRM DIALOG — confirms destructive or irreversible actions.
// Hooks run unconditionally (the old early return crashed on open).
// Initial focus lands on Cancel so Enter never confirms by accident.
// ================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const tone = {
  danger: { ring: 'bg-danger-tint text-danger', button: 'danger' as const, Icon: AlertTriangle },
  warning: { ring: 'bg-partial-tint text-partial', button: 'primary' as const, Icon: AlertTriangle },
  info: { ring: 'bg-info-tint text-info', button: 'primary' as const, Icon: Info },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useDialog(isOpen, onCancel, !isLoading);
  const titleId = useId();
  const msgId = useId();

  if (!isOpen) return null;
  const t = tone[variant];

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-scrim/45 backdrop-blur-[2px] animate-fade-in"
        onClick={!isLoading ? onCancel : undefined}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={msgId}
          tabIndex={-1}
          className="relative w-full max-w-md rounded-sheet bg-white p-6 shadow-dialog animate-scale-in focus:outline-none"
        >
          <div className="flex gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.ring}`}>
              <t.Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
              <p id={msgId} className="mt-1 text-sm text-ink-muted whitespace-pre-line">{message}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} data-autofocus>
              {cancelLabel}
            </Button>
            <Button type="button" variant={t.button} onClick={onConfirm} isLoading={isLoading}>
              {isLoading ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
