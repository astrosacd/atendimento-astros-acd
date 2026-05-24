import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

type CreateOrderBody = {
  productId: string;
  orderBumpIds?: string[];
  couponCode?: string | null;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  customerCpf?: string | null;
  paymentGateway: "stripe" | "mercadopago" | "pix";
  currency: "BRL" | "USD";
  proofUrl?: string | null;
};

// SECURITY: Rate limiting to prevent abuse
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
  
  // Reset if window expired
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  
  record.count++;
  rateLimitMap.set(ip, record);
  
  // Clean up old entries periodically (every 100 requests)
  if (rateLimitMap.size > 1000) {
    const cutoff = now - windowMs;
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < cutoff) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  return record.count > maxRequests;
}

// SECURITY: Input validation helpers
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 255) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeString(str: string | undefined | null, maxLength: number): string {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return true; // Optional field
  if (typeof phone !== 'string') return false;
  if (phone.length > 20) return false;
  // Allow digits, spaces, dashes, parentheses, and plus sign
  const phoneRegex = /^[\d\s\-\(\)\+]+$/;
  return phoneRegex.test(phone);
}

function isValidCpf(cpf: string | undefined | null): boolean {
  if (!cpf) return true; // Optional field
  if (typeof cpf !== 'string') return false;
  // Remove non-digits
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) return false; // CPF or CNPJ
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    if (checkRateLimit(ip)) {
      console.log("Rate limit exceeded for IP:", ip);
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as CreateOrderBody;

    // SECURITY: Enhanced input validation
    if (!body?.productId || !body?.customerEmail || !body?.paymentGateway) {
      return new Response(
        JSON.stringify({ error: "productId, customerEmail e paymentGateway são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate productId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.productId)) {
      return new Response(
        JSON.stringify({ error: "ID do produto inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate email
    if (!isValidEmail(body.customerEmail)) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate payment gateway
    if (!['stripe', 'mercadopago', 'pix'].includes(body.paymentGateway)) {
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate phone if provided
    if (!isValidPhoneNumber(body.customerPhone)) {
      return new Response(
        JSON.stringify({ error: "Telefone inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate CPF if provided
    if (!isValidCpf(body.customerCpf)) {
      return new Response(
        JSON.stringify({ error: "CPF/CNPJ inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize string inputs
    const customerName = sanitizeString(body.customerName, 200);
    const customerEmail = sanitizeString(body.customerEmail, 255).toLowerCase();
    const customerPhone = sanitizeString(body.customerPhone, 20);
    const customerCpf = sanitizeString(body.customerCpf, 18);

    // Simplify currency for customers (and avoid confusing UX)
    const currency: "BRL" | "USD" = body.paymentGateway === "stripe" ? "USD" : "BRL";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Duplicate order detection (prevent spam within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentOrder } = await supabase
      .from("gateway_orders")
      .select("id")
      .eq("customer_email", customerEmail)
      .eq("product_id", body.productId)
      .gte("created_at", fiveMinutesAgo)
      .maybeSingle();

    if (recentOrder) {
      console.log("Duplicate order detected for:", customerEmail, body.productId);
      return new Response(
        JSON.stringify({ error: "Pedido duplicado detectado. Aguarde alguns minutos antes de tentar novamente." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Product
    const { data: product, error: productError } = await supabase
      .from("gateway_products")
      .select("id, name, price_brl, price_usd, public_slug, status")
      .eq("id", body.productId)
      .single();

    if (productError || !product || product.status !== "active") {
      console.error("Product not found/active:", productError);
      return new Response(
        JSON.stringify({ error: "Produto não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Order bumps - validate UUIDs first
    const orderBumpIds = (body.orderBumpIds || []).filter(id => id && uuidRegex.test(id));
    let orderBumps: Array<{ id: string; name: string; price_brl: number; price_usd: number; allow_coupon: boolean }> = [];

    if (orderBumpIds.length > 0) {
      const { data: bumps, error: bumpsError } = await supabase
        .from("gateway_order_bumps")
        .select("id, name, price_brl, price_usd, status, allow_coupon")
        .in("id", orderBumpIds)
        .eq("status", "active");

      if (bumpsError) {
        console.error("Order bumps fetch error:", bumpsError);
        return new Response(
          JSON.stringify({ error: "Erro ao carregar ofertas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      orderBumps = (bumps || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        price_brl: b.price_brl,
        price_usd: b.price_usd,
        allow_coupon: b.allow_coupon ?? true,
      }));
    }

    const getPrice = (priceBrl: number, priceUsd: number) => (currency === "USD" ? priceUsd : priceBrl);

    const subtotal =
      getPrice(product.price_brl, product.price_usd) +
      orderBumps.reduce((sum, ob) => sum + getPrice(ob.price_brl, ob.price_usd), 0);

    // Check if any selected order bump disallows coupons
    const anyBumpDisallowsCoupon = orderBumps.some((ob) => ob.allow_coupon === false);

    // Coupon
    let coupon: any = null;
    let discountAmount = 0;

    const couponCode = sanitizeString(body.couponCode, 50).toUpperCase();
    if (couponCode && !anyBumpDisallowsCoupon) {
      const { data: c, error: cError } = await supabase
        .from("gateway_coupons")
        .select("*")
        .eq("code", couponCode)
        .eq("status", "active")
        .single();

      if (!cError && c) {
        // Validate fixed currency
        if (c.discount_type === "fixed" && c.currency !== currency) {
          // ignore coupon silently for safety
          coupon = null;
        } else {
          const now = new Date();
          if (c.starts_at && new Date(c.starts_at) > now) coupon = null;
          else if (c.expires_at && new Date(c.expires_at) < now) coupon = null;
          else if (c.max_uses_global && c.usage_count >= c.max_uses_global) coupon = null;
          else {
            coupon = c;
            discountAmount =
              c.discount_type === "percentage"
                ? (subtotal * Number(c.discount_value)) / 100
                : Number(c.discount_value);
          }
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("gateway_orders")
      .insert([
        {
          product_id: product.id,
          order_bump_id: orderBumpIds.length > 0 ? orderBumpIds[0] : null, // Keep first for legacy
          coupon_id: coupon?.id || null,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          customer_cpf: customerCpf || null,
          subtotal,
          discount_amount: discountAmount,
          total,
          currency,
          status: "pending",
          payment_gateway: body.paymentGateway,
          proof_url: body.proofUrl || null,
          abandoned_email_sent: false,
        },
      ])
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Create order error:", orderError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar pedido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Order created:", order.id, "IP:", ip, "Email:", customerEmail);

    // Save all order bumps to gateway_order_items
    if (orderBumps.length > 0) {
      const orderItems = orderBumps.map((ob) => ({
        order_id: order.id,
        order_bump_id: ob.id,
        name: ob.name,
        price: getPrice(ob.price_brl, ob.price_usd),
      }));

      const { error: itemsError } = await supabase
        .from("gateway_order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Insert order items error:", itemsError);
      }
    }

    // Record coupon usage (server-side)
    if (coupon?.id) {
      await supabase.from("gateway_coupon_usages").insert([
        {
          coupon_id: coupon.id,
          order_id: order.id,
          discount_amount: discountAmount,
        },
      ]);

      await supabase
        .from("gateway_coupons")
        .update({
          usage_count: Number(coupon.usage_count || 0) + 1,
          total_discount_given: Number(coupon.total_discount_given || 0) + discountAmount,
        })
        .eq("id", coupon.id);
    }

    // If it's a PIX order with a proof, trigger OCR automatically
    if (body.paymentGateway === 'pix' && body.proofUrl) {
      console.log("Triggering automatic OCR for PIX order:", order.id);
      supabase.functions.invoke('gateway-ocr-pix', {
        body: { orderId: order.id }
      }).catch(err => console.error("Auto OCR failed:", err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        currency,
        subtotal,
        discountAmount,
        total,
        couponBlocked: anyBumpDisallowsCoupon && couponCode ? true : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("gateway-create-order error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar pedido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
