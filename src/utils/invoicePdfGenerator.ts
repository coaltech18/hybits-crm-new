import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, InvoiceItem, ClientGstType } from '@/types';
import { roundCurrency } from '@/utils/format';

// ================================================================
// INVOICE PDF GENERATOR
// ================================================================
// Generates GST-compliant invoices matching legal requirements.
// All data comes directly from database (no recalculation).
// Supports dynamic currency based on outlet settings.
// ================================================================

interface CompanyDetails {
    name: string;
    address: string;
    gstin: string;
    phone: string;
    email: string;
    currency?: string; // Optional: defaults to INR
}

interface InvoicePDFData {
    invoice: Invoice;
    companyDetails: CompanyDetails;
}

/**
 * Currency configuration for PDF formatting
 * 
 * NOTE: jsPDF's default fonts (Helvetica, Courier, Times) only support Latin-1 characters.
 * Unicode symbols like ₹ are NOT supported, causing broken rendering.
 * Solution: Use text prefixes which are universally supported.
 */
const PDF_CURRENCY_CONFIG: Record<string, { prefix: string; locale: string }> = {
    INR: { prefix: 'Rs.', locale: 'en-IN' },  // Use "Rs." instead of ₹
    USD: { prefix: '$', locale: 'en-US' },
    EUR: { prefix: 'EUR', locale: 'de-DE' }, // € not supported in PDF, use EUR
    GBP: { prefix: 'GBP', locale: 'en-GB' }, // £ may not render, use GBP
    AED: { prefix: 'AED', locale: 'ar-AE' },
    SGD: { prefix: 'S$', locale: 'en-SG' },
};

/**
 * Format currency for PDF display with dynamic currency support
 * 
 * @param amount - The amount to format
 * @param currencyCode - ISO 4217 currency code (default: INR)
 * @returns Formatted currency string (e.g., "Rs. 1,234.56" or "$ 1,234.56")
 */
function formatPdfCurrency(amount: number, currencyCode: string = 'INR'): string {
    const config = PDF_CURRENCY_CONFIG[currencyCode] || PDF_CURRENCY_CONFIG.INR;

    // Format number with appropriate locale
    const formattedNumber = new Intl.NumberFormat(config.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

    return `${config.prefix} ${formattedNumber}`;
}

/**
 * Format date for PDF display
 */
function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Get GST type display label
 */
function getGstTypeLabel(gstType: ClientGstType | null | undefined): string {
    switch (gstType) {
        case 'domestic':
            return 'Domestic (Intra-State)';
        case 'sez':
            return 'SEZ (Special Economic Zone)';
        case 'export':
            return 'Export';
        default:
            return 'Domestic (Default)';
    }
}

/**
 * Calculate GST breakup based on client GST type
 * Returns { cgst, sgst, igst } - database values (no recalculation)
 */
function calculateGstBreakup(
    taxTotal: number,
    gstType: ClientGstType | null | undefined
): { cgst: number; sgst: number; igst: number } {
    // Domestic: Split into CGST + SGST (50/50)
    // SEZ/Export: IGST only
    if (gstType === 'sez' || gstType === 'export') {
        return {
            cgst: 0,
            sgst: 0,
            igst: taxTotal,
        };
    }

    // Domestic or null (default to domestic)
    return {
        cgst: Math.round((taxTotal / 2) * 100) / 100,
        sgst: Math.round((taxTotal / 2) * 100) / 100,
        igst: 0,
    };
}

/**
 * Generate Invoice PDF
 * 
 * @param data - Invoice data from database
 * @returns PDF blob for download
 */
export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
    const { invoice, companyDetails } = data;
    const doc = new jsPDF();

    // Get currency from company details (default INR)
    const currency = companyDetails.currency || 'INR';

    // Local currency formatter using dynamic currency
    const fmtCurrency = (amount: number) => formatPdfCurrency(amount, currency);

    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // ================================================================
    // HEADER: Company Details (From)
    // ================================================================
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyDetails.name, 14, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(companyDetails.address, 14, yPos);

    yPos += 5;
    doc.text(`GSTIN: ${companyDetails.gstin}`, 14, yPos);

    yPos += 5;
    doc.text(`Phone: ${companyDetails.phone} | Email: ${companyDetails.email}`, 14, yPos);

    // ================================================================
    // INVOICE TITLE & NUMBER
    // ================================================================
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, yPos, { align: 'center' });

    // Invoice details on right side
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const invoiceDetails = [
        `Invoice No: ${invoice.invoice_number}`,
        `Date: ${formatDate(invoice.issued_at || invoice.created_at)}`,
        `Type: ${invoice.invoice_type.charAt(0).toUpperCase() + invoice.invoice_type.slice(1)}`,
    ];

    let rightY = yPos - 20;
    invoiceDetails.forEach(line => {
        rightY += 6;
        doc.text(line, pageWidth - 14, rightY, { align: 'right' });
    });

    // ================================================================
    // BILL TO: Client Details
    // ================================================================
    yPos += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPos, pageWidth - 14, yPos);

    yPos += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, yPos);

    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.clients?.name || 'N/A', 14, yPos);

    if (invoice.clients?.billing_address) {
        yPos += 5;
        // Handle multi-line address
        const addressLines = doc.splitTextToSize(invoice.clients.billing_address, 80);
        addressLines.forEach((line: string) => {
            doc.text(line, 14, yPos);
            yPos += 5;
        });
    }

    if (invoice.clients?.gstin) {
        doc.text(`GSTIN: ${invoice.clients.gstin}`, 14, yPos);
        yPos += 5;
    }

    if (invoice.clients?.phone) {
        doc.text(`Phone: ${invoice.clients.phone}`, 14, yPos);
        yPos += 5;
    }

    // GST Type
    const gstType = invoice.clients?.gst_type;
    yPos += 2;
    doc.setFont('helvetica', 'bold');
    doc.text(`GST Type: ${getGstTypeLabel(gstType)}`, 14, yPos);
    doc.setFont('helvetica', 'normal');

    // ================================================================
    // EVENT DETAILS (if event invoice)
    // ================================================================
    if (invoice.invoice_type === 'event' && invoice.events) {
        yPos += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Event Details:', 14, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`${invoice.events.event_name} - ${formatDate(invoice.events.event_date)}`, 14, yPos);
        yPos += 5;
    }

    // ================================================================
    // LINE ITEMS TABLE
    // ================================================================
    yPos += 10;

    const items: InvoiceItem[] = invoice.invoice_items || [];
    const tableData = items.map((item, index) => [
        (index + 1).toString(),
        item.description,
        item.quantity.toString(),
        fmtCurrency(item.unit_price),
        fmtCurrency(item.line_total),
        `${item.tax_rate}%`,
        fmtCurrency(item.tax_amount),
        fmtCurrency(roundCurrency(item.line_total + item.tax_amount)),
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [['#', 'Description', 'Qty', 'Rate', 'Amount', 'Tax %', 'Tax', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [60, 60, 60],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 50 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 22 },
            4: { halign: 'right', cellWidth: 22 },
            5: { halign: 'center', cellWidth: 18 },
            6: { halign: 'right', cellWidth: 22 },
            7: { halign: 'right', cellWidth: 25 },
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        margin: { left: 14, right: 14 },
    });

    // Get Y position after table
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ================================================================
    // TOTALS SECTION
    // ================================================================
    const totalsStartX = pageWidth - 80;
    const totalsValueX = pageWidth - 14;

    // Calculate GST breakup
    const gstBreakup = calculateGstBreakup(invoice.tax_total, gstType);

    // Subtotal
    doc.setFontSize(10);
    doc.text('Subtotal:', totalsStartX, yPos);
    doc.text(fmtCurrency(invoice.subtotal), totalsValueX, yPos, { align: 'right' });

    // GST Breakup
    yPos += 6;
    if (gstBreakup.igst > 0) {
        // IGST for SEZ/Export
        doc.text('IGST:', totalsStartX, yPos);
        doc.text(fmtCurrency(gstBreakup.igst), totalsValueX, yPos, { align: 'right' });
    } else {
        // CGST + SGST for Domestic
        doc.text('CGST:', totalsStartX, yPos);
        doc.text(fmtCurrency(gstBreakup.cgst), totalsValueX, yPos, { align: 'right' });

        yPos += 6;
        doc.text('SGST:', totalsStartX, yPos);
        doc.text(fmtCurrency(gstBreakup.sgst), totalsValueX, yPos, { align: 'right' });
    }

    // Total Tax
    yPos += 6;
    doc.text('Total Tax:', totalsStartX, yPos);
    doc.text(fmtCurrency(invoice.tax_total), totalsValueX, yPos, { align: 'right' });

    // Grand Total
    yPos += 8;
    doc.setDrawColor(0, 0, 0);
    doc.line(totalsStartX - 5, yPos - 2, totalsValueX, yPos - 2);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', totalsStartX, yPos + 5);
    doc.text(fmtCurrency(invoice.grand_total), totalsValueX, yPos + 5, { align: 'right' });

    // ================================================================
    // FOOTER
    // ================================================================
    yPos += 25;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('This is a system generated invoice.', 14, yPos);

    yPos += 5;
    doc.text('No signature required.', 14, yPos);

    return doc;
}

/**
 * Download invoice as PDF
 * 
 * @param invoice - Full invoice object from database
 */
export function downloadInvoicePDF(invoice: Invoice): void {
    // Build company details from outlet
    const companyDetails: CompanyDetails = {
        name: invoice.outlets?.name || 'Company Name',
        address: [
            invoice.outlets?.address,
            invoice.outlets?.city,
            invoice.outlets?.state,
            invoice.outlets?.pincode,
        ].filter(Boolean).join(', ') || 'Address not available',
        gstin: invoice.outlets?.gstin || 'GSTIN not available',
        phone: invoice.outlets?.phone || '-',
        email: invoice.outlets?.email || '-',
        // Dynamic currency from outlet, default INR
        currency: invoice.outlets?.currency || 'INR',
    };

    const doc = generateInvoicePDF({ invoice, companyDetails });

    // Download the PDF
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
}
