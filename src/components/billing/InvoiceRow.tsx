// ============================================================================
// INVOICE ROW COMPONENT
// ============================================================================

import React from 'react';
import { Invoice } from '@/types/billing';
import Button from '@/components/ui/Button';
import Icon from '@/components/AppIcon';

interface InvoiceRowProps {
  invoice: Invoice;
  onView?: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  showUserInfo?: boolean;
  userInfo?: {
    user_name?: string;
    user_email?: string;
  };
}

const InvoiceRow: React.FC<InvoiceRowProps> = ({
  invoice,
  onView,
  onDownload,
  onDelete,
  showUserInfo = false,
  userInfo
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = () => {
    return invoice.status === 'pending' && new Date(invoice.due_date) < new Date();
  };

  const handleView = () => {
    if (onView) {
      onView(invoice);
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(invoice);
    }
  };

  return (
    <tr className="hover:bg-muted/50">
      {/* Invoice Number */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-foreground">
            {invoice.invoice_number || `INV-${invoice.id.slice(-6)}`}
          </div>
          <div className="text-sm text-muted-foreground">
            {invoice.description}
          </div>
        </div>
      </td>

      {/* User Info (Admin view) */}
      {showUserInfo && (
        <td className="px-6 py-4 whitespace-nowrap">
          <div>
            <div className="text-sm font-medium text-foreground">
              {userInfo?.user_name || 'Unknown User'}
            </div>
            <div className="text-sm text-muted-foreground">
              {userInfo?.user_email || 'No email'}
            </div>
          </div>
        </td>
      )}

      {/* Amount */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-foreground">
          ₹{invoice.amount.toLocaleString()}
        </div>
      </td>

      {/* Due Date */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`text-sm ${isOverdue() ? 'text-red-600 font-medium' : 'text-foreground'}`}>
          {formatDate(invoice.due_date)}
          {isOverdue() && (
            <Icon name="alert-triangle" size={14} className="inline ml-1 text-red-600" />
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </span>
      </td>

      {/* Created Date */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-muted-foreground">
          {formatDate(invoice.created_at)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleView}
          >
            <Icon name="eye" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
          >
            <Icon name="download" size={16} />
          </Button>
          {invoice.status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
            >
              <Icon name="check" size={16} />
            </Button>
          )}
          {onDelete && invoice.status !== 'paid' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(invoice)}
            >
              <Icon name="trash" size={16} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default InvoiceRow;
