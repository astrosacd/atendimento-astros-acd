import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } =
      await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const baserowRowId = Number(body.baserow_row_id);
    const value = body.value;
    const observacao =
      typeof body.observacao === "string"
        ? body.observacao.trim().slice(0, 500)
        : null;

    if (!baserowRowId || !Number.isFinite(baserowRowId)) {
      return new Response(
        JSON.stringify({ error: "baserow_row_id obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof value !== "boolean") {
      return new Response(
        JSON.stringify({ error: "value precisa ser booleano" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const roleNames = (roles ?? []).map((r: any) => r.role).filter(Boolean);
    let allowed = roleNames.includes("admin");

    if (!allowed && roleNames.length > 0) {
      const { data: permissions } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .in("role_name", roleNames)
        .in("permission_key", [
          "view_consulta_numeros",
          "manage_config_consulta_numeros",
        ]);
      allowed = (permissions?.length ?? 0) > 0;
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para alterar auto-hospedado" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data, error } = await supabase
      .from("consulta_numeros_cache")
      .update({
        auto_hospedado: value,
        auto_hospedado_observacao: value ? observacao : null,
        auto_hospedado_marcado_em: value ? new Date().toISOString() : null,
        auto_hospedado_marcado_por: value ? userData.user.id : null,
      })
      .eq("baserow_row_id", baserowRowId)
      .select(
        "baserow_row_id, row_data, auto_hospedado, auto_hospedado_observacao, auto_hospedado_marcado_em",
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ error: "Número não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[qr-scan-toggle-auto-hospedado]", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
