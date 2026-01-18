import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  moeda: string;
  categoria_id: string | null;
  data_vencimento: string;
  status: string;
  tipo: string;
  recorrencia: string | null;
  observacao: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("[despesas-cron] Starting cron job execution...");

  try {
    // Check if cron is active
    const { data: config, error: configError } = await supabase
      .from("despesas_cron_config")
      .select("*")
      .limit(1)
      .single();

    if (configError) {
      console.error("[despesas-cron] Error fetching config:", configError);
      throw new Error("Failed to fetch cron config");
    }

    if (!config?.is_active) {
      console.log("[despesas-cron] Cron is disabled, skipping...");
      return new Response(
        JSON.stringify({ success: true, message: "Cron is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target month (next month from today)
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const targetYear = targetMonth.getFullYear();
    const targetMonthNum = targetMonth.getMonth();
    const targetMonthStr = `${targetYear}-${String(targetMonthNum + 1).padStart(2, "0")}`;

    console.log(`[despesas-cron] Generating for target month: ${targetMonthStr}`);

    // Fetch all fixed expenses
    const { data: allDespesas, error: despesasError } = await supabase
      .from("despesas")
      .select("*")
      .eq("tipo", "fixa")
      .neq("status", "cancelado");

    if (despesasError) {
      console.error("[despesas-cron] Error fetching despesas:", despesasError);
      throw new Error("Failed to fetch despesas");
    }

    const fixedExpenses = (allDespesas || []) as Despesa[];

    if (fixedExpenses.length === 0) {
      console.log("[despesas-cron] No fixed expenses found");
      await logExecution(supabase, config.id, "success", "No fixed expenses to generate", 0, 0, targetMonthStr);
      return new Response(
        JSON.stringify({ success: true, message: "No fixed expenses found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper functions
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const getRecurringKey = (d: Despesa) =>
      [normalize(d.descricao), d.categoria_id ?? "no-category", d.moeda ?? "BRL", d.recorrencia ?? "mensal"].join("::");

    // Build one template per key (pick the most recent by due date)
    const templatesByKey = new Map<string, Despesa>();
    for (const d of fixedExpenses) {
      const key = getRecurringKey(d);
      const existing = templatesByKey.get(key);
      if (!existing) {
        templatesByKey.set(key, d);
        continue;
      }
      const existingDate = new Date(existing.data_vencimento).getTime();
      const currentDate = new Date(d.data_vencimento).getTime();
      if (currentDate > existingDate) templatesByKey.set(key, d);
    }

    // Check existing expenses for target month
    const existingKeysInTargetMonth = new Set<string>();

    // Fetch expenses in target month
    const startOfMonth = new Date(targetYear, targetMonthNum, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(targetYear, targetMonthNum + 1, 0).toISOString().split("T")[0];

    const { data: existingDespesas } = await supabase
      .from("despesas")
      .select("*")
      .gte("data_vencimento", startOfMonth)
      .lte("data_vencimento", endOfMonth)
      .neq("status", "cancelado");

    for (const d of (existingDespesas || []) as Despesa[]) {
      existingKeysInTargetMonth.add(getRecurringKey(d));
    }

    const lastDayOfTargetMonth = new Date(targetYear, targetMonthNum + 1, 0).getDate();

    const templates = Array.from(templatesByKey.values());
    const toCreate = templates
      .filter((tpl) => !existingKeysInTargetMonth.has(getRecurringKey(tpl)))
      .map((tpl) => {
        const originalDate = new Date(tpl.data_vencimento);
        const day = Math.min(originalDate.getDate(), lastDayOfTargetMonth);
        const newDate = new Date(targetYear, targetMonthNum, day);

        return {
          descricao: tpl.descricao,
          valor: tpl.valor,
          moeda: tpl.moeda,
          categoria_id: tpl.categoria_id,
          data_vencimento: newDate.toISOString().split("T")[0],
          status: "pendente",
          tipo: "fixa",
          recorrencia: tpl.recorrencia,
          observacao: tpl.observacao,
        };
      });

    const skipped = templates.length - toCreate.length;

    if (toCreate.length === 0) {
      console.log("[despesas-cron] All recurring expenses already exist for target month");
      await logExecution(supabase, config.id, "success", "All expenses already exist for target month", 0, skipped, targetMonthStr);
      return new Response(
        JSON.stringify({ success: true, message: "All expenses already exist", skipped }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new expenses
    const { error: insertError } = await supabase.from("despesas").insert(toCreate);

    if (insertError) {
      console.error("[despesas-cron] Error inserting expenses:", insertError);
      await logExecution(supabase, config.id, "error", insertError.message, 0, 0, targetMonthStr, insertError.message);
      throw new Error("Failed to insert expenses");
    }

    const message = skipped > 0
      ? `${toCreate.length} expenses created, ${skipped} already existed`
      : `${toCreate.length} expenses created`;

    console.log(`[despesas-cron] ${message}`);
    await logExecution(supabase, config.id, "success", message, toCreate.length, skipped, targetMonthStr);

    return new Response(
      JSON.stringify({ success: true, message, created: toCreate.length, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[despesas-cron] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logExecution(
  supabase: any,
  configId: string,
  status: string,
  message: string,
  created: number,
  skipped: number,
  targetMonth: string,
  errorDetails?: string
) {
  const now = new Date().toISOString();
  
  // Calculate next run (first day of next month)
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(8, 0, 0, 0);

  // Update config
  await supabase
    .from("despesas_cron_config")
    .update({
      last_run_at: now,
      last_run_status: status,
      last_run_message: message,
      next_run_at: nextMonth.toISOString(),
    })
    .eq("id", configId);

  // Insert log
  await supabase.from("despesas_cron_logs").insert({
    status,
    message,
    despesas_created: created,
    despesas_skipped: skipped,
    target_month: targetMonth,
    error_details: errorDetails,
  });
}
