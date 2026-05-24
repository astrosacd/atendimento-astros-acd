import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

// Helper function to convert plain text to HTML
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
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

// Helper function to send email via Gmail SMTP
async function sendEmailViaGmail(
  gmailUser: string,
  gmailAppPassword: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: gmailUser,
        password: gmailAppPassword,
      },
    },
  });

  await client.send({
    from: gmailUser,
    to: to,
    subject: subject,
    content: "auto",
    html: html,
  });

  await client.close();
}

// Helper function to send WhatsApp message via Evolution API
async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  message: string
): Promise<void> {
  // Format phone number (remove non-digits and ensure proper format)
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '55' + formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      number: formattedPhone,
      text: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp send failed: ${response.status} - ${errorText}`);
  }
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
      console.log("Abandoned cart recovery disabled");
      return new Response(
        JSON.stringify({ message: "Abandoned cart recovery disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Support both delay_minutes (new) and hours_threshold (legacy)
    const delayMinutes = settings.value.delay_minutes || (settings.value.hours_threshold ? settings.value.hours_threshold * 60 : 30);
    const delayBetweenSends = settings.value.delay_between_sends || 5;
    const thresholdDate = new Date();
    thresholdDate.setMinutes(thresholdDate.getMinutes() - delayMinutes);
    
    console.log(`Threshold: ${delayMinutes} minutes, checking orders before: ${thresholdDate.toISOString()}`);

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

    // Email config
    const gmailUser = settings.value.gmail_user;
    const gmailAppPassword = settings.value.gmail_app_password;
    const emailEnabled = gmailUser && gmailAppPassword;

    // WhatsApp config
    const whatsappEnabled = settings.value.whatsapp_enabled;
    const whatsappApiUrl = settings.value.whatsapp_api_url;
    const whatsappApiKey = settings.value.whatsapp_api_key;
    const whatsappInstanceName = settings.value.whatsapp_instance_name;
    const whatsappTemplate = settings.value.whatsapp_template || '';

    if (!emailEnabled && !whatsappEnabled) {
      console.log("No notification channel configured (email or WhatsApp)");
      return new Response(
        JSON.stringify({ message: "No notification channel configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;
    let whatsappSent = 0;

    // Get email template from settings
    const emailSubject = settings.value.email_subject || "Você esqueceu algo no carrinho!";
    const emailTemplate = settings.value.email_template || "";

    for (let i = 0; i < abandonedOrders.length; i++) {
      const order = abandonedOrders[i];
      
      // Add delay between sends (except for the first one)
      if (i > 0) {
        console.log(`Waiting ${delayBetweenSends} seconds before next send...`);
        await delay(delayBetweenSends);
      }

      const checkoutUrl = order.product?.public_slug 
        ? `${req.headers.get("origin") || supabaseUrl.replace('.supabase.co', '.lovable.app')}/p/${order.product.public_slug}`
        : "#";

      const productPrice = order.currency === 'BRL' 
        ? `R$ ${order.total.toFixed(2)}` 
        : `$ ${order.total.toFixed(2)}`;

      // Send Email
      if (emailEnabled && order.customer_email) {
        try {
          let textContent = emailTemplate
            .replace(/\{\{nome\}\}/g, order.customer_name || "Cliente")
            .replace(/\{\{produto\}\}/g, order.product?.name || "Produto")
            .replace(/\{\{valor\}\}/g, productPrice)
            .replace(/\{\{link\}\}/g, checkoutUrl);

          if (!textContent.trim()) {
            textContent = `Olá ${order.customer_name || "Cliente"}!

Notamos que você não finalizou sua compra.

📦 Produto: ${order.product?.name || "Produto"}
💰 Valor: ${productPrice}

O item ainda está esperando por você! Clique no link abaixo para finalizar:
${checkoutUrl}

Se você não iniciou esta compra, pode ignorar este email.`;
          }

          const htmlContent = textToHtml(textContent);

          await sendEmailViaGmail(
            gmailUser,
            gmailAppPassword,
            order.customer_email,
            emailSubject.replace(/\{\{produto\}\}/g, order.product?.name || "Produto"),
            htmlContent
          );

          emailsSent++;
          console.log(`[${i + 1}/${abandonedOrders.length}] Email sent to ${order.customer_email}`);
        } catch (emailError: any) {
          console.error(`Error sending email to ${order.customer_email}:`, emailError.message);
        }
      }

      // Send WhatsApp
      if (whatsappEnabled && order.customer_phone && whatsappApiUrl && whatsappApiKey && whatsappInstanceName) {
        try {
          let whatsappMessage = whatsappTemplate
            .replace(/\{\{nome\}\}/g, order.customer_name || "Cliente")
            .replace(/\{\{produto\}\}/g, order.product?.name || "Produto")
            .replace(/\{\{valor\}\}/g, productPrice)
            .replace(/\{\{link\}\}/g, checkoutUrl);

          if (!whatsappMessage.trim()) {
            whatsappMessage = `Olá ${order.customer_name || "Cliente"}! 👋

Notamos que você não finalizou sua compra.

📦 Produto: ${order.product?.name || "Produto"}
💰 Valor: ${productPrice}

O item ainda está esperando por você! Acesse o link abaixo para finalizar:
${checkoutUrl}

Se precisar de ajuda, é só responder esta mensagem!`;
          }

          await sendWhatsAppMessage(
            whatsappApiUrl,
            whatsappApiKey,
            whatsappInstanceName,
            order.customer_phone,
            whatsappMessage
          );

          whatsappSent++;
          console.log(`[${i + 1}/${abandonedOrders.length}] WhatsApp sent to ${order.customer_phone}`);
        } catch (whatsappError: any) {
          console.error(`Error sending WhatsApp to ${order.customer_phone}:`, whatsappError.message);
        }
      }

      // Mark as sent if at least one channel succeeded
      if ((emailEnabled && order.customer_email) || (whatsappEnabled && order.customer_phone)) {
        await supabase
          .from("gateway_orders")
          .update({ abandoned_email_sent: true })
          .eq("id", order.id);
      }
    }

    console.log(`Completed: ${emailsSent} emails sent, ${whatsappSent} WhatsApp messages sent`);

    return new Response(
      JSON.stringify({ success: true, emailsSent, whatsappSent }),
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
