// Callback OBRIGATÓRIO da Meta: chamado quando um usuário desautoriza o app.
// Precisa validar o signed_request assinado com o App Secret e limpar tokens.
// URL pública (verify_jwt=false por default no Lovable). Nunca exige Authorization.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// base64url → Uint8Array
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

// Meta manda application/x-www-form-urlencoded com campo signed_request=SIG.PAYLOAD
async function parseSignedRequest(req: Request): Promise<{ payload: any; raw: string } | null> {
  const ct = req.headers.get("content-type") || "";
  let signedRequest = "";
  const rawBody = await req.text();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    signedRequest = params.get("signed_request") || "";
  } else if (ct.includes("application/json")) {
    try {
      const j = JSON.parse(rawBody);
      signedRequest = j.signed_request || "";
    } catch { /* noop */ }
  } else {
    // Alguns clientes Meta mandam sem content-type explícito
    const params = new URLSearchParams(rawBody);
    signedRequest = params.get("signed_request") || rawBody;
  }
  if (!signedRequest || !signedRequest.includes(".")) return null;

  const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Precisamos testar contra cada app_secret cadastrado (multi-tenant).
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, message: "Instagram Deauthorize Callback ativo" }), {
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
    const parsed = await parseSignedRequest(req);
    if (!parsed) {
      console.warn("[deauthorize] Assinatura inválida ou signed_request ausente");
      return new Response(JSON.stringify({ error: "invalid_signed_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const igUserId = String(parsed.payload.user_id || "");
    const matchedUserId = parsed.payload._matched_user_id as string | undefined;
    console.log("[deauthorize] Usuário desautorizou o app:", { igUserId, matchedUserId });

    // Limpa tokens do(s) usuário(s) correspondente(s).
    const filter = matchedUserId
      ? supabase.from("instagram_settings").update({
          access_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", matchedUserId)
      : supabase.from("instagram_settings").update({
          access_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq("ig_user_id", igUserId);

    const { error } = await filter;
    if (error) console.error("[deauthorize] Erro ao limpar tokens:", error);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[deauthorize] Fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
