import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

type IncomingPayload = {
  evento: string;
  timestamp?: string;
  numero?: unknown;
  modelo?: unknown;
  status?: unknown;
  exclusao?: unknown;
  // allow future fields
  [key: string]: unknown;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = (await req.json()) as IncomingPayload;
    const event = String(payload?.evento || "");

    if (!event) {
      return new Response(JSON.stringify({ error: "evento is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich payload with modelo/status when only IDs were provided
    const numero = (payload?.numero ?? null) as any;
    const modeloId = typeof numero?.modelo_id === "string" ? numero.modelo_id : null;
    const statusId = typeof numero?.status_id === "string" ? numero.status_id : null;

    let modelo = (payload?.modelo ?? numero?.modelo ?? null) as any;
    let status = (payload?.status ?? numero?.status ?? null) as any;

    if (!modelo && modeloId) {
      const { data: m } = await supabase
        .from("numeros_aquecimento_modelos")
        .select("*")
        .eq("id", modeloId)
        .maybeSingle();
      modelo = m ?? null;
    }

    if (!status && statusId) {
      const { data: s } = await supabase
        .from("numeros_aquecimento_status")
        .select("*")
        .eq("id", statusId)
        .maybeSingle();
      status = s ?? null;
    }

    const enrichedPayload: IncomingPayload = {
      ...payload,
      // Top-level convenience
      modelo,
      status,
      modelo_nome: (modelo as any)?.nome ?? null,
      status_nome: (status as any)?.nome ?? null,
      // n8n-friendly structure
      numero: numero && typeof numero === "object"
        ? {
            ...numero,
            modelo,
            status,
            modelo_nome: (modelo as any)?.nome ?? null,
            status_nome: (status as any)?.nome ?? null,
          }
        : numero,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    };

    const { data: webhooks, error: webhooksError } = await supabase
      .from("numeros_aquecimento_webhooks")
      .select("*")
      .eq("is_active", true)
      .contains("eventos", [event]);

    if (webhooksError) throw webhooksError;

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ success: true, delivered: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let delivered = 0;
    const results: Array<{ id: string; nome: string; ok: boolean; status?: number; error?: string }> = [];

    for (const webhook of webhooks) {
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhook.secret_key ? { "X-Webhook-Secret": webhook.secret_key } : {}),
          },
          body: JSON.stringify(enrichedPayload),
        });

        const ok = res.ok;
        if (ok) delivered += 1;

        results.push({ id: webhook.id, nome: webhook.nome, ok, status: res.status });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ id: webhook.id, nome: webhook.nome, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, delivered, total: webhooks.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[numeros-webhook-proxy] Error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
