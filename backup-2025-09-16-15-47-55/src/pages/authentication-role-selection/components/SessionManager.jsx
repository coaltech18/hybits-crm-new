import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SessionManager = ({ user, sessions, onLogoutSession, onLogoutAll }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState(null);

  const handleLogoutSession = async (sessionId) => {
    setLoadingSessionId(sessionId);
    setIsLoading(true);
    
    try {
      await onLogoutSession(sessionId);
    } finally {
      setIsLoading(false);
      setLoadingSessionId(null);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoading(true);
    
    try {
      await onLogoutAll();
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceIcon = (deviceType) => {
    const iconMap = {
      'desktop': 'Monitor',
      'mobile': 'Smartphone',
      'tablet': 'Tablet',
      'unknown': 'HelpCircle'
    };
    return iconMap?.[deviceType] || 'Monitor';
  };

  const getLocationFlag = (country) => {
    // Mock country flags using emoji
    const flagMap = {
      'IN': '🇮🇳',
      'US': '🇺🇸',
      'UK': '🇬🇧',
      'CA': '🇨🇦',
      'AU': '🇦🇺'
    };
    return flagMap?.[country] || '🌍';
  };

  const formatLastActive = (timestamp) => {
    const now = new Date();
    const lastActive = new Date(timestamp);
    const diffInMinutes = Math.floor((now - lastActive) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Active now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="Monitor" size={32} color="white" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Active Sessions</h2>
        <p className="text-muted-foreground">
          Manage your active sessions across all devices
        </p>
      </div>
      <div className="space-y-6">
        {/* Current Session Info */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Icon name="Shield" size={20} className="text-primary" />
            <h3 className="font-medium text-foreground">Current Session</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            You are currently signed in as <strong>{user?.name || 'John Smith'}</strong> from this device.
          </p>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground">All Sessions ({sessions?.length})</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogoutAll}
              loading={isLoading}
              disabled={sessions?.length <= 1}
              iconName="LogOut"
              iconPosition="left"
            >
              Logout All Others
            </Button>
          </div>

          <div className="space-y-3">
            {sessions?.map((session) => (
              <div
                key={session?.id}
                className={`p-4 border rounded-lg transition-colors ${
                  session?.isCurrent 
                    ? 'bg-primary/5 border-primary/20' :'bg-card border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Icon 
                        name={getDeviceIcon(session?.deviceType)} 
                        size={20} 
                        className="text-muted-foreground" 
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-foreground">
                          {session?.deviceName}
                        </h4>
                        {session?.isCurrent && (
                          <span className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <span>{getLocationFlag(session?.country)}</span>
                          <span>{session?.location}</span>
                        </span>
                        <span>{session?.browser}</span>
                        <span>{formatLastActive(session?.lastActive)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                        <span>IP: {session?.ipAddress}</span>
                        <span>•</span>
                        <span>Started: {new Date(session.createdAt)?.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {!session?.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLogoutSession(session?.id)}
                      loading={loadingSessionId === session?.id}
                      disabled={isLoading}
                      iconName="LogOut"
                      iconPosition="left"
                    >
                      Logout
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <Icon name="AlertTriangle" size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Security Reminder</p>
              <p className="text-xs text-muted-foreground mt-1">
                If you notice any suspicious activity or unrecognized sessions, 
                please logout immediately and contact your system administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionManager;