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
    const { 
      cliente_id, 
      roteiro_id, 
      variables = {}, 
      numero_destino: numDestino, 
      source = "manual", 
      voice_id_override, 
      valor_extenso = false,
      manual = false,
      consultor_phone = ""
    } = body;

    // Load config
    const { data: configRows } = await supabase.from("ligacoes_ia_config").select("config_key, config_value");
    const cfg: Record<string, string> = {};
    (configRows ?? []).forEach((r: any) => cfg[r.config_key] = r.config_value ?? "");

    const wavoipToken = cfg.wavoip_token;
    const dialer = cfg.wavoip_dialer_number;
    const provider = cfg.calling_provider || "wavoip";

    if (provider === "wavoip" && (!wavoipToken || !dialer)) {
      return new Response(JSON.stringify({ error: "Wavoip não configurado (token ou número discador ausente)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (provider === "twilio") {
      const sid = cfg.twilio_account_sid;
      const auth = cfg.twilio_auth_token;
      const from = cfg.twilio_phone_number;
      if (!sid || !auth || !from) {
        return new Response(JSON.stringify({ error: "Twilio não configurado (SID, Token ou Número ausente)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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

    // Load roteiro early so we know moeda/idioma for formatting valor/data
    let roteiro: any = null;
    if (roteiro_id) {
      const { data: r } = await supabase.from("ligacoes_ia_roteiros").select("*").eq("id", roteiro_id).single();
      roteiro = r;
    }
    const moedaRoteiro: "BRL" | "USD" | "EUR" = (roteiro?.moeda ?? "BRL") as any;
    const idiomaRoteiro: string = roteiro?.idioma ?? "pt-BR";

    // Format currency numerically (symbol + amount) per moeda
    const fmtValor = (v: any, moeda: "BRL" | "USD" | "EUR") => {
      if (v == null || v === "") return "";
      const num = Number(v);
      if (Number.isNaN(num)) return String(v);
      const locale = moeda === "BRL" ? "pt-BR" : "en-US";
      try {
        return new Intl.NumberFormat(locale, { style: "currency", currency: moeda }).format(num);
      } catch {
        const sym = moeda === "BRL" ? "R$" : moeda === "USD" ? "$" : "€";
        return `${sym} ${num.toFixed(2)}`;
      }
    };

    // pt-BR currency to spoken words (for TTS naturalness)
    const valorPorExtensoBRL = (v: any): string => {
      const num = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(num) || num < 0) return "";
      const U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
      const D10 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
      const D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
      const C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
      const ate999 = (n: number): string => {
        if (n === 0) return "";
        if (n === 100) return "cem";
        const c = Math.floor(n / 100), r = n % 100;
        const p: string[] = [];
        if (c > 0) p.push(C[c]);
        if (r > 0) {
          if (r < 10) p.push(U[r]);
          else if (r < 20) p.push(D10[r - 10]);
          else { const d = Math.floor(r / 10), u = r % 10; p.push(u === 0 ? D[d] : `${D[d]} e ${U[u]}`); }
        }
        return p.join(" e ");
      };
      const inteiroExt = (n: number): string => {
        if (n === 0) return "zero";
        const mi = Math.floor(n / 1_000_000), ml = Math.floor((n % 1_000_000) / 1000), r = n % 1000;
        const p: string[] = [];
        if (mi > 0) p.push(mi === 1 ? "um milhão" : `${ate999(mi)} milhões`);
        if (ml > 0) p.push(ml === 1 ? "mil" : `${ate999(ml)} mil`);
        if (r > 0) p.push(ate999(r));
        return p.join(" e ");
      };
      const inteiros = Math.floor(num);
      const centavos = Math.round((num - inteiros) * 100);
      const partes: string[] = [];
      if (inteiros > 0) partes.push(`${inteiroExt(inteiros)} ${inteiros === 1 ? "real" : "reais"}`);
      if (centavos > 0) partes.push(`${inteiroExt(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
      if (partes.length === 0) return "zero real";
      return partes.join(" e ");
    };

    // en-US currency to spoken words for USD/EUR
    const valorPorExtensoEN = (v: any, currency: "USD" | "EUR"): string => {
      const num = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(num) || num < 0) return "";
      const U = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
      const TE = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
      const T = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
      const under1000 = (n: number): string => {
        if (n === 0) return "";
        const p: string[] = [];
        const h = Math.floor(n / 100), r = n % 100;
        if (h > 0) p.push(`${U[h]} hundred`);
        if (r > 0) {
          if (r < 10) p.push(U[r]);
          else if (r < 20) p.push(TE[r - 10]);
          else { const d = Math.floor(r / 10), u = r % 10; p.push(u === 0 ? T[d] : `${T[d]}-${U[u]}`); }
        }
        return p.join(" ");
      };
      const intExt = (n: number): string => {
        if (n === 0) return "zero";
        const mi = Math.floor(n / 1_000_000), th = Math.floor((n % 1_000_000) / 1000), r = n % 1000;
        const p: string[] = [];
        if (mi > 0) p.push(`${under1000(mi)} million`);
        if (th > 0) p.push(`${under1000(th)} thousand`);
        if (r > 0) p.push(under1000(r));
        return p.join(" ");
      };
      const whole = Math.floor(num);
      const cents = Math.round((num - whole) * 100);
      const sing = currency === "USD" ? "dollar" : "euro";
      const plur = currency === "USD" ? "dollars" : "euros";
      const parts: string[] = [];
      if (whole > 0) parts.push(`${intExt(whole)} ${whole === 1 ? sing : plur}`);
      if (cents > 0) parts.push(`${intExt(cents)} ${cents === 1 ? "cent" : "cents"}`);
      if (parts.length === 0) return `zero ${plur}`;
      return parts.join(" and ");
    };

    const formatarValorFinal = (v: any): string => {
      if (!valor_extenso) return fmtValor(v, moedaRoteiro);
      if (moedaRoteiro === "BRL") return valorPorExtensoBRL(v);
      return valorPorExtensoEN(v, moedaRoteiro);
    };

    // Date: BR locale for pt-BR scripts, en-US for foreign ones
    const fmtData = (d: any): string => {
      if (!d) return "";
      const s = String(d).split("T")[0];
      const [y, m, day] = s.split("-");
      if (!y || !m || !day) return s;
      if (idiomaRoteiro === "pt-BR") return `${day}/${m}/${y}`;
      // en-US: "November 30, 2025"
      try {
        const dt = new Date(`${y}-${m}-${day}T00:00:00Z`);
        return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(dt);
      } catch {
        return `${m}/${day}/${y}`;
      }
    };
    const finalVars = {
      ...(cliente
        ? {
            nome: cliente.nome ?? "",
            produto: cliente.produto ?? "",
            valor: formatarValorFinal(cliente.valor),
            data_renovacao: fmtData(cliente.data_renovacao),
          }
        : {}),
      ...variables,
    };

    // Generate (or get cached) audio
    let ttsData: any = { signed_url: "", texto_final: "Chamada manual" };
    if (!manual) {
      const ttsRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ligacoes-ia-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ roteiro_id, variables: finalVars, preview_voice_id: voice_id_override }),
      });
      ttsData = await ttsRes.json();
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
    }

    // Create historico row first (pending)
    const { data: hist, error: histErr } = await supabase.from("ligacoes_ia_historico").insert({
      cliente_id: cliente_id ?? null,
      roteiro_id: roteiro_id ?? null,
      audio_cache_id: ttsData.audio_cache_id || null,
      numero_destino: numeroDestino,
      numero_origem: provider === "twilio" ? cfg.twilio_phone_number : dialer,
      status: "iniciando",
      context: { variables: finalVars, texto_final: ttsData.texto_final, manual: !!manual },
      triggered_by: user.id,
      source: manual ? "manual_consultor" : source,
    }).select("*").single();
    if (histErr) return new Response(JSON.stringify({ error: histErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // If Wavoip, call is placed client-side via WebRTC
    if (provider === "wavoip") {
      await supabase.from("ligacoes_ia_historico").update({
        status: "pronto_para_discar",
        wavoip_call_id: hist.id,
        raw_payload: { mode: "webrtc_inject_tts", audio_cache_id: ttsData.audio_cache_id },
      }).eq("id", hist.id);

      return new Response(JSON.stringify({
        success: true,
        provider: "wavoip",
        historico_id: hist.id,
        cache_hit: ttsData.cache_hit,
        audio_url: ttsData.signed_url,
        texto_final: ttsData.texto_final,
        phone: String(numeroDestino).replace(/\D/g, ""),
        wavoip_token: wavoipToken,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      // Twilio flow: Trigger call via Twilio API
      const twilioSid = cfg.twilio_account_sid;
      const twilioAuth = cfg.twilio_auth_token;
      const twilioFrom = cfg.twilio_phone_number;
      
      const normalizedDestination = String(numeroDestino).startsWith("+")
        ? String(numeroDestino)
        : `+${String(numeroDestino).replace(/\D/g, "")}`;
      let twimlUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-twiml?audio_url=${encodeURIComponent(ttsData.signed_url)}&hist_id=${hist.id}`;
      let targetTo = normalizedDestination;
      let isBridgeMode = false;

      if (manual && consultor_phone) {
        // Bridge mode: Twilio calls the consultant first, then bridges to customer
        isBridgeMode = true;
        targetTo = consultor_phone.startsWith("+") ? consultor_phone : `+${consultor_phone.replace(/\D/g, "")}`;
        twimlUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-twiml?bridge_to=${encodeURIComponent(normalizedDestination)}&hist_id=${hist.id}`;
      }
      
      const statusCallbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-twiml?hist_id=${hist.id}&twilio_event=${isBridgeMode ? "bridge_parent" : "direct_call"}`;
      
      const basicAuth = btoa(`${twilioSid}:${twilioAuth}`);
      
      const callParams = new URLSearchParams({
        To: targetTo,
        From: twilioFrom,
        Url: twimlUrl,
        Method: "GET",
        StatusCallback: statusCallbackUrl,
        StatusCallbackMethod: "POST",
      });
      const statusEvents = isBridgeMode ? ["initiated", "ringing", "answered"] : ["initiated", "ringing", "answered", "completed"];
      statusEvents.forEach((event) => {
        callParams.append("StatusCallbackEvent", event);
      });

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: callParams,
      });

      const twilioData = await twilioRes.json();
      
      if (!twilioRes.ok) {
        console.error("Twilio Error:", twilioData);
        await supabase.from("ligacoes_ia_historico").update({
          status: "erro",
          error_message: twilioData.message || "Erro desconhecido no Twilio",
        }).eq("id", hist.id);
        
        return new Response(JSON.stringify({ error: twilioData.message || "Erro ao iniciar ligação via Twilio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("ligacoes_ia_historico").update({
        status: "discando",
        wavoip_call_id: twilioData.sid,
        raw_payload: { mode: "twilio_pstn", call_sid: twilioData.sid, to: normalizedDestination, from: twilioFrom, twiml_url: twimlUrl, status_callback_url: statusCallbackUrl },
      }).eq("id", hist.id);

      return new Response(JSON.stringify({
        success: true,
        provider: "twilio",
        historico_id: hist.id,
        call_sid: twilioData.sid,
        texto_final: ttsData.texto_final,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
