import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

type PublicGatewaySettings = {
  stripe: { enabled: boolean };
  mercadopago: { 
    enabled: boolean;
    allow_credit_card?: boolean;
    allow_pix?: boolean;
    allow_boleto?: boolean;
    immediate_payment?: boolean;
  };
  pix_manual: {
    enabled: boolean;
    pix_key?: string;
    receiver_name?: string;
    instructions?: string;
    qr_code_url?: string | null;
  };
  checkout: {
    countdown_enabled?: boolean;
    countdown_minutes?: number;
    countdown_message?: string;
  };
  success_page: {
    enabled?: boolean;
    title?: string;
    message?: string;
    instructions?: string;
    primary_button_text?: string;
    primary_button_path?: string;
    support_whatsapp_enabled?: boolean;
    support_whatsapp_number?: string;
    support_whatsapp_button_text?: string;
    support_whatsapp_message?: string;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("gateway_settings")
      .select("key, value")
      .in("key", ["stripe", "mercadopago", "checkout", "success_page", "pix_manual"]);

    if (error) {
      console.error("gateway-public-settings fetch error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao carregar configurações" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const raw: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      raw[row.key] = row.value;
    });

    const result: PublicGatewaySettings = {
      stripe: { enabled: raw.stripe?.enabled === true },
      mercadopago: { 
        enabled: raw.mercadopago?.enabled === true,
        allow_credit_card: raw.mercadopago?.allow_credit_card !== false,
        allow_pix: raw.mercadopago?.allow_pix !== false,
        allow_boleto: raw.mercadopago?.allow_boleto !== false,
        immediate_payment: raw.mercadopago?.immediate_payment === true,
      },
      pix_manual: {
        enabled: raw.pix_manual?.enabled === true,
        pix_key: raw.pix_manual?.pix_key,
        receiver_name: raw.pix_manual?.receiver_name,
        instructions: raw.pix_manual?.instructions,
        qr_code_url: raw.pix_manual?.qr_code_url,
      },
      checkout: {
        countdown_enabled: raw.checkout?.countdown_enabled === true,
        countdown_minutes: typeof raw.checkout?.countdown_minutes === "number" ? raw.checkout.countdown_minutes : undefined,
        countdown_message: typeof raw.checkout?.countdown_message === "string" ? raw.checkout.countdown_message : undefined,
      },
      success_page: {
        enabled: raw.success_page?.enabled === true,
        title: typeof raw.success_page?.title === "string" ? raw.success_page.title : undefined,
        message: typeof raw.success_page?.message === "string" ? raw.success_page.message : undefined,
        instructions: typeof raw.success_page?.instructions === "string" ? raw.success_page.instructions : undefined,
        primary_button_text: typeof raw.success_page?.primary_button_text === "string" ? raw.success_page.primary_button_text : undefined,
        primary_button_path: typeof raw.success_page?.primary_button_path === "string" ? raw.success_page.primary_button_path : undefined,
        support_whatsapp_enabled: raw.success_page?.support_whatsapp_enabled === true,
        support_whatsapp_number: typeof raw.success_page?.support_whatsapp_number === "string" ? raw.success_page.support_whatsapp_number : undefined,
        support_whatsapp_button_text: typeof raw.success_page?.support_whatsapp_button_text === "string" ? raw.success_page.support_whatsapp_button_text : undefined,
        support_whatsapp_message: typeof raw.success_page?.support_whatsapp_message === "string" ? raw.success_page.support_whatsapp_message : undefined,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gateway-public-settings error:", e);
    return new Response(
      JSON.stringify({ error: "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
