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

    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      throw new Error("Token e nova senha são obrigatórios");
    }

    // Strong password validation
    const passwordErrors: string[] = [];
    if (newPassword.length < 8) {
      passwordErrors.push("mínimo 8 caracteres");
    }
    if (!/[a-z]/.test(newPassword)) {
      passwordErrors.push("uma letra minúscula");
    }
    if (!/[A-Z]/.test(newPassword)) {
      passwordErrors.push("uma letra maiúscula");
    }
    if (!/[0-9]/.test(newPassword)) {
      passwordErrors.push("um número");
    }
    
    if (passwordErrors.length > 0) {
      throw new Error(`A senha deve conter: ${passwordErrors.join(", ")}`);
    }

    console.log(`Validating password reset token`);

    // Validate token using the secure function
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'validate_password_reset_token',
      { p_token: token }
    );

    if (tokenError) {
      console.error("Error validating token:", tokenError);
      throw new Error("Erro ao validar token");
    }

    if (!tokenData || tokenData.length === 0 || !tokenData[0].is_valid) {
      throw new Error("Token inválido ou expirado");
    }

    const userId = tokenData[0].user_id;
    const email = tokenData[0].email;

    console.log(`Updating password for user: ${userId}`);

    // Update user password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Erro ao atualizar senha");
    }

    // Mark token as used
    const { error: markError } = await supabase.rpc('mark_password_reset_token_used', {
      p_token: token,
    });

    if (markError) {
      console.error("Error marking token as used:", markError);
      // Don't throw - password was already updated
    }

    console.log(`Password updated successfully for user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha atualizada com sucesso",
        email: email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in update-user-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
