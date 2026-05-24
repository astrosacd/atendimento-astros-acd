import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
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

// SECURITY: Sanitize PII from log messages
const sanitizePII = (text: string): string => {
  return text
    .replace(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF]')
    .replace(/\b\d{11}\b/g, '[CPF]')
    .replace(/\b\d{10,11}\b/g, '[PHONE]');
};

// SECURITY: Sanitize order data for logging
const sanitizeOrderForLog = (data: any): any => {
  if (!data) return data;
  const sanitized = { ...data };
  if (sanitized.customer_email) sanitized.customer_email = '[EMAIL]';
  if (sanitized.customer_phone) sanitized.customer_phone = '[PHONE]';
  if (sanitized.customer_cpf) sanitized.customer_cpf = '[CPF]';
  if (sanitized.customer_name) sanitized.customer_name = '[REDACTED]';
  if (sanitized.payer) {
    sanitized.payer = { ...sanitized.payer };
    if (sanitized.payer.email) sanitized.payer.email = '[EMAIL]';
    if (sanitized.payer.first_name) sanitized.payer.first_name = '[REDACTED]';
    if (sanitized.payer.last_name) sanitized.payer.last_name = '[REDACTED]';
    if (sanitized.payer.identification) sanitized.payer.identification = '[REDACTED]';
  }
  return sanitized;
};

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

// HMAC-SHA256 verification helper
async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return computedSignature === signature.toLowerCase();
  } catch {
    return false;
  }
}

// Verify Mercado Pago webhook signature
async function verifyMercadoPagoSignature(
  req: Request,
  rawBody: string
): Promise<{ valid: boolean; reason?: string }> {
  const mpWebhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  
  if (!mpWebhookSecret) {
    console.warn("MERCADOPAGO_WEBHOOK_SECRET not configured - skipping signature verification");
    return { valid: true, reason: "secret_not_configured" };
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    return { valid: false, reason: "missing_headers" };
  }

  // Parse x-signature header (format: "ts=xxx,v1=yyy")
  const signatureParts: Record<string, string> = {};
  xSignature.split(",").forEach(part => {
    const [key, value] = part.split("=");
    if (key && value) signatureParts[key.trim()] = value.trim();
  });

  const ts = signatureParts["ts"];
  const v1 = signatureParts["v1"];

  if (!ts || !v1) {
    return { valid: false, reason: "invalid_signature_format" };
  }

  // Build the manifest string for verification
  // MP uses: id:{data.id};request-id:{x-request-id};ts:{ts};
  let dataId = "";
  try {
    const parsed = JSON.parse(rawBody);
    dataId = parsed.data?.id || "";
  } catch {
    dataId = "";
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const isValid = await verifyHmacSignature(manifest, v1, mpWebhookSecret);

  return { valid: isValid, reason: isValid ? undefined : "signature_mismatch" };
}

// Verify Stripe webhook signature
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<{ valid: boolean; reason?: string }> {
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeWebhookSecret) {
    console.warn("STRIPE_WEBHOOK_SECRET not configured - skipping signature verification");
    return { valid: true, reason: "secret_not_configured" };
  }

  if (!signatureHeader) {
    return { valid: false, reason: "missing_signature_header" };
  }

  // Parse Stripe signature header (format: "t=xxx,v1=yyy,v0=zzz")
  const signatureParts: Record<string, string> = {};
  signatureHeader.split(",").forEach(part => {
    const [key, value] = part.split("=");
    if (key && value) signatureParts[key.trim()] = value.trim();
  });

  const timestamp = signatureParts["t"];
  const expectedSignature = signatureParts["v1"];

  if (!timestamp || !expectedSignature) {
    return { valid: false, reason: "invalid_signature_format" };
  }

  // Stripe uses: timestamp.payload
  const signedPayload = `${timestamp}.${rawBody}`;
  const isValid = await verifyHmacSignature(signedPayload, expectedSignature, stripeWebhookSecret);

  return { valid: isValid, reason: isValid ? undefined : "signature_mismatch" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Parse webhook data
    const contentType = req.headers.get("content-type") || "";
    let data: any;

    if (contentType.includes("application/json")) {
      data = JSON.parse(rawBody);
    } else {
      // For form data, we need to re-parse
      const formData = new URLSearchParams(rawBody);
      data = Object.fromEntries(formData.entries());
    }

    console.log("Webhook received:", JSON.stringify(sanitizeOrderForLog(data), null, 2));

    // Determine webhook source and verify signature
    const isMercadoPago = data.type === "payment" || data.topic === "payment";
    const isStripe = data.type?.startsWith("checkout.session") || data.type?.startsWith("payment_intent");

    if (isMercadoPago) {
      const mpVerification = await verifyMercadoPagoSignature(req, rawBody);
      if (!mpVerification.valid) {
        console.error("Mercado Pago signature verification failed:", mpVerification.reason);
        // Always return 200 to prevent information leakage
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      console.log("Mercado Pago signature verified successfully");
    }

    if (isStripe) {
      const stripeSignature = req.headers.get("stripe-signature");
      const stripeVerification = await verifyStripeSignature(rawBody, stripeSignature);
      if (!stripeVerification.valid) {
        console.error("Stripe signature verification failed:", stripeVerification.reason);
        // Always return 200 to prevent information leakage
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      console.log("Stripe signature verified successfully");
    }

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
    if (isMercadoPago) {
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
      console.log("MP Payment details:", JSON.stringify(sanitizeOrderForLog(payment), null, 2));

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
    if (isStripe) {
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
