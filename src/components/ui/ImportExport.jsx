import React, { useState, useRef } from 'react';
import Button from './Button';
import Icon from '../AppIcon';
import { 
  exportToCSV, 
  exportToJSON, 
  importFile, 
  validateImportData,
  generateExportFilename,
  columnDefinitions 
} from '../../utils/importExport';

const ImportExport = ({
  data = [],
  dataType = 'data',
  columns = [],
  onImport = () => {},
  onExport = () => {},
  requiredFields = [],
  className = '',
  showImport = true,
  showExport = true,
  exportFormats = ['csv', 'json'],
  importFormats = ['csv', 'json']
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const fileInputRef = useRef(null);

  // Get column definitions for the data type
  const getColumns = () => {
    if (columns.length > 0) return columns;
    return columnDefinitions[dataType] || [];
  };

  // Handle export
  const handleExport = async (format) => {
    if (!data || data.length === 0) {
      // Try to get data from parent component or show sample data
      const sampleData = getSampleData();
      if (!sampleData || sampleData.length === 0) {
        alert('No data available to export');
        return;
      }
      // Use sample data for demonstration
      data = sampleData;
    }

    setIsExporting(true);
    try {
      console.log('Exporting data:', { dataType, format, dataCount: data.length, data: data.slice(0, 2) });
      const filename = generateExportFilename(dataType, format);
      const cols = getColumns();
      
      if (format === 'csv') {
        exportToCSV(data, cols, filename);
      } else if (format === 'json') {
        exportToJSON(data, filename);
      }
      
      onExport({ format, filename, dataCount: data.length });
      
      // Show success message
      alert(`Successfully exported ${data.length} records to ${filename}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setShowFormatMenu(false);
    }
  };

  // Get sample data for demonstration when no real data is available
  const getSampleData = () => {
    const sampleDataMap = {
      customers: [
        { id: 1, name: 'John Doe', email: 'john@example.com', phone: '+1234567890', company: 'ABC Corp', status: 'Active', created_at: '2024-01-15' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '+1234567891', company: 'XYZ Ltd', status: 'Active', created_at: '2024-01-16' }
      ],
      inventory: [
        { id: 1, item_code: 'PLT-001', name: 'Dinner Plate', category: 'Plates', current_stock: 50, reorder_point: 10, unit_price: 25.00, condition: 'Good' },
        { id: 2, item_code: 'CUP-001', name: 'Coffee Cup', category: 'Cups', current_stock: 30, reorder_point: 15, unit_price: 15.00, condition: 'New' }
      ],
      invoices: [
        { id: 1, invoice_number: 'INV-001', customer_name: 'John Doe', invoice_date: '2024-01-15', due_date: '2024-02-15', total_amount: 1500.00, status: 'Paid', gst_amount: 225.00 },
        { id: 2, invoice_number: 'INV-002', customer_name: 'Jane Smith', invoice_date: '2024-01-16', due_date: '2024-02-16', total_amount: 2000.00, status: 'Pending', gst_amount: 300.00 }
      ],
      orders: [
        { id: 1, customer_name: 'John Doe', event_date: '2024-02-15', status: 'Confirmed', total_amount: 1500.00, payment_status: 'Paid', created_at: '2024-01-15' },
        { id: 2, customer_name: 'Jane Smith', event_date: '2024-02-20', status: 'In Progress', total_amount: 2000.00, payment_status: 'Partial', created_at: '2024-01-16' }
      ],
      dashboard: [
        { date: '2024-01-15', metric: 'Revenue', value: 15000 },
        { date: '2024-01-16', metric: 'Orders', value: 25 },
        { date: '2024-01-17', metric: 'Customers', value: 150 }
      ]
    };
    
    return sampleDataMap[dataType] || [];
  };

  // Handle import
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let format = 'csv';
      
      if (fileExtension === 'json') {
        format = 'json';
      }

      const importedData = await importFile(file, format);
      
      // Validate imported data
      const validation = validateImportData(importedData, requiredFields);
      
      if (!validation.isValid) {
        alert(`Import validation failed:\n${validation.errors.join('\n')}`);
        return;
      }

      onImport({ 
        data: importedData, 
        format, 
        filename: file.name,
        dataCount: importedData.length 
      });
      
      alert(`Successfully imported ${importedData.length} records from ${file.name}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
      setShowImportMenu(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Export Button */}
      {showExport && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            iconName="Download"
            iconPosition="left"
            onClick={() => setShowFormatMenu(!showFormatMenu)}
            disabled={isExporting}
            className="relative"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          
          {showFormatMenu && (
            <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-luxury z-50 min-w-32">
              {exportFormats.map(format => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground first:rounded-t-lg last:rounded-b-lg flex items-center gap-2"
                >
                  <Icon name={format === 'csv' ? 'FileText' : 'FileCode'} size={14} />
                  Export {format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import Button */}
      {showImport && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            iconName="Upload"
            iconPosition="left"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept={importFormats.map(f => `.${f}`).join(',')}
            onChange={handleImport}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default ImportExport;
