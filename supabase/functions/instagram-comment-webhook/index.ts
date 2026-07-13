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
async function verifyMetaSignature(supabase: any, rawBody: string, signatureHeader: string | null): Promise<{ ok: boolean; userId: string | null }> {
  if (!signatureHeader) return { ok: false, userId: null };
  const provided = hexToBytes(signatureHeader);
  const { data: rows } = await supabase
    .from("instagram_settings")
    .select("user_id, app_secret")
    .not("app_secret", "is", null);
  for (const row of rows ?? []) {
    if (!row.app_secret) continue;
    const expected = await hmacSha256Bytes(row.app_secret, rawBody);
    if (timingSafeEqual(provided, expected)) return { ok: true, userId: row.user_id };
  }
  return { ok: false, userId: null };
}

async function logEvent(supabase: any, row: {
  user_id?: string | null; event_type: string; status: string;
  channel?: string | null; target?: string | null; message?: string | null; metadata?: any;
}) {
  try {
    await supabase.from("instagram_notification_logs").insert({
      user_id: row.user_id ?? null,
      event_type: row.event_type,
      status: row.status,
      channel: row.channel ?? "webhook",
      target: row.target ?? null,
      message: row.message ?? null,
      metadata: row.metadata ?? null,
    });
  } catch (e) {
    console.error("[log] falha ao gravar log:", e);
  }
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
    const sig = await verifyMetaSignature(supabase, rawBody, signatureHeader);
    if (!sig.ok) {
      console.warn("[ig-webhook] Assinatura X-Hub-Signature-256 inválida ou ausente — rejeitando");
      await logEvent(supabase, {
        event_type: "webhook_signature_invalid",
        status: "rejected",
        message: signatureHeader ? "Assinatura HMAC não bateu com nenhum app_secret" : "Header X-Hub-Signature-256 ausente",
      });
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const body = JSON.parse(rawBody);
    await logEvent(supabase, {
      user_id: sig.userId,
      event_type: "webhook_received",
      status: "received",
      target: body?.object || null,
      message: `${(body?.entry?.length ?? 0)} entry(ies)`,
      metadata: { object: body?.object },
    });
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
        const commentText: string = value.text || "";
        const commenterId: string | undefined = value.from?.id;
        const commenterUsername: string | undefined = value.from?.username;
        const mediaId = value.media?.id;

        if (!commentId || commenterId === igUserId) continue;

        // ---------- DEDUP GLOBAL POR COMENTÁRIO ----------
        // Se já existe qualquer histórico com esse comment_id, pulamos tudo.
        const { count: dupCount } = await supabase
          .from("ig_auto_reply_history")
          .select("id", { count: "exact", head: true })
          .eq("ig_comment_id", commentId);
        if ((dupCount ?? 0) > 0) {
          console.log(`[dedup] Comment ${commentId} já processado — ignorando`);
          continue;
        }

        const { data: rules } = await supabase
          .from("ig_auto_reply_rules")
          .select("*")
          .eq("user_id", settings.user_id)
          .eq("active", true)
          .order("specific_media_id", { ascending: false });

        if (!rules) continue;

        for (const rule of rules) {
          if (rule.specific_media_id && rule.specific_media_id !== mediaId) continue;

          const lowerComment = commentText.toLowerCase();
          const lowerUsername = (commenterUsername || "").toLowerCase();

          // ---------- BLACKLISTS ----------
          const ukBlacklist: string[] = rule.blacklist_usernames ?? [];
          if (ukBlacklist.some((u) => u && lowerUsername === u.toLowerCase().replace(/^@/, ""))) {
            console.log(`[blacklist] username ${commenterUsername} bloqueado para rule ${rule.name}`);
            continue;
          }
          const kwBlacklist: string[] = rule.blacklist_keywords ?? [];
          if (kwBlacklist.some((kw) => kw && lowerComment.includes(kw.toLowerCase()))) {
            console.log(`[blacklist] keyword bloqueada para rule ${rule.name}`);
            continue;
          }

          // ---------- MATCH ----------
          const matches = !rule.keywords || rule.keywords.length === 0
            ? true
            : rule.keywords.some((kw: string) => lowerComment.includes(kw.toLowerCase()));
          if (!matches) continue;

          // ---------- COOLDOWN + DAILY LIMIT POR USUÁRIO ----------
          if (commenterId) {
            const cooldown = Math.max(0, rule.cooldown_seconds ?? 3600);
            if (cooldown > 0) {
              const since = new Date(Date.now() - cooldown * 1000).toISOString();
              const { count: recentCount } = await supabase
                .from("ig_auto_reply_history")
                .select("id", { count: "exact", head: true })
                .eq("rule_id", rule.id)
                .eq("ig_user_id", commenterId)
                .gte("created_at", since);
              if ((recentCount ?? 0) > 0) {
                console.log(`[cooldown] user ${commenterId} ainda em cooldown para rule ${rule.name}`);
                continue;
              }
            }

            const dailyLimit = Math.max(0, rule.max_per_user_per_day ?? 3);
            if (dailyLimit > 0) {
              const dayStart = new Date();
              dayStart.setUTCHours(0, 0, 0, 0);
              const { count: dayCount } = await supabase
                .from("ig_auto_reply_history")
                .select("id", { count: "exact", head: true })
                .eq("rule_id", rule.id)
                .eq("ig_user_id", commenterId)
                .gte("created_at", dayStart.toISOString());
              if ((dayCount ?? 0) >= dailyLimit) {
                console.log(`[daily-limit] user ${commenterId} atingiu ${dailyLimit}/dia para rule ${rule.name}`);
                continue;
              }
            }
          }

          console.log(`Matched rule: ${rule.name}`);

          let publicSent = false;
          let dmSent = false;
          let errorMsg: string | null = null;

          try {
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
                const isFollowError = [400, 10, 100].includes(dmData.error?.code);
                if (isFollowError && rule.non_follower_response) {
                  const replyRes = await fetch(`${graphHost}/${commentId}/replies`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: rule.non_follower_response, access_token: accessToken }),
                  });
                  if (replyRes.ok) publicSent = true;
                  errorMsg = "User not following. Sent follow-request public reply.";
                } else {
                  errorMsg = `DM Error: ${dmData.error?.message || 'Unknown'}`;
                }
              }
            }

            if (rule.public_response && !publicSent) {
              const replyRes = await fetch(`${graphHost}/${commentId}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: rule.public_response, access_token: accessToken }),
              });
              if (replyRes.ok) publicSent = true;
              else if (!errorMsg) errorMsg = "Public reply failed";
            }

            // Insert com upsert-safe: se outro processo concorrente já inseriu, o unique index (rule_id, ig_comment_id) rejeita.
            const { error: histErr } = await supabase.from("ig_auto_reply_history").insert({
              user_id: settings.user_id,
              rule_id: rule.id,
              ig_comment_id: commentId,
              ig_media_id: mediaId,
              ig_username: commenterUsername,
              ig_user_id: commenterId,
              comment_text: commentText,
              public_response_sent: publicSent,
              dm_sent: dmSent,
              error_message: errorMsg,
            });
            if (histErr && histErr.code === "23505") {
              console.log("[dedup] histórico duplicado detectado no insert (race)");
            }

            break; // Stop after first matched rule
          } catch (err) {
            console.error("Execution error:", err);
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
