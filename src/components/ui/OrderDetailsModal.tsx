import React, { useState } from 'react';
import { Order } from '@/types';
import { formatIndianDate } from '@/utils/format';
import Icon from '../AppIcon';
import { InvoiceCreationAudit } from '@/services/auditService';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order }) => {
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditEntries] = useState<InvoiceCreationAudit[]>([]);


  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'items_dispatched': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'items_returned': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'partial': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Order Details - {order.order_number}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              View complete order information
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
      <div className="space-y-6">
        {/* Order Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{order.order_number}</h3>
            <p className="text-sm text-muted-foreground">Created: {formatIndianDate(order.created_at)}</p>
          </div>
          <div className="flex space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
              {order.status.replace('_', ' ').toUpperCase()}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
              {order.payment_status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Customer Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <span className="ml-2 font-medium">{order.customer_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Customer ID:</span>
              <span className="ml-2 font-medium">{order.customer_id}</span>
            </div>
          </div>
        </div>

        {/* Event Information */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Event Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Event Date:</span>
              <span className="ml-2 font-medium">{formatIndianDate(order.event_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Event Type:</span>
              <span className="ml-2 font-medium capitalize">{order.event_type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span>
              <span className="ml-2 font-medium">{order.event_duration || 0} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Guest Count:</span>
              <span className="ml-2 font-medium">{order.guest_count || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Location Type:</span>
              <span className="ml-2 font-medium capitalize">{order.location_type}</span>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Order Items</h4>
          {order.items && order.items.length > 0 ? (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{item.item_name}</p>
                    <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">₹{(item.rate || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total: ₹{(item.amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No items added to this order yet.</p>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Order Summary</h4>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Amount:</span>
            <span className="text-xl font-bold text-foreground">₹{(order.total_amount || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">Notes</h4>
            <p className="text-sm text-foreground">{order.notes}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Timestamps</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2 font-medium">{formatIndianDate(order.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="ml-2 font-medium">{formatIndianDate(order.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      {/* Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Invoice Creation Audit Log</h2>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="x" size={24} />
              </button>
            </div>
            
            {auditEntries.length === 0 ? (
              <p className="text-muted-foreground">No audit entries found.</p>
            ) : (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Attempt</th>
                      <th className="text-left p-2 text-foreground">Status</th>
                      <th className="text-left p-2 text-foreground">Error</th>
                      <th className="text-left p-2 text-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border">
                        <td className="p-2 text-foreground">{entry.attempt_integer}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            entry.success 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {entry.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground text-xs">
                          {entry.error_message ? (
                            <span title={entry.error_message}>
                              {entry.error_message.length > 50 
                                ? entry.error_message.substring(0, 50) + '...' 
                                : entry.error_message}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsModal;
