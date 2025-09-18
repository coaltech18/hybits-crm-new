import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext.tsx';
import { ThemeProvider } from '@/contexts/ThemeContext.tsx';
import Routes from '@/Routes.tsx';
import ErrorBoundary from '@/components/ErrorBoundary.tsx';
import ScrollToTop from '@/components/ScrollToTop.tsx';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ScrollToTop />
            <Routes />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
