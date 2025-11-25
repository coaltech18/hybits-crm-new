// ============================================================================
// EXPORT UTILITIES
// ============================================================================

import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface ExportOptions {
  filename?: string;
  sheetName?: string;
  includeHeaders?: boolean;
  dateFormat?: string;
}

/**
 * Convert data array to CSV string
 */
export function arrayToCSV(data: any[][], options: ExportOptions = {}): string {
  const { includeHeaders = true } = options;
  
  if (!data || data.length === 0) {
    return '';
  }

  const rows: string[] = [];
  
  data.forEach((row, index) => {
    // Skip header row if includeHeaders is false and it's the first row
    if (index === 0 && !includeHeaders && row.every(cell => typeof cell === 'string')) {
      return;
    }
    
    const csvRow = row.map(cell => {
      if (cell === null || cell === undefined) {
        return '';
      }
      
      // Convert dates
      if (cell instanceof Date) {
        return cell.toLocaleDateString('en-IN');
      }
      
      const cellStr = String(cell);
      
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      
      return cellStr;
    });
    
    rows.push(csvRow.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(data: any[][], options: ExportOptions = {}): void {
  const { filename = 'export.csv', includeHeaders = true } = options;
  
  const csvContent = arrayToCSV(data, { includeHeaders });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download Excel file
 */
export function downloadExcel(
  data: any[][],
  options: ExportOptions = {}
): void {
  const { filename = 'export.xlsx', sheetName = 'Sheet1' } = options;
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths (auto-width for first 10 columns)
  const colWidths = data[0]?.map((_, colIndex) => {
    const maxLength = Math.max(
      ...data.map(row => {
        const cell = row[colIndex];
        return cell ? String(cell).length : 0;
      })
    );
    return { wch: Math.min(Math.max(maxLength, 10), 50) };
  }) || [];
  
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Write file
  XLSX.writeFile(wb, filename);
}

/**
 * Download JSON file
 */
export function downloadJSON(data: any[], options: ExportOptions = {}): void {
  const { filename = 'export.json' } = options;
  
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format number for export
 */
export function formatNumberForExport(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString('en-IN');
}

/**
 * Generic export function
 */
export function exportData(
  data: any[][],
  format: ExportFormat,
  options: ExportOptions = {}
): void {
  switch (format) {
    case 'csv':
      downloadCSV(data, options);
      break;
    case 'excel':
      downloadExcel(data, options);
      break;
    case 'json':
      // For JSON, convert 2D array to array of objects
      if (data.length > 0 && data[0]) {
        const headers = data[0];
        const objects = data.slice(1).map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[String(header)] = row[index] ?? null;
          });
          return obj;
        });
        downloadJSON(objects, options);
      }
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

