// Webhook da Stripe para o módulo de COBRANÇA RECORRENTE (/admin/cobranca).
// Valida assinatura via STRIPE_WEBHOOK_SECRET (campo billing_stripe_config.stripe_webhook_secret).
// Eventos tratados:
//   - checkout.session.completed
//   - payment_intent.succeeded
//   - payment_link.* (apenas log)
//
// Ao confirmar pagamento:
//   1) Marca client_payments como "paid"
//   2) Avança data_renovacao em 1 ciclo
//   3) Cancela TODAS as outras cobranças pendentes do mesmo cliente
//
// Configure em: Stripe Dashboard → Developers → Webhooks → Add endpoint
//   URL: https://<project>.supabase.co/functions/v1/client-payment-stripe-webhook
//   Eventos: checkout.session.completed, payment_intent.succeeded
//
// Sem verify_jwt (chamado por servidor externo).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-webhook-test",
};

const CYCLE_MONTHS: Record<string, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
};

// HMAC-SHA256 hex
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Validação compatível com lib oficial da Stripe (t=<ts>,v1=<sig>)
async function verifyStripeSignature(payload: string, header: string, secret: string, toleranceSec = 300): Promise<boolean> {
  const parts = header.split(",").reduce((acc, p) => {
    const [k, v] = p.split("=");
    if (!acc[k]) acc[k] = [];
    acc[k].push(v);
    return acc;
  }, {} as Record<string, string[]>);

  const ts = parts["t"]?.[0];
  const sigs = parts["v1"] || [];
  if (!ts || sigs.length === 0) return false;

  // Tolerância de tempo (anti-replay)
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(ts)) > toleranceSec) return false;

  const signedPayload = `${ts}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  // Comparação simples (entradas curtas, baixo risco de timing)
  return sigs.some(s => s === expected);
}

async function applyPaidPayment(
  supabase: any,
  payment: any,
  paidAt: string,
  stripeIdLog: string
) {
  // 1) marca como paga
  await supabase.from("client_payments").update({
    status: "paid",
    paid_at: paidAt,
    approval_reason: `Confirmado via webhook Stripe (${stripeIdLog})`,
  }).eq("id", payment.id);

  // 2) renovação
  const cliente: any = payment.cliente;
  if (cliente?.id && cliente?.cobranca_ativa !== false && cliente?.data_renovacao && cliente?.ciclo_cobranca) {
    const venc = new Date(cliente.data_renovacao);
    venc.setHours(0, 0, 0, 0);
    const months = CYCLE_MONTHS[cliente.ciclo_cobranca] || 1;
    const renewalDate = new Date(venc);
    renewalDate.setMonth(renewalDate.getMonth() + months);
    const newRenewalDate = renewalDate.toISOString().split("T")[0];
    await supabase.from("clientes").update({ data_renovacao: newRenewalDate }).eq("id", cliente.id);
    console.log(`[stripe-webhook] Renovação ${cliente.id}: ${cliente.data_renovacao} → ${newRenewalDate}`);
  }

  // 3) cancela outras pendências
  if (cliente?.id) {
    const { data: cancelled } = await supabase
      .from("client_payments")
      .update({
        status: "cancelled",
        approval_reason: `Cancelado automaticamente — pago via ${payment.payment_type} (Stripe)`,
      })
      .eq("cliente_id", cliente.id)
      .in("status", ["pending", "pending_approval"])
      .neq("id", payment.id)
      .select("id");
    console.log(`[stripe-webhook] Auto-canceladas: ${cancelled?.length ?? 0}`);

    // Cancela ligações IA e SMS agendados pendentes
    const { data: cancLig } = await supabase
      .from("ligacoes_agendadas")
      .update({ status: "cancelada", erro: "Cancelada automaticamente: pagamento confirmado (Stripe)", updated_at: new Date().toISOString() })
      .eq("cliente_id", cliente.id)
      .eq("status", "pendente")
      .select("id");
    console.log(`[stripe-webhook] Ligações IA canceladas: ${cancLig?.length ?? 0}`);

    const { data: cancSms } = await supabase
      .from("sms_agendados")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("cliente_id", cliente.id)
      .eq("status", "pendente")
      .select("id");
    console.log(`[stripe-webhook] SMS cancelados: ${cancSms?.length ?? 0}`);
  }

  // 4) recibo
  if (cliente?.id && cliente?.cobranca_ativa !== false) {
    try {
      await supabase.functions.invoke("send-receipt", {
        body: { clienteId: cliente.id, paymentId: payment.id, paidAt },
      });
    } catch (e) {
      console.error("[stripe-webhook] Falha recibo:", e);
    }
  }
}

async function findPaymentByStripeId(supabase: any, candidateIds: string[]) {
  for (const id of candidateIds.filter(Boolean)) {
    const { data } = await supabase
      .from("client_payments")
      .select("*, cliente:clientes(id, data_renovacao, ciclo_cobranca, cobranca_ativa)")
      .eq("payment_id", id)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ===== TEST MODE =====
    // Header x-webhook-test: ping → não valida assinatura, só responde diagnóstico.
    if (req.headers.get("x-webhook-test") === "ping") {
      const { data: cfg } = await supabase
        .from("billing_stripe_config")
        .select("stripe_enabled, stripe_webhook_secret")
        .maybeSingle();
      const { data: lastRealHit } = await supabase
        .from("billing_webhook_logs")
        .select("id, created_at, result")
        .eq("provider", "stripe")
        .eq("is_test", false)
        .in("result", ["received", "paid", "already_paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const secretOk = !!cfg?.stripe_webhook_secret;
      const enabled = !!cfg?.stripe_enabled;
      const ready = secretOk && !!lastRealHit;
      const msg = !secretOk
        ? "Endpoint acessível, mas falta o Signing Secret (whsec_...) — webhook NÃO vai validar notificações da Stripe."
        : !enabled
          ? "Endpoint tem Signing Secret, mas a Stripe está desabilitada em billing_stripe_config."
          : !lastRealHit
            ? "Endpoint acessível e Signing Secret salvo, mas ainda NÃO existe chamada real/simulada da Stripe registrada. Use 'Send test event' no painel da Stripe para validar de verdade."
            : `Stripe já bateu neste endpoint em ${new Date(lastRealHit.created_at).toLocaleString("pt-BR")}.`;
      try {
        await supabase.from("billing_webhook_logs").insert({
          provider: "stripe", event_type: "ping", http_status: 200,
          result: ready ? "ok" : (secretOk ? "not_confirmed_on_provider" : "missing_secret"), message: msg, is_test: true,
        });
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({
          ok: ready, test: true, provider: "stripe", url_reachable: true,
          stripe_enabled: enabled, signing_secret_configured: secretOk,
          provider_delivery_confirmed: !!lastRealHit, last_real_hit_at: lastRealHit?.created_at || null,
          message: msg, timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: cfg } = await supabase
      .from("billing_stripe_config")
      .select("stripe_enabled, stripe_webhook_secret")
      .maybeSingle();

    if (!cfg?.stripe_enabled || !cfg?.stripe_webhook_secret) {
      console.error("[stripe-webhook] desativado ou sem secret configurado");
      return new Response(JSON.stringify({ error: "not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sigHeader = req.headers.get("stripe-signature") || "";
    const rawBody = await req.text();

    const valid = await verifyStripeSignature(rawBody, sigHeader, cfg.stripe_webhook_secret);
    if (!valid) {
      console.error("[stripe-webhook] assinatura inválida");
      try {
        await supabase.from("billing_webhook_logs").insert({
          provider: "stripe", event_type: "invalid_signature", http_status: 400,
          result: "invalid_signature", message: "Assinatura HMAC inválida ou expirada",
        });
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    console.log("[stripe-webhook] event:", event.type, "id:", event.id);
    try {
      await supabase.from("billing_webhook_logs").insert({
        provider: "stripe", event_type: event.type, external_id: event.id,
        http_status: 200, result: "received", message: `Evento ${event.type} recebido`,
      });
    } catch { /* ignore */ }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ ok: true, ignored: "not_paid" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payment = await findPaymentByStripeId(supabase, [
        session.id,
        session.payment_intent,
        session.payment_link,
      ]);
      if (!payment) {
        console.warn("[stripe-webhook] session.completed sem match:", session.id);
        return new Response(JSON.stringify({ ok: true, matched: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (payment.status === "paid") {
        return new Response(JSON.stringify({ ok: true, already_paid: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await applyPaidPayment(supabase, payment, new Date().toISOString(), session.id);
      return new Response(JSON.stringify({ ok: true, status: "paid" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const payment = await findPaymentByStripeId(supabase, [pi.id]);
      if (!payment) {
        return new Response(JSON.stringify({ ok: true, matched: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (payment.status === "paid") {
        return new Response(JSON.stringify({ ok: true, already_paid: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const paidAt = pi.created ? new Date(pi.created * 1000).toISOString() : new Date().toISOString();
      await applyPaidPayment(supabase, payment, paidAt, pi.id);
      return new Response(JSON.stringify({ ok: true, status: "paid" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Outros eventos: ignora
    return new Response(JSON.stringify({ ok: true, ignored: event.type }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[stripe-webhook] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
