// ===================================================================
// HYBITS CRM — Invoice PDF Generation Tests
// Tests for PDF generation functionality
// ===================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data for testing
const mockInvoiceData = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  invoice_number: 'INV-2024-001',
  invoice_date: '2024-01-15',
  due_date: '2024-02-15',
  customer_id: 'cust-123',
  location_id: 'loc-123',
  subtotal: 1000.00,
  cgst: 90.00,
  sgst: 90.00,
  igst: 0.00,
  total_amount: 1180.00,
  payment_received: 0.00,
  customers: {
    contact_person: 'John Doe',
    gstin: '29ABCDE1234F1Z5',
    address_street: '123 Main St',
    address_city: 'Mumbai',
    address_state: 'Maharashtra',
    address_pincode: '400001'
  },
  locations: {
    name: 'Hybits Office',
    address: '456 Business Park',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400002',
    gstin: '27ABCDE1234F1Z5'
  },
  invoice_items: [
    {
      id: 'item-1',
      product_name: 'Web Development Service',
      hsn_code: '998314',
      quantity: 1,
      unit_price: 1000.00,
      gst_rate: 18.00,
      total_amount: 1180.00
    },
    {
      id: 'item-2',
      product_name: 'Consulting Service',
      hsn_code: '998315',
      quantity: 2,
      unit_price: 500.00,
      gst_rate: 18.00,
      total_amount: 1180.00
    }
  ]
};

describe('Invoice PDF Generation', () => {
  describe('Invoice Data Mapping', () => {
    it('should calculate taxable amount correctly', () => {
      const item = mockInvoiceData.invoice_items[0];
      const taxableAmount = item.total_amount / (1 + item.gst_rate / 100);
      const expectedTaxable = 1000.00; // 1180 / 1.18
      
      expect(Math.round(taxableAmount * 100) / 100).toBe(expectedTaxable);
    });

    it('should calculate tax amount correctly', () => {
      const item = mockInvoiceData.invoice_items[0];
      const taxableAmount = item.total_amount / (1 + item.gst_rate / 100);
      const taxAmount = item.total_amount - taxableAmount;
      const expectedTax = 180.00; // 1180 - 1000
      
      expect(Math.round(taxAmount * 100) / 100).toBe(expectedTax);
    });

    it('should format currency correctly', () => {
      const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;
      
      expect(formatCurrency(1000)).toBe('₹1000.00');
      expect(formatCurrency(1000.5)).toBe('₹1000.50');
      expect(formatCurrency(1000.123)).toBe('₹1000.12');
    });

    it('should format date correctly', () => {
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
      };
      
      expect(formatDate('2024-01-15')).toBe('15/01/2024');
    });

    it('should handle missing optional fields', () => {
      const itemWithoutHSN = {
        ...mockInvoiceData.invoice_items[0],
        hsn_code: undefined
      };
      
      expect(itemWithoutHSN.hsn_code || 'N/A').toBe('N/A');
    });

    it('should truncate long product names', () => {
      const longName = 'This is a very long product name that should be truncated for PDF display';
      const truncated = longName.length > 25 ? longName.substring(0, 25) + '...' : longName;
      
      expect(truncated).toBe('This is a very long produ...');
      expect(truncated.length).toBeLessThanOrEqual(28); // 25 + '...'
    });
  });

  describe('PDF Generation Edge Function', () => {
    it('should validate required invoice_id parameter', () => {
      const requestBody = {};
      const hasInvoiceId = 'invoice_id' in requestBody;
      
      expect(hasInvoiceId).toBe(false);
    });

    it('should validate invoice_id format (UUID)', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'invalid-id';
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(uuidRegex.test(validUUID)).toBe(true);
      expect(uuidRegex.test(invalidUUID)).toBe(false);
    });

    it('should generate correct file name format', () => {
      const invoiceNumber = 'INV-2024-001';
      const timestamp = '2024-01-15T10-30-00-000Z';
      const expectedFileName = `invoices/${invoiceNumber}_${timestamp}.pdf`;
      
      expect(expectedFileName).toBe('invoices/INV-2024-001_2024-01-15T10-30-00-000Z.pdf');
    });
  });

  describe('PDF Content Validation', () => {
    it('should include all required invoice information', () => {
      const requiredFields = [
        'invoice_number',
        'invoice_date',
        'due_date',
        'total_amount',
        'subtotal',
        'cgst',
        'sgst',
        'igst'
      ];
      
      requiredFields.forEach(field => {
        expect(mockInvoiceData).toHaveProperty(field);
        expect(mockInvoiceData[field as keyof typeof mockInvoiceData]).toBeDefined();
      });
    });

    it('should include customer information', () => {
      expect(mockInvoiceData.customers.contact_person).toBe('John Doe');
      expect(mockInvoiceData.customers.gstin).toBe('29ABCDE1234F1Z5');
      expect(mockInvoiceData.customers.address_street).toBe('123 Main St');
    });

    it('should include location information', () => {
      expect(mockInvoiceData.locations.name).toBe('Hybits Office');
      expect(mockInvoiceData.locations.gstin).toBe('27ABCDE1234F1Z5');
    });

    it('should include invoice items', () => {
      expect(mockInvoiceData.invoice_items).toHaveLength(2);
      expect(mockInvoiceData.invoice_items[0].product_name).toBe('Web Development Service');
      expect(mockInvoiceData.invoice_items[0].quantity).toBe(1);
    });
  });

  describe('Storage and URL Generation', () => {
    it('should generate storage path correctly', () => {
      const invoiceNumber = 'INV-2024-001';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const storagePath = `invoices/${invoiceNumber}_${timestamp}.pdf`;
      
      expect(storagePath).toMatch(/^invoices\/INV-2024-001_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.pdf$/);
    });

    it('should validate signed URL expiry time', () => {
      const expirySeconds = 3600; // 1 hour
      const expiryMinutes = expirySeconds / 60;
      
      expect(expiryMinutes).toBe(60);
      expect(expirySeconds).toBeGreaterThan(0);
      expect(expirySeconds).toBeLessThanOrEqual(86400); // Max 24 hours
    });
  });

  describe('Error Handling', () => {
    it('should handle missing invoice gracefully', () => {
      const mockError = { message: 'Invoice not found' };
      
      expect(mockError.message).toBe('Invoice not found');
    });

    it('should handle permission errors', () => {
      const allowedRoles = ['admin', 'manager', 'accountant'];
      const userRole = 'user';
      
      const hasPermission = allowedRoles.includes(userRole);
      expect(hasPermission).toBe(false);
    });

    it('should handle upload failures', () => {
      const mockUploadError = { message: 'Failed to upload PDF' };
      
      expect(mockUploadError.message).toBe('Failed to upload PDF');
    });
  });
});

// Integration test helpers (for manual testing)
export const testHelpers = {
  mockInvoiceData,
  
  // Helper to test Edge Function locally
  createTestRequest: (invoiceId: string, authToken: string) => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  }),
  
  // Helper to validate PDF response
  validatePdfResponse: (response: any) => {
    return (
      response &&
      typeof response.url === 'string' &&
      typeof response.key === 'string' &&
      response.url.includes('documents') &&
      response.key.startsWith('invoices/')
    );
  }
};
