import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log(`Found ${abandonedOrders.length} abandoned carts`);

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

    for (const order of abandonedOrders) {
      if (!order.customer_email) continue;

      try {
        const checkoutUrl = order.product?.public_slug 
          ? `${req.headers.get("origin") || ""}/p/${order.product.public_slug}`
          : "#";

        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [order.customer_email],
          subject: "Você esqueceu algo no carrinho!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">Olá${order.customer_name ? `, ${order.customer_name}` : ""}!</h1>
              <p>Notamos que você não finalizou sua compra. O item abaixo ainda está esperando por você:</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin: 0 0 10px 0; color: #333;">${order.product?.name || "Produto"}</h2>
                <p style="color: #666; margin: 0;">
                  <strong style="color: #000; font-size: 20px;">
                    ${order.currency === 'BRL' ? 'R$' : '$'} ${order.total.toFixed(2)}
                  </strong>
                </p>
              </div>
              
              <a href="${checkoutUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                Finalizar Compra
              </a>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Se você não iniciou esta compra, por favor ignore este email.
              </p>
            </div>
          `,
        });

        // Mark as sent
        await supabase
          .from("gateway_orders")
          .update({ abandoned_email_sent: true })
          .eq("id", order.id);

        emailsSent++;
        console.log(`Abandoned cart email sent to ${order.customer_email}`);
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
