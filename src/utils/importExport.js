// Import/Export utility functions for CSV, JSON, and Excel files

/**
 * Convert data to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Array of column definitions {key, label}
 * @returns {string} CSV string
 */
export const convertToCSV = (data, columns) => {
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
 * @param {Array} data - Array of objects to convert
 * @returns {string} JSON string
 */
export const convertToJSON = (data) => {
  return JSON.stringify(data, null, 2);
};

/**
 * Download file with given content and filename
 * @param {string} content - File content
 * @param {string} filename - Name of the file
 * @param {string} mimeType - MIME type of the file
 */
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
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
 * @param {Array} data - Data to export
 * @param {Array} columns - Column definitions
 * @param {string} filename - Export filename
 */
export const exportToCSV = (data, columns, filename = 'export.csv') => {
  const csv = convertToCSV(data, columns);
  downloadFile(csv, filename, 'text/csv');
};

/**
 * Export data to JSON file
 * @param {Array} data - Data to export
 * @param {string} filename - Export filename
 */
export const exportToJSON = (data, filename = 'export.json') => {
  const json = convertToJSON(data);
  downloadFile(json, filename, 'application/json');
};

/**
 * Parse CSV content
 * @param {string} csv - CSV string content
 * @returns {Array} Parsed data array
 */
export const parseCSV = (csv) => {
  const lines = csv.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
};

/**
 * Parse JSON content
 * @param {string} json - JSON string content
 * @returns {Array} Parsed data array
 */
export const parseJSON = (json) => {
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
 * @param {File} file - File object
 * @returns {Promise<string>} File content
 */
export const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

/**
 * Handle file import
 * @param {File} file - File to import
 * @param {string} type - Expected file type ('csv' or 'json')
 * @returns {Promise<Array>} Parsed data
 */
export const importFile = async (file, type = 'csv') => {
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
 * @param {Array} data - Imported data
 * @param {Array} requiredFields - Required field names
 * @returns {Object} Validation result {isValid, errors}
 */
export const validateImportData = (data, requiredFields = []) => {
  const errors = [];
  
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
 * @param {string} dataType - Type of data (customers, orders, inventory, etc.)
 * @param {string} format - File format (csv, json)
 * @returns {string} Generated filename
 */
export const generateExportFilename = (dataType, format = 'csv') => {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${dataType}_export_${date}.${format}`;
};

/**
 * Common column definitions for different data types
 */
export const columnDefinitions = {
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
