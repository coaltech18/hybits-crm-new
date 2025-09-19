// ============================================================================
// LOGIN PAGE
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/hooks/useForm';
import { commonValidationRules } from '@/utils/validation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
        <p className="text-muted-foreground mt-2">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="Email"
          placeholder="Enter your email"
          value={data.email}
          onChange={handleChange('email')}
          error={errors.email}
          required
          disabled={isLoading}
        />

        <Input
          type="password"
          label="Password"
          placeholder="Enter your password"
          value={data.password}
          onChange={handleChange('password')}
          error={errors.password}
          required
          disabled={isLoading}
        />

        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Demo credentials: admin@hybits.com / admin123
        </p>
      </div>

      <div className="border-t border-border pt-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <button
              type="button"
              className="text-primary hover:text-primary/80 font-medium"
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
