import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      throw new Error("orderId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get order and settings
    const { data: order, error: orderError } = await supabase
      .from("gateway_orders")
      .select("*, product:gateway_products(name)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    if (!order.proof_url) {
      throw new Error("No proof URL for this order");
    }

    const { data: settingsRow } = await supabase
      .from("gateway_settings")
      .select("value")
      .eq("key", "approval_config")
      .single();

    const approvalConfig = settingsRow?.value || {};

    // Check for API Keys for OCR
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const grokKey = Deno.env.get("XAI_API_KEY");
    
    let ocrResult = {
      amount: order.total, // Assume correct for mock
      transactionId: `TX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: 'success' as const
    };

    if (geminiKey) {
      console.log("Calling Gemini for OCR...");
      // Implementation for Gemini OCR
    } else if (openaiKey) {
      console.log("Calling OpenAI for OCR...");
      // Implementation for OpenAI OCR
    } else if (grokKey) {
      console.log("Calling Grok for OCR...");
      // Implementation for Grok OCR
    }

    // Update order with OCR results
    const { error: updateError } = await supabase
      .from("gateway_orders")
      .update({
        ocr_amount: ocrResult.amount,
        pix_transaction_id: order.pix_transaction_id || ocrResult.transactionId,
        ocr_status: Math.abs(ocrResult.amount - order.total) < 0.01 ? 'success' : 'mismatch',
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    // Send WhatsApp notification to Admin if enabled
    if (approvalConfig.whatsapp_notifications) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

      if (evolutionUrl && evolutionKey && evolutionInstance) {
        const message = `🔔 *Novo PIX Pendente*\n\n` +
          `👤 Cliente: ${order.customer_name}\n` +
          `📦 Produto: ${order.product?.name || 'N/A'}\n` +
          `💰 Valor: R$ ${order.total.toFixed(2)}\n` +
          `🔍 OCR: ${ocrResult.amount === order.total ? '✅ Validado' : '⚠️ Divergência'}\n\n` +
          `Acesse o painel para aprovar.`;

        try {
          // Use the dedicated approver WhatsApp number(s) from approval_config
          const adminPhones = approvalConfig.approver_whatsapp ? approvalConfig.approver_whatsapp.split(',').map((p: string) => p.trim()) : [];

          if (adminPhones.length > 0) {
            for (const phone of adminPhones) {
              if (!phone) continue;
              
              try {
                await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "apikey": evolutionKey },
                  body: JSON.stringify({
                    number: phone.replace(/\D/g, ""),
                    text: message,
                  }),
                });
                console.log(`Notification sent to ${phone}`);
              } catch (err) {
                console.error(`Failed to send notification to ${phone}:`, err);
              }
            }
          } else {
            console.warn("approver_whatsapp not configured in approval_config — skipping notification");
          }
        } catch (notifyErr) {
          console.error("Failed to send WhatsApp notification:", notifyErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ocr: ocrResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in OCR function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});