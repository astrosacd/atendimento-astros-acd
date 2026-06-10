// Receives Wavoip call status callbacks and updates historico row.
// On terminal "no-answer" / "client hung up before audio" statuses, optionally
// dispatches a WhatsApp audio fallback (configurable in cobranca_ligacao_config).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

const STATUS_MAP: Record<string, string> = {
  ringing: "tocando",
  answered: "atendida",
  in_progress: "atendida",
  completed: "finalizada",
  no_answer: "nao_atendeu",
  busy: "ocupado",
  failed: "erro",
  rejected: "rejeitada",
  cliente_desligou_antes_audio: "cliente_desligou_antes_audio",
  nao_atendeu: "nao_atendeu",
  finalizada: "finalizada",
};

const FALLBACK_TRIGGER_STATUSES = new Set(["nao_atendeu", "cliente_desligou_antes_audio"]);

function todayInBrazil(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function formatBRL(value: number | null | undefined, moeda = "BRL"): string {
  if (value == null) return "";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(value);
  } catch {
    return `R$ ${Number(value).toFixed(2)}`;
  }
}

function formatDateBR(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function normalizePhoneBR(num: string): string {
  const digits = String(num || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") || digits.length > 11) return digits;
  return "55" + digits;
}

async function dispatchFallbackAudio(supabase: any, historicoId: string) {
  // Load historico + cliente + audio_cache
  const { data: hist } = await supabase
    .from("ligacoes_ia_historico")
    .select("id, cliente_id, audio_cache_id, numero_destino, status, fallback_audio_sent_at, source")
    .eq("id", historicoId)
    .maybeSingle();

  if (!hist) return { skipped: "historico_not_found" };
  if (hist.fallback_audio_sent_at) return { skipped: "already_sent" };
  if (!hist.cliente_id) return { skipped: "no_cliente" };

  // Load config
  const { data: cfg } = await supabase
    .from("cobranca_ligacao_config")
    .select("fallback_audio_enabled, fallback_audio_template, fallback_audio_send_text, fallback_max_per_day")
    .limit(1).maybeSingle();

  if (!cfg?.fallback_audio_enabled) return { skipped: "disabled" };

  const limit = Math.max(1, Number(cfg.fallback_max_per_day ?? 1));
  const todayStr = todayInBrazil();
  const dayStart = new Date(`${todayStr}T00:00:00-03:00`).toISOString();
  const dayEnd = new Date(`${todayStr}T23:59:59-03:00`).toISOString();

  const { count: sentToday } = await supabase
    .from("ligacoes_ia_historico")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", hist.cliente_id)
    .not("fallback_audio_sent_at", "is", null)
    .gte("fallback_audio_sent_at", dayStart)
    .lte("fallback_audio_sent_at", dayEnd);

  if ((sentToday ?? 0) >= limit) {
    await supabase.from("ligacoes_ia_historico")
      .update({ fallback_audio_error: `Limite diário atingido (${sentToday}/${limit})` })
      .eq("id", historicoId);
    return { skipped: "daily_limit_reached", sent_today: sentToday, limit };
  }

  // Load cliente
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome, numero, valor, moeda, data_renovacao, produto")
    .eq("id", hist.cliente_id)
    .maybeSingle();

  // Load audio cache
  if (!hist.audio_cache_id) return { skipped: "no_audio_cache" };
  const { data: audio } = await supabase
    .from("ligacoes_ia_audios_cache")
    .select("storage_path")
    .eq("id", hist.audio_cache_id)
    .maybeSingle();
  if (!audio?.storage_path) return { skipped: "audio_storage_missing" };

  // Generate signed URL (1 hour) for Evolution to fetch
  const { data: signed } = await supabase.storage
    .from("ligacoes-ia-audios")
    .createSignedUrl(audio.storage_path, 3600);
  const audioUrl = signed?.signedUrl;
  if (!audioUrl) return { skipped: "signed_url_failed" };

  // Pick first active billing whatsapp instance
  const { data: inst } = await supabase
    .from("billing_whatsapp_instances")
    .select("instance_name, api_url, api_key")
    .eq("is_active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1).maybeSingle();
  if (!inst?.instance_name || !inst?.api_url || !inst?.api_key) {
    await supabase.from("ligacoes_ia_historico")
      .update({ fallback_audio_error: "Nenhuma instância WhatsApp ativa configurada (billing)" })
      .eq("id", historicoId);
    return { skipped: "no_whatsapp_instance" };
  }

  const phone = normalizePhoneBR(hist.numero_destino || cliente?.numero || "");
  if (!phone || phone.length < 12) {
    await supabase.from("ligacoes_ia_historico")
      .update({ fallback_audio_error: "Número inválido para fallback" })
      .eq("id", historicoId);
    return { skipped: "invalid_phone" };
  }

  const tplVars = {
    nome: (cliente?.nome ?? "").split(" ")[0] || "tudo bem",
    nome_completo: cliente?.nome ?? "",
    valor: formatBRL(cliente?.valor, cliente?.moeda ?? "BRL"),
    vencimento: formatDateBR(cliente?.data_renovacao),
    produto: cliente?.produto ?? "",
  };
  const textMessage = renderTemplate(cfg.fallback_audio_template ?? "", tplVars).trim();

  const baseUrl = inst.api_url.replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json", apikey: inst.api_key };
  const errors: string[] = [];

  // 1) Optional text first
  if (cfg.fallback_audio_send_text && textMessage) {
    try {
      const r = await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers,
        body: JSON.stringify({ number: phone, text: textMessage, delay: 800 }),
      });
      if (!r.ok) errors.push(`text(${r.status}): ${(await r.text()).slice(0, 200)}`);
    } catch (e) { errors.push(`text:${(e as Error).message}`); }
  }

  // 2) Audio (PTT)
  let audioOk = false;
  try {
    let r = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${inst.instance_name}`, {
      method: "POST", headers,
      body: JSON.stringify({ number: phone, audio: audioUrl, delay: 1200, encoding: true }),
    });
    if (!r.ok && (await r.clone().text()).includes("mediatype")) {
      r = await fetch(`${baseUrl}/message/sendMedia/${inst.instance_name}`, {
        method: "POST", headers,
        body: JSON.stringify({ number: phone, mediatype: "audio", media: audioUrl, mimetype: "audio/mpeg", delay: 1200 }),
      });
    }
    audioOk = r.ok;
    if (!r.ok) errors.push(`audio(${r.status}): ${(await r.text()).slice(0, 200)}`);
  } catch (e) { errors.push(`audio:${(e as Error).message}`); }

  if (audioOk) {
    await supabase.from("ligacoes_ia_historico").update({
      fallback_audio_sent_at: new Date().toISOString(),
      fallback_audio_error: errors.length ? errors.join(" | ") : null,
    }).eq("id", historicoId);
    await supabase.from("billing_whatsapp_instances")
      .update({ last_used_at: new Date().toISOString() })
      .eq("instance_name", inst.instance_name);
    return { sent: true, phone, errors };
  }

  await supabase.from("ligacoes_ia_historico")
    .update({ fallback_audio_error: errors.join(" | ") || "Falha desconhecida" })
    .eq("id", historicoId);
  return { sent: false, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const histId = url.searchParams.get("hist_id");
    const body = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const wavoipStatus = body.status || body.event || "";
    const mapped = STATUS_MAP[wavoipStatus] || wavoipStatus || "atualizado";

    const update: Record<string, any> = {
      status: mapped,
      raw_payload: body,
    };
    if (body.duration_seconds != null || body.duration != null) update.duration_seconds = body.duration_seconds ?? body.duration;
    if (body.cost_cents) update.cost_cents = body.cost_cents;
    if (body.observacao) update.error_message = body.observacao;
    if (mapped === "atendida" && !update.answered_at) update.answered_at = new Date().toISOString();
    if (["finalizada", "nao_atendeu", "ocupado", "erro", "rejeitada", "cliente_desligou_antes_audio"].includes(mapped)) {
      update.ended_at = new Date().toISOString();
    }

    let query = supabase.from("ligacoes_ia_historico").update(update);
    if (histId) query = query.eq("id", histId);
    else if (body.call_id) query = query.eq("wavoip_call_id", body.call_id);
    else return new Response(JSON.stringify({ error: "Missing identifier" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fire fallback audio for Wavoip no-answer / hangup-before-audio terminal statuses.
    let fallback: any = null;
    if (FALLBACK_TRIGGER_STATUSES.has(mapped) && histId) {
      try {
        fallback = await dispatchFallbackAudio(supabase, histId);
      } catch (e) {
        fallback = { error: (e as Error).message };
      }
    }

    return new Response(JSON.stringify({ ok: true, fallback }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
