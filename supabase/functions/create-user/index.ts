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
    // 1. Authenticate the calling user
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
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;

    // 2. Verify caller is usuario_pro
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: hasRole } = await adminClient.rpc("has_role", {
      _user_id: callerId,
      _role: "usuario_pro",
    });

    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Solo usuario_pro puede crear usuarios" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse request body
    const { name, email, password, role, active } = await req.json();

    if (!name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios: name, email, password, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["usuario_pro", "pim_manager"].includes(role)) {
      return new Response(JSON.stringify({ error: "Rol inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create user in auth.users (with email auto-confirmed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: `Error creando usuario: ${createError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // 5. Insert profile (the trigger handle_new_user should create it, but we update to ensure name + active)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ name, active: active !== false })
      .eq("id", userId);

    if (profileError) {
      // Profile might not exist yet if trigger hasn't fired, try upsert
      await adminClient.from("profiles").upsert({
        id: userId,
        name,
        email,
        active: active !== false,
      });
    }

    // 6. Insert role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (roleError) {
      // Cleanup: delete the auth user if role assignment fails
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: `Error asignando rol: ${roleError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, name, email, role, active: active !== false },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
