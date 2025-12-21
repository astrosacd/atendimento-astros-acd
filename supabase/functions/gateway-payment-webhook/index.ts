import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderData {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  total: number;
  product?: {
    name: string;
  };
}

interface NotificationSettings {
  whatsapp_enabled?: boolean;
  whatsapp_instance_name?: string;
  whatsapp_api_url?: string;
  whatsapp_api_key?: string;
  whatsapp_template?: string;
  email_enabled?: boolean;
  gmail_user?: string;
  gmail_app_password?: string;
  email_subject?: string;
  email_template?: string;
}

// Function to replace template variables
const replaceVariables = (template: string, order: OrderData): string => {
  return template
    .replace(/{nome}/g, order.customer_name)
    .replace(/{email}/g, order.customer_email)
    .replace(/{telefone}/g, order.customer_phone || '')
    .replace(/{produto}/g, order.product?.name || 'Produto')
    .replace(/{valor}/g, order.total.toFixed(2));
};

// Send WhatsApp notification
async function sendWhatsAppNotification(
  order: OrderData,
  settings: NotificationSettings
): Promise<{ success: boolean; error?: string }> {
  if (!settings.whatsapp_enabled) {
    return { success: false, error: "WhatsApp notifications disabled" };
  }

  if (!settings.whatsapp_instance_name || !settings.whatsapp_api_url || !settings.whatsapp_api_key) {
    return { success: false, error: "WhatsApp not configured" };
  }

  if (!order.customer_phone) {
    return { success: false, error: "Customer has no phone number" };
  }

  try {
    // Format phone number
    let formattedPhone = order.customer_phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    const message = replaceVariables(settings.whatsapp_template || "Olá {nome}! Seu pagamento foi confirmado!", order);

    const response = await fetch(`${settings.whatsapp_api_url}/message/sendText/${settings.whatsapp_instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": settings.whatsapp_api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WhatsApp API error:", errorText);
      return { success: false, error: errorText };
    }

    console.log(`WhatsApp notification sent to ${formattedPhone}`);
    return { success: true };
  } catch (error: any) {
    console.error("WhatsApp notification error:", error);
    return { success: false, error: error.message };
  }
}

// Send Email notification via Gmail SMTP
async function sendEmailNotification(
  order: OrderData,
  settings: NotificationSettings
): Promise<{ success: boolean; error?: string }> {
  if (!settings.email_enabled) {
    return { success: false, error: "Email notifications disabled" };
  }

  if (!settings.gmail_user || !settings.gmail_app_password) {
    return { success: false, error: "Gmail not configured" };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: settings.gmail_user,
          password: settings.gmail_app_password,
        },
      },
    });

    const subject = replaceVariables(settings.email_subject || "Pagamento Confirmado", order);
    const body = replaceVariables(settings.email_template || "Olá {nome}, seu pagamento foi confirmado!", order);

    await client.send({
      from: settings.gmail_user,
      to: order.customer_email,
      subject: subject,
      content: body,
    });

    await client.close();
    
    console.log(`Email notification sent to ${order.customer_email}`);
    return { success: true };
  } catch (error: any) {
    console.error("Email notification error:", error);
    return { success: false, error: error.message };
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

    // Parse webhook data
    const contentType = req.headers.get("content-type") || "";
    let data: any;

    if (contentType.includes("application/json")) {
      data = await req.json();
    } else {
      const formData = await req.formData();
      data = Object.fromEntries(formData.entries());
    }

    console.log("Webhook received:", JSON.stringify(data, null, 2));

    // Get gateway settings
    const { data: settings } = await supabase
      .from("gateway_settings")
      .select("key, value");

    const settingsMap: Record<string, any> = {};
    settings?.forEach((s: { key: string; value: any }) => {
      settingsMap[s.key] = s.value;
    });

    const notificationSettings: NotificationSettings = settingsMap.payment_notifications || {};

    // Handle Mercado Pago IPN
    if (data.type === "payment" || data.topic === "payment") {
      const paymentId = data.data?.id || data.id;
      
      if (!paymentId) {
        console.log("No payment ID found in webhook");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const mpAccessToken = settingsMap.mercadopago?.access_token || settingsMap.gateways?.mercadopago?.accessToken || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

      if (!mpAccessToken) {
        console.error("MP Access Token not found");
        return new Response("Config error", { status: 500, headers: corsHeaders });
      }

      // Get payment details from Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!mpResponse.ok) {
        console.error("Error fetching MP payment:", await mpResponse.text());
        return new Response("MP error", { status: 500, headers: corsHeaders });
      }

      const payment = await mpResponse.json();
      console.log("MP Payment details:", JSON.stringify(payment, null, 2));

      const orderId = payment.external_reference;
      
      if (!orderId) {
        console.log("No external_reference found");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Map MP status to our status
      let orderStatus = "pending";
      switch (payment.status) {
        case "approved":
          orderStatus = "paid";
          break;
        case "rejected":
        case "cancelled":
          orderStatus = "cancelled";
          break;
        case "pending":
        case "in_process":
          orderStatus = "pending";
          break;
      }

      // Update order
      const { error: updateError } = await supabase
        .from("gateway_orders")
        .update({
          status: orderStatus,
          payment_id: String(paymentId),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        console.error("Error updating order:", updateError);
        return new Response("DB error", { status: 500, headers: corsHeaders });
      }

      console.log(`Order ${orderId} updated to status: ${orderStatus}`);

      // Send notifications if payment is approved
      if (orderStatus === "paid") {
        // Fetch order details with product
        const { data: orderData } = await supabase
          .from("gateway_orders")
          .select("*, product:gateway_products(name)")
          .eq("id", orderId)
          .single();

        if (orderData) {
          const order: OrderData = {
            id: orderData.id,
            customer_name: orderData.customer_name,
            customer_email: orderData.customer_email,
            customer_phone: orderData.customer_phone,
            total: orderData.total,
            product: orderData.product,
          };

          // Send notifications in background
          const whatsappResult = await sendWhatsAppNotification(order, notificationSettings);
          console.log("WhatsApp notification result:", whatsappResult);

          const emailResult = await sendEmailNotification(order, notificationSettings);
          console.log("Email notification result:", emailResult);
        }
      }
    }

    // Handle Stripe webhook
    if (data.type?.startsWith("checkout.session") || data.type?.startsWith("payment_intent")) {
      console.log("Stripe webhook received:", data.type);
      
      // Handle checkout.session.completed
      if (data.type === "checkout.session.completed") {
        const session = data.data?.object;
        const orderId = session?.client_reference_id || session?.metadata?.order_id;
        
        if (orderId) {
          const { error: updateError } = await supabase
            .from("gateway_orders")
            .update({
              status: "paid",
              payment_id: session.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          if (updateError) {
            console.error("Error updating Stripe order:", updateError);
          } else {
            console.log(`Stripe order ${orderId} marked as paid`);

            // Send notifications for Stripe payments
            const { data: orderData } = await supabase
              .from("gateway_orders")
              .select("*, product:gateway_products(name)")
              .eq("id", orderId)
              .single();

            if (orderData) {
              const order: OrderData = {
                id: orderData.id,
                customer_name: orderData.customer_name,
                customer_email: orderData.customer_email,
                customer_phone: orderData.customer_phone,
                total: orderData.total,
                product: orderData.product,
              };

              const whatsappResult = await sendWhatsAppNotification(order, notificationSettings);
              console.log("WhatsApp notification result:", whatsappResult);

              const emailResult = await sendEmailNotification(order, notificationSettings);
              console.log("Email notification result:", emailResult);
            }
          }
        }
      }
      
      // Handle payment_intent.payment_failed
      if (data.type === "payment_intent.payment_failed") {
        const paymentIntent = data.data?.object;
        const orderId = paymentIntent?.metadata?.order_id;
        
        if (orderId) {
          await supabase
            .from("gateway_orders")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          console.log(`Stripe order ${orderId} marked as cancelled`);
        }
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }
});
