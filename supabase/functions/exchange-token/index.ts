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
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid token
    const { data: tokenRow, error: fetchErr } = await supabaseAdmin
      .from("login_tokens")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (fetchErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Token invalid or expired" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark token as used
    await supabaseAdmin
      .from("login_tokens")
      .update({ used: true })
      .eq("id", tokenRow.id);

    // Get user email for magic link generation
    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.admin.getUserById(tokenRow.user_id);

    if (userErr || !userData?.user?.email) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a magic link for the user (creates a session)
    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
      });

    if (linkErr || !linkData) {
      return new Response(
        JSON.stringify({ error: "Failed to generate session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract the hashed_token and verification type from the link
    // The properties object contains the token data we need
    const properties = linkData.properties;

    return new Response(
      JSON.stringify({
        hashed_token: properties.hashed_token,
        redirect_path: tokenRow.redirect_path,
        verification_type: "magiclink",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
