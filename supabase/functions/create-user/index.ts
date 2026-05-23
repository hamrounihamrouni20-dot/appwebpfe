// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables', { supabaseUrl, serviceRoleKey });
      return jsonResponse({ error: 'Missing Supabase environment variables' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.slice(7).trim();
    const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser.user) {
      return jsonResponse({ error: 'Invalid user session' }, 401);
    }

    const adminId = authUser.user.id;
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      return jsonResponse({ error: 'Only admin can create users' }, 403);
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('Failed to parse JSON body', err, rawBody);
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { email, password, full_name, role } = body;
    const phone = body.phone ?? null;
    const address = body.address ?? null;

    if (!email || !full_name || !role || typeof email !== 'string' || typeof full_name !== 'string' || typeof role !== 'string') {
      return jsonResponse({ error: 'Email, full_name, and role are required' }, 400);
    }

    const allowedRoles = ['admin', 'technician', 'user'];
    if (!allowedRoles.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    const generatedPassword = password || `Sw-${Math.random().toString(36).slice(2, 10)}!`;
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (createError || !createdUser?.user) {
      console.error('createUser auth.admin.createUser error', createError);
      return jsonResponse({ error: createError?.message ?? 'Failed to create user' }, 400);
    }

    const userId = createdUser.user.id;
    const { error: insertProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name,
        role,
        phone,
        address,
      });

    if (insertProfileError) {
      return jsonResponse({ error: insertProfileError.message ?? String(insertProfileError) }, 400);
    }

    return jsonResponse({
      success: true,
      user: {
        id: userId,
        email,
        full_name,
        role,
        phone,
        address,
      },
      temporary_password: password ? null : generatedPassword,
    });
  } catch (err) {
    console.error('create-user function error', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});