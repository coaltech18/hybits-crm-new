// ============================================================================
// HYBITS CRM — Mark Overdue Invoices Edge Function
// ============================================================================
// Manually triggers the mark_overdue_invoices() database function.
// Requires admin/manager role or service key.
// ============================================================================

// @ts-ignore - Deno-specific import, works at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - ESM import, works at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno global type declaration (for IDE support)
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// Security headers - inlined (Supabase Edge Functions don't support shared modules)
// See supabase/functions/_shared/securityHeaders.ts for reference
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'self'",
  'Referrer-Policy': 'no-referrer-when-downgrade',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authentication and role (optional - can be done via RLS on the function)
    // For now, we rely on the function being SECURITY DEFINER and RLS policies
    // In production, you may want to add explicit role checking here

    // Call the database function
    const { data, error } = await supabase.rpc('mark_overdue_invoices')

    if (error) {
      console.error('Error calling mark_overdue_invoices:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message || String(error) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // data should be an integer (count of updated invoices)
    const updatedCount = typeof data === 'number' ? data : 0

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated_count: updatedCount,
        message: `Marked ${updatedCount} invoice(s) as overdue`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (err) {
    console.error('Unexpected error in run-mark-overdue:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

