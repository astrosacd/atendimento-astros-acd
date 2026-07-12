// Callback OBRIGATÓRIO da Meta (LGPD/GDPR): usuário pede exclusão dos dados.
// Valida signed_request com App Secret, registra pedido, apaga dados do IG user
// e devolve { url, confirmation_code } para o usuário acompanhar o status.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function base64UrlDecodeText(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}
async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function parseSignedRequest(supabase: any, req: Request) {
  const ct = req.headers.get("content-type") || "";
  const rawBody = await req.text();
  let signedRequest = "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    signedRequest = new URLSearchParams(rawBody).get("signed_request") || "";
  } else if (ct.includes("application/json")) {
    try { signedRequest = JSON.parse(rawBody).signed_request || ""; } catch { /* noop */ }
  } else {
    signedRequest = new URLSearchParams(rawBody).get("signed_request") || rawBody;
  }
  if (!signedRequest.includes(".")) return null;
  const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
  const { data: rows } = await supabase
    .from("instagram_settings")
    .select("user_id, app_secret, ig_user_id")
    .not("app_secret", "is", null);
  const providedSig = base64UrlDecode(encodedSig);
  for (const row of rows ?? []) {
    if (!row.app_secret) continue;
    const expected = await hmacSha256(row.app_secret, encodedPayload);
    if (timingSafeEqual(providedSig, expected)) {
      const payload = JSON.parse(base64UrlDecodeText(encodedPayload));
      return { payload: { ...payload, _matched_user_id: row.user_id }, raw: signedRequest };
    }
  }
  return null;
}

// código curto e legível
function genCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, message: "Instagram Data Deletion Callback ativo" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const parsed = await parseSignedRequest(supabase, req);
    if (!parsed) {
      console.warn("[data-deletion] signed_request inválido");
      await supabase.from("instagram_notification_logs").insert({
        event_type: "data_deletion",
        status: "rejected",
        channel: "webhook",
        message: "signed_request inválido ou ausente",
      });
      return new Response(JSON.stringify({ error: "invalid_signed_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const igUserId = String(parsed.payload.user_id || "");
    const matchedUserId = parsed.payload._matched_user_id as string | undefined;
    const confirmationCode = genCode();

    // 1) Registra o pedido (pending)
    const { error: insertErr } = await supabase
      .from("instagram_data_deletion_requests")
      .insert({
        confirmation_code: confirmationCode,
        ig_user_id: igUserId || null,
        user_id: matchedUserId || null,
        status: "pending",
        signed_request_raw: parsed.raw,
      });
    if (insertErr) {
      console.error("[data-deletion] insert falhou:", insertErr);
      throw insertErr;
    }

    await supabase.from("instagram_notification_logs").insert({
      user_id: matchedUserId ?? null,
      event_type: "data_deletion",
      status: "received",
      channel: "webhook",
      target: igUserId || null,
      message: `Pedido registrado (code: ${confirmationCode})`,
      metadata: { confirmation_code: confirmationCode },
    });

    // 2) Apaga dados do IG (best-effort). Não bloqueia o response — Meta exige resposta rápida.
    (async () => {
      try {
        const filters: Array<Promise<any>> = [];
        if (matchedUserId) {
          filters.push(supabase.from("instagram_settings").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("ig_auto_reply_rules").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("ig_auto_reply_history").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("instagram_competitors").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("instagram_competitor_analyses").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("instagram_competitor_posts").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("instagram_espionage_config").delete().eq("user_id", matchedUserId));
          filters.push(supabase.from("posts").delete().eq("user_id", matchedUserId));
        } else if (igUserId) {
          filters.push(supabase.from("instagram_settings").delete().eq("ig_user_id", igUserId));
        }
        await Promise.allSettled(filters);
        await supabase
          .from("instagram_data_deletion_requests")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("confirmation_code", confirmationCode);
        console.log("[data-deletion] Exclusão concluída:", confirmationCode);
      } catch (e: any) {
        console.error("[data-deletion] Erro na exclusão em background:", e);
        await supabase
          .from("instagram_data_deletion_requests")
          .update({ status: "failed", error_message: e?.message || String(e) })
          .eq("confirmation_code", confirmationCode);
      }
    })();

    // 3) Resposta obrigatória para a Meta
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    // pega o Origin da própria request se disponível (Meta manda direto para a function),
    // senão usa um URL público de status via a própria function.
    const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") || "";
    const statusUrl = publicSiteUrl
      ? `${publicSiteUrl.replace(/\/$/, "")}/instagram/status-exclusao/${confirmationCode}`
      : `${supabaseUrl}/functions/v1/instagram-data-deletion?code=${confirmationCode}`;

    return new Response(
      JSON.stringify({ url: statusUrl, confirmation_code: confirmationCode }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[data-deletion] Fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
