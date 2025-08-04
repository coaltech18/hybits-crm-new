import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RoleSelector from './components/RoleSelector';
import SystemStatus from './components/SystemStatus';
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

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setAuthStep('2fa');
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Main Authentication */}
        <div className="flex flex-col justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto w-full">
            {/* Company Branding */}
            <div className="text-center mb-8">
              <div className="bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">H</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Hybits CRM</h1>
              <p className="text-gray-600">Rental Management System</p>
              <p className="text-sm text-gray-500 mt-2">Dishes • Plates • Cutlery • Glassware</p>
            </div>

            {/* Error Display */}
            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{authError}</p>
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
                onRoleSelect={handleRoleSelection}
                onError={handleAuthError}
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

            {/* Step Indicator */}
            <div className="mt-8 flex justify-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${authStep === 'login' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${authStep === 'role-selection' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${authStep === '2fa' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${authStep === 'complete' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>

        {/* Right Column - System Status & Info */}
        <div className="flex flex-col justify-center space-y-6">
          <SystemStatus />
          
          {/* Company Information */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">About Hybits</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 rounded-lg p-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Company</h4>
                  <p className="text-gray-600">Hybits - Premium Rental Services</p>
                  <a href="https://hybits.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                    Visit hybits.in
                  </a>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="bg-green-100 rounded-lg p-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Services</h4>
                  <ul className="text-gray-600 text-sm space-y-1">
                    <li>• Dinner Plates & Dishes</li>
                    <li>• Cups & Glassware</li>
                    <li>• Cutlery & Serving Items</li>
                    <li>• Event Catering Equipment</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="bg-purple-100 rounded-lg p-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">System Features</h4>
                  <ul className="text-gray-600 text-sm space-y-1">
                    <li>• Inventory Management</li>
                    <li>• Order Tracking</li>
                    <li>• GST Billing</li>
                    <li>• Customer Relationship Management</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationRoleSelection;