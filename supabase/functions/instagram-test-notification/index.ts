// Envia uma mensagem de TESTE via WhatsApp para os números dos gestores
// configurados em instagram_settings, usando a instância ativa da Evolution API.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: settings, error: sErr } = await supabase
      .from("instagram_settings")
      .select("manager_numbers, notify_whatsapp, account_username")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sErr) throw new Error("Erro ao carregar instagram_settings");

    const numbers: string[] = (settings?.manager_numbers as string[]) || [];
    if (!numbers.length) {
      return json({ success: false, error: "Nenhum número de gestor cadastrado." }, 400);
    }

    const { data: instance, error: iErr } = await supabase
      .from("billing_whatsapp_instances")
      .select("api_url, api_key, instance_name")
      .eq("is_active", true)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (iErr || !instance) {
      return json({ success: false, error: "Nenhuma instância Evolution ativa configurada." }, 400);
    }
    const { api_url, api_key, instance_name } = instance;
    if (!api_url || !api_key || !instance_name) {
      return json({ success: false, error: "Instância Evolution incompleta." }, 400);
    }

    const dateStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const text = `*🧪 Teste de notificação Instagram*\n\n✅ Se você recebeu esta mensagem, as notificações de renovação de token estão funcionando corretamente.\n\n👤 Conta: ${settings?.account_username || user.email}\n📅 Enviado em: ${dateStr}\n\n_Mensagem gerada pelo botão "Testar notificação" no painel /instagram._`;

    const results: Array<{ number: string; ok: boolean; status?: number; error?: string }> = [];
    for (const raw of numbers) {
      const number = (raw || "").replace(/\D/g, "");
      if (!number) {
        results.push({ number: raw, ok: false, error: "Número inválido" });
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
        } else {
          results.push({ number, ok: true, status: res.status });
        }
      } catch (e: any) {
        console.error(`[ig-test-notif] Erro ${number}:`, e);
        results.push({ number, ok: false, error: e?.message || String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return json({
      success: okCount > 0,
      instance: instance_name,
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
