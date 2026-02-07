
import { LucideIcon, FileX } from 'lucide-react';
import { Button } from './Button';

// ================================================================
// EMPTY STATE COMPONENT
// ================================================================
// Displays a friendly message when there's no data to show.
// Used in lists, tables, and search results.
// ================================================================

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon = FileX,
    title,
    description,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
            {/* Icon */}
            <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-brand-primary" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-brand-text mb-1">
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className="text-brand-text/70 text-center max-w-sm mb-4">
                    {description}
                </p>
            )}

            {/* Action Button */}
            {action && (
                <Button onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}
