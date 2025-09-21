// ============================================================================
// LOGIN PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const { data, errors, handleChange, handleSubmit, setError } = useForm<LoginFormData>({
    initialData: {
      email: '',
      password: '',
    },
    validationRules: {
      email: [
        commonValidationRules.required('Email is required'),
        commonValidationRules.email('Please enter a valid email address'),
      ],
      password: [
        commonValidationRules.required('Password is required'),
        commonValidationRules.minLength(6, 'Password must be at least 6 characters'),
      ],
    },
    onSubmit: async (formData) => {
      try {
        setIsLoading(true);
        await login(formData.email, formData.password);
        navigate('/dashboard');
      } catch (error: any) {
        setError('email', error.message || 'Login failed. Please check your credentials.');
      } finally {
        setIsLoading(false);
      }
    },
  });

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
        <p className="text-gray-600">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-gray-600">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={data.email}
            onChange={handleChange('email')}
            disabled={isLoading}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          {errors.email && (
            <p className="text-sm text-red-600 mt-1">{errors.email}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-600">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={data.password}
            onChange={handleChange('password')}
            disabled={isLoading}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          {errors.password && (
            <p className="text-sm text-red-600 mt-1">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          Demo credentials: admin@hybits.com / admin123
        </p>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              type="button"
              className="text-green-600 hover:underline font-medium"
              onClick={() => {
                // TODO: Implement registration flow
                console.log('Navigate to registration');
              }}
            >
              Contact administrator
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
