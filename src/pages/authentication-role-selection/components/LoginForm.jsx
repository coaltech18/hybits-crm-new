import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

const LoginForm = ({ onSuccess, onError }) => {
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!formData?.email || !formData?.password) {
      onError?.('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const result = await signIn(formData?.email, formData?.password);
      onSuccess?.(result);
    } catch (error) {
      let errorMessage = 'Authentication failed';
      
      if (error?.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error?.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and confirm your account before signing in.';
      } else if (error?.message?.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to authentication service. Your Supabase project may be paused or inactive. Please check your Supabase dashboard.';
      } else if (error?.message) {
        errorMessage = error?.message;
      }

      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role) => {
    const demoCredentials = {
      admin: { email: 'admin@hybits.in', password: 'admin123' },
      manager: { email: 'manager@hybits.in', password: 'manager123' },
      staff: { email: 'staff@hybits.in', password: 'staff123' }
    };

    const credentials = demoCredentials?.[role];
    if (credentials) {
      setFormData(credentials);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
        <p className="text-gray-600">Sign in to access your dashboard</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              value={formData?.email}
              onChange={handleInputChange}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData?.password}
              onChange={handleInputChange}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
      {/* Demo Login Options */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-600 mb-4">Quick Demo Access</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleDemoLogin('admin')}
            className="px-3 py-2 text-xs bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('manager')}
            className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
          >
            Manager
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('staff')}
            className="px-3 py-2 text-xs bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors"
          >
            Staff
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Click to auto-fill demo credentials
        </p>
      </div>
      {/* Additional Options */}
      <div className="mt-6 text-center">
        <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
          Forgot your password?
        </a>
      </div>
    </div>
  );
};

export default LoginForm;