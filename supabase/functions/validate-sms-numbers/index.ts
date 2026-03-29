import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NumberResult {
  numero: string;
  status: "apto" | "bloqueado";
  motivo?: string;
  baserow_id?: number;
  nome?: string;
  observacoes?: string;
  data_cadastro?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { numeros } = body;

    if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
      return new Response(JSON.stringify({ error: "numeros é obrigatório (array de strings)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (numeros.length > 20) {
      return new Response(JSON.stringify({ error: "Máximo de 20 números por vez" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all cached rows from Baserow
    const { data: cacheData, error: cacheError } = await supabase
      .from("consulta_numeros_cache")
      .select("baserow_row_id, row_data");

    if (cacheError) {
      throw new Error("Erro ao consultar cache: " + cacheError.message);
    }

    const allRows = (cacheData || []).map((r: any) => ({
      id: r.baserow_row_id,
      ...r.row_data,
    }));

    // Fetch today's SMS log count per number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { data: smsLogs } = await supabase
      .from("sms_validation_logs")
      .select("numero, resultado")
      .gte("created_at", todayIso)
      .eq("resultado", "apto");

    const dailyCounts: Record<string, number> = {};
    (smsLogs || []).forEach((log: any) => {
      const n = log.numero?.trim();
      if (n) dailyCounts[n] = (dailyCounts[n] || 0) + 1;
    });

    const results: NumberResult[] = [];

    for (const rawNumero of numeros) {
      const numero = String(rawNumero).trim();
      if (!numero) continue;

      // Search by numero field in cached rows
      const matchingRow = allRows.find((row: any) => {
        const rowNumero = String(row.numero ?? row.Numero ?? "").trim();
        return rowNumero === numero;
      });

      if (!matchingRow) {
        results.push({
          numero,
          status: "bloqueado",
          motivo: "Número não existe na base",
        });
        continue;
      }

      const observacoes = String(matchingRow.observacoes ?? matchingRow.Observacoes ?? "").trim();
      const obsLower = observacoes.toLowerCase();
      const nome = String(matchingRow.nome ?? matchingRow.Nome ?? "").trim();
      const dataCadastro = String(matchingRow.data_cadastro ?? matchingRow.Data_Cadastro ?? "").trim();

      // Check: External number
      if (obsLower.includes("numero externo")) {
        results.push({
          numero,
          status: "bloqueado",
          motivo: "Número externo - não é possível enviar SMS",
          baserow_id: matchingRow.id,
          nome,
          observacoes,
          data_cadastro: dataCadastro,
        });
        continue;
      }

      // Check: SIM não aprovisionado
      if (obsLower.includes("sim não aprovisionado") || obsLower.includes("sim nao aprovisionado")) {
        results.push({
          numero,
          status: "bloqueado",
          motivo: "SIM não aprovisionado",
          baserow_id: matchingRow.id,
          nome,
          observacoes,
          data_cadastro: dataCadastro,
        });
        continue;
      }

      // Check: Banido permanentemente
      if (obsLower.includes("banido permanentemente")) {
        results.push({
          numero,
          status: "bloqueado",
          motivo: "Banido permanentemente",
          baserow_id: matchingRow.id,
          nome,
          observacoes,
          data_cadastro: dataCadastro,
        });
        continue;
      }

      // Check: Status field for EXCLUÍDO
      const statusVal =
        matchingRow.excluido_da_base?.value ??
        matchingRow.excluido_da_base ??
        matchingRow.status?.value ??
        matchingRow.status ??
        "";
      const statusStr = String(statusVal).trim().toLowerCase();
      if (statusStr.includes("excluído") || statusStr.includes("excluido")) {
        results.push({
          numero,
          status: "bloqueado",
          motivo: "Número excluído da base",
          baserow_id: matchingRow.id,
          nome,
          observacoes,
          data_cadastro: dataCadastro,
        });
        continue;
      }

      // Check: Daily SMS limit (max 2)
      const todayCount = dailyCounts[numero] || 0;
      if (todayCount >= 2) {
        results.push({
          numero,
          status: "bloqueado",
          motivo: "Limite diário de 2 SMS atingido",
          baserow_id: matchingRow.id,
          nome,
          observacoes,
          data_cadastro: dataCadastro,
        });
        continue;
      }

      // Passed all validations
      results.push({
        numero,
        status: "apto",
        baserow_id: matchingRow.id,
        nome,
        observacoes,
        data_cadastro: dataCadastro,
      });
    }

    // Log all validations
    const logInserts = results.map((r) => ({
      numero: r.numero,
      resultado: r.status,
      motivo: r.motivo || null,
      baserow_row_id: r.baserow_id ? String(r.baserow_id) : null,
      user_id: user.id,
      user_email: user.email || null,
    }));

    if (logInserts.length > 0) {
      await supabase.from("sms_validation_logs").insert(logInserts);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        total: results.length,
        aptos: results.filter((r) => r.status === "apto").length,
        bloqueados: results.filter((r) => r.status === "bloqueado").length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[validate-sms-numbers] Error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
