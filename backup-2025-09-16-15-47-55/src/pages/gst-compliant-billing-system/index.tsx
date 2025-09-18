import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import Header from '../../components/ui/Header.tsx';
import Sidebar from '../../components/ui/Sidebar.tsx';
import Breadcrumb from '../../components/ui/Breadcrumb.tsx';
import Icon from '../../components/AppIcon.tsx';
import Button from '../../components/ui/Button.tsx';

// Import all components
import InvoiceFilters from './components/InvoiceFilters';
import InvoiceGrid from './components/InvoiceGrid';
import InvoiceEditor from './components/InvoiceEditor';
import GSTReturnTools from './components/GSTReturnTools';
import PaymentTracker from './components/PaymentTracker';
import BulkOperations from './components/BulkOperations';

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  rate: number;
  gstRate: number;
  amount: number;
}

interface GSTBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerGstin: string;
  date: string;
  dueDate: string;
  totalAmount: number;
  baseAmount: number;
  gstBreakdown: GSTBreakdown;
  paymentStatus: string;
  isGstCompliant: boolean;
  items: InvoiceItem[];
}

const GSTCompliantBillingSystem: React.FC = () => {
  const navigate = useNavigate();
  // const _location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  const [activeView, setActiveView] = useState<string>('invoices');
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showBulkOperations, setShowBulkOperations] = useState<boolean>(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Mock invoice data
  const mockInvoices: Invoice[] = [
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
      customerName: 'Priya Catering Services',
      customerGstin: '29FGHIJ5678K2L6',
      date: '2024-08-02',
      dueDate: '2024-08-16',
      totalAmount: 18900,
      baseAmount: 16000,
      gstBreakdown: { cgst: 1450, sgst: 1450, igst: 0 },
      paymentStatus: 'paid',
      isGstCompliant: true,
      items: [
        { id: 1, description: 'Glassware Set (30 pcs)', quantity: 30, rate: 15, gstRate: 18, amount: 531 },
        { id: 2, description: 'Cutlery Set (25 pcs)', quantity: 25, rate: 20, gstRate: 18, amount: 590 }
      ]
    }
    // Add more mock invoices as needed
  ];

  useEffect(() => {
    setInvoices(mockInvoices);
  }, []);

  const handleInvoiceSelect = (invoice: Invoice): void => {
    setEditingInvoice(invoice);
  };

  const handleInvoiceToggle = (invoiceId: number): void => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleBulkAction = (action: string): void => {
    console.log('Bulk action:', action, selectedInvoices);
    setShowBulkOperations(true);
  };

  const handleCreateInvoice = (): void => {
    setEditingInvoice(null);
  };

  const handleEditInvoice = (invoice: Invoice): void => {
    setEditingInvoice(invoice);
  };

  const handleInvoiceSave = (invoiceData: Invoice): void => {
    console.log('Saving invoice:', invoiceData);
    setEditingInvoice(null);
  };

  const handleInvoiceCancel = (): void => {
    setEditingInvoice(null);
  };

  const handleViewChange = (view: string): void => {
    setActiveView(view);
  };

  const handleLogout = (): void => {
    navigate('/authentication-role-selection');
  };

  const handleRoleSwitch = (): void => {
    console.log('Role switch requested');
  };

  const handleSearchAction = (query: string): void => {
    console.log('Global search:', query);
  };

  const renderActiveView = (): React.ReactNode => {
    switch (activeView) {
      case 'invoices':
        return (
          <InvoiceGrid
            invoices={invoices}
            selectedInvoices={selectedInvoices}
            onInvoiceSelect={handleInvoiceSelect}
            onInvoiceToggle={handleInvoiceToggle}
            onEditInvoice={handleEditInvoice}
            onBulkAction={handleBulkAction}
          />
        );
      case 'gst-returns':
        return <GSTReturnTools />;
      case 'payments':
        return <PaymentTracker />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={userProfile}
        onLogout={handleLogout}
        onRoleSwitch={handleRoleSwitch}
        onSearch={handleSearchAction}
      />
      
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />

      <main className={`pt-16 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      }`}>
        <div className="p-6">
          <Breadcrumb />
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              GST Compliant Billing System
            </h1>
            <p className="text-muted-foreground">
              Comprehensive billing and invoicing system with GST compliance and automated return filing.
            </p>
          </div>

          {/* View Tabs */}
          <div className="flex items-center space-x-1 mb-6">
            <Button
              variant={activeView === 'invoices' ? 'default' : 'ghost'}
              onClick={() => handleViewChange('invoices')}
            >
              <Icon name="FileText" size={16} className="mr-2" />
              Invoices
            </Button>
            <Button
              variant={activeView === 'gst-returns' ? 'default' : 'ghost'}
              onClick={() => handleViewChange('gst-returns')}
            >
              <Icon name="Calculator" size={16} className="mr-2" />
              GST Returns
            </Button>
            <Button
              variant={activeView === 'payments' ? 'default' : 'ghost'}
              onClick={() => handleViewChange('payments')}
            >
              <Icon name="CreditCard" size={16} className="mr-2" />
              Payments
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-280px)]">
            {/* Left Sidebar - Filters */}
            <div className="col-span-12 lg:col-span-3">
              <InvoiceFilters
                onFilterChange={(filters: any) => console.log('Filters changed:', filters)}
                onSearch={(query: any) => console.log('Search:', query)}
                searchQuery=""
              />
            </div>

            {/* Main Content */}
            <div className="col-span-12 lg:col-span-9">
              <div className="bg-card border border-border rounded-lg p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground capitalize">
                    {activeView.replace('-', ' ')}
                  </h2>
                  {activeView === 'invoices' && (
                    <Button onClick={handleCreateInvoice} iconName="Plus">
                      New Invoice
                    </Button>
                  )}
                </div>
                {renderActiveView()}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Invoice Editor Modal */}
      {editingInvoice !== undefined && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <InvoiceEditor
              invoice={editingInvoice}
              onSave={handleInvoiceSave}
              onCancel={handleInvoiceCancel}
            />
          </div>
        </div>
      )}

      {/* Bulk Operations Modal */}
      {showBulkOperations && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl">
            <BulkOperations
              selectedInvoices={selectedInvoices}
              onClose={() => setShowBulkOperations(false)}
              onExecute={(action: any, data: any) => {
                console.log('Bulk operation:', action, data);
                setShowBulkOperations(false);
                setSelectedInvoices([]);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTCompliantBillingSystem;
