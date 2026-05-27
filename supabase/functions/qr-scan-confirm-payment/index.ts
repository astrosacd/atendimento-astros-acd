import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const body = await req.json().catch(() => ({}));
    const scanId: string | undefined = body.qr_scan_id;
    const action: string = body.action ?? "confirm"; // 'confirm' | 'cancel'
    const comprovanteUrl: string | undefined = body.comprovante_url;
    const observacao: string | undefined = body.observacao;

    if (!scanId) {
      return new Response(JSON.stringify({ error: "qr_scan_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: scan, error: getErr } = await supabase
      .from("qr_scan_history")
      .select("*")
      .eq("id", scanId)
      .single();
    if (getErr || !scan) {
      return new Response(JSON.stringify({ error: "Scan não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (scan.payment_status !== "pendente") {
      return new Response(JSON.stringify({ error: `Scan já está com status ${scan.payment_status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      await supabase.from("qr_scan_history").update({
        payment_status: "cancelado",
        confirmed_by: userData.user.id,
        observacao: observacao ?? scan.observacao,
      }).eq("id", scanId);
      return new Response(JSON.stringify({ ok: true, status: "cancelado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm
    await supabase.from("qr_scan_history").update({
      payment_status: "pago",
      paid_at: new Date().toISOString(),
      confirmed_by: userData.user.id,
      payment_comprovante_url: comprovanteUrl ?? scan.payment_comprovante_url,
      observacao: observacao ?? scan.observacao,
    }).eq("id", scanId);

    // Increment monthly counter (qtd_pagos)
    const scanDate = new Date(scan.scan_date);
    const ano = scanDate.getUTCFullYear();
    const mes = scanDate.getUTCMonth() + 1;
    const { data: counter } = await supabase
      .from("qr_scan_monthly_counter")
      .select("*")
      .eq("baserow_row_id", scan.baserow_row_id)
      .eq("ano", ano).eq("mes", mes)
      .maybeSingle();
    await supabase.from("qr_scan_monthly_counter").upsert({
      baserow_row_id: scan.baserow_row_id, ano, mes,
      qtd_gratis_usados: counter?.qtd_gratis_usados ?? 0,
      qtd_pagos: (counter?.qtd_pagos ?? 0) + 1,
    }, { onConflict: "baserow_row_id,ano,mes" });

    return new Response(JSON.stringify({ ok: true, status: "pago" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[qr-scan-confirm-payment]", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
