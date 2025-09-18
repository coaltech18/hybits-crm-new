import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../../services/authService';
import LoginForm from './components/LoginForm';
import RoleSelector from './components/RoleSelector';
import TwoFactorAuth from './components/TwoFactorAuth';

const AuthenticationRoleSelection = () => {
  const { user, userProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [authStep, setAuthStep] = useState('login'); // 'login', 'role-selection', '2fa', 'complete'
  const [selectedRole, setSelectedRole] = useState(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!loading && user && userProfile) {
      // User is already authenticated, redirect to dashboard
      navigate('/executive-dashboard');
    }
  }, [user, userProfile, loading, navigate]);

  const handleLoginSuccess = (userData) => {
    if (userData?.user) {
      // Check if user profile exists and has role
      if (userData?.user?.user_metadata?.role) {
        setAuthStep('complete');
        navigate('/executive-dashboard');
      } else {
        setAuthStep('role-selection');
      }
    }
  };

  const handleRoleSelection = async (role) => {
    try {
      setSelectedRole(role);
      // Update user role in the database
      if (user?.id && role?.id) {
        await AuthService.updateUserRole(user.id, role.id);
        // Refresh user profile to get updated role
        // The AuthContext will handle this automatically
      }
      setAuthStep('2fa');
    } catch (error) {
      handleAuthError('Failed to update user role. Please try again.');
    }
  };

  const handle2FAComplete = () => {
    setAuthStep('complete');
    navigate('/executive-dashboard');
  };

  const handleAuthError = (error) => {
    setAuthError(error);
    setTimeout(() => setAuthError(''), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl shadow-luxury p-10 max-w-md w-full border border-border animate-fade-in">
        {/* Company Branding */}
        <div className="text-center mb-10">
          <div className="bg-primary text-primary-foreground rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-subtle">
            <span className="text-3xl font-bold">H</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">Hybits CRM</h1>
          <p className="text-muted-foreground text-lg font-medium">Rental Management System</p>
        </div>

        {/* Error Display */}
        {authError && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-slide-up">
            <p className="text-destructive text-sm font-medium">{authError}</p>
          </div>
        )}

        {/* Authentication Steps */}
        {authStep === 'login' && (
          <LoginForm 
            onSuccess={handleLoginSuccess}
            onError={handleAuthError}
          />
        )}

        {authStep === 'role-selection' && (
          <RoleSelector 
            user={user}
            onRoleSelect={handleRoleSelection}
            isLoading={loading}
          />
        )}

        {authStep === '2fa' && (
          <TwoFactorAuth 
            selectedRole={selectedRole}
            onComplete={handle2FAComplete}
            onError={handleAuthError}
          />
        )}

        {authStep === 'complete' && (
          <div className="text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Complete</h2>
            <p className="text-gray-600 mb-4">Redirecting to dashboard...</p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthenticationRoleSelection;