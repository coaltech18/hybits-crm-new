// Import/Export utility functions for CSV, JSON, and Excel files

interface ColumnDefinition {
  key: string;
  label: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Convert data to CSV format
 * @param data - Array of objects to convert
 * @param columns - Array of column definitions {key, label}
 * @returns CSV string
 */
export const convertToCSV = (data: any[], columns: ColumnDefinition[]): string => {
  if (!data || data.length === 0) return '';
  
  // Get headers
  const headers = columns.map(col => col.label || col.key).join(',');
  
  // Get data rows
  const rows = data.map(item => 
    columns.map(col => {
      let value = item[col.key];
      // Handle nested objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      }
      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join('; ');
      }
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',')
  );
  
  return [headers, ...rows].join('\n');
};

/**
 * Convert data to JSON format
 * @param data - Array of objects to convert
 * @returns JSON string
 */
export const convertToJSON = (data: any[]): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Download file with given content and filename
 * @param content - File content
 * @param filename - Name of the file
 * @param mimeType - MIME type of the file
 */
export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain'): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to CSV file
 * @param data - Data to export
 * @param columns - Column definitions
 * @param filename - Export filename
 */
export const exportToCSV = (data: any[], columns: ColumnDefinition[], filename: string = 'export.csv'): void => {
  const csv = convertToCSV(data, columns);
  downloadFile(csv, filename, 'text/csv');
};

/**
 * Export data to JSON file
 * @param data - Data to export
 * @param filename - Export filename
 */
export const exportToJSON = (data: any[], filename: string = 'export.json'): void => {
  const json = convertToJSON(data);
  downloadFile(json, filename, 'application/json');
};

/**
 * Parse CSV content
 * @param csv - CSV string content
 * @returns Parsed data array
 */
export const parseCSV = (csv: string): any[] => {
  const lines = csv.split('\n');
  const headers = lines[0]?.split(',')?.map(h => h.trim().replace(/"/g, '')) || [];
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj: {[key: string]: any} = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
};

/**
 * Parse JSON content
 * @param json - JSON string content
 * @returns Parsed data array
 */
export const parseJSON = (json: string): any[] => {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return [];
  }
};

/**
 * Read file content
 * @param file - File object
 * @returns Promise with file content
 */
export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

/**
 * Handle file import
 * @param file - File to import
 * @param type - Expected file type ('csv' or 'json')
 * @returns Promise with parsed data
 */
export const importFile = async (file: File, type: 'csv' | 'json' = 'csv'): Promise<any[]> => {
  try {
    const content = await readFileContent(file);
    
    if (type === 'csv') {
      return parseCSV(content);
    } else if (type === 'json') {
      return parseJSON(content);
    }
    
    throw new Error(`Unsupported file type: ${type}`);
  } catch (error) {
    console.error('Error importing file:', error);
    throw error;
  }
};

/**
 * Validate imported data structure
 * @param data - Imported data
 * @param requiredFields - Required field names
 * @returns Validation result {isValid, errors}
 */
export const validateImportData = (data: any[], requiredFields: string[] = []): ValidationResult => {
  const errors: string[] = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { isValid: false, errors };
  }
  
  if (data.length === 0) {
    errors.push('No data found in file');
    return { isValid: false, errors };
  }
  
  // Check required fields
  requiredFields.forEach(field => {
    const hasField = data.every(item => item.hasOwnProperty(field));
    if (!hasField) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get export filename based on data type and current date
 * @param dataType - Type of data (customers, orders, inventory, etc.)
 * @param format - File format (csv, json)
 * @returns Generated filename
 */
export const generateExportFilename = (dataType: string, format: 'csv' | 'json' = 'csv'): string => {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${dataType}_export_${date}.${format}`;
};

/**
 * Common column definitions for different data types
 */
export const columnDefinitions: {[key: string]: ColumnDefinition[]} = {
  customers: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Customer Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'company', label: 'Company' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created Date' }
  ],
  
  orders: [
    { key: 'id', label: 'Order ID' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'event_date', label: 'Event Date' },
    { key: 'status', label: 'Status' },
    { key: 'total_amount', label: 'Total Amount' },
    { key: 'payment_status', label: 'Payment Status' },
    { key: 'created_at', label: 'Created Date' }
  ],
  
  inventory: [
    { key: 'id', label: 'ID' },
    { key: 'item_code', label: 'Item Code' },
    { key: 'name', label: 'Item Name' },
    { key: 'category', label: 'Category' },
    { key: 'current_stock', label: 'Current Stock' },
    { key: 'reorder_point', label: 'Reorder Point' },
    { key: 'unit_price', label: 'Unit Price' },
    { key: 'condition', label: 'Condition' }
  ],
  
  invoices: [
    { key: 'id', label: 'Invoice ID' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_date', label: 'Invoice Date' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'total_amount', label: 'Total Amount' },
    { key: 'status', label: 'Status' },
    { key: 'gst_amount', label: 'GST Amount' }
  ]
};
