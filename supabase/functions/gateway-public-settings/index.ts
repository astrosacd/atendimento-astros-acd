import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PublicGatewaySettings = {
  stripe: { enabled: boolean };
  mercadopago: { enabled: boolean };
  checkout: {
    countdown_enabled?: boolean;
    countdown_minutes?: number;
    countdown_message?: string;
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
      .in("key", ["stripe", "mercadopago", "checkout"]);

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
      mercadopago: { enabled: raw.mercadopago?.enabled === true },
      checkout: {
        countdown_enabled: raw.checkout?.countdown_enabled === true,
        countdown_minutes: typeof raw.checkout?.countdown_minutes === "number" ? raw.checkout.countdown_minutes : undefined,
        countdown_message: typeof raw.checkout?.countdown_message === "string" ? raw.checkout.countdown_message : undefined,
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
