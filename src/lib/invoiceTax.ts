// ===================================================================
// HYBITS CRM — Invoice Tax Calculation Engine
// Pure tax calculation functions for GST compliance
// ===================================================================

export interface LineTaxInput {
  qty: number;
  rate: number;
  gstRate: number;
  invoiceRegion?: 'DOMESTIC' | 'SEZ' | 'EXPORT';
  outletState?: string;
  customerState?: string;
}

export interface LineTaxResult {
  taxable: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
}

export interface InvoiceTaxResult {
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  breakdown: LineTaxResult[];
}

// Standard GST rates as per Indian tax law
export const ALLOWED_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

/**
 * Round to 2 decimal places using banker's rounding (round half to even)
 * This ensures consistent rounding behavior across the application
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate tax for a single invoice line item
 * Implements GST rules for domestic, inter-state, and SEZ transactions
 */
export function calculateLineTax(input: LineTaxInput): LineTaxResult {
  const { qty, rate, gstRate, invoiceRegion = 'DOMESTIC', outletState, customerState } = input;

  // Validate inputs
  if (qty < 0 || rate < 0 || gstRate < 0) {
    throw new Error('Quantity, rate, and GST rate must be non-negative');
  }

  // Calculate taxable amount
  const taxable = roundToTwoDecimals(qty * rate);

  // Handle SEZ/Export cases - no GST
  if (invoiceRegion === 'SEZ' || invoiceRegion === 'EXPORT' || gstRate === 0) {
    return {
      taxable,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      lineTotal: taxable
    };
  }

  // Calculate total tax amount
  const taxAmount = roundToTwoDecimals(taxable * gstRate / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  // Determine tax split based on state
  if (outletState && customerState && outletState !== customerState) {
    // Inter-state transaction - IGST only
    igst = taxAmount;
  } else {
    // Intra-state transaction - CGST + SGST
    // Split tax amount equally, handle odd cents by adding to CGST
    const halfTax = taxAmount / 2;
    cgst = roundToTwoDecimals(halfTax);
    sgst = roundToTwoDecimals(halfTax);
    
    // Adjust for rounding differences to ensure cgst + sgst = taxAmount
    const difference = roundToTwoDecimals(taxAmount - cgst - sgst);
    if (difference !== 0) {
      cgst = roundToTwoDecimals(cgst + difference);
    }
  }

  const lineTotal = roundToTwoDecimals(taxable + taxAmount);

  return {
    taxable,
    taxAmount,
    cgst,
    sgst,
    igst,
    lineTotal
  };
}

/**
 * Calculate total invoice tax from multiple line items
 * Aggregates line-level calculations to invoice totals
 */
export function calculateInvoiceFromLines(
  lines: LineTaxInput[],
  invoiceRegion: 'DOMESTIC' | 'SEZ' | 'EXPORT' = 'DOMESTIC',
  outletState?: string,
  customerState?: string
): InvoiceTaxResult {
  if (!lines || lines.length === 0) {
    return {
      taxable_value: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total_amount: 0,
      breakdown: []
    };
  }

  // Calculate tax for each line
  const breakdown = lines.map(line => 
    calculateLineTax({
      ...line,
      invoiceRegion,
      outletState,
      customerState
    })
  );

  // Aggregate totals
  const taxable_value = roundToTwoDecimals(
    breakdown.reduce((sum, line) => sum + line.taxable, 0)
  );

  const cgst = roundToTwoDecimals(
    breakdown.reduce((sum, line) => sum + line.cgst, 0)
  );

  const sgst = roundToTwoDecimals(
    breakdown.reduce((sum, line) => sum + line.sgst, 0)
  );

  const igst = roundToTwoDecimals(
    breakdown.reduce((sum, line) => sum + line.igst, 0)
  );

  const total_amount = roundToTwoDecimals(
    breakdown.reduce((sum, line) => sum + line.lineTotal, 0)
  );

  return {
    taxable_value,
    cgst,
    sgst,
    igst,
    total_amount,
    breakdown
  };
}

/**
 * Validate GST rate against standard rates
 * Logs warning for non-standard rates but allows them
 */
export function validateGstRate(rate: number): { isValid: boolean; isStandard: boolean; message?: string } {
  if (rate < 0 || rate > 100) {
    return {
      isValid: false,
      isStandard: false,
      message: 'GST rate must be between 0 and 100'
    };
  }

  const isStandard = ALLOWED_GST_RATES.includes(rate);
  
  if (!isStandard) {
    console.warn(`Non-standard GST rate used: ${rate}%. Standard rates are: ${ALLOWED_GST_RATES.join(', ')}`);
  }

  return {
    isValid: true,
    isStandard,
    message: isStandard ? undefined : `Non-standard GST rate: ${rate}%`
  };
}

/**
 * Get display name for GST rate
 */
export function getGstRateDisplayName(rate: number): string {
  if (rate === 0) return '0% (Exempt)';
  if (rate === 0.25) return '0.25% (Precious metals)';
  if (rate === 3) return '3% (Gold/Silver)';
  if (rate === 5) return '5% (Essential goods)';
  if (rate === 12) return '12% (Standard)';
  if (rate === 18) return '18% (Standard)';
  if (rate === 28) return '28% (Luxury)';
  return `${rate}% (Custom)`;
}

/**
 * Determine invoice region based on customer and outlet details
 */
export function determineInvoiceRegion(
  customerGstin?: string,
  outletState?: string,
  customerState?: string,
  isSezCustomer?: boolean
): 'DOMESTIC' | 'SEZ' | 'EXPORT' {
  if (isSezCustomer) return 'SEZ';
  if (!customerGstin && customerState !== outletState) return 'EXPORT';
  return 'DOMESTIC';
}
