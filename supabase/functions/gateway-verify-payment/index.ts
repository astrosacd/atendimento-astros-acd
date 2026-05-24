import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface OrderBumpItem {
  name: string;
  price: number;
}

interface OrderData {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  total: number;
  product?: {
    name: string;
  };
  order_bumps?: OrderBumpItem[];
}

type VerifyResponse = {
  success: boolean;
  status: 'paid' | 'pending' | 'already_paid';
  message?: string;
  order?: OrderData;
  notifications?: {
    whatsapp: { success: boolean; error?: string };
    email: { success: boolean; error?: string };
  };
};

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
  // Build order bumps text
  const orderBumpsText = order.order_bumps && order.order_bumps.length > 0
    ? order.order_bumps.map(ob => `• ${ob.name} (R$ ${ob.price.toFixed(2)})`).join('\n')
    : '';

  return template
    .replace(/{nome}/g, order.customer_name)
    .replace(/{email}/g, order.customer_email)
    .replace(/{telefone}/g, order.customer_phone || '')
    .replace(/{produto}/g, order.product?.name || 'Produto')
    .replace(/{valor}/g, order.total.toFixed(2))
    .replace(/{order_bumps}/g, orderBumpsText)
    .replace(/{adicionais}/g, orderBumpsText);
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
    let formattedPhone = order.customer_phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    const message = replaceVariables(settings.whatsapp_template || "Olá {nome}! Seu pagamento foi confirmado!", order);

    console.log(`Sending WhatsApp to ${formattedPhone} via ${settings.whatsapp_api_url}`);

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

// Helper to fetch order bumps from gateway_order_items
async function fetchOrderBumps(supabase: any, orderId: string): Promise<OrderBumpItem[]> {
  const { data: items, error } = await supabase
    .from("gateway_order_items")
    .select("name, price")
    .eq("order_id", orderId);

  if (error || !items || items.length === 0) {
    return [];
  }

  return items.map((item: any) => ({
    name: item.name,
    price: Number(item.price) || 0,
  }));
}

// Build order data with order bumps
async function buildOrderData(supabase: any, orderData: any): Promise<OrderData> {
  const orderBumps = await fetchOrderBumps(supabase, orderData.id);
  
  return {
    id: orderData.id,
    customer_name: orderData.customer_name,
    customer_email: orderData.customer_email,
    customer_phone: orderData.customer_phone,
    total: Number(orderData.total),
    product: orderData.product,
    order_bumps: orderBumps.length > 0 ? orderBumps : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, orderId } = await req.json();

    if (!sessionId && !orderId) {
      return new Response(
        JSON.stringify({ error: "sessionId or orderId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get settings
    const { data: settingsRows } = await supabase
      .from("gateway_settings")
      .select("key, value");

    const settingsMap: Record<string, any> = {};
    settingsRows?.forEach((s: { key: string; value: any }) => {
      settingsMap[s.key] = s.value;
    });

    const notificationSettings: NotificationSettings = settingsMap.payment_notifications || {};

    let order: any = null;

    // If sessionId, verify with Stripe
    if (sessionId) {
      const stripeSecretKey = settingsMap.stripe?.secret_key || Deno.env.get("STRIPE_SECRET_KEY");

      if (stripeSecretKey) {
        // Get session details from Stripe
        const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          headers: {
            "Authorization": `Basic ${btoa(stripeSecretKey + ":")}`,
          },
        });

        if (stripeResponse.ok) {
          const session = await stripeResponse.json();
          console.log("Stripe session:", JSON.stringify(session, null, 2));

          if (session.payment_status === "paid") {
            const orderIdFromSession = session.client_reference_id || session.metadata?.order_id;

            if (orderIdFromSession) {
              // Get order with product
              const { data: orderData } = await supabase
                .from("gateway_orders")
                .select("*, product:gateway_products(name)")
                .eq("id", orderIdFromSession)
                .single();

              if (orderData && orderData.status !== "paid") {
                // Update order to paid
                await supabase
                  .from("gateway_orders")
                  .update({
                    status: "paid",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", orderIdFromSession);

                order = orderData;
                console.log(`Order ${orderIdFromSession} marked as paid`);
              } else if (orderData?.status === "paid") {
                // Already paid, don't send notifications again
                const orderDataBuilt = await buildOrderData(supabase, orderData);
                const resp: VerifyResponse = {
                  success: true,
                  status: "already_paid",
                  message: "Order already processed",
                  order: orderDataBuilt,
                };
                return new Response(JSON.stringify(resp), {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }
        }
      }
    }

    // If orderId provided, get order directly
    if (orderId && !order) {
      const { data: orderData } = await supabase
        .from("gateway_orders")
        .select("*, product:gateway_products(name)")
        .eq("id", orderId)
        .single();

      if (orderData && orderData.status === "paid") {
        const orderDataBuilt = await buildOrderData(supabase, orderData);
        const resp: VerifyResponse = {
          success: true,
          status: "already_paid",
          message: "Order already processed",
          order: orderDataBuilt,
        };
        return new Response(JSON.stringify(resp), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Send notifications if order was just paid
    if (order) {
      const orderForNotification = await buildOrderData(supabase, order);

      const whatsappResult = await sendWhatsAppNotification(orderForNotification, notificationSettings);
      console.log("WhatsApp result:", whatsappResult);

      const emailResult = await sendEmailNotification(orderForNotification, notificationSettings);
      console.log("Email result:", emailResult);

      const resp: VerifyResponse = {
        success: true,
        status: "paid",
        order: orderForNotification,
        notifications: {
          whatsapp: whatsappResult,
          email: emailResult,
        },
      };

      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp: VerifyResponse = {
      success: true,
      status: "pending",
      message: "Payment not yet confirmed",
    };

    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
