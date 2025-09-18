import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PendingApprovals = ({ approvals, onApprove, onReject }) => {
  const mockApprovals = approvals || [
    {
      id: 'PA-001',
      type: 'order',
      title: 'High-value rental order',
      description: 'Wedding order for 1000+ items - ₹85,000',
      customer: 'Royal Events Mumbai',
      amount: 85000,
      priority: 'high',
      submittedBy: 'Priya Sharma',
      submittedAt: new Date(Date.now() - 1800000),
      icon: 'ShoppingCart'
    },
    {
      id: 'PA-002',
      type: 'discount',
      title: 'Special discount approval',
      description: '25% discount for bulk corporate order',
      customer: 'TechCorp Solutions',
      amount: 15000,
      priority: 'medium',
      submittedBy: 'Amit Patel',
      submittedAt: new Date(Date.now() - 3600000),
      icon: 'Percent'
    },
    {
      id: 'PA-003',
      type: 'refund',
      title: 'Refund request',
      description: 'Event cancelled - full refund requested',
      customer: 'Sharma Family',
      amount: 12500,
      priority: 'medium',
      submittedBy: 'Rajesh Kumar',
      submittedAt: new Date(Date.now() - 5400000),
      icon: 'RotateCcw'
    },
    {
      id: 'PA-004',
      type: 'inventory',
      title: 'Inventory write-off',
      description: 'Damaged items after event - 50 plates',
      customer: 'Internal',
      amount: 2500,
      priority: 'low',
      submittedBy: 'Warehouse Team',
      submittedAt: new Date(Date.now() - 7200000),
      icon: 'AlertTriangle'
    }
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-white bg-red-600';
      case 'medium': return 'text-white bg-yellow-500';
      case 'low': return 'text-white bg-gray-600';
      default: return 'text-white bg-gray-600';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN')}`;
  };

  const handleApprove = (approval) => {
    if (onApprove) {
      onApprove(approval);
    }
  };

  const handleReject = (approval) => {
    if (onReject) {
      onReject(approval);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Pending Approvals</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {mockApprovals?.length} pending
          </span>
          <div className="w-2 h-2 bg-warning rounded-full animate-pulse"></div>
        </div>
      </div>
      <div className="space-y-3">
        {mockApprovals?.map((approval) => (
          <div key={approval?.id} className="border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-surface rounded-lg">
                  <Icon name={approval?.icon} size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="text-sm font-medium text-foreground">
                      {approval?.title}
                    </h4>
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm ${getPriorityColor(approval?.priority)}`}>
                      {approval?.priority?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {approval?.description}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>Customer: {approval?.customer}</span>
                    <span>Amount: {formatCurrency(approval?.amount)}</span>
                    <span>By: {approval?.submittedBy}</span>
                    <span>{formatTimestamp(approval?.submittedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(approval)}
                iconName="X"
                iconPosition="left"
              >
                Reject
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleApprove(approval)}
                iconName="Check"
                iconPosition="left"
              >
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
      {mockApprovals?.length === 0 && (
        <div className="text-center py-8">
          <Icon name="CheckCircle" size={48} className="text-success mx-auto mb-4" />
          <p className="text-muted-foreground">No pending approvals</p>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;