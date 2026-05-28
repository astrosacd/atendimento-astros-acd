import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
};

const BRT_TZ = "America/Sao_Paulo";

function todayBrt(): { date: string; ano: number; mes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const ano = Number(get("year"));
  const mes = Number(get("month"));
  const dia = get("day");
  return { date: `${ano}-${String(mes).padStart(2, "0")}-${dia}`, ano, mes };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const baserowRowId = Number(body.baserow_row_id);
    const paymentMethod: string | undefined = body.payment_method;
    const paymentLinkId: string | undefined = body.payment_link_id;
    const observacao: string | undefined = body.observacao;
    const manualObs: string | undefined = body.payment_manual_observacao;
    const comprovanteUrl: string | undefined = body.payment_comprovante_url;

    if (!baserowRowId || !Number.isFinite(baserowRowId)) {
      return new Response(JSON.stringify({ error: "baserow_row_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load config
    const { data: configRows } = await supabase
      .from("qr_scan_config")
      .select("*")
      .limit(1);
    const config = configRows?.[0] ?? { qtd_gratis_por_mes: 4, valor_excedente: 14.97, qtd_por_dia: 2, ativo: true };
    
    // Daily limit from config (defaults to 2 if not set)
    const DAILY_LIMIT = config.qtd_por_dia ?? 2;
    
    if (!config.ativo) {
      return new Response(JSON.stringify({ error: "Módulo de QR Scan desativado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Number must be flagged auto_hospedado
    const { data: cacheRow, error: cacheErr } = await supabase
      .from("consulta_numeros_cache")
      .select("baserow_row_id, row_data, auto_hospedado")
      .eq("baserow_row_id", baserowRowId)
      .maybeSingle();
    if (cacheErr || !cacheRow) {
      return new Response(JSON.stringify({ error: "Número não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!cacheRow.auto_hospedado) {
      return new Response(JSON.stringify({ error: "Número não está marcado como auto-hospedado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rd: any = cacheRow.row_data || {};
    const numeroStr = String(rd.numero ?? rd.Numero ?? "");
    const clienteNome = rd.nome ?? rd.Nome ?? rd.cliente ?? null;

    const { date: hoje, ano, mes } = todayBrt();

    // Daily check (any active scan today)
    const { data: todayScans } = await supabase
      .from("qr_scan_history")
      .select("id, payment_status")
      .eq("baserow_row_id", baserowRowId)
      .eq("scan_date", hoje)
      .in("payment_status", ["nao_aplica", "pendente", "pago"]);
    if ((todayScans?.length ?? 0) >= DAILY_LIMIT) {
      return new Response(JSON.stringify({
        ok: false,
        status: "daily_limit",
        message: "Limite diário atingido. Este número já tem um escaneamento registrado hoje.",
        blocked: "daily_limit",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Monthly counter
    const { data: counter } = await supabase
      .from("qr_scan_monthly_counter")
      .select("*")
      .eq("baserow_row_id", baserowRowId)
      .eq("ano", ano).eq("mes", mes)
      .maybeSingle();
    const gratisUsados = counter?.qtd_gratis_usados ?? 0;
    const aindaTemGratis = gratisUsados < (config.qtd_gratis_por_mes ?? 4);

    // Free flow
    if (aindaTemGratis) {
      const { data: inserted, error: insErr } = await supabase
        .from("qr_scan_history")
        .insert({
          baserow_row_id: baserowRowId,
          numero: numeroStr,
          cliente_nome: clienteNome,
          scan_date: hoje,
          tipo: "gratis",
          payment_status: "nao_aplica",
          operador_user_id: userId,
          observacao,
          paid_at: new Date().toISOString(),
          confirmed_by: userId,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // Increment counter
      await supabase.from("qr_scan_monthly_counter").upsert({
        baserow_row_id: baserowRowId, ano, mes,
        qtd_gratis_usados: gratisUsados + 1,
        qtd_pagos: counter?.qtd_pagos ?? 0,
      }, { onConflict: "baserow_row_id,ano,mes" });

      return new Response(JSON.stringify({
        ok: true, status: "gratis_registrado", scan: inserted,
        restantes_gratis: (config.qtd_gratis_por_mes ?? 4) - (gratisUsados + 1),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Needs payment
    if (!paymentMethod) {
      return new Response(JSON.stringify({
        ok: false,
        status: "needs_payment",
        valor: config.valor_excedente,
        message: `Limite grátis de ${config.qtd_gratis_por_mes} atingido este mês. Escaneamento adicional: R$ ${config.valor_excedente}.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allowedMethods = ["link_mp", "link_stripe", "manual_pix", "manual_saldo", "manual_outro"];
    if (!allowedMethods.includes(paymentMethod)) {
      return new Response(JSON.stringify({ error: "payment_method inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If link_mp / link_stripe: generate the payment link via the existing function
    let generatedLinkId: string | null = paymentLinkId ?? null;
    let generatedPaymentUrl: string | null = null;
    if (paymentMethod === "link_mp" || paymentMethod === "link_stripe") {
      const provider = paymentMethod === "link_mp" ? "mercadopago" : "stripe";
      const empresa = (clienteNome && String(clienteNome).trim()) || `QR Scan ${numeroStr}`;
      const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-payment-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          empresa,
          provider,
          valor_da_venda: config.valor_excedente,
          validade_horas: 48,
        }),
      });
      const genJson = await genRes.json().catch(() => ({}));
      if (!genRes.ok || !genJson?.success) {
        return new Response(JSON.stringify({
          error: genJson?.error || "Falha ao gerar link de pagamento",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      generatedLinkId = genJson.link_id ?? null;
      generatedPaymentUrl = genJson.payment_url ?? null;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("qr_scan_history")
      .insert({
        baserow_row_id: baserowRowId,
        numero: numeroStr,
        cliente_nome: clienteNome,
        scan_date: hoje,
        tipo: "pago",
        valor_cobrado: config.valor_excedente,
        payment_status: "pendente",
        payment_method: paymentMethod,
        payment_link_id: generatedLinkId,
        payment_manual_observacao: manualObs ?? null,
        payment_comprovante_url: comprovanteUrl ?? null,
        operador_user_id: userId,
        observacao,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({
      ok: true, status: "pendente_pagamento", scan: inserted,
      valor: config.valor_excedente,
      payment_url: generatedPaymentUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[qr-scan-register]", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
