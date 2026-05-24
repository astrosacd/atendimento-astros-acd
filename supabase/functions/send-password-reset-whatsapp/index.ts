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

    const { userId, phone, userName, instanceName, apiUrl, apiKey } = await req.json();

    if (!userId || !phone) {
      throw new Error("userId e phone são obrigatórios");
    }

    // Use passed credentials or fallback to env vars
    const evolutionApiUrl = apiUrl || Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = apiKey || Deno.env.get("EVOLUTION_API_KEY");
    const evolutionInstance = instanceName || Deno.env.get("EVOLUTION_INSTANCE");

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      console.error("Missing Evolution API credentials");
      throw new Error("Credenciais da Evolution API não configuradas");
    }

    const cleanPhone = phone.replace(/\D/g, '');
    console.log(`Generating password reset token for user: ${userId}`);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Get user email from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    // Store token using RPC function with rate limiting
    const { data: tokenCreated, error: rpcError } = await supabase.rpc('create_password_reset_token', {
      p_user_id: userId,
      p_email: profile?.email || "",
      p_token: token,
      p_expires_at: expiresAt.toISOString()
    });

    if (rpcError) {
      console.error("Error creating token:", rpcError);
      throw new Error("Erro ao gerar token de recuperação");
    }

    if (!tokenCreated) {
      throw new Error("Limite de solicitações atingido. Tente novamente em 1 hora.");
    }

    // Create the reset link with actual app domain
    const resetLink = `https://astros-crm.lovable.app/redefinir-senha?token=${token}`;

    console.log(`Sending password reset WhatsApp to: ${cleanPhone}`);

    const message = `🔐 *Recuperação de Senha*

Olá, ${userName || 'Usuário'}!

Você solicitou a recuperação da sua senha do Sistema Astros.

Clique no link abaixo para criar uma nova senha:
${resetLink}

⚠️ Este link expira em 1 hora.

Se você não solicitou esta recuperação, ignore esta mensagem.`;

    // Send message via Evolution API
    const evolutionUrl = `${evolutionApiUrl}/message/sendText/${evolutionInstance}`;
    console.log(`Calling Evolution API: ${evolutionUrl}`);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionApiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Evolution API error:", errorText);
      throw new Error(`Erro ao enviar WhatsApp: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("Evolution API response:", responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Mensagem WhatsApp enviada com sucesso" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset-whatsapp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
