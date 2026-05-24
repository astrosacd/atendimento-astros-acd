// Public webhook for Atomicat form submissions
// URL: https://<project>.supabase.co/functions/v1/atomicat-webhook
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Auto-detection aliases
const NAME_KEYS = ["nome", "name", "first_name", "firstname", "fullname", "nome_completo"];
const EMAIL_KEYS = ["email", "e-mail", "mail"];
const PHONE_KEYS = ["telefone", "phone", "contato", "whatsapp", "celular", "mobile", "tel"];

function pickField(fields: Record<string, any>, candidates: string[], override?: string): string | null {
  if (override && fields[override] != null) return String(fields[override]);
  const lowerMap: Record<string, string> = {};
  for (const k of Object.keys(fields)) lowerMap[k.toLowerCase().trim()] = k;
  for (const c of candidates) {
    if (lowerMap[c]) {
      const v = fields[lowerMap[c]];
      if (v != null && String(v).trim() !== "") return String(v);
    }
  }
  return null;
}

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (!p) return "";
  // Brazilian: if 10/11 digits, prepend 55
  if (p.length === 10 || p.length === 11) p = "55" + p;
  return p;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k.toLowerCase()] ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const formInfo = payload?.form ?? {};
    const submission = payload?.submission ?? {};
    const fields: Record<string, any> = submission?.fields ?? {};
    const meta = submission?.metadata ?? {};
    const pageUrl: string = meta?.page?.url ?? "";
    const pageName: string = meta?.page?.name ?? "";
    const formId: string = formInfo?.id ?? "";
    const formName: string = formInfo?.name ?? "";

    // Find matching config
    const { data: configs } = await supabase
      .from("atomicat_forms")
      .select("*")
      .eq("is_active", true);

    const match = (configs ?? []).find((c: any) => {
      if (c.identifier_type === "form_id") return c.form_id && c.form_id === formId;
      if (c.identifier_type === "name_url") {
        const nameMatch = c.form_name && c.form_name.toLowerCase() === formName.toLowerCase();
        const urlMatch = !c.page_url || (pageUrl && pageUrl.startsWith(c.page_url));
        return nameMatch && urlMatch;
      }
      // both: try id first, fallback to name+url
      if (c.form_id && c.form_id === formId) return true;
      const nameMatch = c.form_name && c.form_name.toLowerCase() === formName.toLowerCase();
      const urlMatch = !c.page_url || (pageUrl && pageUrl.startsWith(c.page_url));
      return nameMatch && urlMatch;
    });

    // Extract fields (auto + override)
    const overrides = match?.field_overrides ?? {};
    const nome = pickField(fields, NAME_KEYS, overrides.nome) ?? "";
    const email = pickField(fields, EMAIL_KEYS, overrides.email) ?? "";
    const telefoneRaw = pickField(fields, PHONE_KEYS, overrides.telefone) ?? "";
    const telefone = normalizePhone(telefoneRaw);

    if (!match) {
      await supabase.from("atomicat_submissions").insert({
        atomicat_form_id: formId, atomicat_form_name: formName, page_url: pageUrl,
        payload, extracted_nome: nome, extracted_email: email, extracted_telefone: telefone,
        status: "no_match", error_message: "Nenhum formulário cadastrado bate com este payload",
      });
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Settings
    const { data: settings } = await supabase.from("atomicat_settings").select("*").limit(1).maybeSingle();
    const apiUrl = settings?.api_url || Deno.env.get("EVOLUTION_API_URL");
    const apiKey = settings?.api_key || Deno.env.get("EVOLUTION_API_KEY");
    const instance = match.instance_name || settings?.default_instance_name || Deno.env.get("EVOLUTION_INSTANCE");

    let status: string = "received";
    let errMsg: string | null = null;
    let sentAt: string | null = null;

    if (!telefone) {
      status = "skipped"; errMsg = "Telefone ausente no payload";
    } else if (!apiUrl || !apiKey || !instance) {
      status = "failed"; errMsg = "Credenciais Evolution API incompletas";
    } else {
      const message = renderTemplate(match.message_template, {
        nome, email, telefone, pagina: pageName || pageUrl,
        page: pageName, page_url: pageUrl, form: formName,
      });
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": apiKey },
          body: JSON.stringify({ number: telefone, text: message }),
        });
        if (!res.ok) {
          status = "failed"; errMsg = `Evolution ${res.status}: ${(await res.text()).slice(0, 300)}`;
        } else {
          status = "sent"; sentAt = new Date().toISOString();
        }
      } catch (e: any) {
        status = "failed"; errMsg = `Erro de rede: ${e?.message ?? String(e)}`;
      }
    }

    await supabase.from("atomicat_submissions").insert({
      form_config_id: match.id,
      atomicat_form_id: formId, atomicat_form_name: formName, page_url: pageUrl,
      payload, extracted_nome: nome, extracted_email: email, extracted_telefone: telefone,
      status, error_message: errMsg, sent_at: sentAt,
    });

    return new Response(JSON.stringify({ ok: true, matched: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("atomicat-webhook error:", e);
    try {
      await supabase.from("atomicat_submissions").insert({
        payload, status: "failed", error_message: `Exception: ${e?.message ?? String(e)}`,
      });
    } catch {}
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
