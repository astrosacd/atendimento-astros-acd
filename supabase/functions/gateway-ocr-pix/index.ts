import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
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

    // AI API Keys
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    
    let ocrResult = {
      amount: order.total,
      transactionId: order.pix_transaction_id || '',
      status: 'pending' as const,
      extracted_date: null as string | null
    };

    if (geminiKey && order.proof_url) {
      console.log("Calling Gemini for real OCR...");
      try {
        // Fetch the image
        const imageResponse = await fetch(order.proof_url);
        const imageBlob = await imageResponse.blob();
        const buffer = await imageBlob.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        
        const prompt = `Você é um especialista em recibos de PIX brasileiros. Extraia as seguintes informações da imagem do comprovante de forma precisa:
1. Valor total pago (em formato numérico decimal, ex: 150.00)
2. ID da Transação / Código E2E (um código longo alfanumérico que geralmente começa com 'E' e tem cerca de 32 caracteres)
3. Data e hora da transação (ISO format se possível)

Responda APENAS um objeto JSON válido no formato:
{
  "amount": 150.00,
  "transactionId": "E123456789...",
  "date": "2024-01-01T10:00:00Z"
}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: imageBlob.type || "image/jpeg",
                    data: base64Image
                  }
                }
              ]
            }],
            generationConfig: {
              response_mime_type: "application/json",
            }
          })
        });

        const result = await response.json();
        const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (content) {
          const parsed = JSON.parse(content);
          ocrResult.amount = parseFloat(parsed.amount) || order.total;
          ocrResult.transactionId = parsed.transactionId || '';
          ocrResult.extracted_date = parsed.date || null;
          ocrResult.status = 'success';
          console.log("Gemini OCR successful:", ocrResult);
        }
      } catch (err) {
        console.error("Gemini OCR failed:", err);
        ocrResult.status = 'error';
      }
    } else {
      console.warn("No Gemini key or proof URL found, skipping real OCR.");
    }

    // Check for duplicate transaction ID in the database (server-side check)
    let isDuplicate = false;
    if (ocrResult.transactionId) {
      const { data: duplicateOrders } = await supabase
        .from("gateway_orders")
        .select("id")
        .eq("pix_transaction_id", ocrResult.transactionId)
        .neq("id", orderId)
        .neq("status", "rejected");
      
      if (duplicateOrders && duplicateOrders.length > 0) {
        isDuplicate = true;
        console.warn(`Duplicate transaction ID found: ${ocrResult.transactionId}`);
      }
    }

    // Update order with OCR results
    const ocr_status = isDuplicate ? 'duplicate' : 
                      (Math.abs(ocrResult.amount - order.total) < 0.01 ? 'success' : 'mismatch');

    const { error: updateError } = await supabase
      .from("gateway_orders")
      .update({
        ocr_amount: ocrResult.amount,
        pix_transaction_id: ocrResult.transactionId || order.pix_transaction_id,
        ocr_status: ocr_status,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    // Send WhatsApp notification if enabled
    if (approvalConfig.whatsapp_notifications) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

      if (evolutionUrl && evolutionKey && evolutionInstance) {
        let ocrText = '🔍 OCR: ';
        if (ocr_status === 'success') ocrText += '✅ Validado';
        else if (ocr_status === 'mismatch') ocrText += '⚠️ Valor Divergente (IA leu R$ ' + ocrResult.amount.toFixed(2) + ')';
        else if (ocr_status === 'duplicate') ocrText += '🚫 ID DUPLICADO (FRAUDE!)';
        else ocrText += '❓ Não processado';

        const message = `🔔 *Novo PIX Pendente*\n\n` +
          `👤 Cliente: ${order.customer_name}\n` +
          `📦 Produto: ${order.product?.name || 'N/A'}\n` +
          `💰 Valor Digitado: R$ ${order.total.toFixed(2)}\n` +
          `${ocrText}\n\n` +
          `🆔 ID Transação: ${ocrResult.transactionId || 'Não detectado'}\n\n` +
          `Acesse o painel para aprovar.`;

        const adminPhones = approvalConfig.approver_whatsapp ? 
                           approvalConfig.approver_whatsapp.split(',').map((p: string) => p.trim()) : [];

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
          } catch (err) {
            console.error(`Failed to send notification to ${phone}:`, err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      ocr: ocrResult, 
      is_duplicate: isDuplicate,
      ocr_status: ocr_status 
    }), {
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
