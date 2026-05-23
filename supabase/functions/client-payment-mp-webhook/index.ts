// Webhook do Mercado Pago para o módulo de COBRANÇA RECORRENTE (/admin/cobranca).
// Recebe a notificação (IPN/Webhook), busca o pagamento na API do MP para CONFIRMAR
// (nunca confia só no payload), e ao confirmar como "approved":
//   1) Marca o client_payments correspondente como "paid"
//   2) Avança data_renovacao do cliente em 1 ciclo
//   3) Cancela TODAS as outras cobranças pendentes do mesmo cliente
//
// Configure em: Mercado Pago → Seu Aplicativo → Webhooks/IPN
//   URL: https://<project>.supabase.co/functions/v1/client-payment-mp-webhook
//   Eventos: payment
//
// Sem verify_jwt (chamado por servidor externo).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id, x-webhook-test",
};

const CYCLE_MONTHS: Record<string, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ===== TEST MODE =====
  // Permite o painel admin verificar que o endpoint está vivo e acessível
  // sem disparar nenhuma lógica de pagamento. Header: x-webhook-test: ping
  if (req.headers.get("x-webhook-test") === "ping") {
    const tokenOk = !!Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    return new Response(
      JSON.stringify({
        ok: true,
        test: true,
        provider: "mercadopago",
        url_reachable: true,
        access_token_configured: tokenOk,
        message: tokenOk
          ? "Webhook do Mercado Pago acessível e MERCADOPAGO_ACCESS_TOKEN está configurado."
          : "Webhook acessível, mas falta MERCADOPAGO_ACCESS_TOKEN nos Secrets.",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) {
      console.error("[mp-webhook] MERCADOPAGO_ACCESS_TOKEN ausente");
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: corsHeaders });
    }

    // MP envia tanto via body JSON quanto via query string. Aceita os dois.
    const url = new URL(req.url);
    const qpType = url.searchParams.get("type") || url.searchParams.get("topic");
    const qpId = url.searchParams.get("data.id") || url.searchParams.get("id");

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const eventType = body?.type || body?.topic || qpType;
    const mpPaymentId = body?.data?.id || body?.resource || qpId;

    console.log("[mp-webhook] event:", eventType, "id:", mpPaymentId);

    // MP envia vários tipos. Só nos interessa "payment".
    if (eventType && !String(eventType).includes("payment")) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!mpPaymentId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no_id" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CONFIRMA chamando a API do MP (anti-spoof)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    if (!mpRes.ok) {
      console.error(`[mp-webhook] MP API ${mpRes.status} para ${mpPaymentId}`);
      // 200 para o MP não retentar infinitamente em casos de id inválido
      return new Response(JSON.stringify({ ok: false, mpStatus: mpRes.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpRes.json();
    const mpStatus = mpData?.status; // approved | pending | rejected | cancelled | in_process
    const externalRef = mpData?.external_reference;
    console.log(`[mp-webhook] MP payment ${mpPaymentId} status=${mpStatus} ext_ref=${externalRef}`);

    // Acha o client_payments: 1º por payment_id exato; 2º por preference_id (external_reference)
    let { data: payment } = await supabase
      .from("client_payments")
      .select("*, cliente:clientes(id, data_renovacao, ciclo_cobranca, cobranca_ativa)")
      .eq("payment_id", String(mpPaymentId))
      .maybeSingle();

    if (!payment && externalRef) {
      const { data: byRef } = await supabase
        .from("client_payments")
        .select("*, cliente:clientes(id, data_renovacao, ciclo_cobranca, cobranca_ativa)")
        .eq("preference_id", String(externalRef))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = byRef ?? null;
    }

    if (!payment) {
      console.warn(`[mp-webhook] Sem client_payments para mpId=${mpPaymentId} ext_ref=${externalRef}`);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "paid") {
      return new Response(JSON.stringify({ ok: true, already_paid: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mapeia status
    if (mpStatus === "rejected" || mpStatus === "cancelled") {
      await supabase.from("client_payments").update({ status: mpStatus }).eq("id", payment.id);
      return new Response(JSON.stringify({ ok: true, status: mpStatus }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mpStatus !== "approved") {
      // pending / in_process — nada a fazer
      return new Response(JSON.stringify({ ok: true, status: mpStatus }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paidAt = mpData?.date_approved || new Date().toISOString();

    // 1) Marca como pago + atualiza id real do MP
    await supabase.from("client_payments").update({
      status: "paid",
      paid_at: paidAt,
      payment_id: String(mpPaymentId),
      approval_reason: "Confirmado via webhook Mercado Pago",
    }).eq("id", payment.id);

    // 2) Renovação do cliente
    const cliente: any = payment.cliente;
    if (cliente?.id && cliente?.cobranca_ativa !== false && cliente?.data_renovacao && cliente?.ciclo_cobranca) {
      const venc = new Date(cliente.data_renovacao);
      venc.setHours(0, 0, 0, 0);
      const months = CYCLE_MONTHS[cliente.ciclo_cobranca] || 1;
      const renewalDate = new Date(venc);
      renewalDate.setMonth(renewalDate.getMonth() + months);
      const newRenewalDate = renewalDate.toISOString().split("T")[0];
      await supabase.from("clientes").update({ data_renovacao: newRenewalDate }).eq("id", cliente.id);
      console.log(`[mp-webhook] Renovação ${cliente.id}: ${cliente.data_renovacao} → ${newRenewalDate}`);
    }

    // 3) Cancela as outras cobranças pendentes do mesmo cliente
    if (cliente?.id) {
      const { data: cancelled } = await supabase
        .from("client_payments")
        .update({
          status: "cancelled",
          approval_reason: `Cancelado automaticamente — pago via ${payment.payment_type} (Mercado Pago)`,
        })
        .eq("cliente_id", cliente.id)
        .in("status", ["pending", "pending_approval"])
        .neq("id", payment.id)
        .select("id");
      console.log(`[mp-webhook] Auto-canceladas: ${cancelled?.length ?? 0}`);
    }

    // 4) Envia recibo
    if (cliente?.id && cliente?.cobranca_ativa !== false) {
      try {
        await supabase.functions.invoke("send-receipt", {
          body: { clienteId: cliente.id, paymentId: payment.id, paidAt },
        });
      } catch (e) {
        console.error("[mp-webhook] Falha ao enviar recibo:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, status: "paid" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[mp-webhook] erro:", e);
    // Sempre 200 para MP não retentar em loop por erro nosso
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
