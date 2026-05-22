// Dispatches a call via Wavoip API using a pre-generated TTS audio URL.
// Creates a historico row and triggers the call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { cliente_id, roteiro_id, variables = {}, numero_destino: numDestino, source = "manual", voice_id_override, valor_extenso = false } = body;

    // Load config
    const { data: configRows } = await supabase.from("ligacoes_ia_config").select("config_key, config_value");
    const cfg: Record<string, string> = {};
    (configRows ?? []).forEach((r: any) => cfg[r.config_key] = r.config_value ?? "");

    const wavoipToken = cfg.wavoip_token;
    const dialer = cfg.wavoip_dialer_number;
    if (!wavoipToken || !dialer) {
      return new Response(JSON.stringify({ error: "Wavoip não configurado (token ou número discador ausente)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve destination number
    let numeroDestino = numDestino;
    let cliente: any = null;
    if (cliente_id) {
      const { data: c } = await supabase.from("clientes").select("*").eq("id", cliente_id).single();
      if (c) {
        cliente = c;
        if (!numeroDestino) numeroDestino = c.numero;
      }
    }
    if (!numeroDestino) {
      return new Response(JSON.stringify({ error: "Número de destino ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auto-merge cliente fields into variables
    // Auto-merge cliente fields into variables (with friendly formatting for TTS)
    const fmtValorBR = (v: any) => {
      if (v == null || v === "") return "";
      const num = Number(v);
      if (Number.isNaN(num)) return String(v);
      try {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
      } catch {
        return `R$ ${num.toFixed(2).replace(".", ",")}`;
      }
    };
    const fmtDataBR = (d: any) => {
      if (!d) return "";
      const s = String(d).split("T")[0];
      const [y, m, day] = s.split("-");
      return (y && m && day) ? `${day}/${m}/${y}` : s;
    };
    const finalVars = {
      ...(cliente
        ? {
            nome: cliente.nome ?? "",
            produto: cliente.produto ?? "",
            valor: fmtValorBR(cliente.valor),
            data_renovacao: fmtDataBR(cliente.data_renovacao),
          }
        : {}),
      ...variables,
    };

    // Generate (or get cached) audio
    const ttsRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ligacoes-ia-tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ roteiro_id, variables: finalVars, preview_voice_id: voice_id_override }),
    });
    const ttsData = await ttsRes.json();
    if (!ttsRes.ok) {
      const raw = String(ttsData?.error ?? "");
      let friendly = raw;
      if (raw.includes("detected_unusual_activity") || raw.includes("Free Tier usage disabled")) {
        friendly = "ElevenLabs bloqueou a conta Free Tier (atividade incomum detectada). É necessário ativar um plano pago no ElevenLabs ou usar outra chave de API. Verifique em Ligações IA → Configurações.";
      } else if (raw.includes("quota") || raw.includes("character_limit")) {
        friendly = "Cota de caracteres do ElevenLabs esgotada. Faça upgrade do plano ou aguarde a renovação.";
      }
      return new Response(JSON.stringify({ error: friendly, raw }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create historico row first (pending)
    const { data: hist, error: histErr } = await supabase.from("ligacoes_ia_historico").insert({
      cliente_id: cliente_id ?? null,
      roteiro_id: roteiro_id ?? null,
      audio_cache_id: ttsData.audio_cache_id,
      numero_destino: numeroDestino,
      numero_origem: dialer,
      status: "iniciando",
      context: { variables: finalVars, texto_final: ttsData.texto_final },
      triggered_by: user.id,
      source,
    }).select("*").single();
    if (histErr) return new Response(JSON.stringify({ error: histErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Call is placed client-side via WebRTC (Wavoip JS SDK) so we can inject
    // TTS audio as the microphone stream. This endpoint just provisions the
    // historico row, generates/caches the audio, and returns what the client needs.
    await supabase.from("ligacoes_ia_historico").update({
      status: "pronto_para_discar",
      wavoip_call_id: hist.id,
      raw_payload: { mode: "webrtc_inject_tts", audio_cache_id: ttsData.audio_cache_id },
    }).eq("id", hist.id);

    return new Response(JSON.stringify({
      success: true,
      historico_id: hist.id,
      cache_hit: ttsData.cache_hit,
      audio_url: ttsData.signed_url,
      texto_final: ttsData.texto_final,
      phone: String(numeroDestino).replace(/\D/g, ""),
      wavoip_token: wavoipToken,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
