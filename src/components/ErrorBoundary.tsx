import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// ================================================================
// ERROR BOUNDARY COMPONENT
// ================================================================
// Catches JavaScript errors anywhere in child component tree,
// logs them, and displays a fallback UI instead of crashing.
// ================================================================

interface Props {
    children: ReactNode;
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
            return (
                <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                        {/* Error Icon */}
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>

                        {/* Error Message */}
                        <h1 className="text-2xl font-bold text-brand-text mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-brand-text/70 mb-6">
                            We're sorry, but something unexpected happened. Please try again or contact support if the problem persists.
                        </p>

                        {/* Error Details (Development Only) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mb-6 p-4 bg-red-50 rounded-lg text-left overflow-auto max-h-40">
                                <p className="text-sm font-mono text-red-800 break-all">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white font-medium rounded-lg hover:bg-brand-primaryDark transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-brand-text font-medium rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Go to Dashboard
                            </button>
                        </div>

                        {/* Reload Link */}
                        <p className="mt-6 text-sm text-brand-text/50">
                            If the problem persists,{' '}
                            <button
                                onClick={this.handleReload}
                                className="text-brand-primary hover:underline"
                            >
                                reload the page
                            </button>
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
