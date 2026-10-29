import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ================================================================
// ERROR BOUNDARY COMPONENT
// ================================================================
// Catches JavaScript errors anywhere in child component tree,
// logs them, and displays a fallback UI instead of crashing.
// ================================================================

interface Props {
    children: ReactNode;
    /**
     * 'page' (default) fills the screen; 'section' renders inside the app
     * shell so the sidebar survives a page crash.
     */
    variant?: 'page' | 'section';
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render shows the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console (in production, send to error tracking service)
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);

        this.setState({ errorInfo });

        // TODO: In production, send to error tracking service like Sentry
        // Sentry.captureException(error, { extra: errorInfo });
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/dashboard';
    };

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const section = this.props.variant === 'section';
            return (
                <div
                    className={
                        section
                            ? 'py-6 sm:py-10'
                            : 'flex min-h-screen items-center justify-center bg-paper p-4'
                    }
                >
                    <div role="alert" className={section ? 'sheet max-w-2xl p-6 sm:p-8' : 'sheet w-full max-w-md p-6 sm:p-8'}>
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
                                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
                                <p className="mt-1.5 text-sm text-ink-muted">
                                    This page hit an unexpected error. Anything already saved is safe. Try
                                    again, or go back to the dashboard. If it keeps happening, tell your admin
                                    what you were doing.
                                </p>
                            </div>
                        </div>

                        {/* Error Details (Development Only) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mt-6 max-h-48 overflow-auto rounded-lg border border-danger-rule bg-danger-tint p-4 text-left">
                                <p className="serial break-all text-sm text-danger">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-danger">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                            <Button type="button" onClick={this.handleRetry}>
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                Try again
                            </Button>
                            <Button type="button" variant="outline" onClick={this.handleGoHome}>
                                <Home className="h-4 w-4" aria-hidden="true" />
                                Go to dashboard
                            </Button>
                        </div>

                        {/* Reload Link */}
                        <p className="mt-6 border-t border-rule pt-4 text-sm text-ink-muted">
                            Still stuck?{' '}
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="font-semibold text-brand-primary hover:underline"
                            >
                                Reload the page
                            </button>
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
