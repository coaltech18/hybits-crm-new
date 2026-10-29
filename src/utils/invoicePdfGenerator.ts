import jsPDF, { GState } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, InvoiceItem, InvoiceStatus, ClientGstType } from '@/types';
import { COMPANY_PROFILE, DEFAULT_TERMS_AND_CONDITIONS } from '@/config/companyProfile';
import { DEFAULT_HSN_CODE } from '@/config/gstConstants';
import { getInvoiceById } from '@/services/invoiceService';
import { roundCurrency } from '@/utils/format';
import { formatDate as formatDisplayDate } from '@/utils/billingDate';

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

/** How the document is labelled: only issued statuses print as a tax invoice. */
type PdfMode = 'draft' | 'final' | 'cancelled';

interface InvoicePDFData {
    invoice: Invoice;
    companyDetails: CompanyDetails;
    /** Defaults to the mode derived from invoice.status. */
    mode?: PdfMode;
}

function getPdfMode(status: InvoiceStatus): PdfMode {
    if (status === 'finalized' || status === 'partially_paid' || status === 'paid') return 'final';
    if (status === 'cancelled') return 'cancelled';
    return 'draft';
}

const PDF_NUMBER_FORMATTER = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

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
    return `Rs. ${PDF_NUMBER_FORMATTER.format(amount)}`;
}

/**
 * Make text safe for jsPDF's built-in fonts (WinAnsi / Latin-1 only).
 * Maps common typographic characters to ASCII and drops the rest, so
 * nothing renders as mojibake.
 */
function pdfSafe(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/\u20B9/g, 'Rs.')
        .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
        .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
        .replace(/[\u2013\u2014\u2212]/g, '-')
        .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[\u00A0\u2007\u202F]/g, ' ')
        .replace(/[^\n\r\t -\u00FF]/g, '');
}

/**
 * Format date for PDF display. YYYY-MM-DD values are read as local dates.
 */
function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return formatDisplayDate(dateString, 'short');
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

function isIgstSupply(gstType: ClientGstType | null | undefined): boolean {
    return gstType === 'sez' || gstType === 'export';
}

/**
 * Calculate GST breakup based on client GST type.
 * CGST is half the stored tax; SGST is the remainder, so the two always
 * add up to tax_total exactly.
 */
function calculateGstBreakup(
    taxTotal: number,
    gstType: ClientGstType | null | undefined
): { cgst: number; sgst: number; igst: number } {
    // SEZ/Export: IGST only (also when zero-rated)
    if (isIgstSupply(gstType)) {
        return {
            cgst: 0,
            sgst: 0,
            igst: taxTotal,
        };
    }

    // Domestic or null (default to domestic)
    const cgst = roundCurrency(taxTotal / 2);
    return {
        cgst,
        sgst: roundCurrency(taxTotal - cgst),
        igst: 0,
    };
}

/** Draw the status watermark and footer on every page, above the content. */
function decoratePages(doc: jsPDF, mode: PdfMode): void {
    // jsPDF 4 has these at runtime; the stale @types/jspdf (v1) in node_modules
    // shadows them in the jsPDF type, so declare the few we need.
    const pages = doc as unknown as {
        getNumberOfPages(): number;
        saveGraphicsState(): unknown;
        restoreGraphicsState(): unknown;
        setGState(state: GState): unknown;
    };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageCount = pages.getNumberOfPages();
    const watermark = mode === 'draft' ? 'DRAFT' : mode === 'cancelled' ? 'CANCELLED' : null;

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);

        if (watermark) {
            pages.saveGraphicsState();
            pages.setGState(new GState({ opacity: 0.12 }));
            doc.setFontSize(mode === 'cancelled' ? 64 : 72);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(mode === 'cancelled' ? 200 : 120, mode === 'cancelled' ? 0 : 120, mode === 'cancelled' ? 0 : 120);
            doc.text(watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
            pages.restoreGraphicsState();
        }

        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(160, 160, 160);
        doc.text('This is a system generated invoice. No signature required.', 14, pageHeight - 10);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
}

/**
 * Generate Invoice PDF
 *
 * @param data - Invoice data from database
 * @returns PDF blob for download
 */
export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
    const { invoice, companyDetails } = data;
    const mode = data.mode ?? getPdfMode(invoice.status);
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftX = 14;
    const rightX = pageWidth - 14;
    const contentWidth = rightX - leftX;
    let y = 20;

    /** Write wrapped text and advance y by the number of lines. */
    const writeWrapped = (text: string, width: number, lineHeight: number) => {
        const lines: string[] = doc.splitTextToSize(pdfSafe(text), width);
        lines.forEach((line) => {
            doc.text(line, leftX, y);
            y += lineHeight;
        });
    };

    // Issued invoices print the party as it was at finalization (042 snapshot)
    const billTo = {
        name: invoice.client_name_snap ?? invoice.clients?.name,
        gstin: invoice.client_gstin_snap ?? invoice.clients?.gstin,
        address: invoice.client_address_snap ?? invoice.clients?.billing_address,
        gstType: invoice.client_gst_type_snap ?? invoice.clients?.gst_type,
    };

    // ================================================================
    // HEADER: Company Details (From)
    // ================================================================
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSafe(companyDetails.name), leftX, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    writeWrapped(companyDetails.address, contentWidth * 0.6, 5);

    doc.text(`GSTIN: ${pdfSafe(companyDetails.gstin)}`, leftX, y);
    y += 5;

    // Conditional contact line — never show dashes
    const contactParts = [
        companyDetails.phone && companyDetails.phone !== '-' ? `Phone: ${companyDetails.phone}` : null,
        companyDetails.email && companyDetails.email !== '-' ? `Email: ${companyDetails.email}` : null,
    ].filter(Boolean);

    if (contactParts.length > 0) {
        doc.text(pdfSafe(contactParts.join(' | ')), leftX, y);
        y += 5;
    }

    // Outlet branch reference
    if (invoice.outlets) {
        doc.setFont('helvetica', 'bold');
        writeWrapped(`Outlet: ${invoice.outlets.code || ''} / ${invoice.outlets.name || ''}`, contentWidth * 0.6, 5);
        doc.setFont('helvetica', 'normal');
    }

    // ================================================================
    // INVOICE TITLE & NUMBER (right-aligned box)
    // ================================================================
    y += 12;
    doc.setFontSize(mode === 'cancelled' ? 12 : 15);
    doc.setFont('helvetica', 'bold');
    const invoiceTitle =
        mode === 'final' ? 'TAX INVOICE' : mode === 'cancelled' ? 'CANCELLED - NOT A VALID TAX INVOICE' : 'DRAFT INVOICE';
    if (mode === 'cancelled') doc.setTextColor(200, 0, 0);
    doc.text(invoiceTitle, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Invoice details on right side — positioned relative to title
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const invoiceDetails = [
        `Invoice No: ${pdfSafe(invoice.invoice_number)}`,
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
    writeWrapped(billTo.name || 'N/A', contentWidth, 5);
    y += 1;

    if (billTo.address) {
        writeWrapped(billTo.address, 80, 5);
        y += 1; // small gap after address block
    }

    if (billTo.gstin) {
        doc.text(`GSTIN: ${pdfSafe(billTo.gstin)}`, leftX, y);
        y += 6;
    }

    if (invoice.clients?.phone) {
        doc.text(`Phone: ${pdfSafe(invoice.clients.phone)}`, leftX, y);
        y += 6;
    }

    // GST Type
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text(`GST Type: ${getGstTypeLabel(billTo.gstType)}`, leftX, y);
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
        writeWrapped(`${invoice.events.event_name} - ${formatDate(invoice.events.event_date)}`, contentWidth, 5);
        y += 1;

        if (invoice.events.event_type) {
            writeWrapped(`Type: ${invoice.events.event_type}`, contentWidth, 5);
            y += 1;
        }

        y += 4; // breathing room before table
    }

    // ================================================================
    // LINE ITEMS TABLE
    // ================================================================
    y += 4;

    const items: InvoiceItem[] = invoice.invoice_items || [];

    if (items.length === 0) {
        console.warn(`[PDF] Invoice ${invoice.invoice_number} has no line items — table will be empty.`);
    }

    const tableData = items.map((item, index) => [
        (index + 1).toString(),
        DEFAULT_HSN_CODE,
        pdfSafe(item.description),
        item.quantity.toString(),
        formatPdfCurrency(item.unit_price),
        formatPdfCurrency(item.line_total),
        `${item.tax_rate}%`,
        formatPdfCurrency(item.tax_amount),
        formatPdfCurrency(item.line_total + item.tax_amount),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['#', 'HSN', 'Description', 'Qty', 'Unit Price', 'Amount', 'Tax %', 'Tax', 'Total']],
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
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

    // ================================================================
    // BANK DETAILS (LEFT) + TOTALS (RIGHT) — SIDE BY SIDE
    // ================================================================
    // Both sections start at the same Y-position after the items table.
    // Bank details render on the left half, totals on the right half.
    // This keeps everything on the same page and looks professional.
    // ================================================================

    // Calculate GST breakup
    const gstType = billTo.gstType;
    const gstBreakup = calculateGstBreakup(invoice.tax_total, gstType);
    const igst = isIgstSupply(gstType);

    // Pre-calculate height needed for both sections
    const bank = COMPANY_PROFILE.bankDetails;
    const bankFieldCount = bank
        ? 4 + (bank.branch ? 1 : 0) // accountName, bankName, accountNumber, ifscCode + optional branch
        : 0;
    const bankSectionHeight = bank ? 15 + (bankFieldCount * 5) : 0; // title + fields

    // Totals: Subtotal + GST lines + Total Tax + Grand Total
    const totalsLineCount = igst ? 4 : 5; // IGST path = 4 lines, CGST+SGST path = 5
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
    if (igst) {
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

    doc.setFontSize(13);
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
    // - Only legacy NULL terms fall back to DEFAULT_TERMS_AND_CONDITIONS;
    //   terms the user deliberately cleared print no T&C page
    // - Always starts on a new page for clean separation
    // - Each bullet is an ATOMIC block (never splits across pages)
    // - Unicode bullets (\u2022) are sanitized to '-' for jsPDF Latin-1
    // ================================================================
    const tcText =
        invoice.terms_and_conditions === null || invoice.terms_and_conditions === undefined
            ? DEFAULT_TERMS_AND_CONDITIONS
            : invoice.terms_and_conditions;

    if (tcText.trim()) {
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
            // jsPDF Helvetica only supports Latin-1 (U+0000–U+00FF)
            const displayText = pdfSafe(bullet);

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
    // WATERMARK + FOOTER on every page (drawn last so tables can't hide it)
    // ================================================================
    decoratePages(doc, mode);

    return doc;
}

/**
 * Download invoice as PDF
 *
 * Re-fetches the full invoice (with items) when they are not loaded,
 * e.g. when called from the list page.
 *
 * @param invoice - Invoice object (items may or may not be loaded)
 * @throws Error when the invoice cannot be loaded
 */
export async function downloadInvoicePDF(invoice: Invoice): Promise<void> {
    let fullInvoice: Invoice = invoice;
    if (!invoice.invoice_items || invoice.invoice_items.length === 0) {
        const fetched = await getInvoiceById(invoice.id);
        if (!fetched) {
            throw new Error('Could not load invoice for PDF');
        }
        fullInvoice = fetched;
    }

    const companyDetails: CompanyDetails = {
        name: COMPANY_PROFILE.legalName,
        address: COMPANY_PROFILE.address,
        gstin: fullInvoice.supplier_gstin_snap || COMPANY_PROFILE.gstin,
        phone: COMPANY_PROFILE.phone,
        email: COMPANY_PROFILE.email,
    };

    const mode = getPdfMode(fullInvoice.status);
    const doc = generateInvoicePDF({ invoice: fullInvoice, companyDetails, mode });

    // Download the PDF ('/' and other reserved characters are not valid in file names)
    const prefix = mode === 'draft' ? 'Draft_Invoice' : mode === 'cancelled' ? 'Cancelled_Invoice' : 'Invoice';
    const safeNumber = (fullInvoice.invoice_number || fullInvoice.id).replace(/[\\/:*?"<>|]/g, '-');
    doc.save(`${prefix}_${safeNumber}.pdf`);
}
