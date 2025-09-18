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
      manager: { email: 'manager@hybits.in', password: 'manager123' }
    };

    const credentials = demoCredentials?.[role];
    if (credentials) {
      setFormData(credentials);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gradient mb-3">Welcome Back</h2>
        <p className="text-muted-foreground text-lg">Sign in to access your dashboard</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              value={formData?.email}
              onChange={handleInputChange}
              className="block w-full pl-12 pr-4 py-3 border-2 border-primary/20 bg-white/90 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/40 transition-all duration-300 hover:border-primary/30 shadow-subtle hover:shadow-pronounced text-foreground font-medium"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData?.password}
              onChange={handleInputChange}
              className="block w-full pl-12 pr-12 py-3 border-2 border-primary/20 bg-white/90 backdrop-blur-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/40 transition-all duration-300 hover:border-primary/30 shadow-subtle hover:shadow-pronounced text-foreground font-medium"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-4 flex items-center hover:scale-110 transition-transform duration-200"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-muted-foreground hover:text-primary" />
              ) : (
                <Eye className="h-5 w-5 text-muted-foreground hover:text-primary" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg shadow-subtle hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold text-lg transition-smooth"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
      {/* Demo Login Options */}
      <div className="mt-8 pt-6 border-t border-primary/20">
        <p className="text-center text-sm text-muted-foreground mb-4 font-semibold">Quick Demo Access</p>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => handleDemoLogin('admin')}
            className="px-6 py-3 text-sm bg-primary text-primary-foreground rounded-lg shadow-subtle hover:bg-primary/90 transition-smooth border border-border font-semibold"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('manager')}
            className="px-6 py-3 text-sm bg-secondary text-secondary-foreground rounded-lg shadow-subtle hover:bg-secondary/80 transition-smooth border border-border font-semibold"
          >
            Manager
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Click to auto-fill demo credentials
        </p>
      </div>
      {/* Additional Options */}
      <div className="mt-6 text-center">
        <a href="#" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors duration-200">
          Forgot your password?
        </a>
      </div>
    </div>
  );
};

export default LoginForm;