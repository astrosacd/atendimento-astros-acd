import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all poll messages that were sent
    const { data: pollMessages, error: messagesError } = await supabase
      .from("divulgador_messages")
      .select(`
        id,
        content,
        poll_options,
        group_id,
        sent_at,
        divulgador_groups!inner(
          id,
          name,
          whatsapp_group_id,
          instance_id,
          divulgador_instances!inner(
            api_url,
            api_key,
            instance_name
          )
        )
      `)
      .eq("media_type", "poll")
      .eq("status", "sent")
      .order("sent_at", { ascending: false });

    if (messagesError) {
      console.error("Error fetching poll messages:", messagesError);
      throw messagesError;
    }

    console.log(`Found ${pollMessages?.length || 0} poll messages to check`);

    let updatedPolls = 0;
    let totalVotes = 0;

    for (const message of pollMessages || []) {
      const group = message.divulgador_groups as any;
      const instance = group?.divulgador_instances;
      
      if (!instance) {
        console.log(`No instance found for message ${message.id}`);
        continue;
      }

      const apiUrl = instance.api_url.replace(/\/$/, "");
      const apiKey = instance.api_key;
      const instanceName = instance.instance_name;
      const groupId = group.whatsapp_group_id;

      console.log(`Fetching chat for group: ${groupId}, instance: ${instanceName}`);

      try {
        // Fetch messages from the group to find poll responses
        // Evolution API endpoint to get messages
        const chatResponse = await fetch(
          `${apiUrl}/chat/findMessages/${instanceName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": apiKey,
            },
            body: JSON.stringify({
              where: {
                key: {
                  remoteJid: groupId,
                },
              },
              limit: 100,
            }),
          }
        );

        if (!chatResponse.ok) {
          console.error(`Failed to fetch chat: ${chatResponse.status} ${await chatResponse.text()}`);
          continue;
        }

        const chatData = await chatResponse.json();
        console.log(`Got ${chatData?.messages?.length || 0} messages from chat`);

        // Find poll update messages
        const pollUpdates = chatData?.messages?.filter((msg: any) => {
          return msg.message?.pollUpdateMessage || msg.pollUpdates;
        }) || [];

        console.log(`Found ${pollUpdates.length} poll updates`);

        // Process poll results
        // We need to aggregate votes by option
        const votesByOption: Record<string, { count: number; voters: string[] }> = {};

        // Initialize all options with 0 votes
        for (const option of message.poll_options || []) {
          votesByOption[option] = { count: 0, voters: [] };
        }

        for (const update of pollUpdates) {
          const pollUpdate = update.message?.pollUpdateMessage || update;
          const voter = update.key?.participant || update.participant || "unknown";
          
          // Get the selected options from the vote
          const vote = pollUpdate?.vote || pollUpdate?.pollUpdates?.[0];
          if (vote) {
            const selectedOptions = vote.selectedOptions || vote.pollOptionNames || [];
            for (const option of selectedOptions) {
              if (votesByOption[option]) {
                if (!votesByOption[option].voters.includes(voter)) {
                  votesByOption[option].count++;
                  votesByOption[option].voters.push(voter);
                }
              }
            }
          }
        }

        // Also check for pollCreationMessage results directly in the message
        const pollCreations = chatData?.messages?.filter((msg: any) => {
          const pollMsg = msg.message?.pollCreationMessage || msg.message?.pollCreationMessageV3;
          return pollMsg && pollMsg.name === message.content;
        }) || [];

        for (const pollCreation of pollCreations) {
          if (pollCreation.pollUpdates) {
            for (const update of pollCreation.pollUpdates) {
              const voter = update.pollUpdateMessageKey?.participant || "unknown";
              const selectedOptions = update.vote?.selectedOptions || [];
              
              for (const option of selectedOptions) {
                if (votesByOption[option]) {
                  if (!votesByOption[option].voters.includes(voter)) {
                    votesByOption[option].count++;
                    votesByOption[option].voters.push(voter);
                  }
                }
              }
            }
          }
        }

        // Save results to database
        for (const [optionName, data] of Object.entries(votesByOption)) {
          if (data.count > 0) {
            const { error: upsertError } = await supabase
              .from("divulgador_poll_results")
              .upsert(
                {
                  message_id: message.id,
                  group_id: group.id,
                  poll_name: message.content,
                  option_name: optionName,
                  vote_count: data.count,
                  voters: data.voters,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: "message_id,group_id,option_name",
                  ignoreDuplicates: false,
                }
              );

            if (upsertError) {
              console.error(`Error upserting poll result:`, upsertError);
            } else {
              totalVotes += data.count;
              updatedPolls++;
            }
          }
        }
      } catch (fetchError) {
        console.error(`Error processing poll ${message.id}:`, fetchError);
      }
    }

    console.log(`Updated ${updatedPolls} poll results with ${totalVotes} total votes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Atualizado ${updatedPolls} resultados de enquete`,
        polls_checked: pollMessages?.length || 0,
        total_votes: totalVotes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error fetching poll results:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
