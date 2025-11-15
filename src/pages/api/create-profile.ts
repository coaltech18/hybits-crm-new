// ============================================================================
// CREATE PROFILE API ENDPOINT
// ============================================================================
// Server only. Do not call from client.
//
// NOTE: This is a Vite/React app, not Next.js. This file serves as a reference
// for implementing a server-side endpoint. You can:
//
// Option 1: Create a Supabase Edge Function
//   - Create supabase/functions/create-profile/index.ts
//   - Deploy: supabase functions deploy create-profile
//
// Option 2: Create a separate Express/Node.js API server
//   - Set up a server that handles POST /api/create-profile
//   - Use process.env.SUPABASE_SERVICE_ROLE_KEY for admin access
//
// Option 3: Use Supabase Database Functions
//   - Create a PostgreSQL function that creates profiles
//   - Call it via RPC from client (with proper RLS)
//
// This file structure matches Next.js API routes for reference.
// ============================================================================

/**
 * Server-side endpoint to create a user profile using SERVICE_ROLE key
 * This bypasses RLS and should only be called from server-side code
 * 
 * @example
 * // In a serverless function or API route:
 * POST /api/create-profile
 * Body: { userId: string, email: string, full_name: string, role: string }
 * 
 * Response: { success: true, profile: {...} } or { success: false, error: string }
 */
export async function createProfileHandler(request: {
  userId: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  outlet_id?: string;
}): Promise<{ success: boolean; profile?: any; error?: string }> {
  // This is a stub - implement in your server environment
  // Example implementation for Supabase Edge Function:
  
  /*
  import { createClient } from '@supabase/supabase-js';
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  if (!serviceRoleKey) {
    return { success: false, error: 'Service role key not configured' };
  }
  
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: request.userId,
      email: request.email,
      full_name: request.full_name,
      role: request.role,
      phone: request.phone || null,
      outlet_id: request.outlet_id || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, profile: data };
  */
  
  // Use request parameter to avoid TypeScript unused variable warning
  throw new Error(
    `This endpoint must be implemented in a server environment. Expected: userId=${request.userId}, email=${request.email}`
  );
}

// Example Supabase Edge Function implementation (supabase/functions/create-profile/index.ts):
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { userId, email, full_name, role, phone, outlet_id } = await req.json();
    
    if (!userId || !email || !full_name || !role) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        full_name,
        role,
        phone: phone || null,
        outlet_id: outlet_id || null,
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true, profile: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
*/

