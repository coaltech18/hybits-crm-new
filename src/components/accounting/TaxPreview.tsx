// ===================================================================
// HYBITS CRM — Tax Preview Component
// Live preview of tax calculations for invoice creation
// ===================================================================

import React from 'react';
import { calculateInvoiceFromLines, LineTaxInput, InvoiceTaxResult } from '@/lib/invoiceTax';

interface TaxPreviewProps {
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    gst_rate: number;
    hsn_code?: string;
  }>;
  outletState?: string;
  customerState?: string;
  invoiceRegion?: 'DOMESTIC' | 'SEZ' | 'EXPORT';
  className?: string;
}

const TaxPreview: React.FC<TaxPreviewProps> = ({
  items,
  outletState,
  customerState,
  invoiceRegion = 'DOMESTIC',
  className = ''
}) => {
  // Convert items to tax calculation format
  const taxLines: LineTaxInput[] = items
    .filter(item => item.quantity > 0 && item.rate >= 0)
    .map(item => ({
      qty: item.quantity,
      rate: item.rate,
      gstRate: item.gst_rate,
      outletState,
      customerState,
      invoiceRegion
    }));

  // Calculate tax totals
  const taxResult: InvoiceTaxResult = calculateInvoiceFromLines(
    taxLines,
    invoiceRegion,
    outletState,
    customerState
  );

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isInterState = outletState && customerState && outletState !== customerState;
  const isSezOrExport = invoiceRegion === 'SEZ' || invoiceRegion === 'EXPORT';

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Tax Preview
      </h3>
      
      {items.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Add items to see tax calculation
        </p>
      ) : (
        <div className="space-y-2">
          {/* Per-line breakdown */}
          <div className="space-y-1">
            {taxResult.breakdown.map((line, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
                  {items[index]?.description || `Item ${index + 1}`}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {formatCurrency(line.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <hr className="border-gray-200 dark:border-gray-600" />

          {/* Tax breakdown */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Taxable Value:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {formatCurrency(taxResult.taxable_value)}
              </span>
            </div>

            {!isSezOrExport && (
              <>
                {isInterState ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">IGST:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatCurrency(taxResult.igst)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">CGST:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatCurrency(taxResult.cgst)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">SGST:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatCurrency(taxResult.sgst)}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}

            <hr className="border-gray-200 dark:border-gray-600" />

            <div className="flex justify-between text-base font-semibold">
              <span className="text-gray-900 dark:text-gray-100">Total Amount:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {formatCurrency(taxResult.total_amount)}
              </span>
            </div>
          </div>

          {/* Tax info */}
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {isSezOrExport ? (
              <p>No GST applicable for {invoiceRegion} transactions</p>
            ) : isInterState ? (
              <p>Inter-state transaction: IGST applicable</p>
            ) : (
              <p>Intra-state transaction: CGST + SGST applicable</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxPreview;
