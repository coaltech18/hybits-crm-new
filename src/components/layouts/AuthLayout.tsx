// ============================================================================
// AUTH LAYOUT COMPONENT
// ============================================================================

import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-white text-gray-900 relative">
          <div className="flex flex-col justify-center items-center w-full p-16 text-center">
            <div className="max-w-sm">
              {/* Logo */}
              <div className="mb-8">
                <div className="mb-8">
                  <img 
                    src="/assets/LOGO.png" 
                    alt="Hybits Logo" 
                    className="h-20 w-auto mx-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-[#1A8754]">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <div className="mb-6">
                <img 
                  src="/assets/LOGO.png" 
                  alt="Hybits Logo" 
                  className="h-16 w-auto mx-auto object-contain filter brightness-0 invert"
                />
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10">
              {children}
            </div>
            
            <div className="mt-6 text-center text-sm text-white/60">
              <p>© 2024 Hybits Suite. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;