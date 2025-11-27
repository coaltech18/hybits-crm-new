// ===================================================================
// HYBITS CRM — Invoice PDF Generation Edge Function
// Generates PDF invoices using pdf-lib (Deno-compatible)
// 
// NOTE: This file uses Deno-specific imports and APIs.
// TypeScript errors about missing modules in IDE are expected - 
// code runs correctly in Deno runtime at Supabase Edge Functions.
// ===================================================================

// @ts-ignore - Deno-specific import, works at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - ESM import, works at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - ESM import, works at runtime
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

// Deno global type declaration (for IDE support)
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvoiceData {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  customer_id: string
  location_id: string
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  total_amount: number
  payment_received: number
  customers: {
    contact_person: string
    gstin?: string
    address_street?: string
    address_city?: string
    address_state?: string
    address_pincode?: string
  }
  locations: {
    name: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    gstin?: string
  }
  invoice_items: Array<{
    id: string
    product_name: string
    hsn_code?: string
    quantity: number
    unit_price: number
    gst_rate: number
    total_amount: number
  }>
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { invoice_id } = await req.json()
    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get auth token and verify permissions
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for data access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Create client with user token for auth verification
    const userToken = authHeader.replace('Bearer ', '')
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user authentication
    const { data: { user }, error: authError } = await userSupabase.auth.getUser(userToken)
    if (authError || !user || !user.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch user profile with outlet_id for ownership check
    // Note: user_profiles.id references auth.users.id (not user_id)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role, outlet_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user has required role
    if (!['admin', 'manager', 'accountant'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoice with outlet_id first to check ownership
    const { data: invoiceCheck, error: invoiceCheckError } = await supabaseAdmin
      .from('invoices')
      .select('id, outlet_id, invoice_number')
      .eq('id', invoice_id)
      .single()

    if (invoiceCheckError || !invoiceCheck) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enforce outlet ownership: admin can access all, others only their outlet
    if (profile.role !== 'admin' && profile.outlet_id !== invoiceCheck.outlet_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have access to this invoice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch full invoice data with related information (now that ownership is verified)
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        customers(contact_person, gstin, address_street, address_city, address_state, address_pincode),
        locations(name, address, city, state, pincode, gstin),
        invoice_items(*)
      `)
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch invoice data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate PDF using pdf-lib
    const pdfBytes = await generateInvoicePdf(invoice as InvoiceData)

    // Upload PDF to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `invoices/${invoice.invoice_number}_${timestamp}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create signed URL with configurable expiry (default 1 hour = 3600 seconds)
    // Signed URLs expire after the specified time for security
    const signedUrlExpiry = parseInt(Deno.env.get('PDF_SIGNED_URL_EXPIRY') || '3600', 10)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(fileName, signedUrlExpiry)

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError)
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice with PDF information
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        invoice_pdf_url: signedUrlData.signedUrl,
        invoice_pdf_key: fileName
      })
      .eq('id', invoice_id)

    if (updateError) {
      console.error('Update error:', updateError)
      // PDF was uploaded but invoice update failed - this is not critical
      console.warn('PDF uploaded but invoice update failed:', updateError)
    }

    // Insert audit log entry (using service role client)
    const { error: auditError } = await supabaseAdmin
      .from('invoice_pdf_audit')
      .insert({
        invoice_id: invoice.id,
        generated_by: profile.id,
        pdf_key: fileName
      })

    if (auditError) {
      // Log error but don't fail the request - audit is non-critical
      console.error('Audit log error:', auditError)
      console.warn('PDF generated but audit log failed')
    }

    // Return only signed URL and minimal metadata (no service role keys)
    return new Response(
      JSON.stringify({
        url: signedUrlData.signedUrl,
        key: fileName,
        expiresIn: signedUrlExpiry
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateInvoicePdf(invoice: InvoiceData): Promise<Uint8Array> {
  // Create new PDF document
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size in points
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const { width, height } = page.getSize()
  const margin = 50
  let yPosition = height - margin

  // Helper function to format currency
  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`
  
  // Helper function to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  // Draw header
  page.drawText('HYBITS CRM', {
    x: margin,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: rgb(0.12, 0.25, 0.69) // Blue color
  })

  // Company/Outlet info
  yPosition -= 30
  if (invoice.locations?.name) {
    page.drawText(invoice.locations.name, {
      x: margin,
      y: yPosition,
      size: 12,
      font: boldFont
    })
    yPosition -= 15
  }

  if (invoice.locations?.address) {
    const addressParts = [
      invoice.locations.address,
      invoice.locations.city,
      invoice.locations.state,
      invoice.locations.pincode
    ].filter(Boolean)
    
    page.drawText(addressParts.join(', '), {
      x: margin,
      y: yPosition,
      size: 10,
      font
    })
    yPosition -= 15
  }

  if (invoice.locations?.gstin) {
    page.drawText(`GSTIN: ${invoice.locations.gstin}`, {
      x: margin,
      y: yPosition,
      size: 10,
      font
    })
  }

  // Invoice info (right side)
  const rightX = width - margin - 200
  let rightY = height - margin

  page.drawText('INVOICE', {
    x: rightX,
    y: rightY,
    size: 20,
    font: boldFont,
    color: rgb(0.12, 0.25, 0.69)
  })

  rightY -= 25
  page.drawText(`Invoice #: ${invoice.invoice_number}`, {
    x: rightX,
    y: rightY,
    size: 12,
    font: boldFont
  })

  rightY -= 20
  page.drawText(`Date: ${formatDate(invoice.invoice_date)}`, {
    x: rightX,
    y: rightY,
    size: 10,
    font
  })

  rightY -= 15
  page.drawText(`Due Date: ${formatDate(invoice.due_date)}`, {
    x: rightX,
    y: rightY,
    size: 10,
    font
  })

  // Move to billing section
  yPosition = rightY - 40

  // Draw horizontal line
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  })

  yPosition -= 30

  // Bill To section
  page.drawText('Bill To:', {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont
  })

  yPosition -= 20
  page.drawText(invoice.customers.contact_person || 'N/A', {
    x: margin,
    y: yPosition,
    size: 11,
    font: boldFont
  })

  yPosition -= 15
  if (invoice.customers.address_street) {
    const customerAddress = [
      invoice.customers.address_street,
      invoice.customers.address_city,
      invoice.customers.address_state,
      invoice.customers.address_pincode
    ].filter(Boolean).join(', ')

    page.drawText(customerAddress, {
      x: margin,
      y: yPosition,
      size: 10,
      font
    })
    yPosition -= 15
  }

  if (invoice.customers.gstin) {
    page.drawText(`GSTIN: ${invoice.customers.gstin}`, {
      x: margin,
      y: yPosition,
      size: 10,
      font
    })
  }

  yPosition -= 40

  // Items table header
  const tableStartY = yPosition
  const colWidths = [40, 200, 60, 80, 60, 80, 80] // Adjusted for 7 columns
  const colX = [
    margin,
    margin + colWidths[0],
    margin + colWidths[0] + colWidths[1],
    margin + colWidths[0] + colWidths[1] + colWidths[2],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5]
  ]

  // Table header background
  page.drawRectangle({
    x: margin,
    y: yPosition - 20,
    width: width - 2 * margin,
    height: 20,
    color: rgb(0.95, 0.95, 0.95)
  })

  // Table headers
  const headers = ['#', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'GST%', 'Amount']
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: colX[i] + 5,
      y: yPosition - 15,
      size: 10,
      font: boldFont
    })
  })

  yPosition -= 25

  // Draw table border
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  })

  // Items rows
  invoice.invoice_items.forEach((item, index) => {
    yPosition -= 20

    // Calculate taxable amount and tax
    const taxableAmount = item.total_amount / (1 + item.gst_rate / 100)
    const taxAmount = item.total_amount - taxableAmount

    const rowData = [
      (index + 1).toString(),
      item.product_name.length > 25 ? item.product_name.substring(0, 25) + '...' : item.product_name,
      item.hsn_code || 'N/A',
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      `${item.gst_rate}%`,
      formatCurrency(item.total_amount)
    ]

    rowData.forEach((data, i) => {
      const textX = i === 0 || i === 2 || i === 3 || i === 5 ? colX[i] + 5 : // Left align for #, HSN, Qty, GST%
                   i === 4 || i === 6 ? colX[i] + colWidths[i] - 5 : // Right align for Rate, Amount
                   colX[i] + 5 // Left align for Description

      page.drawText(data, {
        x: textX,
        y: yPosition,
        size: 9,
        font
      })
    })

    // Draw row separator
    page.drawLine({
      start: { x: margin, y: yPosition - 5 },
      end: { x: width - margin, y: yPosition - 5 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    })
  })

  yPosition -= 30

  // Totals section
  const totalsX = width - margin - 200
  const totalsData = [
    ['Subtotal:', formatCurrency(invoice.subtotal)],
    ['CGST:', formatCurrency(invoice.cgst)],
    ['SGST:', formatCurrency(invoice.sgst)],
    ['IGST:', formatCurrency(invoice.igst)],
    ['Total Amount:', formatCurrency(invoice.total_amount)]
  ]

  totalsData.forEach((total, index) => {
    const isTotal = index === totalsData.length - 1
    const currentFont = isTotal ? boldFont : font
    const fontSize = isTotal ? 12 : 10

    page.drawText(total[0], {
      x: totalsX,
      y: yPosition,
      size: fontSize,
      font: currentFont
    })

    page.drawText(total[1], {
      x: totalsX + 100,
      y: yPosition,
      size: fontSize,
      font: currentFont
    })

    if (isTotal) {
      // Draw line above total
      page.drawLine({
        start: { x: totalsX, y: yPosition + 5 },
        end: { x: totalsX + 150, y: yPosition + 5 },
        thickness: 1,
        color: rgb(0.3, 0.3, 0.3)
      })
    }

    yPosition -= 18
  })

  // Footer
  yPosition = margin + 50
  page.drawText('Thank you for your business!', {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: rgb(0.12, 0.25, 0.69)
  })

  yPosition -= 20
  page.drawText('This is a computer-generated invoice and does not require a signature.', {
    x: margin,
    y: yPosition,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5)
  })

  // Save PDF as bytes
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
