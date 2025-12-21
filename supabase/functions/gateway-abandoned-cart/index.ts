import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert plain text to HTML
function textToHtml(text: string): string {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convert line breaks to <br> and wrap in basic HTML
  const htmlContent = escaped.replace(/\n/g, '<br>');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0;">
          ${htmlContent}
        </p>
      </div>
    </body>
    </html>
  `;
}

// Helper function to delay execution
function delay(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get abandoned cart settings
    const { data: settings } = await supabase
      .from("gateway_settings")
      .select("value")
      .eq("key", "abandoned_cart")
      .single();

    if (!settings?.value?.enabled) {
      console.log("Abandoned cart emails disabled");
      return new Response(
        JSON.stringify({ message: "Abandoned cart emails disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hoursThreshold = settings.value.hours_threshold || 24;
    const delayBetweenSends = settings.value.delay_between_sends || 5; // Default 5 seconds
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);

    // Find abandoned orders
    const { data: abandonedOrders, error: ordersError } = await supabase
      .from("gateway_orders")
      .select(`
        *,
        product:gateway_products(name, image_url, public_slug)
      `)
      .eq("status", "pending")
      .eq("abandoned_email_sent", false)
      .lt("created_at", thresholdDate.toISOString());

    if (ordersError) {
      console.error("Error fetching abandoned orders:", ordersError);
      throw ordersError;
    }

    if (!abandonedOrders || abandonedOrders.length === 0) {
      console.log("No abandoned carts found");
      return new Response(
        JSON.stringify({ message: "No abandoned carts found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${abandonedOrders.length} abandoned carts, will send with ${delayBetweenSends}s delay between each`);

    // Get email settings
    const { data: emailSettings } = await supabase
      .from("gateway_settings")
      .select("value")
      .eq("key", "email")
      .single();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = emailSettings?.value?.from_email || "noreply@example.com";
    const fromName = emailSettings?.value?.from_name || "Loja";
    let emailsSent = 0;

    // Get email template from settings
    const emailSubject = settings.value.email_subject || "Você esqueceu algo no carrinho!";
    const emailTemplate = settings.value.email_template || "";

    for (let i = 0; i < abandonedOrders.length; i++) {
      const order = abandonedOrders[i];
      
      if (!order.customer_email) continue;

      // Add delay between sends (except for the first one)
      if (i > 0) {
        console.log(`Waiting ${delayBetweenSends} seconds before next send...`);
        await delay(delayBetweenSends);
      }

      try {
        const checkoutUrl = order.product?.public_slug 
          ? `${req.headers.get("origin") || ""}/p/${order.product.public_slug}`
          : "#";

        const productPrice = order.currency === 'BRL' 
          ? `R$ ${order.total.toFixed(2)}` 
          : `$ ${order.total.toFixed(2)}`;

        // Replace template variables in plain text
        let textContent = emailTemplate
          .replace(/\{\{nome\}\}/g, order.customer_name || "Cliente")
          .replace(/\{\{produto\}\}/g, order.product?.name || "Produto")
          .replace(/\{\{valor\}\}/g, productPrice)
          .replace(/\{\{link\}\}/g, checkoutUrl);

        // If no template, use default
        if (!textContent.trim()) {
          textContent = `Olá ${order.customer_name || "Cliente"}!

Notamos que você não finalizou sua compra.

📦 Produto: ${order.product?.name || "Produto"}
💰 Valor: ${productPrice}

O item ainda está esperando por você! Clique no link abaixo para finalizar:
${checkoutUrl}

Se você não iniciou esta compra, pode ignorar este email.`;
        }

        // Convert plain text to HTML
        const htmlContent = textToHtml(textContent);

        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [order.customer_email],
          subject: emailSubject.replace(/\{\{produto\}\}/g, order.product?.name || "Produto"),
          html: htmlContent,
        });

        // Mark as sent
        await supabase
          .from("gateway_orders")
          .update({ abandoned_email_sent: true })
          .eq("id", order.id);

        emailsSent++;
        console.log(`[${i + 1}/${abandonedOrders.length}] Abandoned cart email sent to ${order.customer_email}`);
      } catch (emailError: any) {
        console.error(`Error sending email to ${order.customer_email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing abandoned carts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
