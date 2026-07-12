// Envia uma mensagem de TESTE via WhatsApp para os números dos gestores
// configurados em instagram_settings, usando a instância ativa da Evolution API.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const logEvent = async (
    user_id: string | null,
    status: string,
    message: string,
    metadata: Record<string, unknown> = {},
    target?: string,
  ) => {
    try {
      await supabase.from("instagram_notification_logs").insert({
        user_id,
        event_type: "test_notification",
        status,
        channel: "whatsapp",
        target: target ?? null,
        message,
        metadata,
      });
    } catch (e) {
      console.error("[ig-test-notif] log fail:", e);
    }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: settings, error: sErr } = await supabase
      .from("instagram_settings")
      .select("manager_numbers, notify_whatsapp, account_username, evolution_api_url, evolution_api_key, evolution_instance_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sErr) throw new Error("Erro ao carregar instagram_settings");

    const numbers: string[] = (settings?.manager_numbers as string[]) || [];
    if (!numbers.length) {
      await logEvent(user.id, "failed", "Nenhum número de gestor cadastrado.");
      return json({ success: false, error: "Nenhum número de gestor cadastrado." }, 400);
    }

    // 1) Preferir credenciais dedicadas do módulo Instagram
    let api_url = (settings?.evolution_api_url || "").trim();
    let api_key = (settings?.evolution_api_key || "").trim();
    let instance_name = (settings?.evolution_instance_name || "").trim();
    let source: "instagram_settings" | "billing_whatsapp_instances" = "instagram_settings";

    // 2) Fallback: instância ativa do sistema
    if (!api_url || !api_key || !instance_name) {
      const { data: instance, error: iErr } = await supabase
        .from("billing_whatsapp_instances")
        .select("api_url, api_key, instance_name")
        .eq("is_active", true)
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (iErr || !instance?.api_url || !instance?.api_key || !instance?.instance_name) {
        await logEvent(user.id, "failed", "Nenhuma credencial Evolution configurada (nem no módulo Instagram, nem instância ativa do sistema).");
        return json({ success: false, error: "Configure a Evolution API na aba Notificações do módulo Instagram (URL, API Key e Nome da instância)." }, 400);
      }
      api_url = instance.api_url;
      api_key = instance.api_key;
      instance_name = instance.instance_name;
      source = "billing_whatsapp_instances";
    }

    const dateStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const text = `*🧪 Teste de notificação Instagram*\n\n✅ Se você recebeu esta mensagem, as notificações de renovação de token estão funcionando corretamente.\n\n👤 Conta: ${settings?.account_username || user.email}\n📅 Enviado em: ${dateStr}\n\n_Mensagem gerada pelo botão "Testar notificação" no painel /instagram._`;

    const results: Array<{ number: string; ok: boolean; status?: number; error?: string }> = [];
    for (const raw of numbers) {
      const number = (raw || "").replace(/\D/g, "");
      if (!number) {
        results.push({ number: raw, ok: false, error: "Número inválido" });
        await logEvent(user.id, "failed", "Número inválido", { raw }, raw);
        continue;
      }
      try {
        const res = await fetch(`${api_url}/message/sendText/${instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: api_key },
          body: JSON.stringify({ number, text, delay: 1200 }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`[ig-test-notif] Falha ${number} [${res.status}]: ${body}`);
          results.push({ number, ok: false, status: res.status, error: body.slice(0, 200) });
          await logEvent(user.id, "failed", `HTTP ${res.status}: ${body.slice(0, 200)}`, { instance: instance_name }, number);
        } else {
          results.push({ number, ok: true, status: res.status });
          await logEvent(user.id, "success", "Teste enviado com sucesso", { instance: instance_name }, number);
        }
      } catch (e: any) {
        console.error(`[ig-test-notif] Erro ${number}:`, e);
        results.push({ number, ok: false, error: e?.message || String(e) });
        await logEvent(user.id, "failed", e?.message || String(e), { instance: instance_name }, number);
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return json({
      success: okCount > 0,
      instance: instance_name,
      source,
      total: results.length,
      sent: okCount,
      failed: results.length - okCount,
      results,
    });
  } catch (error: any) {
    console.error("[ig-test-notif] Fatal:", error);
    return json({ success: false, error: error?.message || String(error) }, 500);
  }
});
