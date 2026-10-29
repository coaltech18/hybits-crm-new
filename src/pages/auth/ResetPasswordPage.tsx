import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { updatePassword } from '@/services/authService';
import { Input } from '@/components/ui/Input';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Choose a new password. Reached from a password-recovery or invite email
 * link (which signs the user in) or by a signed-in user directly.
 */
export function ResetPasswordPage() {
  useDocumentTitle('Set password');

  const { isLoading: isAuthLoading, isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (isAuthLoading) {
    return (
      <Card padding="lg">
        <div className="py-6">
          <Spinner size="lg" label="Checking your link" />
        </div>
      </Card>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Card padding="lg">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Link expired</h1>
            <p className="mt-1 text-sm text-ink-muted">
              This password link is invalid or has expired. Request a new one from the sign-in page with
              Forgot password.
            </p>
          </div>
          <LinkButton to="/login" size="lg" className="w-full">
            Back to sign in
          </LinkButton>
        </div>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(password);
      showToast('Password updated', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Could not update the password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
          <p className="mt-1 text-sm text-ink-muted">For {user.email}. Use at least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <Input
          type="password"
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
        <Input
          type="password"
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isSaving} disabled={!password || !confirm}>
          {isSaving ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </Card>
  );
}
