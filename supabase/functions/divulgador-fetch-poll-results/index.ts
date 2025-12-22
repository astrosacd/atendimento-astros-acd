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
        // Fetch messages from the group using Evolution API v2 endpoint
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
              limit: 200,
            }),
          }
        );

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          console.error(`Failed to fetch chat: ${chatResponse.status} ${errorText}`);
          continue;
        }

        const chatData = await chatResponse.json();
        
        // Log the actual structure of the response for debugging
        console.log(`API Response type: ${typeof chatData}, isArray: ${Array.isArray(chatData)}`);
        console.log(`API Response sample: ${JSON.stringify(chatData).substring(0, 500)}`);

        // Evolution API v2 returns an array directly, not { messages: [...] }
        const messages = Array.isArray(chatData) ? chatData : (chatData?.messages || chatData?.data || []);
        
        console.log(`Got ${messages?.length || 0} messages from chat`);

        // Find poll update messages
        const pollUpdates = messages.filter((msg: any) => {
          return msg?.message?.pollUpdateMessage || 
                 msg?.pollUpdates || 
                 msg?.message?.pollCreationMessage ||
                 msg?.message?.pollCreationMessageV3;
        }) || [];

        console.log(`Found ${pollUpdates.length} poll-related messages`);

        // Process poll results
        const votesByOption: Record<string, { count: number; voters: string[] }> = {};

        // Initialize all options with 0 votes
        for (const option of message.poll_options || []) {
          votesByOption[option] = { count: 0, voters: [] };
        }

        // Process each poll message to extract votes
        for (const pollMsg of pollUpdates) {
          // Check for pollUpdateMessage (vote updates)
          const pollUpdate = pollMsg?.message?.pollUpdateMessage;
          if (pollUpdate) {
            const voter = pollMsg?.key?.participant || pollMsg?.participant || "unknown";
            const vote = pollUpdate?.vote;
            if (vote) {
              const selectedOptions = vote?.selectedOptions || [];
              for (const option of selectedOptions) {
                const optionName = typeof option === 'string' ? option : option?.name || option?.optionName;
                if (optionName && votesByOption[optionName]) {
                  if (!votesByOption[optionName].voters.includes(voter)) {
                    votesByOption[optionName].count++;
                    votesByOption[optionName].voters.push(voter);
                  }
                }
              }
            }
          }

          // Check for pollUpdates array in the message
          if (pollMsg?.pollUpdates && Array.isArray(pollMsg.pollUpdates)) {
            for (const update of pollMsg.pollUpdates) {
              const voter = update?.pollUpdateMessageKey?.participant || "unknown";
              const selectedOptions = update?.vote?.selectedOptions || [];
              
              for (const option of selectedOptions) {
                const optionName = typeof option === 'string' ? option : option?.name || option?.optionName;
                if (optionName && votesByOption[optionName]) {
                  if (!votesByOption[optionName].voters.includes(voter)) {
                    votesByOption[optionName].count++;
                    votesByOption[optionName].voters.push(voter);
                  }
                }
              }
            }
          }

          // Check for pollCreationMessage with embedded results
          const pollCreation = pollMsg?.message?.pollCreationMessage || pollMsg?.message?.pollCreationMessageV3;
          if (pollCreation && pollCreation.name === message.content) {
            // Some APIs include results in the creation message
            if (pollCreation.results) {
              for (const result of pollCreation.results) {
                const optionName = result?.optionName || result?.name;
                if (optionName && votesByOption[optionName]) {
                  const voters = result?.voters || [];
                  for (const voter of voters) {
                    if (!votesByOption[optionName].voters.includes(voter)) {
                      votesByOption[optionName].count++;
                      votesByOption[optionName].voters.push(voter);
                    }
                  }
                }
              }
            }
          }
        }

        // Save results to database
        for (const [optionName, data] of Object.entries(votesByOption)) {
          // Only save if there are votes OR if we want to track all options
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
            if (data.count > 0) updatedPolls++;
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
