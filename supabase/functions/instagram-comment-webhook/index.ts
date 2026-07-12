import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call, x-hub-signature-256",
};

// -------- Meta signature validation (X-Hub-Signature-256) --------
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("sha256=") ? hex.slice(7) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
async function hmacSha256Bytes(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
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
async function verifyMetaSignature(supabase: any, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const provided = hexToBytes(signatureHeader);
  // Testa contra cada app_secret cadastrado (multi-tenant)
  const { data: rows } = await supabase
    .from("instagram_settings")
    .select("app_secret")
    .not("app_secret", "is", null);
  for (const row of rows ?? []) {
    if (!row.app_secret) continue;
    const expected = await hmacSha256Bytes(row.app_secret, rawBody);
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}
// -----------------------------------------------------------------

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1. Handle Webhook Verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      // Check if this token matches any user's verify token in instagram_settings
      const { data: settings } = await supabase
        .from("instagram_settings")
        .select("webhook_verify_token")
        .eq("webhook_verify_token", token)
        .maybeSingle();

      if (settings) {
        console.log("Webhook verified successfully!");
        return new Response(challenge, { status: 200 });
      }
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Handle Webhook Event (POST)
  try {
    // Ler cru primeiro para validar assinatura (parse JSON altera bytes)
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256") || req.headers.get("X-Hub-Signature-256");
    const signatureValid = await verifyMetaSignature(supabase, rawBody, signatureHeader);
    if (!signatureValid) {
      console.warn("[ig-webhook] Assinatura X-Hub-Signature-256 inválida ou ausente — rejeitando");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const body = JSON.parse(rawBody);
    console.log("Received Instagram webhook event:", JSON.stringify(body, null, 2));

    if (body.object !== "instagram" || !body.entry) {
      return new Response("OK", { status: 200 });
    }


    for (const entry of body.entry) {
      const igUserId = entry.id;
      
      const { data: settings, error: settingsError } = await supabase
        .from("instagram_settings")
        .select("*")
        .eq("ig_user_id", igUserId)
        .maybeSingle();

      if (settingsError || !settings || !settings.auto_reply_enabled) {
        console.log(`Settings not found or disabled for ${igUserId}`);
        continue;
      }

      const accessToken = settings.access_token;
      if (!accessToken) continue;

      const graphHost = "https://graph.facebook.com/v20.0";

      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue;

        const value = change.value;
        const commentId = value.id;
        const commentText = value.text || "";
        const commenterId = value.from?.id;
        const commenterUsername = value.from?.username;
        const mediaId = value.media?.id;

        if (commenterId === igUserId) continue;

        // Find rules - Prioritize specific post rules
        const { data: rules } = await supabase
          .from("ig_auto_reply_rules")
          .select("*")
          .eq("user_id", settings.user_id)
          .eq("active", true)
          .order("specific_media_id", { ascending: false }); // Rules with media_id first

        if (!rules) continue;

        for (const rule of rules) {
          // Check if rule matches specific post (if defined)
          if (rule.specific_media_id && rule.specific_media_id !== mediaId) continue;

          let matches = false;
          if (!rule.keywords || rule.keywords.length === 0) {
            matches = true;
          } else {
            const lowerComment = commentText.toLowerCase();
            matches = rule.keywords.some(kw => lowerComment.includes(kw.toLowerCase()));
          }

          if (matches) {
            console.log(`Matched rule: ${rule.name}`);
            
            let publicSent = false;
            let dmSent = false;
            let errorMsg = null;

            try {
              // Priority 1: DM (if configured)
              if (rule.dm_response && commenterId) {
                const dmRes = await fetch(`${graphHost}/${igUserId}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    recipient: { id: commenterId },
                    message: { text: rule.dm_response },
                    access_token: accessToken,
                  }),
                });
                const dmData = await dmRes.json();
                
                if (dmRes.ok) {
                  dmSent = true;
                } else {
                  console.error("DM Error:", dmData);
                  // Error codes for "cannot message this user" (not following, no opt-in)
                  const isFollowError = [400, 10, 100].includes(dmData.error?.code);
                  
                  if (isFollowError && rule.non_follower_response) {
                    // Send non-follower public response instead
                    const replyRes = await fetch(`${graphHost}/${commentId}/replies`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        message: rule.non_follower_response,
                        access_token: accessToken,
                      }),
                    });
                    if (replyRes.ok) publicSent = true;
                    errorMsg = "User not following. Sent follow-request public reply.";
                  } else {
                    errorMsg = `DM Error: ${dmData.error?.message || 'Unknown'}`;
                  }
                }
              }

              // Priority 2: Standard Public Response (if configured and not already sent a follow request)
              if (rule.public_response && !publicSent) {
                const replyRes = await fetch(`${graphHost}/${commentId}/replies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: rule.public_response,
                    access_token: accessToken,
                  }),
                });
                if (replyRes.ok) publicSent = true;
                else if (!errorMsg) errorMsg = "Public reply failed";
              }

              // Log history
              await supabase.from("ig_auto_reply_history").insert({
                user_id: settings.user_id,
                rule_id: rule.id,
                ig_comment_id: commentId,
                ig_media_id: mediaId,
                ig_username: commenterUsername,
                ig_user_id: commenterId,
                comment_text: commentText,
                public_response_sent: publicSent,
                dm_sent: dmSent,
                error_message: errorMsg
              });

              break; // Stop after first matched rule
            } catch (err) {
              console.error("Execution error:", err);
            }
          }
        }
      }
    }
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response("Error", { status: 400 });
  }
});
