// Edge function que dispara o processamento PixPague em BACKGROUND.
// Retorna imediatamente para o cliente (200 OK) e usa EdgeRuntime.waitUntil
// para garantir que o OCR + checagem de duplicado + notificação WhatsApp
// sejam executados mesmo que o navegador do cliente feche a conexão.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// @ts-ignore — EdgeRuntime é global no Deno Deploy/Supabase
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

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

    console.log("[pixpague-trigger] Scheduling background processing for:", paymentId, "manualReview:", !!manualReview);

    const backgroundTask = (async () => {
      try {
        console.log("[pixpague-trigger] Invoking pixpague-process-proof...");
        const { data, error } = await supabase.functions.invoke("pixpague-process-proof", {
          body: { paymentId, proofUrl, declaredAmount, manualReview },
          headers: {
            "Authorization": req.headers.get("Authorization") || ""
          }
        });
        
        if (error) {
          console.error("[pixpague-trigger] Background processing error:", error);
        } else {
          console.log("[pixpague-trigger] Background processing finished:", JSON.stringify(data));
        }
      } catch (e) {
        console.error("[pixpague-trigger] Background exception during invoke:", e);
      }
    })();

    // Garante que o runtime aguarde a tarefa terminar mesmo após responder
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask);
    }

    // Resposta imediata
    return new Response(
      JSON.stringify({ success: true, scheduled: true, paymentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("[pixpague-trigger] error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
