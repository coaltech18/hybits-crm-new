import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, InvoiceItem, ClientGstType } from '@/types';
import { COMPANY_PROFILE, DEFAULT_TERMS_AND_CONDITIONS } from '@/config/companyProfile';
import { DEFAULT_HSN_CODE } from '@/config/gstConstants';

// ================================================================
// INVOICE PDF GENERATOR (INR ONLY)
// ================================================================
// Generates GST-compliant invoices matching legal requirements.
// All data comes directly from database (no recalculation).
// Currency is FIXED to INR.
// ================================================================

interface CompanyDetails {
    name: string;
    address: string;
    gstin: string;
    phone: string;
    email: string;
}

interface InvoicePDFData {
    invoice: Invoice;
    companyDetails: CompanyDetails;
}

/**
 * Format currency for PDF display (INR ONLY)
 * 
 * NOTE: jsPDF's default fonts (Helvetica, Courier, Times) only support Latin-1 characters.
 * Unicode symbols like ₹ are NOT supported, causing broken rendering.
 * Solution: Use "Rs." prefix which is universally supported.
 * 
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "Rs. 1,234.56")
 */
function formatPdfCurrency(amount: number): string {
    const formattedNumber = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

    return `Rs. ${formattedNumber}`;
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

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftX = 14;
    const rightX = pageWidth - 14;
    let y = 20;

    // ================================================================
    // HEADER: Company Details (From)
    // ================================================================
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyDetails.name, leftX, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(companyDetails.address, leftX, y);
    y += 5;

    doc.text(`GSTIN: ${companyDetails.gstin}`, leftX, y);
    y += 5;

    // Conditional contact line — never show dashes
    const contactParts = [
        companyDetails.phone && companyDetails.phone !== '-' ? `Phone: ${companyDetails.phone}` : null,
        companyDetails.email && companyDetails.email !== '-' ? `Email: ${companyDetails.email}` : null,
    ].filter(Boolean);

    if (contactParts.length > 0) {
        doc.text(contactParts.join(' | '), leftX, y);
        y += 5;
    }

    // Outlet branch reference
    if (invoice.outlets) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Outlet: ${invoice.outlets.code || ''} / ${invoice.outlets.name || ''}`, leftX, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
    }

    // ================================================================
    // INVOICE TITLE & NUMBER (right-aligned box)
    // ================================================================
    // Title centered
    y += 8;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });

    // Invoice details on right side — positioned relative to title
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const invoiceDetails = [
        `Invoice No: ${invoice.invoice_number}`,
        `Date: ${formatDate(invoice.issued_at || invoice.created_at)}`,
        `Type: ${invoice.invoice_type.charAt(0).toUpperCase() + invoice.invoice_type.slice(1)}`,
    ];

    let detailY = y - 14;
    invoiceDetails.forEach(line => {
        doc.text(line, rightX, detailY, { align: 'right' });
        detailY += 5;
    });

    // ================================================================
    // BILL TO: Client Details
    // ================================================================
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftX, y, rightX, y);

    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', leftX, y);

    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.clients?.name || 'N/A', leftX, y);
    y += 6;

    if (invoice.clients?.billing_address) {
        const addressLines = doc.splitTextToSize(invoice.clients.billing_address, 80);
        addressLines.forEach((line: string) => {
            doc.text(line, leftX, y);
            y += 5;
        });
        y += 1; // small gap after address block
    }

    if (invoice.clients?.gstin) {
        doc.text(`GSTIN: ${invoice.clients.gstin}`, leftX, y);
        y += 6;
    }

    if (invoice.clients?.phone) {
        doc.text(`Phone: ${invoice.clients.phone}`, leftX, y);
        y += 6;
    }

    // GST Type
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text(`GST Type: ${getGstTypeLabel(invoice.clients?.gst_type)}`, leftX, y);
    doc.setFont('helvetica', 'normal');
    y += 8;

    // ================================================================
    // EVENT DETAILS (if event invoice)
    // ================================================================
    if (invoice.invoice_type === 'event' && invoice.events) {
        // Separator line
        doc.setDrawColor(200, 200, 200);
        doc.line(leftX, y, rightX, y);
        y += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Event Details:', leftX, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.text(`${invoice.events.event_name} - ${formatDate(invoice.events.event_date)}`, leftX, y);
        y += 6;

        if (invoice.events.event_type) {
            doc.text(`Type: ${invoice.events.event_type}`, leftX, y);
            y += 6;
        }

        y += 4; // breathing room before table
    }

    // ================================================================
    // LINE ITEMS TABLE
    // ================================================================
    y += 4;

    const items: InvoiceItem[] = invoice.invoice_items || [];
    const tableData = items.map((item, index) => [
        (index + 1).toString(),
        DEFAULT_HSN_CODE,
        item.description,
        item.quantity.toString(),
        formatPdfCurrency(item.unit_price),
        formatPdfCurrency(item.line_total),
        `${item.tax_rate}%`,
        formatPdfCurrency(item.tax_amount),
        formatPdfCurrency(item.line_total + item.tax_amount),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['#', 'HSN', 'Description', 'Qty', 'Rate', 'Amount', 'Tax %', 'Tax', 'Total']],
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
            1: { halign: 'center', cellWidth: 14 },
            2: { cellWidth: 38 },
            3: { halign: 'center', cellWidth: 12 },
            4: { halign: 'right', cellWidth: 22 },
            5: { halign: 'right', cellWidth: 22 },
            6: { halign: 'center', cellWidth: 16 },
            7: { halign: 'right', cellWidth: 22 },
            8: { halign: 'right', cellWidth: 25 },
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        margin: { left: 14, right: 14 },
    });

    // Get Y position after table
    y = (doc as any).lastAutoTable.finalY + 10;

    // ================================================================
    // BANK DETAILS (LEFT) + TOTALS (RIGHT) — SIDE BY SIDE
    // ================================================================
    // Both sections start at the same Y-position after the items table.
    // Bank details render on the left half, totals on the right half.
    // This keeps everything on the same page and looks professional.
    // ================================================================

    // Calculate GST breakup
    const gstType = invoice.clients?.gst_type;
    const gstBreakup = calculateGstBreakup(invoice.tax_total, gstType);

    // Pre-calculate height needed for both sections
    const bank = COMPANY_PROFILE.bankDetails;
    const bankFieldCount = bank
        ? 4 + (bank.branch ? 1 : 0) // accountName, bankName, accountNumber, ifscCode + optional branch
        : 0;
    const bankSectionHeight = bank ? 15 + (bankFieldCount * 5) : 0; // title + fields

    // Totals: Subtotal + GST lines + Total Tax + Grand Total
    const totalsLineCount = gstBreakup.igst > 0 ? 4 : 5; // IGST path = 4 lines, CGST+SGST path = 5
    const totalsSectionHeight = (totalsLineCount * 6) + 15; // lines + grand total spacing

    const requiredHeight = Math.max(bankSectionHeight, totalsSectionHeight) + 10;

    // Page break if needed — ensures both sections stay on the same page
    if (y + requiredHeight > pageHeight - 40) {
        doc.addPage();
        y = 20;
    }

    const sectionStartY = y;

    // ----------------------------------------------------------
    // LEFT SIDE: Bank Details
    // ----------------------------------------------------------
    if (bank) {
        let bankY = sectionStartY;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Bank Details for Payment', leftX, bankY);

        bankY += 7;
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);

        const bankFields: [string, string][] = [
            ['Account Name', bank.accountName],
            ['Bank Name', bank.bankName],
            ['A/c Number', bank.accountNumber],
            ['IFSC Code', bank.ifscCode],
        ];

        if (bank.branch) {
            bankFields.push(['Branch', bank.branch]);
        }

        bankFields.forEach(([label, value]) => {
            if (value) {
                doc.setFont('helvetica', 'bold');
                doc.text(`${label}:`, leftX, bankY);
                doc.setFont('helvetica', 'normal');
                doc.text(value, leftX + 30, bankY);
                bankY += 5;
            }
        });
    }

    // ----------------------------------------------------------
    // RIGHT SIDE: Totals
    // ----------------------------------------------------------
    const totalsStartX = pageWidth - 80;
    const totalsValueX = rightX;
    let totalsY = sectionStartY;

    // Subtotal
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Subtotal:', totalsStartX, totalsY);
    doc.text(formatPdfCurrency(invoice.subtotal), totalsValueX, totalsY, { align: 'right' });

    // GST Breakup
    totalsY += 6;
    if (gstBreakup.igst > 0) {
        doc.text('IGST:', totalsStartX, totalsY);
        doc.text(formatPdfCurrency(gstBreakup.igst), totalsValueX, totalsY, { align: 'right' });
    } else {
        doc.text('CGST:', totalsStartX, totalsY);
        doc.text(formatPdfCurrency(gstBreakup.cgst), totalsValueX, totalsY, { align: 'right' });

        totalsY += 6;
        doc.text('SGST:', totalsStartX, totalsY);
        doc.text(formatPdfCurrency(gstBreakup.sgst), totalsValueX, totalsY, { align: 'right' });
    }

    // Total Tax
    totalsY += 6;
    doc.text('Total Tax:', totalsStartX, totalsY);
    doc.text(formatPdfCurrency(invoice.tax_total), totalsValueX, totalsY, { align: 'right' });

    // Grand Total
    totalsY += 8;
    doc.setDrawColor(0, 0, 0);
    doc.line(totalsStartX - 5, totalsY - 2, totalsValueX, totalsY - 2);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', totalsStartX, totalsY + 5);
    doc.text(formatPdfCurrency(invoice.grand_total), totalsValueX, totalsY + 5, { align: 'right' });
    totalsY += 12;

    // ----------------------------------------------------------
    // Set Y to whichever section ended lower
    // ----------------------------------------------------------
    const bankEndY = sectionStartY + bankSectionHeight;
    y = Math.max(totalsY, bankEndY) + 4;

    // ================================================================
    // TERMS & CONDITIONS (Page 2 — Bullet-Point Rendering)
    // ================================================================
    // - Fallback to DEFAULT_TERMS_AND_CONDITIONS if invoice has none
    // - Always starts on a new page for clean separation
    // - Each bullet is an ATOMIC block (never splits across pages)
    // - Unicode bullets (\u2022) are sanitized to '-' for jsPDF Latin-1
    // ================================================================
    const tcText = invoice.terms_and_conditions || DEFAULT_TERMS_AND_CONDITIONS;

    if (tcText) {
        // Always start T&C on a new page
        doc.addPage();
        y = 20;

        const bottomMargin = 25;
        const bulletLineHeight = 4;
        const bulletSpacing = 3;
        const textMaxWidth = pageWidth - 28;

        // Heading
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Terms & Conditions', leftX, y);

        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(leftX, y, rightX, y);

        y += 6;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        // Split T&C into individual bullet points
        const bullets = tcText
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
            // Skip lines that are just a heading like "Terms & Conditions"
            .filter((line: string) => !/^terms\s*[&]\s*conditions$/i.test(line));

        bullets.forEach((bullet: string) => {
            // Sanitize Unicode bullets to Latin-1 compatible dash
            // jsPDF Helvetica only supports Latin-1 (U+0000–U+00FF)
            const displayText = bullet
                .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-') // bullet variants → dash
                .replace(/[^\x00-\xFF]/g, ''); // strip any remaining non-Latin-1

            // Wrap text to available width
            const wrappedLines: string[] = doc.splitTextToSize(displayText, textMaxWidth);
            const bulletHeight = wrappedLines.length * bulletLineHeight + bulletSpacing;

            // ATOMIC CHECK: If this entire bullet won't fit, start a new page
            if (y + bulletHeight > pageHeight - bottomMargin) {
                doc.addPage();
                y = 20;

                // Re-render mini heading on new page for context
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(120, 120, 120);
                doc.text('Terms & Conditions (continued)', leftX, y);
                y += 6;

                // Reset to normal style
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(80, 80, 80);
            }

            // Render wrapped lines
            wrappedLines.forEach((wrappedLine: string, lineIdx: number) => {
                doc.text(wrappedLine, leftX, y + (lineIdx * bulletLineHeight));
            });

            // Advance Y past this entire bullet block
            y += bulletHeight;
        });
    }

    // ================================================================
    // FOOTER
    // ================================================================
    y += 14;

    // Ensure footer fits on the page
    if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('This is a system generated invoice.', leftX, y);

    y += 5;
    doc.text('No signature required.', leftX, y);

    return doc;
}

/**
 * Download invoice as PDF
 * 
 * @param invoice - Full invoice object from database
 */
export function downloadInvoicePDF(invoice: Invoice): void {
    // Always use the registered company profile as the seller
    const companyDetails: CompanyDetails = {
        name: COMPANY_PROFILE.legalName,
        address: COMPANY_PROFILE.address,
        gstin: COMPANY_PROFILE.gstin,
        phone: COMPANY_PROFILE.phone,
        email: COMPANY_PROFILE.email,
    };

    const doc = generateInvoicePDF({ invoice, companyDetails });

    // Download the PDF
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
}
