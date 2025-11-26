// ===================================================================
// HYBITS CRM — Invoice Tax Calculation Tests
// Comprehensive tests for GST tax calculation engine
// ===================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateLineTax,
  calculateInvoiceFromLines,
  validateGstRate,
  roundToTwoDecimals,
  getGstRateDisplayName,
  determineInvoiceRegion,
  ALLOWED_GST_RATES,
  LineTaxInput
} from '../invoiceTax';

describe('Invoice Tax Calculation Engine', () => {
  describe('roundToTwoDecimals', () => {
    it('should round numbers to 2 decimal places', () => {
      expect(roundToTwoDecimals(10.123)).toBe(10.12);
      expect(roundToTwoDecimals(10.125)).toBe(10.13); // Banker's rounding
      expect(roundToTwoDecimals(10.126)).toBe(10.13);
      expect(roundToTwoDecimals(10)).toBe(10);
      expect(roundToTwoDecimals(10.1)).toBe(10.1);
    });

    it('should handle edge cases', () => {
      expect(roundToTwoDecimals(0)).toBe(0);
      expect(roundToTwoDecimals(0.001)).toBe(0);
      expect(roundToTwoDecimals(0.999)).toBe(1);
    });
  });

  describe('validateGstRate', () => {
    it('should validate standard GST rates', () => {
      for (const rate of ALLOWED_GST_RATES) {
        const result = validateGstRate(rate);
        expect(result.isValid).toBe(true);
        expect(result.isStandard).toBe(true);
        expect(result.message).toBeUndefined();
      }
    });

    it('should accept custom valid rates', () => {
      const result = validateGstRate(15);
      expect(result.isValid).toBe(true);
      expect(result.isStandard).toBe(false);
      expect(result.message).toContain('Non-standard GST rate');
    });

    it('should reject invalid rates', () => {
      expect(validateGstRate(-1).isValid).toBe(false);
      expect(validateGstRate(101).isValid).toBe(false);
      expect(validateGstRate(-1).message).toContain('between 0 and 100');
    });
  });

  describe('calculateLineTax', () => {
    it('should calculate domestic intra-state tax (CGST + SGST)', () => {
      const input: LineTaxInput = {
        qty: 1,
        rate: 10000,
        gstRate: 18,
        outletState: 'Karnataka',
        customerState: 'Karnataka'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(10000);
      expect(result.taxAmount).toBe(1800);
      expect(result.cgst).toBe(900);
      expect(result.sgst).toBe(900);
      expect(result.igst).toBe(0);
      expect(result.lineTotal).toBe(11800);
    });

    it('should calculate domestic inter-state tax (IGST)', () => {
      const input: LineTaxInput = {
        qty: 1,
        rate: 10000,
        gstRate: 18,
        outletState: 'Karnataka',
        customerState: 'Maharashtra'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(10000);
      expect(result.taxAmount).toBe(1800);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(1800);
      expect(result.lineTotal).toBe(11800);
    });

    it('should handle SEZ transactions (no tax)', () => {
      const input: LineTaxInput = {
        qty: 1,
        rate: 10000,
        gstRate: 18,
        invoiceRegion: 'SEZ',
        outletState: 'Karnataka',
        customerState: 'Karnataka'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(10000);
      expect(result.taxAmount).toBe(0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.lineTotal).toBe(10000);
    });

    it('should handle export transactions (no tax)', () => {
      const input: LineTaxInput = {
        qty: 1,
        rate: 10000,
        gstRate: 18,
        invoiceRegion: 'EXPORT'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(10000);
      expect(result.taxAmount).toBe(0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.lineTotal).toBe(10000);
    });

    it('should handle zero GST rate', () => {
      const input: LineTaxInput = {
        qty: 1,
        rate: 10000,
        gstRate: 0,
        outletState: 'Karnataka',
        customerState: 'Karnataka'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(10000);
      expect(result.taxAmount).toBe(0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.lineTotal).toBe(10000);
    });

    it('should handle fractional quantities and rates', () => {
      const input: LineTaxInput = {
        qty: 2.5,
        rate: 123.45,
        gstRate: 12,
        outletState: 'Karnataka',
        customerState: 'Karnataka'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(308.63); // 2.5 * 123.45 = 308.625 → 308.63
      expect(result.taxAmount).toBe(37.04); // 308.63 * 0.12 = 37.0356 → 37.04
      expect(result.cgst).toBe(18.52); // 37.04 / 2 = 18.52
      expect(result.sgst).toBe(18.52); // 37.04 / 2 = 18.52
      expect(result.igst).toBe(0);
      expect(result.lineTotal).toBe(345.67); // 308.63 + 37.04
    });

    it('should handle odd cent distribution in CGST/SGST split', () => {
      const input: LineTaxInput = {
        qty: 1,
        rate: 100,
        gstRate: 18,
        outletState: 'Karnataka',
        customerState: 'Karnataka'
      };

      const result = calculateLineTax(input);

      expect(result.taxable).toBe(100);
      expect(result.taxAmount).toBe(18);
      expect(result.cgst).toBe(9);
      expect(result.sgst).toBe(9);
      expect(result.cgst + result.sgst).toBe(result.taxAmount);
    });

    it('should throw error for negative inputs', () => {
      expect(() => calculateLineTax({ qty: -1, rate: 100, gstRate: 18 }))
        .toThrow('must be non-negative');
      
      expect(() => calculateLineTax({ qty: 1, rate: -100, gstRate: 18 }))
        .toThrow('must be non-negative');
      
      expect(() => calculateLineTax({ qty: 1, rate: 100, gstRate: -18 }))
        .toThrow('must be non-negative');
    });
  });

  describe('calculateInvoiceFromLines', () => {
    it('should calculate totals for multiple lines with same GST rate', () => {
      const lines: LineTaxInput[] = [
        { qty: 1, rate: 5000, gstRate: 18 },
        { qty: 2, rate: 2500, gstRate: 18 }
      ];

      const result = calculateInvoiceFromLines(lines, 'DOMESTIC', 'Karnataka', 'Karnataka');

      expect(result.taxable_value).toBe(10000); // 5000 + 5000
      expect(result.cgst).toBe(900); // (900 + 450) + (900 + 450) = 1800 / 2
      expect(result.sgst).toBe(900);
      expect(result.igst).toBe(0);
      expect(result.total_amount).toBe(11800);
      expect(result.breakdown).toHaveLength(2);
    });

    it('should calculate totals for mixed GST rates', () => {
      const lines: LineTaxInput[] = [
        { qty: 1, rate: 10000, gstRate: 18 }, // 10000 + 1800 = 11800
        { qty: 1, rate: 5000, gstRate: 5 },   // 5000 + 250 = 5250
        { qty: 1, rate: 2000, gstRate: 0 }    // 2000 + 0 = 2000
      ];

      const result = calculateInvoiceFromLines(lines, 'DOMESTIC', 'Karnataka', 'Karnataka');

      expect(result.taxable_value).toBe(17000);
      expect(result.cgst).toBe(1025); // (900 + 125 + 0)
      expect(result.sgst).toBe(1025); // (900 + 125 + 0)
      expect(result.igst).toBe(0);
      expect(result.total_amount).toBe(19050);
    });

    it('should handle inter-state transactions', () => {
      const lines: LineTaxInput[] = [
        { qty: 1, rate: 10000, gstRate: 18 }
      ];

      const result = calculateInvoiceFromLines(lines, 'DOMESTIC', 'Karnataka', 'Maharashtra');

      expect(result.taxable_value).toBe(10000);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(1800);
      expect(result.total_amount).toBe(11800);
    });

    it('should handle empty lines array', () => {
      const result = calculateInvoiceFromLines([]);

      expect(result.taxable_value).toBe(0);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.total_amount).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should handle SEZ transactions for all lines', () => {
      const lines: LineTaxInput[] = [
        { qty: 1, rate: 10000, gstRate: 18 },
        { qty: 1, rate: 5000, gstRate: 12 }
      ];

      const result = calculateInvoiceFromLines(lines, 'SEZ', 'Karnataka', 'Karnataka');

      expect(result.taxable_value).toBe(15000);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.total_amount).toBe(15000);
    });
  });

  describe('getGstRateDisplayName', () => {
    it('should return correct display names for standard rates', () => {
      expect(getGstRateDisplayName(0)).toBe('0% (Exempt)');
      expect(getGstRateDisplayName(0.25)).toBe('0.25% (Precious metals)');
      expect(getGstRateDisplayName(3)).toBe('3% (Gold/Silver)');
      expect(getGstRateDisplayName(5)).toBe('5% (Essential goods)');
      expect(getGstRateDisplayName(12)).toBe('12% (Standard)');
      expect(getGstRateDisplayName(18)).toBe('18% (Standard)');
      expect(getGstRateDisplayName(28)).toBe('28% (Luxury)');
    });

    it('should return custom rate display for non-standard rates', () => {
      expect(getGstRateDisplayName(15)).toBe('15% (Custom)');
      expect(getGstRateDisplayName(7.5)).toBe('7.5% (Custom)');
    });
  });

  describe('determineInvoiceRegion', () => {
    it('should determine SEZ for SEZ customers', () => {
      const region = determineInvoiceRegion('29ABCDE1234F1Z5', 'Karnataka', 'Maharashtra', true);
      expect(region).toBe('SEZ');
    });

    it('should determine EXPORT for customers without GSTIN in different state', () => {
      const region = determineInvoiceRegion(undefined, 'Karnataka', 'Maharashtra', false);
      expect(region).toBe('EXPORT');
    });

    it('should determine DOMESTIC for customers with GSTIN', () => {
      const region = determineInvoiceRegion('29ABCDE1234F1Z5', 'Karnataka', 'Maharashtra', false);
      expect(region).toBe('DOMESTIC');
    });

    it('should determine DOMESTIC for same state customers', () => {
      const region = determineInvoiceRegion(undefined, 'Karnataka', 'Karnataka', false);
      expect(region).toBe('DOMESTIC');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical software services invoice (Karnataka to Karnataka)', () => {
      const lines: LineTaxInput[] = [
        { qty: 1, rate: 50000, gstRate: 18, outletState: 'Karnataka', customerState: 'Karnataka' },
        { qty: 1, rate: 25000, gstRate: 18, outletState: 'Karnataka', customerState: 'Karnataka' }
      ];

      const result = calculateInvoiceFromLines(lines, 'DOMESTIC', 'Karnataka', 'Karnataka');

      expect(result.taxable_value).toBe(75000);
      expect(result.cgst).toBe(6750); // 75000 * 0.18 / 2
      expect(result.sgst).toBe(6750); // 75000 * 0.18 / 2
      expect(result.igst).toBe(0);
      expect(result.total_amount).toBe(88500);
    });

    it('should handle mixed rate retail invoice (Karnataka to Maharashtra)', () => {
      const lines: LineTaxInput[] = [
        { qty: 2, rate: 1000, gstRate: 5, outletState: 'Karnataka', customerState: 'Maharashtra' },   // Essential goods
        { qty: 1, rate: 5000, gstRate: 18, outletState: 'Karnataka', customerState: 'Maharashtra' },  // Electronics
        { qty: 1, rate: 10000, gstRate: 28, outletState: 'Karnataka', customerState: 'Maharashtra' }  // Luxury item
      ];

      const result = calculateInvoiceFromLines(lines, 'DOMESTIC', 'Karnataka', 'Maharashtra');

      expect(result.taxable_value).toBe(17000); // 2000 + 5000 + 10000
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(4700); // 100 + 900 + 2800
      expect(result.total_amount).toBe(21700);
    });

    it('should handle export invoice (no GST)', () => {
      const lines: LineTaxInput[] = [
        { qty: 100, rate: 50, gstRate: 18 },
        { qty: 50, rate: 200, gstRate: 12 }
      ];

      const result = calculateInvoiceFromLines(lines, 'EXPORT');

      expect(result.taxable_value).toBe(15000); // 5000 + 10000
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
      expect(result.igst).toBe(0);
      expect(result.total_amount).toBe(15000);
    });
  });
});
