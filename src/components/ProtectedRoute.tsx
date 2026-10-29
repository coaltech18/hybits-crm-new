import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/** Shown when a stored session exists but the profile could not be loaded. */
function ProfileLoadError({ message }: { message: string }) {
  const { logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-ink">Couldn't load your profile</h1>
        <p className="text-sm text-ink-muted">
          Your session is still saved. Check your connection and try again.
        </p>
        <Alert variant="error" className="text-left">{message}</Alert>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="outline" onClick={handleSignOut} isLoading={isSigningOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, user, authError } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (authError && !user) {
    return <ProfileLoadError message={authError} />;
  }

  // Require BOTH a session and a loaded user profile. A session whose
  // profile failed to load must not reach protected pages: role checks
  // below would be skipped and pages would crash on a null user.
  if (!isAuthenticated || !user) {
    // Remember where the user was going so login can send them back.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
