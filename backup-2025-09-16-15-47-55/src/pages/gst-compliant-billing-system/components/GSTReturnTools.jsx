import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const GSTReturnTools = ({ onExport, onGenerate }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [returnType, setReturnType] = useState('GSTR1');
  const [isGenerating, setIsGenerating] = useState(false);

  const periodOptions = [
    { value: '2024-01', label: 'January 2024' },
    { value: '2024-02', label: 'February 2024' },
    { value: '2024-03', label: 'March 2024' },
    { value: '2024-04', label: 'April 2024' },
    { value: '2024-05', label: 'May 2024' },
    { value: '2024-06', label: 'June 2024' },
    { value: '2024-07', label: 'July 2024' },
    { value: '2024-08', label: 'August 2024' }
  ];

  const returnTypeOptions = [
    { value: 'GSTR1', label: 'GSTR-1 (Outward Supplies)' },
    { value: 'GSTR3B', label: 'GSTR-3B (Summary Return)' },
    { value: 'GSTR2A', label: 'GSTR-2A (Auto-populated)' },
    { value: 'GSTR9', label: 'GSTR-9 (Annual Return)' }
  ];

  const mockGSTData = {
    'GSTR1': {
      totalTaxableValue: 2450000,
      totalTax: 441000,
      cgst: 220500,
      sgst: 220500,
      igst: 0,
      invoiceCount: 156,
      b2bInvoices: 142,
      b2cInvoices: 14
    },
    'GSTR3B': {
      outwardSupplies: 2450000,
      inwardSupplies: 1200000,
      inputTaxCredit: 216000,
      netTaxLiability: 225000,
      interestPenalty: 0,
      totalPayment: 225000
    }
  };

  const handleGenerate = async () => {
    if (!selectedPeriod || !returnType) return;
    
    setIsGenerating(true);
    // Simulate API call
    setTimeout(() => {
      setIsGenerating(false);
      onGenerate({ period: selectedPeriod, type: returnType });
    }, 2000);
  };

  const handleExport = (format) => {
    if (!selectedPeriod || !returnType) return;
    onExport({ period: selectedPeriod, type: returnType, format });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const currentData = mockGSTData?.[returnType] || mockGSTData?.['GSTR1'];

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">GST Return Preparation</h2>
          <p className="text-sm text-muted-foreground">Generate and export GST returns for filing</p>
        </div>
        <div className="flex items-center space-x-2">
          <Icon name="FileText" size={20} className="text-primary" />
          <span className="text-sm font-medium text-primary">Government Filing Ready</span>
        </div>
      </div>
      {/* Selection Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Select
          label="Return Period"
          options={periodOptions}
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          placeholder="Select period"
        />
        
        <Select
          label="Return Type"
          options={returnTypeOptions}
          value={returnType}
          onChange={setReturnType}
        />

        <div className="flex items-end">
          <Button
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={!selectedPeriod || !returnType}
            iconName="RefreshCw"
            iconPosition="left"
            className="w-full"
          >
            Generate Return
          </Button>
        </div>
      </div>
      {/* Return Summary */}
      {selectedPeriod && returnType && (
        <div className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">
              {returnType} Summary - {periodOptions?.find(p => p?.value === selectedPeriod)?.label}
            </h3>
            
            {returnType === 'GSTR1' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(currentData?.totalTaxableValue)}</p>
                  <p className="text-sm text-muted-foreground">Taxable Value</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{formatCurrency(currentData?.totalTax)}</p>
                  <p className="text-sm text-muted-foreground">Total Tax</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{currentData?.invoiceCount}</p>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary">{currentData?.b2bInvoices}</p>
                  <p className="text-sm text-muted-foreground">B2B Invoices</p>
                </div>
              </div>
            )}

            {returnType === 'GSTR3B' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(currentData?.outwardSupplies)}</p>
                  <p className="text-sm text-muted-foreground">Outward Supplies</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{formatCurrency(currentData?.inputTaxCredit)}</p>
                  <p className="text-sm text-muted-foreground">Input Tax Credit</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{formatCurrency(currentData?.netTaxLiability)}</p>
                  <p className="text-sm text-muted-foreground">Net Tax Liability</p>
                </div>
              </div>
            )}
          </div>

          {/* Tax Breakdown */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">Tax Breakdown</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{formatCurrency(currentData?.cgst || 0)}</p>
                <p className="text-xs text-muted-foreground">CGST</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{formatCurrency(currentData?.sgst || 0)}</p>
                <p className="text-xs text-muted-foreground">SGST</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{formatCurrency(currentData?.igst || 0)}</p>
                <p className="text-xs text-muted-foreground">IGST</p>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">Export Options</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                iconName="Download"
                iconPosition="left"
              >
                JSON Format
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('excel')}
                iconName="FileSpreadsheet"
                iconPosition="left"
              >
                Excel Format
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                iconName="FileText"
                iconPosition="left"
              >
                CSV Format
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleExport('government')}
                iconName="Upload"
                iconPosition="left"
              >
                Government Portal Format
              </Button>
            </div>
          </div>

          {/* Compliance Checklist */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">Compliance Checklist</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Icon name="CheckCircle" size={16} className="text-success" />
                <span className="text-sm text-foreground">All invoices have valid GSTIN</span>
              </div>
              <div className="flex items-center space-x-2">
                <Icon name="CheckCircle" size={16} className="text-success" />
                <span className="text-sm text-foreground">Tax calculations verified</span>
              </div>
              <div className="flex items-center space-x-2">
                <Icon name="CheckCircle" size={16} className="text-success" />
                <span className="text-sm text-foreground">No duplicate invoice numbers</span>
              </div>
              <div className="flex items-center space-x-2">
                <Icon name="AlertCircle" size={16} className="text-warning" />
                <span className="text-sm text-foreground">2 invoices pending customer GSTIN update</span>
              </div>
            </div>
          </div>

          {/* Filing Reminder */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Icon name="Calendar" size={20} className="text-accent mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground">Filing Reminder</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {returnType} for {periodOptions?.find(p => p?.value === selectedPeriod)?.label} is due on{' '}
                  <span className="font-medium text-accent">
                    {returnType === 'GSTR1' ? '11th' : '20th'} of next month
                  </span>
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <Button variant="outline" size="sm" iconName="Bell" iconPosition="left">
                    Set Reminder
                  </Button>
                  <Button variant="outline" size="sm" iconName="ExternalLink" iconPosition="left">
                    GST Portal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTReturnTools;