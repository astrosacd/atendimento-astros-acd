import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("Received poll webhook payload:", JSON.stringify(payload, null, 2));

    // Evolution API poll vote webhook format
    // The payload structure may vary, adjust according to actual Evolution API format
    const { data, event } = payload;

    if (event !== "messages.upsert" && event !== "poll.vote") {
      console.log("Ignoring non-poll event:", event);
      return new Response(
        JSON.stringify({ success: true, message: "Event ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract poll data from the webhook
    // This structure depends on Evolution API's webhook format
    const messageData = data?.message || data;
    const pollUpdate = messageData?.pollUpdateMessage || messageData?.pollVote;

    if (!pollUpdate) {
      console.log("No poll update data found in payload");
      return new Response(
        JSON.stringify({ success: true, message: "No poll data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groupId = data?.key?.remoteJid || messageData?.remoteJid;
    const pollName = pollUpdate?.name || pollUpdate?.pollCreationMessage?.name;
    const votes = pollUpdate?.votes || pollUpdate?.vote;
    const voterNumber = data?.key?.participant || messageData?.participant;

    if (!groupId || !pollName) {
      console.log("Missing required poll data:", { groupId, pollName });
      return new Response(
        JSON.stringify({ success: false, message: "Missing poll data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Find the group in database
    const { data: group, error: groupError } = await supabase
      .from("divulgador_groups")
      .select("id")
      .eq("whatsapp_group_id", groupId.replace("@g.us", ""))
      .single();

    if (groupError || !group) {
      console.log("Group not found:", groupId);
      return new Response(
        JSON.stringify({ success: false, message: "Group not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Find the message (poll) by content matching
    const { data: message, error: messageError } = await supabase
      .from("divulgador_messages")
      .select("id, poll_options")
      .eq("content", pollName)
      .eq("media_type", "poll")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Process votes
    if (votes && Array.isArray(votes)) {
      for (const vote of votes) {
        const optionName = vote.name || vote.optionName || vote;
        
        // Upsert the poll result
        const { data: existingResult, error: selectError } = await supabase
          .from("divulgador_poll_results")
          .select("id, vote_count, voters")
          .eq("group_id", group.id)
          .eq("poll_name", pollName)
          .eq("option_name", optionName)
          .maybeSingle();

        if (existingResult) {
          // Update existing result
          const voters = existingResult.voters || [];
          if (voterNumber && !voters.includes(voterNumber)) {
            voters.push(voterNumber);
          }
          
          await supabase
            .from("divulgador_poll_results")
            .update({
              vote_count: existingResult.vote_count + 1,
              voters,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingResult.id);
        } else {
          // Insert new result
          await supabase
            .from("divulgador_poll_results")
            .insert({
              message_id: message?.id || null,
              group_id: group.id,
              poll_name: pollName,
              option_name: optionName,
              vote_count: 1,
              voters: voterNumber ? [voterNumber] : [],
            });
        }
      }
    }

    console.log("Poll results updated successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Poll results updated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing poll webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
