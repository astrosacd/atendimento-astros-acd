import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { action } = await req.json();

    const { data: settings, error: settingsError } = await supabase
      .from('instagram_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !settings) throw new Error("Configurações do Instagram não encontradas");

    const { access_token, app_id, app_secret } = settings;
    if (!access_token) throw new Error("Token de acesso não configurado");

    const graphHost = "https://graph.facebook.com/v23.0";

    if (action === "debug") {
      if (!app_id || !app_secret) {
        throw new Error("App ID e App Secret são necessários para depurar o token");
      }

      const appAccessToken = `${app_id}|${app_secret}`;
      const debugUrl = `${graphHost}/debug_token?input_token=${access_token}&access_token=${appAccessToken}`;
      
      const res = await fetch(debugUrl);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(`Erro ao depurar token: ${JSON.stringify(result)}`);
      }

      const { data } = result;
      const expiresAt = data.data_access_expires_at || data.expires_at;
      
      let expirationDate = null;
      if (expiresAt) {
        expirationDate = new Date(expiresAt * 1000).toISOString();
      }

      // Update the database with the expiration date
      if (expirationDate) {
        await supabase
          .from('instagram_settings')
          .update({ token_expires_at: expirationDate })
          .eq('user_id', user.id);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          is_valid: data.is_valid,
          expires_at: expirationDate,
          scopes: data.scopes,
          user_id: data.user_id
        } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "refresh") {
      if (!app_id || !app_secret) {
        throw new Error("App ID e App Secret são necessários para renovar o token");
      }

      const refreshUrl = `${graphHost}/oauth/access_token?grant_type=fb_exchange_token&client_id=${app_id}&client_secret=${app_secret}&fb_exchange_token=${access_token}`;
      
      const res = await fetch(refreshUrl);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(`Erro ao renovar token: ${JSON.stringify(result)}`);
      }

      const newAccessToken = result.access_token;
      const expiresIn = result.expires_in; // seconds
      
      let expirationDate = null;
      if (expiresIn) {
        expirationDate = new Date(Date.now() + expiresIn * 1000).toISOString();
      }

      // Update the database with the new token and expiration date
      await supabase
        .from('instagram_settings')
        .update({ 
          access_token: newAccessToken,
          token_expires_at: expirationDate,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Token renovado com sucesso",
        data: {
          expires_at: expirationDate
        } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error("Ação inválida");

  } catch (error: any) {
    console.error("Error managing Instagram token:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
