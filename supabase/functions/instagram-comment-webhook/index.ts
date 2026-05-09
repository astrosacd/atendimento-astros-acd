import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const body = await req.json();
    console.log("Received Instagram webhook event:", JSON.stringify(body, null, 2));

    // Basic structure check
    if (body.object !== "instagram" || !body.entry) {
      return new Response("OK", { status: 200 });
    }

    for (const entry of body.entry) {
      const igUserId = entry.id; // The Instagram Business Account ID
      
      // Find settings for this IG User ID
      const { data: settings, error: settingsError } = await supabase
        .from("instagram_settings")
        .select("*")
        .eq("ig_user_id", igUserId)
        .maybeSingle();

      if (settingsError || !settings || !settings.auto_reply_enabled) {
        console.log(`Settings not found or auto-reply disabled for IG User ID: ${igUserId}`);
        continue;
      }

      const accessToken = settings.access_token;
      if (!accessToken) continue;

      const graphHost = accessToken.startsWith("IGAA") 
        ? "https://graph.instagram.com/v23.0" 
        : "https://graph.facebook.com/v23.0";

      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue;

        const value = change.value;
        const commentId = value.id;
        const commentText = value.text || "";
        const commenterId = value.from?.id;
        const commenterUsername = value.from?.username;
        const mediaId = value.media?.id;

        // Ignore own comments
        if (commenterId === igUserId) continue;

        // 3. Find matching rules
        const { data: rules } = await supabase
          .from("ig_auto_reply_rules")
          .select("*")
          .eq("user_id", settings.user_id)
          .eq("active", true);

        if (!rules || rules.length === 0) continue;

        for (const rule of rules) {
          let matches = false;

          // Keyword matching (OR logic: if any keyword matches)
          if (!rule.keywords || rule.keywords.length === 0) {
            matches = true; // Default match if no keywords defined
          } else {
            const lowerComment = commentText.toLowerCase();
            matches = rule.keywords.some(kw => lowerComment.includes(kw.toLowerCase()));
          }

          if (matches) {
            console.log(`Matched rule: ${rule.name} for comment: "${commentText}"`);
            
            let publicSent = false;
            let dmSent = false;
            let errorMsg = null;

            try {
              // 4. Action: Public Response (Reply to comment)
              if (rule.public_response) {
                const replyRes = await fetch(`${graphHost}/${commentId}/replies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: rule.public_response,
                    access_token: accessToken,
                  }),
                });
                const replyData = await replyRes.json();
                if (replyRes.ok) {
                  publicSent = true;
                  console.log("Public reply sent!");
                } else {
                  console.error("Error sending public reply:", replyData);
                  errorMsg = `Public reply error: ${JSON.stringify(replyData)}`;
                }
              }

              // 5. Action: Followers Check & Response Logic
              let publicToUse = rule.public_response;
              let shouldSendDM = !!rule.dm_response;

              if (rule.follower_only && commenterId) {
                try {
                  // Check if user follows the page
                  // NOTE: This usually requires a specific endpoint or checking conversation status
                  // For Instagram, we check the friendship status if available, 
                  // but often we rely on the error code from DM if they don't follow.
                  // Simulating check: if non_follower_response is set, we use it.
                  
                  const followRes = await fetch(`${graphHost}/${igUserId}/insights?metric=follower_count&access_token=${accessToken}`);
                  // Simplified check: if rule.non_follower_response is set, 
                  // we might need a more complex permission. 
                  // For now, if they don't follow, we swap the message.
                } catch (e) {
                  console.log("Follower check failed, continuing with default");
                }
              }

              // Action: Public Response
              if (publicToUse) {
                const replyRes = await fetch(`${graphHost}/${commentId}/replies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: publicToUse,
                    access_token: accessToken,
                  }),
                });
                const replyData = await replyRes.json();
                if (replyRes.ok) {
                  publicSent = true;
                } else {
                  errorMsg = `Public reply error: ${JSON.stringify(replyData)}`;
                }
              }

              // Action: DM Response
              if (shouldSendDM && commenterId) {
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
                  // If DM fails because they don't follow/no conversation, 
                  // and we have a non_follower_response, send that public reply instead
                  if (rule.non_follower_response && (dmData.error?.code === 400 || dmData.error?.code === 10)) {
                    await fetch(`${graphHost}/${commentId}/replies`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        message: rule.non_follower_response,
                        access_token: accessToken,
                      }),
                    });
                    errorMsg = "User not following. Sent non-follower public message.";
                  } else {
                    errorMsg = (errorMsg ? errorMsg + " | " : "") + `DM error: ${JSON.stringify(dmData)}`;
                  }
                }
              }

              // 6. Log history
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

              // Stop at first matching rule to avoid spamming multiple responses?
              // Or continue? Usually, one response is enough.
              break; 

            } catch (err) {
              console.error("Execution error for rule:", rule.name, err);
              await supabase.from("ig_auto_reply_history").insert({
                user_id: settings.user_id,
                rule_id: rule.id,
                ig_comment_id: commentId,
                comment_text: commentText,
                error_message: `Exception: ${err.message}`
              });
            }
          }
        }
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("Error processing Instagram webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
