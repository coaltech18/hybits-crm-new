import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Hybits" className="h-20 mx-auto mb-4" />
          <p className="text-brand-text/70 mt-2">Production B2B Billing System</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
