import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const InvoiceEditor = ({ invoice, onSave, onCancel, userRole }) => {
  const [activeTab, setActiveTab] = useState('items');
  const [invoiceData, setInvoiceData] = useState(invoice || {
    invoiceNumber: 'INV-2024-' + Math.floor(Math.random() * 1000)?.toString()?.padStart(3, '0'),
    date: new Date()?.toISOString()?.split('T')?.[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)?.toISOString()?.split('T')?.[0],
    customerName: '',
    customerGstin: '',
    customerAddress: '',
    customerState: '',
    items: [],
    paymentTerms: '30 days',
    notes: '',
    status: 'draft'
  });

  const [newItem, setNewItem] = useState({
    description: '',
    quantity: 1,
    rate: 0,
    gstRate: 18,
    amount: 0
  });

  const stateOptions = [
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'tamil-nadu', label: 'Tamil Nadu' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'uttar-pradesh', label: 'Uttar Pradesh' }
  ];

  const gstRateOptions = [
    { value: 0, label: '0%' },
    { value: 5, label: '5%' },
    { value: 12, label: '12%' },
    { value: 18, label: '18%' },
    { value: 28, label: '28%' }
  ];

  const paymentTermsOptions = [
    { value: '15 days', label: '15 days' },
    { value: '30 days', label: '30 days' },
    { value: '45 days', label: '45 days' },
    { value: '60 days', label: '60 days' },
    { value: 'immediate', label: 'Immediate' }
  ];

  const calculateItemAmount = (quantity, rate, gstRate) => {
    let baseAmount = quantity * rate;
    const gstAmount = (baseAmount * gstRate) / 100;
    return baseAmount + gstAmount;
  };

  const handleItemChange = (field, value) => {
    const updatedItem = { ...newItem, [field]: value };
    if (field === 'quantity' || field === 'rate' || field === 'gstRate') {
      updatedItem.amount = calculateItemAmount(updatedItem?.quantity, updatedItem?.rate, updatedItem?.gstRate);
    }
    setNewItem(updatedItem);
  };

  const addItem = () => {
    if (newItem?.description && newItem?.quantity > 0 && newItem?.rate > 0) {
      const item = {
        ...newItem,
        id: Date.now(),
        amount: calculateItemAmount(newItem?.quantity, newItem?.rate, newItem?.gstRate)
      };
      setInvoiceData({
        ...invoiceData,
        items: [...invoiceData?.items, item]
      });
      setNewItem({
        description: '',
        quantity: 1,
        rate: 0,
        gstRate: 18,
        amount: 0
      });
    }
  };

  const removeItem = (itemId) => {
    setInvoiceData({
      ...invoiceData,
      items: invoiceData?.items?.filter(item => item?.id !== itemId)
    });
  };

  const calculateTotals = () => {
    let baseAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    invoiceData?.items?.forEach(item => {
      const itemBase = item?.quantity * item?.rate;
      baseAmount += itemBase;

      const gstAmount = (itemBase * item?.gstRate) / 100;
      
      // If same state, split into CGST/SGST, otherwise IGST
      if (invoiceData?.customerState === 'maharashtra') {
        cgst += gstAmount / 2;
        sgst += gstAmount / 2;
      } else {
        igst += gstAmount;
      }
    });

    const totalAmount = baseAmount + cgst + sgst + igst;

    return { baseAmount, cgst, sgst, igst, totalAmount };
  };

  const totals = calculateTotals();

  const handleSave = () => {
    const finalInvoice = {
      ...invoiceData,
      ...totals,
      gstBreakdown: {
        cgst: totals?.cgst,
        sgst: totals?.sgst,
        igst: totals?.igst
      },
      isGstCompliant: true,
      paymentStatus: invoiceData?.status === 'draft' ? 'pending' : invoiceData?.paymentStatus || 'pending'
    };
    onSave(finalInvoice);
  };

  const tabs = [
    { id: 'items', label: 'Line Items', icon: 'Package' },
    { id: 'customer', label: 'Customer Details', icon: 'User' },
    { id: 'terms', label: 'Payment Terms', icon: 'CreditCard' },
    { id: 'delivery', label: 'Delivery Info', icon: 'Truck' }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    })?.format(amount);
  };

  const isReadOnly = userRole === 'sales' && invoiceData?.status !== 'draft';

  return (
    <div className="bg-surface border border-border rounded-lg h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {invoice ? 'Edit Invoice' : 'Create Invoice'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {invoiceData?.invoiceNumber} • {invoiceData?.status === 'draft' ? 'Draft' : 'Active'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isReadOnly}
            iconName="Save"
            iconPosition="left"
          >
            {invoiceData?.status === 'draft' ? 'Save Draft' : 'Update Invoice'}
          </Button>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs?.map((tab) => (
          <button
            key={tab?.id}
            onClick={() => setActiveTab(tab?.id)}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab?.id
                ? 'text-primary border-b-2 border-primary bg-primary/5' :'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab?.icon} size={16} />
            <span>{tab?.label}</span>
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'items' && (
          <div className="space-y-6">
            {/* Add Item Form */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-foreground mb-4">Add Line Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Description"
                    placeholder="Item description..."
                    value={newItem?.description}
                    onChange={(e) => handleItemChange('description', e?.target?.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={newItem?.quantity}
                  onChange={(e) => handleItemChange('quantity', parseInt(e?.target?.value) || 0)}
                  disabled={isReadOnly}
                />
                <Input
                  label="Rate (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem?.rate}
                  onChange={(e) => handleItemChange('rate', parseFloat(e?.target?.value) || 0)}
                  disabled={isReadOnly}
                />
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Select
                      label="GST Rate"
                      options={gstRateOptions}
                      value={newItem?.gstRate}
                      onChange={(value) => handleItemChange('gstRate', value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <Button
                    onClick={addItem}
                    disabled={!newItem?.description || newItem?.quantity <= 0 || newItem?.rate <= 0 || isReadOnly}
                    iconName="Plus"
                    iconPosition="left"
                  >
                    Add
                  </Button>
                </div>
              </div>
              {newItem?.quantity > 0 && newItem?.rate > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Amount: {formatCurrency(calculateItemAmount(newItem?.quantity, newItem?.rate, newItem?.gstRate))}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">Invoice Items</h3>
              {invoiceData?.items?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="Package" size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No items added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoiceData?.items?.map((item) => (
                    <div key={item?.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{item?.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {item?.quantity} × {formatCurrency(item?.rate)} @ {item?.gstRate}% GST
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">{formatCurrency(item?.amount)}</div>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item?.id)}
                            iconName="Trash2"
                            className="text-error hover:text-error"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            {invoiceData?.items?.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-foreground mb-4">Tax Calculation</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Amount:</span>
                    <span className="font-medium text-foreground">{formatCurrency(totals?.baseAmount)}</span>
                  </div>
                  {totals?.cgst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST:</span>
                      <span className="font-medium text-foreground">{formatCurrency(totals?.cgst)}</span>
                    </div>
                  )}
                  {totals?.sgst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST:</span>
                      <span className="font-medium text-foreground">{formatCurrency(totals?.sgst)}</span>
                    </div>
                  )}
                  {totals?.igst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IGST:</span>
                      <span className="font-medium text-foreground">{formatCurrency(totals?.igst)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between text-lg font-semibold">
                      <span className="text-foreground">Total Amount:</span>
                      <span className="text-primary">{formatCurrency(totals?.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customer' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Customer Name"
                placeholder="Enter customer name"
                value={invoiceData?.customerName}
                onChange={(e) => setInvoiceData({...invoiceData, customerName: e?.target?.value})}
                disabled={isReadOnly}
                required
              />
              <Input
                label="GSTIN"
                placeholder="Enter GSTIN"
                value={invoiceData?.customerGstin}
                onChange={(e) => setInvoiceData({...invoiceData, customerGstin: e?.target?.value})}
                disabled={isReadOnly}
              />
              <div className="md:col-span-2">
                <Input
                  label="Address"
                  placeholder="Enter customer address"
                  value={invoiceData?.customerAddress}
                  onChange={(e) => setInvoiceData({...invoiceData, customerAddress: e?.target?.value})}
                  disabled={isReadOnly}
                />
              </div>
              <Select
                label="State"
                options={stateOptions}
                value={invoiceData?.customerState}
                onChange={(value) => setInvoiceData({...invoiceData, customerState: value})}
                disabled={isReadOnly}
              />
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Payment Terms</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Invoice Date"
                type="date"
                value={invoiceData?.date}
                onChange={(e) => setInvoiceData({...invoiceData, date: e?.target?.value})}
                disabled={isReadOnly}
              />
              <Input
                label="Due Date"
                type="date"
                value={invoiceData?.dueDate}
                onChange={(e) => setInvoiceData({...invoiceData, dueDate: e?.target?.value})}
                disabled={isReadOnly}
              />
              <Select
                label="Payment Terms"
                options={paymentTermsOptions}
                value={invoiceData?.paymentTerms}
                onChange={(value) => setInvoiceData({...invoiceData, paymentTerms: value})}
                disabled={isReadOnly}
              />
            </div>
            <Input
              label="Notes"
              placeholder="Additional notes or terms..."
              value={invoiceData?.notes}
              onChange={(e) => setInvoiceData({...invoiceData, notes: e?.target?.value})}
              disabled={isReadOnly}
            />
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Delivery Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Delivery Address"
                placeholder="Enter delivery address"
                value={invoiceData?.deliveryAddress || ''}
                onChange={(e) => setInvoiceData({...invoiceData, deliveryAddress: e?.target?.value})}
                disabled={isReadOnly}
              />
              <Input
                label="Delivery Date"
                type="date"
                value={invoiceData?.deliveryDate || ''}
                onChange={(e) => setInvoiceData({...invoiceData, deliveryDate: e?.target?.value})}
                disabled={isReadOnly}
              />
              <Input
                label="Contact Person"
                placeholder="Contact person name"
                value={invoiceData?.contactPerson || ''}
                onChange={(e) => setInvoiceData({...invoiceData, contactPerson: e?.target?.value})}
                disabled={isReadOnly}
              />
              <Input
                label="Contact Phone"
                placeholder="Contact phone number"
                value={invoiceData?.contactPhone || ''}
                onChange={(e) => setInvoiceData({...invoiceData, contactPhone: e?.target?.value})}
                disabled={isReadOnly}
              />
            </div>
            <Input
              label="Delivery Instructions"
              placeholder="Special delivery instructions..."
              value={invoiceData?.deliveryInstructions || ''}
              onChange={(e) => setInvoiceData({...invoiceData, deliveryInstructions: e?.target?.value})}
              disabled={isReadOnly}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceEditor;