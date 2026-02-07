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
    success: {
        bg: 'bg-green-50',
        icon: 'text-green-500',
        border: 'border-green-200',
    },
    error: {
        bg: 'bg-red-50',
        icon: 'text-red-500',
        border: 'border-red-200',
    },
    warning: {
        bg: 'bg-yellow-50',
        icon: 'text-yellow-500',
        border: 'border-yellow-200',
    },
    info: {
        bg: 'bg-blue-50',
        icon: 'text-blue-500',
        border: 'border-blue-200',
    },
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
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        ${styles.bg} ${styles.border}
        animate-slide-in-right
        max-w-sm w-full
      `}
            role="alert"
        >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
            <p className="flex-1 text-sm text-brand-text">{toast.message}</p>
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
                className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
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
