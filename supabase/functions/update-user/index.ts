import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = data.claims.sub;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: hasRole } = await adminClient.rpc("has_role", {
      _user_id: callerId,
      _role: "usuario_pro",
    });

    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Solo usuario_pro puede editar usuarios" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, name, email, password, role, active, track_insights } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Update auth user (email, password)
    const authUpdate: Record<string, unknown> = {};
    if (email) authUpdate.email = email;
    if (password) authUpdate.password = password;

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, authUpdate);
      if (authError) {
        return new Response(JSON.stringify({ error: `Error actualizando auth: ${authError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Update profile
    const profileUpdate: Record<string, unknown> = {};
    if (name) profileUpdate.name = name;
    if (email) profileUpdate.email = email;
    if (typeof active === "boolean") profileUpdate.active = active;
    if (typeof track_insights === "boolean") profileUpdate.track_insights = track_insights;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);
      if (profileError) {
        return new Response(JSON.stringify({ error: `Error actualizando perfil: ${profileError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Update role if changed
    if (role && ["usuario_pro", "pim_manager"].includes(role)) {
      // Delete existing role and insert new one
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (roleError) {
        return new Response(JSON.stringify({ error: `Error actualizando rol: ${roleError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
