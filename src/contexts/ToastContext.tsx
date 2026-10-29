import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// ================================================================
// TOAST NOTIFICATION SYSTEM
// ================================================================
// Provides app-wide toast notifications for user feedback.
// Usage: const { showToast } = useToast();
//        showToast('Invoice created successfully', 'success');
// ================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Default durations by type (in ms)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000,
};

// Icons by type
const TOAST_ICONS: Record<ToastType, React.ElementType> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

// Styles by type
const TOAST_STYLES: Record<ToastType, { bg: string; icon: string; border: string }> = {
    success: { bg: 'bg-white', icon: 'text-final', border: 'border-final-rule' },
    error: { bg: 'bg-white', icon: 'text-danger', border: 'border-danger-rule' },
    warning: { bg: 'bg-white', icon: 'text-partial', border: 'border-partial-rule' },
    info: { bg: 'bg-white', icon: 'text-info', border: 'border-info-rule' },
};

// Generate unique ID
function generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Individual Toast Component
function ToastItem({
    toast,
    onClose,
}: {
    toast: Toast;
    onClose: (id: string) => void;
}) {
    const Icon = TOAST_ICONS[toast.type];
    const styles = TOAST_STYLES[toast.type];

    React.useEffect(() => {
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, toast.duration);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onClose]);

    return (
        <div
            className={`
        flex items-start gap-3 px-4 py-3 rounded-sheet border shadow-lift
        ${styles.bg} ${styles.border}
        animate-slide-in-right
        max-w-sm w-full
      `}
            role={toast.type === 'error' ? 'alert' : 'status'}
        >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
            <p className="flex-1 text-sm font-medium text-ink">{toast.message}</p>
            <button
                onClick={() => onClose(toast.id)}
                className="flex-shrink-0 text-brand-text/50 hover:text-brand-text transition-colors"
                aria-label="Close notification"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

// Toast Provider Component
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback(
        (message: string, type: ToastType = 'info', duration?: number) => {
            const id = generateId();
            const newToast: Toast = {
                id,
                message,
                type,
                duration: duration ?? DEFAULT_DURATIONS[type],
            };

            setToasts((prev) => [...prev, newToast]);
        },
        []
    );

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}

            {/* Toast Container - Fixed position at top-right */}
            <div
                className="fixed bottom-4 right-4 left-4 sm:left-auto z-[90] flex flex-col items-end gap-2 pointer-events-none"
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onClose={hideToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// Hook to use toast
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
