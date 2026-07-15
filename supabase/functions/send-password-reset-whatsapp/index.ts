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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Require authenticated admin caller — WhatsApp reset is admin-only
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, phone, userName, instanceName, apiUrl, apiKey } = await req.json();

    if (!userId || !phone) {
      throw new Error("userId e phone são obrigatórios");
    }

    const evolutionApiUrl = apiUrl || Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = apiKey || Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = instanceName || Deno.env.get("EVOLUTION_INSTANCE");

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      throw new Error("Credenciais da Evolution API não configuradas");
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    const { data: tokenCreated, error: rpcError } = await admin.rpc("create_password_reset_token", {
      p_user_id: userId,
      p_email: profile?.email || "",
      p_token: token,
      p_expires_at: expiresAt.toISOString(),
    });

    if (rpcError) {
      console.error("Error creating token:", rpcError);
      throw new Error("Erro ao gerar token de recuperação");
    }

    if (!tokenCreated) {
      throw new Error("Limite de solicitações atingido. Tente novamente em 1 hora.");
    }

    const resetLink = `https://astros-crm.lovable.app/redefinir-senha?token=${token}`;

    const message = `🔐 *Recuperação de Senha*

Olá, ${userName || "Usuário"}!

Você solicitou a recuperação da sua senha do Sistema Astros.

Clique no link abaixo para criar uma nova senha:
${resetLink}

⚠️ Este link expira em 1 hora.

Se você não solicitou esta recuperação, ignore esta mensagem.`;

    const evolutionUrl = `${evolutionApiUrl}/message/sendText/${evolutionInstance}`;

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionApiKey,
      },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Evolution API error:", errorText);
      throw new Error(`Erro ao enviar WhatsApp: ${response.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Mensagem WhatsApp enviada com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset-whatsapp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
