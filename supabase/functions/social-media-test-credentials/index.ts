import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", claims.claims.sub).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const body = await req.json();
    const testPhone: string | undefined = body.test_phone;
    const testEmail: string | undefined = body.test_email;

    const result: any = { graph_api: null, whatsapp: null, email: null };

    // 1) Graph API
    try {
      const { data: settings } = await admin.from("instagram_settings").select("access_token, ig_user_id").limit(1).maybeSingle();
      if (!settings?.ig_user_id || !settings?.access_token) throw new Error("instagram_settings sem ig_user_id ou access_token");
      const r = await fetch(`https://graph.facebook.com/v23.0/${settings.ig_user_id}?fields=id,username&access_token=${settings.access_token}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      result.graph_api = { success: true, username: j.username };
    } catch (e: any) {
      result.graph_api = { success: false, error: e.message };
    }

    const { data: config } = await admin.from("social_media_report_config").select("*").limit(1).maybeSingle();

    // 2) WhatsApp via Evolution (URL + Instance + Key)
    if (testPhone) {
      try {
        let apiUrl: string | undefined = config?.evolution_url;
        let apiKey: string | undefined = config?.evolution_apikey;
        let instanceName: string | undefined = config?.evolution_instance_name;

        if (!apiUrl || !apiKey || !instanceName) {
          const { data: inst } = await admin.from("billing_whatsapp_instances").select("*").eq("is_active", true).limit(1).maybeSingle();
          if (inst) { apiUrl = inst.api_url; apiKey = inst.api_key; instanceName = inst.instance_name; }
        }
        if (!apiUrl || !apiKey || !instanceName) throw new Error("Evolution API não configurada (URL + Instance + Key)");

        const r = await fetch(`${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: testPhone.replace(/\D/g, ""), text: "🧪 Teste de credenciais — Relatórios Social Media ✅" }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j)}`);
        result.whatsapp = { success: true, instance: instanceName };
      } catch (e: any) {
        result.whatsapp = { success: false, error: e.message };
      }
    }

    // 3) Email
    if (testEmail) {
      try {
        const host = config?.email_smtp_host || "smtp.gmail.com";
        const port = config?.email_smtp_port || 465;
        const user = config?.email_smtp_user;
        const pass = config?.email_smtp_pass;
        const from = config?.email_from || user;
        if (!user || !pass || !from) throw new Error("Email SMTP não configurado");
        const client = new SMTPClient({ connection: { hostname: host, port, tls: true, auth: { username: user, password: pass } } });
        await client.send({
          from: config?.email_from_name ? `${config.email_from_name} <${from}>` : from,
          to: testEmail, subject: "🧪 Teste — Relatórios Social Media",
          content: "Teste de credenciais OK", html: "<p><b>✅ Email funcionando!</b> — Relatórios Social Media</p>",
        });
        await client.close();
        result.email = { success: true };
      } catch (e: any) {
        result.email = { success: false, error: e.message };
      }
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("social-media-test-credentials:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
