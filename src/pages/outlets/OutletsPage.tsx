// ============================================================================
// OUTLETS MANAGEMENT PAGE
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { Outlet } from '@/types';
import OutletService from '@/services/outletService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Icon from '@/components/AppIcon';
import { exportData, formatDateForExport } from '@/utils/exportUtils';

const OutletsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'inactive' | ''>('');

  useEffect(() => {
    loadOutlets();
  }, []);

  const loadOutlets = async () => {
    try {
      setLoading(true);
      const data = await OutletService.getAllOutlets();
      setOutlets(data);
    } catch (error) {
      console.error('Failed to load outlets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOutlets = outlets.filter(outlet => {
    const matchesSearch = outlet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         outlet.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         outlet.address.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === '' || 
      (selectedStatus === 'active' && outlet.is_active) ||
      (selectedStatus === 'inactive' && !outlet.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  const handleExport = () => {
    if (filteredOutlets.length === 0) {
      alert('No outlets to export');
      return;
    }

    const headers = [
      'Outlet Code',
      'Name',
      'Address',
      'City',
      'State',
      'Pincode',
      'Contact Person',
      'Contact Phone',
      'Contact Email',
      'Status',
      'Created At',
      'Updated At'
    ];

    const rows = filteredOutlets.map(outlet => [
      outlet.code,
      outlet.name,
      outlet.address.street,
      outlet.address.city,
      outlet.address.state,
      outlet.address.pincode,
      outlet.contact_person,
      outlet.contact_phone,
      outlet.contact_email,
      outlet.is_active ? 'Active' : 'Inactive',
      formatDateForExport(outlet.created_at),
      formatDateForExport(outlet.updated_at)
    ]);

    exportData([headers, ...rows], 'excel', {
      filename: `outlets_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Outlets'
    });
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
  };

  if (!user || !hasPermission(user.role, 'outlets', 'read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon name="alert-triangle" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view outlets.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading outlets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outlets</h1>
          <p className="text-muted-foreground">
            Manage your Hybits outlets and locations
          </p>
        </div>
        {hasPermission(user.role, 'outlets', 'create') && (
          <Button onClick={() => navigate('/outlets/new')}>
            <Icon name="plus" size={16} className="mr-2" />
            Add Outlet
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search outlets by name, code, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <Select
            options={statusOptions}
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value as 'active' | 'inactive' | '')}
            placeholder="All Status"
          />
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex-1">
            <Icon name="filter" size={16} className="mr-2" />
            Filters
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleExport} disabled={filteredOutlets.length === 0}>
            <Icon name="download" size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Outlets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOutlets.map((outlet) => (
          <div key={outlet.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{outlet.name}</h3>
                <p className="text-sm text-muted-foreground">{outlet.code}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(outlet.is_active)}`}>
                {outlet.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Icon name="map-pin" size={14} className="mr-2" />
                <span>{outlet.address.street}, {outlet.address.city}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Icon name="phone" size={14} className="mr-2" />
                <span>{outlet.contact_phone}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Icon name="mail" size={14} className="mr-2" />
                <span>{outlet.contact_email}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Manager: {outlet.contact_person}
              </div>
              <div className="flex space-x-2">
                {hasPermission(user.role, 'outlets', 'read') && (
                  <Button variant="ghost" size="sm">
                    <Icon name="eye" size={14} />
                  </Button>
                )}
                {hasPermission(user.role, 'outlets', 'update') && (
                  <Button variant="ghost" size="sm">
                    <Icon name="edit" size={14} />
                  </Button>
                )}
                {hasPermission(user.role, 'outlets', 'delete') && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Icon name="trash" size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOutlets.length === 0 && (
        <div className="text-center py-12">
          <Icon name="map-pin" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No outlets found</h3>
          <p className="text-muted-foreground">
            {searchTerm || selectedStatus 
              ? 'Try adjusting your search criteria.' 
              : 'No outlets available for your account.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default OutletsPage;
