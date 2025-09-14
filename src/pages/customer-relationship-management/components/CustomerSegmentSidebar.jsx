import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ImportExport from '../../../components/ui/ImportExport';

const CustomerSegmentSidebar = ({ onSegmentSelect, onFilterSelect, selectedSegment, selectedFilters, onAddCustomer, customers = [] }) => {
  const [expandedSections, setExpandedSections] = useState({
    segments: true,
    leadSources: true,
    filters: true
  });

  const customerSegments = [
    { id: 'all', name: 'All Customers', count: 1247, icon: 'Users' },
    { id: 'premium', name: 'Premium Clients', count: 89, icon: 'Crown' },
    { id: 'regular', name: 'Regular Customers', count: 456, icon: 'User' },
    { id: 'new', name: 'New Customers', count: 123, icon: 'UserPlus' },
    { id: 'inactive', name: 'Inactive', count: 67, icon: 'UserX' },
    { id: 'prospects', name: 'Prospects', count: 234, icon: 'Target' }
  ];

  const leadSources = [
    { id: 'website', name: 'Website', count: 345, color: 'bg-blue-500' },
    { id: 'referral', name: 'Referrals', count: 289, color: 'bg-green-500' },
    { id: 'social', name: 'Social Media', count: 156, color: 'bg-purple-500' },
    { id: 'events', name: 'Events', count: 98, color: 'bg-orange-500' },
    { id: 'cold-call', name: 'Cold Calls', count: 67, color: 'bg-red-500' },
    { id: 'advertising', name: 'Advertising', count: 134, color: 'bg-yellow-500' }
  ];

  const savedFilters = [
    { id: 'high-value', name: 'High Value Customers', icon: 'TrendingUp' },
    { id: 'overdue', name: 'Overdue Payments', icon: 'AlertTriangle' },
    { id: 'recent-orders', name: 'Recent Orders', icon: 'Clock' },
    { id: 'no-activity', name: 'No Recent Activity', icon: 'Moon' },
    { id: 'birthday-month', name: 'Birthday This Month', icon: 'Gift' }
  ];

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev?.[section]
    }));
  };

  return (
    <div className="w-full h-full bg-card border-r border-border overflow-y-auto shadow-sm">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Customer Segments</h2>
        <p className="text-sm text-muted-foreground mt-1">Organize and filter customers</p>
      </div>
      <div className="p-4 space-y-6">
        {/* Customer Segments */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('segments')}
            className="w-full justify-between p-0 h-auto font-medium text-foreground hover:bg-transparent"
          >
            <span>Customer Segments</span>
            <Icon 
              name={expandedSections?.segments ? "ChevronDown" : "ChevronRight"} 
              size={16} 
            />
          </Button>
          
          {expandedSections?.segments && (
            <div className="mt-3 space-y-1">
              {customerSegments?.map((segment) => (
                <Button
                  key={segment?.id}
                  variant={selectedSegment === segment?.id ? "default" : "ghost"}
                  onClick={() => onSegmentSelect(segment?.id)}
                  className={`w-full justify-start h-auto p-3 text-left transition-all duration-200 ${
                    selectedSegment === segment?.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon name={segment?.icon} size={16} className="mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{segment?.name}</span>
                      <span className={`text-xs px-3 py-1.5 rounded-full ml-2 font-semibold ${
                        selectedSegment === segment?.id 
                          ? 'bg-white/20 text-white' 
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}>
                        {segment?.count?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Lead Sources */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('leadSources')}
            className="w-full justify-between p-0 h-auto font-medium text-foreground hover:bg-transparent"
          >
            <span>Lead Sources</span>
            <Icon 
              name={expandedSections?.leadSources ? "ChevronDown" : "ChevronRight"} 
              size={16} 
            />
          </Button>
          
          {expandedSections?.leadSources && (
            <div className="mt-3 space-y-1">
              {leadSources?.map((source) => (
                <Button
                  key={source?.id}
                  variant="ghost"
                  onClick={() => onFilterSelect('leadSource', source?.id)}
                  className="w-full justify-start h-auto p-3 text-left hover:bg-muted"
                >
                  <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 ${source?.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{source?.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {source?.count}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Saved Filters */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('filters')}
            className="w-full justify-between p-0 h-auto font-medium text-foreground hover:bg-transparent"
          >
            <span>Saved Filters</span>
            <Icon 
              name={expandedSections?.filters ? "ChevronDown" : "ChevronRight"} 
              size={16} 
            />
          </Button>
          
          {expandedSections?.filters && (
            <div className="mt-3 space-y-1">
              {savedFilters?.map((filter) => (
                <Button
                  key={filter?.id}
                  variant="ghost"
                  onClick={() => onFilterSelect('saved', filter?.id)}
                  className="w-full justify-start h-auto p-3 text-left hover:bg-muted"
                >
                  <Icon name={filter?.icon} size={16} className="mr-3 flex-shrink-0" />
                  <span className="font-medium truncate">{filter?.name}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              iconName="Plus"
              iconPosition="left"
              onClick={onAddCustomer}
            >
              Add Customer
            </Button>
            <ImportExport
              data={customers}
              dataType="customers"
              onExport={(result) => {
                console.log('Customer export completed:', result);
              }}
              onImport={(result) => {
                console.log('Customer import completed:', result);
              }}
              requiredFields={['name', 'email']}
              showExport={false}
              className="w-full"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              iconName="Filter"
              iconPosition="left"
            >
              Create Filter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerSegmentSidebar;