// ============================================================================
// SETTINGS PAGE
// ============================================================================

import React, { useState } from 'react';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useTheme } from '@/contexts/ThemeContext';

const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', name: 'General', icon: 'settings' },
    { id: 'company', name: 'Company', icon: 'building' },
    { id: 'billing', name: 'Billing', icon: 'credit-card' },
    { id: 'notifications', name: 'Notifications', icon: 'bell' },
    { id: 'security', name: 'Security', icon: 'shield' }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Appearance</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
            </div>
            <Button variant="outline" onClick={toggleTheme}>
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} className="mr-2" />
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Language & Region</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Language
            </label>
            <Select
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'Hindi' },
                { value: 'ta', label: 'Tamil' },
                { value: 'te', label: 'Telugu' }
              ]}
              value="en"
              onChange={() => {}}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Timezone
            </label>
            <Select
              options={[
                { value: 'IST', label: 'India Standard Time (IST)' },
                { value: 'UTC', label: 'UTC' }
              ]}
              value="IST"
              onChange={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderCompanySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            placeholder="Enter company name"
            value="Hybits Rental Management"
          />
          <Input
            label="Company Code"
            placeholder="Enter company code"
            value="HYBITS"
          />
          <Input
            label="GST Number"
            placeholder="Enter GST number"
            value="27ABCDE1234F1Z5"
          />
          <Input
            label="PAN Number"
            placeholder="Enter PAN number"
            value="ABCDE1234F"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Address</h3>
        <div className="space-y-4">
          <Input
            label="Street Address"
            placeholder="Enter street address"
            value="123 Business Park"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="City"
              placeholder="Enter city"
              value="Mumbai"
            />
            <Input
              label="State"
              placeholder="Enter state"
              value="Maharashtra"
            />
            <Input
              label="Pincode"
              placeholder="Enter pincode"
              value="400001"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderBillingSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Payment Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Default Payment Terms
            </label>
            <Select
              options={[
                { value: '15', label: '15 days' },
                { value: '30', label: '30 days' },
                { value: '45', label: '45 days' },
                { value: '60', label: '60 days' }
              ]}
              value="30"
              onChange={() => {}}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Default GST Rate
            </label>
            <Select
              options={[
                { value: '0', label: '0%' },
                { value: '5', label: '5%' },
                { value: '12', label: '12%' },
                { value: '18', label: '18%' },
                { value: '28', label: '28%' }
              ]}
              value="18"
              onChange={() => {}}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Settings</h3>
        <div className="space-y-4">
          <Input
            label="Invoice Prefix"
            placeholder="Enter invoice prefix"
            value="INV"
          />
          <Input
            label="Invoice Number Format"
            placeholder="Enter number format"
            value="INV-{YYYY}-{MM}-{####}"
          />
        </div>
      </div>
    </div>
  );

  const renderNotificationsSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Email Notifications</h3>
        <div className="space-y-4">
          {[
            { id: 'new_order', label: 'New Order Created', description: 'Get notified when a new order is created' },
            { id: 'payment_received', label: 'Payment Received', description: 'Get notified when payment is received' },
            { id: 'low_stock', label: 'Low Stock Alert', description: 'Get notified when inventory is running low' },
            { id: 'overdue_invoice', label: 'Overdue Invoice', description: 'Get notified about overdue invoices' }
          ].map((notification) => (
            <div key={notification.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p className="font-medium text-foreground">{notification.label}</p>
                <p className="text-sm text-muted-foreground">{notification.description}</p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Password Settings</h3>
        <div className="space-y-4">
          <Input
            type="password"
            label="Current Password"
            placeholder="Enter current password"
          />
          <Input
            type="password"
            label="New Password"
            placeholder="Enter new password"
          />
          <Input
            type="password"
            label="Confirm New Password"
            placeholder="Confirm new password"
          />
          <Button>Update Password</Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Two-Factor Authentication</h3>
        <div className="p-4 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable 2FA</p>
              <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <Button variant="outline">Enable</Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneralSettings();
      case 'company': return renderCompanySettings();
      case 'billing': return renderBillingSettings();
      case 'notifications': return renderNotificationsSettings();
      case 'security': return renderSecuritySettings();
      default: return renderGeneralSettings();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your application settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={tab.icon} size={16} className="mr-3" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-card border border-border rounded-lg p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
