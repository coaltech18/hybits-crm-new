import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

// ================================================================
// CONFIRM DIALOG COMPONENT
// ================================================================
// Modal dialog for confirming destructive actions.
// Shows before delete, cancel, or other irreversible operations.
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
    // Don't render if not open
    if (!isOpen) return null;

    // Variant styles
    const variantStyles = {
        danger: {
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
        },
        warning: {
            iconBg: 'bg-yellow-100',
            iconColor: 'text-yellow-600',
            buttonClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        },
        info: {
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        },
    };

    const styles = variantStyles[variant];

    // Handle escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel, isLoading]);

    // Prevent background scroll when modal is open
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 transition-opacity animate-fade-in"
                onClick={!isLoading ? onCancel : undefined}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-dialog-title"
                    aria-describedby="confirm-dialog-message"
                >
                    {/* Close button */}
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="absolute top-4 right-4 text-brand-text/50 hover:text-brand-text transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Icon */}
                    <div className={`mx-auto w-12 h-12 ${styles.iconBg} rounded-full flex items-center justify-center mb-4`}>
                        <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />
                    </div>

                    {/* Title */}
                    <h3
                        id="confirm-dialog-title"
                        className="text-lg font-semibold text-brand-text text-center mb-2"
                    >
                        {title}
                    </h3>

                    {/* Message */}
                    <p
                        id="confirm-dialog-message"
                        className="text-brand-text/70 text-center mb-6"
                    >
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3 justify-center">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </Button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${styles.buttonClass}
              `}
                        >
                            {isLoading ? 'Please wait...' : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
