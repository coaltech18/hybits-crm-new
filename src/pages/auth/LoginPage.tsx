import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { resetPassword, safeRedirectPath } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

/** The page the user was sent away from by ProtectedRoute, if any. */
function redirectFromState(state: unknown): string | undefined {
  const from = (state as LoginLocationState | null)?.from;
  if (!from || typeof from.pathname !== 'string') return undefined;
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export function LoginPage() {
  useDocumentTitle('Sign In');

  const { login, isAuthenticated, user, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const redirectTo = redirectFromState(location.state);

  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Already signed in: go where they were headed instead of showing the form.
  if (!isAuthLoading && isAuthenticated && user) {
    return <Navigate to={safeRedirectPath(redirectTo)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      await login(email, password, redirectTo);
      showToast('Welcome back!', 'success');
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Could not send the reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (next: 'signin' | 'forgot') => {
    setMode(next);
    setError('');
    setResetSent(false);
  };

  if (mode === 'forgot') {
    return (
      <Card padding="lg">
        <form onSubmit={handleResetRequest} className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Enter your work email and we'll send you a link to choose a new password.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          {resetSent && (
            <Alert variant="success">
              If an account exists for {email.trim()}, a reset link is on its way. Check your inbox.
            </Alert>
          )}

          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@hybits.in"
            required
            autoComplete="email"
          />

          <Button type="submit" className="w-full" size="lg" isLoading={isLoading} disabled={!email.trim()}>
            {isLoading ? 'Sending…' : 'Send reset link'}
          </Button>

          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="block w-full text-center text-sm font-medium text-brand-primary hover:underline"
          >
            Back to sign in
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Use the work email your admin set up for you.</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <Input
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@hybits.in"
          required
          autoComplete="email"
        />

        <div className="space-y-2">
          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="text-right">
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={isLoading}
          disabled={!email || !password}
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}
