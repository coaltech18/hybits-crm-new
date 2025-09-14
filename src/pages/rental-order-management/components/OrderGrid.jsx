import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const OrderGrid = ({ orders, selectedOrders, onOrderSelect, onOrderClick, onBulkAction, onScheduleDelivery }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'orderDate', direction: 'desc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      onOrderSelect(orders?.map(order => order?.id));
    } else {
      onOrderSelect([]);
    }
  };

  const handleRowSelect = (orderId, checked) => {
    if (checked) {
      onOrderSelect([...selectedOrders, orderId]);
    } else {
      onOrderSelect(selectedOrders?.filter(id => id !== orderId));
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: 'bg-gray-600', text: 'text-white', label: 'Draft' },
      confirmed: { bg: 'bg-blue-600', text: 'text-white', label: 'Confirmed' },
      'in-progress': { bg: 'bg-yellow-500', text: 'text-white', label: 'In Progress' },
      delivered: { bg: 'bg-green-600', text: 'text-white', label: 'Delivered' },
      returned: { bg: 'bg-purple-600', text: 'text-white', label: 'Returned' },
      cancelled: { bg: 'bg-red-600', text: 'text-white', label: 'Cancelled' }
    };

    const config = statusConfig?.[status] || statusConfig?.draft;
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-gray-600', text: 'text-white', label: 'Pending' },
      partial: { bg: 'bg-yellow-500', text: 'text-white', label: 'Partial' },
      paid: { bg: 'bg-green-600', text: 'text-white', label: 'Paid' },
      overdue: { bg: 'bg-red-600', text: 'text-white', label: 'Overdue' }
    };

    const config = statusConfig?.[status] || statusConfig?.pending;
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const getProfitabilityIndicator = (margin) => {
    if (margin >= 30) return <Icon name="TrendingUp" size={16} className="text-green-600" />;
    if (margin >= 15) return <Icon name="Minus" size={16} className="text-yellow-600" />;
    return <Icon name="TrendingDown" size={16} className="text-red-600" />;
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
    return new Date(date)?.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const sortedOrders = [...orders]?.sort((a, b) => {
    if (sortConfig?.direction === 'asc') {
      return a?.[sortConfig?.key] > b?.[sortConfig?.key] ? 1 : -1;
    }
    return a?.[sortConfig?.key] < b?.[sortConfig?.key] ? 1 : -1;
  });

  const SortableHeader = ({ label, sortKey }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {sortConfig?.key === sortKey && (
          <Icon 
            name={sortConfig?.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
            size={14} 
          />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedOrders?.length > 0 && (
        <div className="bg-primary/5 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedOrders?.length} order{selectedOrders?.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction('update-status')}
                iconName="Edit"
                iconPosition="left"
              >
                Update Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction('generate-invoice')}
                iconName="FileText"
                iconPosition="left"
              >
                Generate Invoice
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction('schedule-delivery')}
                iconName="Truck"
                iconPosition="left"
              >
                Schedule Delivery
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-12">
                <Checkbox
                  checked={selectedOrders?.length === orders?.length && orders?.length > 0}
                  onChange={(e) => handleSelectAll(e?.target?.checked)}
                />
              </th>
              <SortableHeader label="Order ID" sortKey="orderId" />
              <SortableHeader label="Customer" sortKey="customerName" />
              <SortableHeader label="Rental Period" sortKey="orderDate" />
              <SortableHeader label="Items" sortKey="totalItems" />
              <SortableHeader label="Amount" sortKey="totalAmount" />
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivery</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Profit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {sortedOrders?.map((order) => (
              <tr 
                key={order?.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onOrderClick(order)}
              >
                <td className="px-4 py-4" onClick={(e) => e?.stopPropagation()}>
                  <Checkbox
                    checked={selectedOrders?.includes(order?.id)}
                    onChange={(e) => handleRowSelect(order?.id, e?.target?.checked)}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-foreground">{order?.orderId}</div>
                  <div className="text-xs text-muted-foreground">{order?.location}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-foreground">{order?.customerName}</div>
                  <div className="text-xs text-muted-foreground">{order?.customerPhone}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground">
                    {formatDate(order?.startDate)} - {formatDate(order?.endDate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order?.duration} days
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-foreground">{order?.totalItems} items</div>
                  <div className="text-xs text-muted-foreground">
                    {order?.itemTypes?.slice(0, 2)?.join(', ')}
                    {order?.itemTypes?.length > 2 && ` +${order?.itemTypes?.length - 2} more`}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-bold text-primary bg-primary/5 px-2 py-1 rounded-md">{formatCurrency(order?.totalAmount)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Security: {formatCurrency(order?.securityDeposit)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {getStatusBadge(order?.status)}
                </td>
                <td className="px-4 py-4">
                  {getPaymentStatusBadge(order?.paymentStatus)}
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground">{order?.deliveryStatus}</div>
                  {order?.deliveryDate && (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(order?.deliveryDate)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    {getProfitabilityIndicator(order?.profitMargin)}
                    <span className={`text-sm font-bold px-2 py-1 rounded-md ${
                      order?.profitMargin >= 30 ? 'text-green-700 bg-green-100' :
                      order?.profitMargin >= 15 ? 'text-yellow-700 bg-yellow-100' :
                      'text-red-700 bg-red-100'
                    }`}>
                      {order?.profitMargin}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4" onClick={(e) => e?.stopPropagation()}>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onOrderClick(order)}
                    >
                      <Icon name="Eye" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => console.log('Edit order:', order?.id)}
                    >
                      <Icon name="Edit" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onScheduleDelivery && onScheduleDelivery(order)}
                      title="Schedule Delivery"
                    >
                      <Icon name="Truck" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => console.log('More actions:', order?.id)}
                    >
                      <Icon name="MoreHorizontal" size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="bg-muted/30 px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min(orders?.length, 15)} of {orders?.length} orders
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>
              <Icon name="ChevronLeft" size={16} />
            </Button>
            <span className="text-sm text-foreground">Page 1 of 1</span>
            <Button variant="outline" size="sm" disabled>
              <Icon name="ChevronRight" size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderGrid;