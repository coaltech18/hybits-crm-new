// ================================================================
// COMPANY PROFILE CONFIGURATION
// ================================================================
// Single source of truth for the legal entity that issues invoices.
// All invoices are generated under this company identity.
// Outlets are shown separately as branch references.
// ================================================================

export const COMPANY_PROFILE = {
    /** Registered legal name (as on GST certificate) */
    legalName: 'HYBITS SOLUTIONS PRIVATE LIMITED',

    /** Company GSTIN */
    gstin: '29AAHCH6039E1ZH',

    /** Registered office address */
    address: 'Bengaluru, Karnataka',

    /** Contact phone */
    phone: '9945624643',

    /** Contact email */
    email: 'info@hybits.in',

    /** Company website */
    website: 'www.hybits.in',

    /** Bank account details for invoice payments */
    bankDetails: {
        accountName: 'HYBITS SOLUTIONS PRIVATE LIMITED',
        bankName: 'HDFC BANK',
        accountNumber: '50200105177482',
        ifscCode: 'HDFC0001749',
        branch: 'V V Puram',
    },
} as const;

export type CompanyProfile = typeof COMPANY_PROFILE;

// ================================================================
// DEFAULT TERMS & CONDITIONS
// ================================================================
// This is pre-filled when creating an invoice.
// The manager can edit it before saving.
// Once saved, the T&C is snapshotted and immutable on that invoice.
// ================================================================

export const DEFAULT_TERMS_AND_CONDITIONS = `Terms & Conditions
• Payment within 3 days from the date of invoice
• Rental Fee includes the use of sterilized dishes for the specified event duration
• Additional charges may apply for extended rental periods or special requests.
• In the event of damage or loss of the rented dishes, the customer will be charged to cover the cost of replacement or repair.
• The company reserves the right to change the pricing of its services. Customers will be notified of any price changes before they take effect.
• Price includes GST and sterilised ready to use dishes.
• Transportation charges may apply in certain cases.
• Strictly No Manual washing: Under no circumstances are the rented sterilized dishes to be washed manually by the customer or event staff.
`;

// ================================================================
// INVOICE NUMBER FORMAT OPTIONS
// ================================================================
// Managers can select one of these formats during invoice creation.
// The system controls the sequential number (NNNN).
// Once an invoice number is generated, it is locked and immutable.
// ================================================================

export type InvoiceNumberFormat = 'default' | 'outlet_fy' | 'outlet_short' | 'fy_only';

export interface InvoiceNumberFormatOption {
    value: InvoiceNumberFormat;
    label: string;
    example: string;
    description: string;
}

export const INVOICE_NUMBER_FORMATS: InvoiceNumberFormatOption[] = [
    {
        value: 'default',
        label: 'Standard',
        example: 'INV-20260210-0001',
        description: 'INV-YYYYMMDD-NNNN',
    },
    {
        value: 'outlet_fy',
        label: 'Outlet + Financial Year',
        example: 'INV/HYB_001/2025-26/0001',
        description: 'INV/OUTLET/FY/NNNN',
    },
    {
        value: 'outlet_short',
        label: 'Outlet Short',
        example: 'INV-HYB_001-0001',
        description: 'INV-OUTLET-NNNN',
    },
    {
        value: 'fy_only',
        label: 'Financial Year',
        example: 'INV/2025-26/0001',
        description: 'INV/FY/NNNN',
    },
];
