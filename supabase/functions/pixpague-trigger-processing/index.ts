// Edge function que dispara o processamento PixPague de forma confiável.
// O processamento precisa ser aguardado aqui porque o runtime pode encerrar
// tarefas em background logo após responder, deixando pagamento preso como
// "em processamento" e sem notificação WhatsApp.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("[pixpague-trigger] Received request body:", JSON.stringify(body));
    const { paymentId, proofUrl, declaredAmount, manualReview } = body;

    if (!paymentId) {
      console.error("[pixpague-trigger] Missing paymentId");
      return new Response(JSON.stringify({ error: "paymentId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[pixpague-trigger] Processing now for:", paymentId, "manualReview:", !!manualReview);

    const { data, error } = await supabase.functions.invoke("pixpague-process-proof", {
      body: { paymentId, proofUrl, declaredAmount, manualReview },
    });

    if (error) {
      console.error("[pixpague-trigger] Processing invocation error:", error);
      return new Response(JSON.stringify({ success: false, paymentId, error: error.message || error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[pixpague-trigger] Processing response:", JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, processed: true, paymentId, result: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("[pixpague-trigger] error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
