// ===================================================================
// HYBITS CRM — Tax Export Helper Tests
// Tests for tax export and reporting utilities
// ===================================================================

import { describe, it, expect } from 'vitest';
import {
  convertInvoiceToExportRows,
  convertInvoicesToExportRows,
  generateTaxExportCsv,
  generateTaxSummary,
  TaxExportRow
} from '../taxExportHelper';
import { Invoice } from '@/services/invoiceService';

describe('Tax Export Helper', () => {
  const mockInvoice: Invoice = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    invoice_number: 'INV-2024-001',
    customer_id: 'cust-123',
    customer_name: 'Test Customer',
    invoice_date: '2024-01-15',
    due_date: '2024-02-15',
    subtotal: 10000,
    taxable_value: 10000,
    cgst: 900,
    sgst: 900,
    igst: 0,
    total_gst: 1800,
    total_amount: 11800,
    payment_status: 'pending',
    payment_received: 0,
    notes: '',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    items: [
      {
        description: 'Web Development Service',
        quantity: 1,
        rate: 10000,
        gst_rate: 18,
        hsn_code: '998314'
      }
    ]
  };

  describe('convertInvoiceToExportRows', () => {
    it('should convert single item invoice to export row', () => {
      const rows = convertInvoiceToExportRows(mockInvoice, '29ABCDE1234F1Z5');

      expect(rows).toHaveLength(1);
      
      const row = rows[0];
      expect(row.invoice_number).toBe('INV-2024-001');
      expect(row.invoice_date).toBe('15/01/2024');
      expect(row.customer_name).toBe('Test Customer');
      expect(row.customer_gstin).toBe('29ABCDE1234F1Z5');
      expect(row.item_description).toBe('Web Development Service');
      expect(row.hsn_code).toBe('998314');
      expect(row.quantity).toBe(1);
      expect(row.rate).toBe(10000);
      expect(row.taxable_value).toBe(10000);
      expect(row.gst_rate).toBe(18);
      expect(row.cgst).toBe(900);
      expect(row.sgst).toBe(900);
      expect(row.igst).toBe(0);
      expect(row.total_amount).toBe(11800);
    });

    it('should handle multiple items with proportional tax distribution', () => {
      const multiItemInvoice: Invoice = {
        ...mockInvoice,
        taxable_value: 15000,
        cgst: 1350,
        sgst: 1350,
        igst: 0,
        total_gst: 2700,
        total_amount: 17700,
        items: [
          {
            description: 'Service A',
            quantity: 1,
            rate: 10000,
            gst_rate: 18,
            hsn_code: '998314'
          },
          {
            description: 'Service B',
            quantity: 1,
            rate: 5000,
            gst_rate: 18,
            hsn_code: '998315'
          }
        ]
      };

      const rows = convertInvoiceToExportRows(multiItemInvoice);

      expect(rows).toHaveLength(2);
      
      // First item (10000/15000 = 2/3 of total)
      expect(rows[0].taxable_value).toBe(10000);
      expect(rows[0].cgst).toBe(900); // 1350 * (10000/15000)
      expect(rows[0].sgst).toBe(900);
      
      // Second item (5000/15000 = 1/3 of total)
      expect(rows[1].taxable_value).toBe(5000);
      expect(rows[1].cgst).toBe(450); // 1350 * (5000/15000)
      expect(rows[1].sgst).toBe(450);
    });

    it('should handle invoice without items', () => {
      const emptyInvoice: Invoice = {
        ...mockInvoice,
        items: []
      };

      const rows = convertInvoiceToExportRows(emptyInvoice);
      expect(rows).toHaveLength(0);
    });

    it('should handle missing HSN codes', () => {
      const invoiceWithoutHsn: Invoice = {
        ...mockInvoice,
        items: [
          {
            description: 'Service without HSN',
            quantity: 1,
            rate: 10000,
            gst_rate: 18
            // hsn_code is undefined
          }
        ]
      };

      const rows = convertInvoiceToExportRows(invoiceWithoutHsn);
      expect(rows[0].hsn_code).toBeUndefined();
    });

    it('should format date correctly', () => {
      const rows = convertInvoiceToExportRows(mockInvoice);
      expect(rows[0].invoice_date).toBe('15/01/2024');
    });
  });

  describe('convertInvoicesToExportRows', () => {
    it('should convert multiple invoices to export rows', () => {
      const invoice2: Invoice = {
        ...mockInvoice,
        id: '456',
        invoice_number: 'INV-2024-002',
        customer_id: 'cust-456',
        customer_name: 'Another Customer'
      };

      const customerGstinMap = new Map([
        ['cust-123', '29ABCDE1234F1Z5'],
        ['cust-456', '27ABCDE1234F1Z5']
      ]);

      const rows = convertInvoicesToExportRows([mockInvoice, invoice2], customerGstinMap);

      expect(rows).toHaveLength(2);
      expect(rows[0].customer_gstin).toBe('29ABCDE1234F1Z5');
      expect(rows[1].customer_gstin).toBe('27ABCDE1234F1Z5');
    });
  });

  describe('generateTaxExportCsv', () => {
    it('should generate CSV with proper headers and data', () => {
      const rows: TaxExportRow[] = [
        {
          invoice_number: 'INV-001',
          invoice_date: '15/01/2024',
          customer_name: 'Test Customer',
          customer_gstin: '29ABCDE1234F1Z5',
          item_description: 'Test Service',
          hsn_code: '998314',
          quantity: 1,
          rate: 10000,
          taxable_value: 10000,
          gst_rate: 18,
          cgst: 900,
          sgst: 900,
          igst: 0,
          total_amount: 11800
        }
      ];

      const csv = generateTaxExportCsv(rows);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Invoice Number');
      expect(lines[0]).toContain('Customer GSTIN');
      expect(lines[0]).toContain('HSN/SAC Code');
      
      expect(lines[1]).toContain('"INV-001"');
      expect(lines[1]).toContain('"29ABCDE1234F1Z5"');
      expect(lines[1]).toContain('10000.00');
      expect(lines[1]).toContain('18.00');
    });

    it('should handle empty GSTIN and HSN codes', () => {
      const rows: TaxExportRow[] = [
        {
          invoice_number: 'INV-001',
          invoice_date: '15/01/2024',
          customer_name: 'Test Customer',
          item_description: 'Test Service',
          quantity: 1,
          rate: 10000,
          taxable_value: 10000,
          gst_rate: 18,
          cgst: 900,
          sgst: 900,
          igst: 0,
          total_amount: 11800
        }
      ];

      const csv = generateTaxExportCsv(rows);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('""'); // Empty GSTIN
      expect(lines[1]).toContain('""'); // Empty HSN
    });
  });

  describe('generateTaxSummary', () => {
    it('should generate correct summary statistics', () => {
      const rows: TaxExportRow[] = [
        {
          invoice_number: 'INV-001',
          invoice_date: '15/01/2024',
          customer_name: 'Customer 1',
          item_description: 'Service A',
          hsn_code: '998314',
          quantity: 1,
          rate: 10000,
          taxable_value: 10000,
          gst_rate: 18,
          cgst: 900,
          sgst: 900,
          igst: 0,
          total_amount: 11800
        },
        {
          invoice_number: 'INV-002',
          invoice_date: '16/01/2024',
          customer_name: 'Customer 2',
          item_description: 'Service B',
          hsn_code: '998315',
          quantity: 1,
          rate: 5000,
          gst_rate: 12,
          cgst: 300,
          sgst: 300,
          igst: 0,
          total_amount: 5600
        }
      ];

      const summary = generateTaxSummary(rows);

      expect(summary.totalInvoices).toBe(2);
      expect(summary.totalItems).toBe(2);
      expect(summary.totalTaxableValue).toBe(15000);
      expect(summary.totalCgst).toBe(1200);
      expect(summary.totalSgst).toBe(1200);
      expect(summary.totalIgst).toBe(0);
      expect(summary.totalAmount).toBe(17400);

      // GST rate breakdown
      expect(summary.gstRateBreakdown.has(18)).toBe(true);
      expect(summary.gstRateBreakdown.has(12)).toBe(true);
      expect(summary.gstRateBreakdown.get(18)?.count).toBe(1);
      expect(summary.gstRateBreakdown.get(18)?.taxableValue).toBe(10000);
      expect(summary.gstRateBreakdown.get(18)?.taxAmount).toBe(1800);

      // HSN breakdown
      expect(summary.hsnBreakdown.has('998314')).toBe(true);
      expect(summary.hsnBreakdown.has('998315')).toBe(true);
      expect(summary.hsnBreakdown.get('998314')?.count).toBe(1);
      expect(summary.hsnBreakdown.get('998314')?.taxableValue).toBe(10000);
    });

    it('should handle missing HSN codes in summary', () => {
      const rows: TaxExportRow[] = [
        {
          invoice_number: 'INV-001',
          invoice_date: '15/01/2024',
          customer_name: 'Customer 1',
          item_description: 'Service without HSN',
          quantity: 1,
          rate: 10000,
          taxable_value: 10000,
          gst_rate: 18,
          cgst: 900,
          sgst: 900,
          igst: 0,
          total_amount: 11800
        }
      ];

      const summary = generateTaxSummary(rows);
      expect(summary.hsnBreakdown.has('No HSN')).toBe(true);
      expect(summary.hsnBreakdown.get('No HSN')?.count).toBe(1);
    });

    it('should round summary totals correctly', () => {
      const rows: TaxExportRow[] = [
        {
          invoice_number: 'INV-001',
          invoice_date: '15/01/2024',
          customer_name: 'Customer 1',
          item_description: 'Service',
          quantity: 1,
          rate: 100.33,
          taxable_value: 100.33,
          gst_rate: 18,
          cgst: 9.03,
          sgst: 9.03,
          igst: 0,
          total_amount: 118.39
        }
      ];

      const summary = generateTaxSummary(rows);
      expect(summary.totalTaxableValue).toBe(100.33);
      expect(summary.totalCgst).toBe(9.03);
      expect(summary.totalAmount).toBe(118.39);
    });
  });
});
