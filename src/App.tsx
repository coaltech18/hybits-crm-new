import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';

// ================================================================
// APP ROOT COMPONENT
// ================================================================
// Wraps the application with:
// 1. ErrorBoundary - Catches render errors and shows fallback UI
// 2. BrowserRouter - Enables client-side routing
// 3. ToastProvider - Provides toast notification system
// 4. AuthProvider - Manages authentication state
// ================================================================

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
