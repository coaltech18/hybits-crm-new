// deno-lint-ignore-file no-explicit-any
// @ts-expect-error - Deno URL imports are resolved at runtime
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// @ts-expect-error - Deno URL imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

// Declare Deno global for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

interface ManageUserRequest {
  action?: string;
  payload?: Record<string, any>;
}

interface UserProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  outlet_id?: string | null;
  outlet_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string | null;
}

function formatUser(profile: UserProfileRow) {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    phone: profile.phone ?? undefined,
    outlet_id: profile.outlet_id ?? undefined,
    outlet_name: profile.outlet_name ?? undefined,
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    last_login: profile.last_login ?? undefined,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: corsHeaders },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: requesterProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || requesterProfile?.role !== "admin") {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const requestBody = (await req.json()) as ManageUserRequest;
    const { action, payload = {} } = requestBody;

    switch (action) {
      case "createUser": {
        const {
          email,
          password,
          full_name,
          role,
          phone,
          outlet_id,
          is_active = true,
          send_invite = false,
        } = payload;

        if (!email || !full_name || !role) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing required fields" }),
            { status: 400, headers: corsHeaders },
          );
        }

        const metadata: Record<string, any> = {
          full_name,
          role,
          phone,
          outlet_id,
          is_active,
        };

        const { data: createData, error: createError } = await adminClient.auth.admin.createUser(
          {
            email,
            password,
            email_confirm: !send_invite,
            user_metadata: metadata,
          },
        );

        if (createError || !createData?.user) {
          console.error("Create user failed:", createError);
          return new Response(
            JSON.stringify({ success: false, error: createError?.message ?? "Failed to create user" }),
            { status: 400, headers: corsHeaders },
          );
        }

        const userId = createData.user.id;

        let outletName: string | null = null;
        if (outlet_id) {
          const { data: outletRow } = await adminClient
            .from("locations")
            .select("name")
            .eq("id", outlet_id)
            .maybeSingle();
          outletName = outletRow?.name ?? null;
        }

        const { data: profileRow, error: profileUpdateError } = await adminClient
          .from("user_profiles")
          .update({
            full_name,
            role,
            phone,
            outlet_id: outlet_id ?? null,
            outlet_name: outletName,
            is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select("*")
          .single();

        if (profileUpdateError || !profileRow) {
          console.error("Profile update after create failed:", profileUpdateError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to finalize user profile" }),
            { status: 500, headers: corsHeaders },
          );
        }

        if (!is_active) {
          await adminClient.auth.admin.updateUserById(userId, {
            user_metadata: { ...metadata, is_active },
          });
        }

        return new Response(
          JSON.stringify({ success: true, user: formatUser(profileRow) }),
          { status: 200, headers: corsHeaders },
        );
      }

      case "updateUser": {
        const { user_id, updates = {} } = payload;
        if (!user_id) {
          return new Response(
            JSON.stringify({ success: false, error: "user_id is required" }),
            { status: 400, headers: corsHeaders },
          );
        }

        const { full_name, role, phone, outlet_id, is_active } = updates;
        const metadataUpdates: Record<string, any> = {};

        if (typeof full_name === "string") metadataUpdates.full_name = full_name;
        if (typeof role === "string") metadataUpdates.role = role;
        if (typeof phone === "string") metadataUpdates.phone = phone;
        if (typeof is_active === "boolean") metadataUpdates.is_active = is_active;
        if (typeof outlet_id === "string" || outlet_id === null) {
          metadataUpdates.outlet_id = outlet_id;
        }

        if (Object.keys(metadataUpdates).length > 0) {
          const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
            user_id,
            { user_metadata: metadataUpdates },
          );

          if (authUpdateError) {
            console.error("Auth metadata update failed:", authUpdateError);
            return new Response(
              JSON.stringify({ success: false, error: authUpdateError.message }),
              { status: 400, headers: corsHeaders },
            );
          }
        }

        let outletName: string | null | undefined = undefined;
        if (updates.hasOwnProperty("outlet_id")) {
          if (outlet_id) {
            const { data: outletRow } = await adminClient
              .from("locations")
              .select("name")
              .eq("id", outlet_id)
              .maybeSingle();
            outletName = outletRow?.name ?? null;
          } else {
            outletName = null;
          }
        }

        const profileUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (typeof full_name === "string") profileUpdates.full_name = full_name;
        if (typeof role === "string") profileUpdates.role = role;
        if (typeof phone === "string") profileUpdates.phone = phone;
        if (typeof is_active === "boolean") profileUpdates.is_active = is_active;
        if (updates.hasOwnProperty("outlet_id")) {
          profileUpdates.outlet_id = outlet_id ?? null;
          profileUpdates.outlet_name = outletName ?? null;
        }

        const { data: updatedProfile, error: updateProfileError } = await adminClient
          .from("user_profiles")
          .update(profileUpdates)
          .eq("id", user_id)
          .select("*")
          .single();

        if (updateProfileError || !updatedProfile) {
          console.error("Profile update failed:", updateProfileError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to update user profile" }),
            { status: 400, headers: corsHeaders },
          );
        }

        return new Response(
          JSON.stringify({ success: true, user: formatUser(updatedProfile) }),
          { status: 200, headers: corsHeaders },
        );
      }

      case "deleteUser": {
        const { user_id } = payload;
        if (!user_id) {
          return new Response(
            JSON.stringify({ success: false, error: "user_id is required" }),
            { status: 400, headers: corsHeaders },
          );
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

        if (deleteError) {
          console.error("Delete user failed:", deleteError);
          return new Response(
            JSON.stringify({ success: false, error: deleteError.message }),
            { status: 400, headers: corsHeaders },
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: corsHeaders },
        );
    }
  } catch (error) {
    console.error("Manage users function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});

