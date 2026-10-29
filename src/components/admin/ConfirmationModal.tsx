import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useDialog } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';

// ================================================================
// CONFIRMATION MODAL (REUSABLE)
// ================================================================
// Generic confirmation dialog for destructive actions, built on the
// same accessible behaviour as ConfirmDialog (portal, focus trap,
// Escape, focus restored; initial focus on Cancel).
// onConfirm may be async: the modal awaits it, disables its buttons while
// it runs, and shows any thrown error inline instead of swallowing it.
// ================================================================

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<unknown>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  /** Keep the confirm button disabled (e.g. a blocking warning is shown). */
  confirmDisabled?: boolean;
}

const tone = {
  danger: { ring: 'bg-danger-tint text-danger', button: 'danger' as const, Icon: AlertTriangle },
  warning: { ring: 'bg-partial-tint text-partial', button: 'primary' as const, Icon: AlertTriangle },
  info: { ring: 'bg-info-tint text-info', button: 'primary' as const, Icon: Info },
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  confirmDisabled = false,
}: ConfirmationModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = busy || isLoading;
  const panelRef = useDialog(isOpen, onClose, !working);
  const titleId = useId();
  const msgId = useId();

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (working || confirmDisabled) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const t = tone[variant];

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-scrim/45 backdrop-blur-[2px] animate-fade-in"
        onClick={!working ? onClose : undefined}
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
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', t.ring)}>
              <t.Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
              <p id={msgId} className="mt-1 whitespace-pre-line text-sm text-ink-muted">{message}</p>
            </div>
          </div>

          {error && <Alert variant="error" className="mt-4">{error}</Alert>}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={working} data-autofocus>
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={t.button}
              onClick={handleConfirm}
              isLoading={working}
              disabled={confirmDisabled}
            >
              {working ? 'Working…' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
