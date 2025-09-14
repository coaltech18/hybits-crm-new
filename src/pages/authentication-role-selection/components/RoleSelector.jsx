import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const RoleSelector = ({ user, onRoleSelect, isLoading }) => {
  const [selectedRole, setSelectedRole] = useState('');

  // Define available roles based on simplified RBAC
  const availableRoles = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system control and configuration',
      permissions: [
        'User Management', 
        'Global Settings', 
        'All Financial Data', 
        'Audit Logs', 
        'System Integrations',
        'Location Management'
      ]
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Billing operations and reporting oversight',
      permissions: [
        'Invoice Creation & Approval', 
        'Payment Collection', 
        'Billing Follow-ups', 
        'Dashboard & Reports', 
        'Customer Management',
        'Order Management'
      ]
    }
  ];

  const roleOptions = availableRoles?.map(role => ({
    value: role?.id,
    label: role?.name,
    description: role?.description
  }));

  const handleRoleSubmit = () => {
    if (selectedRole) {
      const role = availableRoles?.find(r => r?.id === selectedRole);
      onRoleSelect(role);
    }
  };

  const getRoleIcon = (roleId) => {
    const iconMap = {
      'admin': 'Shield',
      'manager': 'Users'
    };
    return iconMap?.[roleId] || 'User';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="User" size={32} color="white" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome back!</h2>
        <p className="text-muted-foreground">
          Hello {user?.name || 'User'}, please select your role to continue
        </p>
      </div>
      <div className="space-y-6">
        {/* Role Selection */}
        <Select
          label="Select Your Role"
          description="Choose the role you want to access the system with"
          placeholder="Choose a role..."
          options={roleOptions}
          value={selectedRole}
          onChange={setSelectedRole}
          required
          className="w-full"
        />

        {/* Role Preview */}
        {selectedRole && (
          <div className="p-4 bg-muted rounded-lg border border-border">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon 
                  name={getRoleIcon(selectedRole)} 
                  size={20} 
                  color="white" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">
                  {availableRoles?.find(r => r?.id === selectedRole)?.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {availableRoles?.find(r => r?.id === selectedRole)?.description}
                </p>
                <div className="mt-3">
                  <p className="text-xs font-medium text-foreground mb-2">Access Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {availableRoles?.find(r => r?.id === selectedRole)?.permissions?.map((permission, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <Button
          variant="default"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={!selectedRole}
          onClick={handleRoleSubmit}
          iconName="ArrowRight"
          iconPosition="right"
        >
          {isLoading ? 'Loading Dashboard...' : 'Continue to Dashboard'}
        </Button>

        {/* Back to Login */}
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            iconName="ArrowLeft"
            iconPosition="left"
          >
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelector;