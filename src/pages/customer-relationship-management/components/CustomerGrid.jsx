import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';

const CustomerGrid = ({ customers, onCustomerSelect, selectedCustomer, selectedCustomers, onCustomerToggle, onBulkAction }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const sortedCustomers = useMemo(() => {
    const sorted = [...customers]?.sort((a, b) => {
      if (sortConfig?.key === 'lastOrder' || sortConfig?.key === 'totalValue') {
        const aVal = a?.[sortConfig?.key] || 0;
        const bVal = b?.[sortConfig?.key] || 0;
        return sortConfig?.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aVal = a?.[sortConfig?.key]?.toString()?.toLowerCase() || '';
      const bVal = b?.[sortConfig?.key]?.toString()?.toLowerCase() || '';
      
      if (sortConfig?.direction === 'asc') {
        return aVal?.localeCompare(bVal);
      }
      return bVal?.localeCompare(aVal);
    });
    return sorted;
  }, [customers, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCellEdit = (customerId, field, value) => {
    setEditingCell(`${customerId}-${field}`);
    setEditValue(value);
  };

  const handleCellSave = () => {
    // In real app, this would update the customer data
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return 'text-success bg-success/10';
    if (score >= 60) return 'text-warning bg-warning/10';
    return 'text-error bg-error/10';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-success bg-success/10';
      case 'Inactive': return 'text-muted-foreground bg-muted';
      case 'Prospect': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date)?.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const allSelected = selectedCustomers?.length === customers?.length;
  const someSelected = selectedCustomers?.length > 0 && selectedCustomers?.length < customers?.length;

  return (
    <div className="w-full h-full bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header with Bulk Actions */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(e) => {
                if (e?.target?.checked) {
                  onBulkAction('selectAll');
                } else {
                  onBulkAction('deselectAll');
                }
              }}
            />
            <span className="text-sm font-medium text-foreground">
              {selectedCustomers?.length > 0 
                ? `${selectedCustomers?.length} selected` 
                : `${customers?.length} customers`}
            </span>
          </div>
          
          {selectedCustomers?.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                iconName="Mail"
                iconPosition="left"
                onClick={() => onBulkAction('email')}
              >
                Email ({selectedCustomers?.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="Download"
                iconPosition="left"
                onClick={() => onBulkAction('export')}
              >
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="Edit"
                iconPosition="left"
                onClick={() => onBulkAction('bulkEdit')}
              >
                Bulk Edit
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Table */}
      <div className="overflow-auto" style={{ height: 'calc(100% - 80px)' }}>
        <table className="w-full">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="w-12 p-3 text-left">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => {
                    if (e?.target?.checked) {
                      onBulkAction('selectAll');
                    } else {
                      onBulkAction('deselectAll');
                    }
                  }}
                />
              </th>
              {[
                { key: 'name', label: 'Customer Name', width: 'w-48' },
                { key: 'email', label: 'Email', width: 'w-56' },
                { key: 'phone', label: 'Phone', width: 'w-36' },
                { key: 'status', label: 'Status', width: 'w-24' },
                { key: 'lastOrder', label: 'Last Order', width: 'w-32' },
                { key: 'totalValue', label: 'Total Value', width: 'w-32' },
                { key: 'healthScore', label: 'Health Score', width: 'w-28' },
                { key: 'actions', label: 'Actions', width: 'w-24' }
              ]?.map((column) => (
                <th
                  key={column?.key}
                  className={`${column?.width} p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider`}
                >
                  {column?.key !== 'actions' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort(column?.key)}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      {column?.label}
                      {sortConfig?.key === column?.key && (
                        <Icon 
                          name={sortConfig?.direction === 'asc' ? "ChevronUp" : "ChevronDown"} 
                          size={14} 
                          className="ml-1" 
                        />
                      )}
                    </Button>
                  ) : (
                    column?.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedCustomers?.map((customer) => (
              <tr
                key={customer?.id}
                className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                  selectedCustomer?.id === customer?.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                }`}
                onClick={() => onCustomerSelect(customer)}
              >
                <td className="p-3" onClick={(e) => e?.stopPropagation()}>
                  <Checkbox
                    checked={selectedCustomers?.includes(customer?.id)}
                    onChange={() => onCustomerToggle(customer?.id)}
                  />
                </td>
                
                <td className="p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary-foreground">
                        {customer?.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      {editingCell === `${customer?.id}-name` ? (
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e?.target?.value)}
                          onBlur={handleCellSave}
                          onKeyDown={(e) => {
                            if (e?.key === 'Enter') handleCellSave();
                            if (e?.key === 'Escape') handleCellCancel();
                          }}
                          className="h-6 text-sm"
                          autoFocus
                        />
                      ) : (
                        <div
                          className="font-medium text-foreground truncate cursor-text hover:bg-muted/50 px-1 py-0.5 rounded"
                          onClick={(e) => {
                            e?.stopPropagation();
                            handleCellEdit(customer?.id, 'name', customer?.name);
                          }}
                        >
                          {customer?.name}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground truncate">
                        ID: {customer?.id}
                      </div>
                    </div>
                  </div>
                </td>
                
                <td className="p-3">
                  {editingCell === `${customer?.id}-email` ? (
                    <Input
                      type="email"
                      value={editValue}
                      onChange={(e) => setEditValue(e?.target?.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => {
                        if (e?.key === 'Enter') handleCellSave();
                        if (e?.key === 'Escape') handleCellCancel();
                      }}
                      className="h-6 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="text-sm text-foreground truncate cursor-text hover:bg-muted/50 px-1 py-0.5 rounded"
                      onClick={(e) => {
                        e?.stopPropagation();
                        handleCellEdit(customer?.id, 'email', customer?.email);
                      }}
                    >
                      {customer?.email}
                    </div>
                  )}
                </td>
                
                <td className="p-3">
                  {editingCell === `${customer?.id}-phone` ? (
                    <Input
                      type="tel"
                      value={editValue}
                      onChange={(e) => setEditValue(e?.target?.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => {
                        if (e?.key === 'Enter') handleCellSave();
                        if (e?.key === 'Escape') handleCellCancel();
                      }}
                      className="h-6 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="text-sm text-foreground cursor-text hover:bg-muted/50 px-1 py-0.5 rounded"
                      onClick={(e) => {
                        e?.stopPropagation();
                        handleCellEdit(customer?.id, 'phone', customer?.phone);
                      }}
                    >
                      {customer?.phone}
                    </div>
                  )}
                </td>
                
                <td className="p-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(customer?.status)}`}>
                    {customer?.status}
                  </span>
                </td>
                
                <td className="p-3">
                  <div className="text-sm text-foreground">
                    {formatDate(customer?.lastOrder)}
                  </div>
                </td>
                
                <td className="p-3">
                  <div className="text-sm font-medium text-foreground">
                    {formatCurrency(customer?.totalValue)}
                  </div>
                </td>
                
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthScoreColor(customer?.healthScore)}`}>
                      {customer?.healthScore}%
                    </span>
                  </div>
                </td>
                
                <td className="p-3" onClick={(e) => e?.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Icon name="MoreHorizontal" size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerGrid;