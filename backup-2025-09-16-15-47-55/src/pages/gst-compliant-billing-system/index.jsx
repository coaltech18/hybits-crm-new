import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

// Import all components
import InvoiceFilters from './components/InvoiceFilters';
import InvoiceGrid from './components/InvoiceGrid';
import InvoiceEditor from './components/InvoiceEditor';
import GSTReturnTools from './components/GSTReturnTools';
import PaymentTracker from './components/PaymentTracker';
import BulkOperations from './components/BulkOperations';

const GSTCompliantBillingSystem = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  const [activeView, setActiveView] = useState('invoices');
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [invoices, setInvoices] = useState([]);


  // Mock invoice data
  const mockInvoices = [
    {
      id: 1,
      invoiceNumber: 'INV-2024-001',
      customerName: 'Rajesh Enterprises',
      customerGstin: '27ABCDE1234F1Z5',
      date: '2024-08-01',
      dueDate: '2024-08-15',
      totalAmount: 25680,
      baseAmount: 21800,
      gstBreakdown: { cgst: 1940, sgst: 1940, igst: 0 },
      paymentStatus: 'overdue',
      isGstCompliant: true,
      items: [
        { id: 1, description: 'Dinner Plates (50 pcs)', quantity: 50, rate: 12, gstRate: 18, amount: 708 },
        { id: 2, description: 'Serving Bowls (20 pcs)', quantity: 20, rate: 25, gstRate: 18, amount: 590 }
      ]
    },
    {
      id: 2,
      invoiceNumber: 'INV-2024-002',
      customerName: 'Mumbai Caterers Ltd',
      customerGstin: '27FGHIJ5678K2L6',
      date: '2024-08-02',
      dueDate: '2024-08-20',
      totalAmount: 45200,
      baseAmount: 38305,
      gstBreakdown: { cgst: 3447, sgst: 3447, igst: 0 },
      paymentStatus: 'partial',
      isGstCompliant: true,
      items: []
    },
    {
      id: 3,
      invoiceNumber: 'INV-2024-003',
      customerName: 'Golden Events',
      customerGstin: '27MNOPQ9012R3S7',
      date: '2024-08-03',
      dueDate: '2024-08-25',
      totalAmount: 18900,
      baseAmount: 16017,
      gstBreakdown: { cgst: 1441, sgst: 1441, igst: 0 },
      paymentStatus: 'pending',
      isGstCompliant: true,
      items: []
    },
    {
      id: 4,
      invoiceNumber: 'INV-2024-004',
      customerName: 'Royal Wedding Planners',
      customerGstin: '29TUVWX3456Y4Z8',
      date: '2024-08-04',
      dueDate: '2024-08-18',
      totalAmount: 67500,
      baseAmount: 57203,
      gstBreakdown: { cgst: 0, sgst: 0, igst: 10297 },
      paymentStatus: 'paid',
      isGstCompliant: true,
      items: []
    },
    {
      id: 5,
      invoiceNumber: 'INV-2024-005',
      customerName: 'Celebration Hub',
      customerGstin: '27ABCDE7890F5G1',
      date: '2024-07-28',
      dueDate: '2024-08-12',
      totalAmount: 32400,
      baseAmount: 27458,
      gstBreakdown: { cgst: 2471, sgst: 2471, igst: 0 },
      paymentStatus: 'overdue',
      isGstCompliant: false,
      items: []
    }
  ];

  const savedFilterPresets = [
    { id: 1, name: 'Overdue Invoices', filters: { paymentStatus: 'overdue' } },
    { id: 2, name: 'This Month', filters: { dateFrom: '2024-08-01', dateTo: '2024-08-31' } },
    { id: 3, name: 'High Value', filters: { amountRange: '50000+' } }
  ];

  useEffect(() => {
    setInvoices(mockInvoices);
    
    // Check for success message from invoice creation
    if (location.state?.message) {
      // You could show a toast notification here
      console.log(location.state.message);
    }
    
    // Add new invoice if created
    if (location.state?.newInvoice) {
      setInvoices(prev => [location.state.newInvoice, ...prev]);
    }
  }, [location.state]);


  const handleLogout = () => {
    console.log('Logging out...');
  };

  const handleFilterChange = (filters) => {
    console.log('Applying filters:', filters);
    // Filter logic would be implemented here
  };

  const handleClearFilters = () => {
    console.log('Clearing all filters');
    setInvoices(mockInvoices);
  };

  const handleInvoiceSelect = (selectedIds) => {
    setSelectedInvoices(selectedIds);
  };

  const handleInvoiceEdit = (invoice) => {
    setEditingInvoice(invoice);
  };

  const handleCreateInvoice = () => {
    navigate('/invoice-creation');
  };

  const handleEditInvoice = (invoice) => {
    navigate('/invoice-creation', { state: { invoice } });
  };

  const handleBulkAction = (action) => {
    if (selectedInvoices?.length === 0) return;
    
    if (action === 'bulk-operations') {
      setShowBulkOperations(true);
    } else {
      console.log(`Performing ${action} on invoices:`, selectedInvoices);
      // Handle specific bulk actions
    }
  };

  const handleInvoiceSave = (invoiceData) => {
    if (editingInvoice) {
      // Update existing invoice
      setInvoices(prev => prev?.map(inv => 
        inv?.id === editingInvoice?.id ? { ...invoiceData, id: editingInvoice?.id } : inv
      ));
    } else {
      // Create new invoice
      const newInvoice = { ...invoiceData, id: Date.now() };
      setInvoices(prev => [newInvoice, ...prev]);
    }
    setEditingInvoice(null);
  };

  const handleInvoiceCancel = () => {
    setEditingInvoice(null);
  };

  const handleGSTExport = (params) => {
    console.log('Exporting GST return:', params);
  };

  const handleGSTGenerate = (params) => {
    console.log('Generating GST return:', params);
  };

  const handlePaymentUpdate = (params) => {
    console.log('Updating payment:', params);
  };

  const handleSendReminder = (params) => {
    console.log('Sending reminder:', params);
  };

  const viewTabs = [
    { id: 'invoices', label: 'Invoice Management', icon: 'FileText' },
    { id: 'payments', label: 'Payment Tracker', icon: 'CreditCard' },
    { id: 'gst-returns', label: 'GST Returns', icon: 'Calculator' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        onLogout={handleLogout}
      />
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">GST Compliant Billing System</h1>
              <p className="text-muted-foreground mt-1">
                Automated invoice generation and tax management with GST compliance
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                iconName="Download"
                iconPosition="left"
              >
                Export Data
              </Button>
              <Button
                onClick={handleCreateInvoice}
                iconName="Plus"
                iconPosition="left"
              >
                Create Invoice
              </Button>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex border-b border-border mb-6">
            {viewTabs?.map((tab) => (
              <button
                key={tab?.id}
                onClick={() => setActiveView(tab?.id)}
                className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeView === tab?.id
                    ? 'text-primary border-b-2 border-primary bg-primary/5' :'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={16} />
                <span>{tab?.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content */}
          {activeView === 'invoices' && !editingInvoice && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Left Panel - Filters and Invoice List */}
              <div className="xl:col-span-2 space-y-6">
                <InvoiceFilters
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                  savedPresets={savedFilterPresets}
                />
                
                <InvoiceGrid
                  invoices={invoices}
                  selectedInvoices={selectedInvoices}
                  onInvoiceSelect={handleInvoiceSelect}
                  onInvoiceEdit={handleEditInvoice}
                  onBulkAction={handleBulkAction}
                />
              </div>

              {/* Right Panel - Quick Actions */}
              <div className="xl:col-span-3">
                <div className="bg-surface border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Button
                      variant="outline"
                      onClick={handleCreateInvoice}
                      iconName="Plus"
                      iconPosition="left"
                      className="h-16 flex-col"
                    >
                      <span className="font-medium">Create Invoice</span>
                      <span className="text-xs text-muted-foreground">Generate new invoice</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleBulkAction('bulk-operations')}
                      disabled={selectedInvoices?.length === 0}
                      iconName="Settings"
                      iconPosition="left"
                      className="h-16 flex-col"
                    >
                      <span className="font-medium">Bulk Operations</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedInvoices?.length} selected
                      </span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => setActiveView('gst-returns')}
                      iconName="Calculator"
                      iconPosition="left"
                      className="h-16 flex-col"
                    >
                      <span className="font-medium">GST Returns</span>
                      <span className="text-xs text-muted-foreground">Prepare tax filing</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => setActiveView('payments')}
                      iconName="CreditCard"
                      iconPosition="left"
                      className="h-16 flex-col"
                    >
                      <span className="font-medium">Payment Tracker</span>
                      <span className="text-xs text-muted-foreground">Monitor payments</span>
                    </Button>
                  </div>

                  {/* Recent Activity */}
                  <div className="border-t border-border pt-4">
                    <h3 className="font-medium text-foreground mb-3">Recent Activity</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                          <Icon name="CheckCircle" size={16} className="text-success" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Payment received</p>
                          <p className="text-xs text-muted-foreground">INV-2024-004 - ₹67,500</p>
                        </div>
                        <span className="text-xs text-muted-foreground">2 min ago</span>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Icon name="FileText" size={16} className="text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Invoice created</p>
                          <p className="text-xs text-muted-foreground">INV-2024-006 - Elite Catering</p>
                        </div>
                        <span className="text-xs text-muted-foreground">15 min ago</span>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center">
                          <Icon name="Bell" size={16} className="text-warning" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Payment reminder sent</p>
                          <p className="text-xs text-muted-foreground">INV-2024-001 - Rajesh Enterprises</p>
                        </div>
                        <span className="text-xs text-muted-foreground">1 hour ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Editor */}
          {editingInvoice && (
            <div className="h-[calc(100vh-200px)]">
              <InvoiceEditor
                invoice={editingInvoice?.id ? editingInvoice : null}
                onSave={handleInvoiceSave}
                onCancel={handleInvoiceCancel}
                userRole={userProfile?.role}
              />
            </div>
          )}

          {/* Payment Tracker View */}
          {activeView === 'payments' && (
            <PaymentTracker
              onPaymentUpdate={handlePaymentUpdate}
              onSendReminder={handleSendReminder}
            />
          )}

          {/* GST Returns View */}
          {activeView === 'gst-returns' && (
            <GSTReturnTools
              onExport={handleGSTExport}
              onGenerate={handleGSTGenerate}
            />
          )}

          {/* Bulk Operations Modal */}
          {showBulkOperations && (
            <BulkOperations
              selectedInvoices={selectedInvoices}
              onBulkAction={(action, invoiceIds) => {
                console.log(`Bulk ${action} on invoices:`, invoiceIds);
                setShowBulkOperations(false);
                setSelectedInvoices([]);
              }}
              onClose={() => setShowBulkOperations(false)}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default GSTCompliantBillingSystem;