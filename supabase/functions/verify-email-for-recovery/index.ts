import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Use service role to query profiles - no RLS bypass needed since we're using service key
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, name, email, approval_status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Error querying profiles:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      // Return a generic message to prevent email enumeration
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: "Usuário não encontrado" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check approval status
    if (profile.approval_status && profile.approval_status !== 'approved') {
      const isPending = profile.approval_status === 'pending';
      return new Response(
        JSON.stringify({ 
          found: true,
          canRecover: false,
          isPending,
          message: isPending 
            ? 'Conta ainda não aprovada' 
            : 'Conta rejeitada'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return minimal data needed for recovery
    return new Response(
      JSON.stringify({ 
        found: true,
        canRecover: true,
        userId: profile.user_id,
        userName: profile.name,
        userEmail: profile.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in verify-email-for-recovery:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
