import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

function getChatRecords(chatData: any): any[] {
  // Evolution API variants observed:
  // - { messages: { records: [...] } }
  // - { messages: [...] }
  // - { records: [...] }
  // - [...] (array)
  if (Array.isArray(chatData)) return chatData;
  if (Array.isArray(chatData?.messages)) return chatData.messages;
  if (Array.isArray(chatData?.records)) return chatData.records;
  if (Array.isArray(chatData?.messages?.records)) return chatData.messages.records;
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      const groupJid = group.whatsapp_group_id;
      const sentAtMs = message.sent_at ? Date.parse(message.sent_at) : 0;

      console.log(`Fetching chat for group: ${groupJid}, instance: ${instanceName}`);

      try {
        const chatResponse = await fetch(`${apiUrl}/chat/findMessages/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: groupJid,
              },
            },
            limit: 300,
          }),
        });

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          console.error(`Failed to fetch chat: ${chatResponse.status} ${errorText}`);
          continue;
        }

        const chatData = await chatResponse.json();
        const records = getChatRecords(chatData);

        console.log(
          `Chat payload parsed: records=${records.length}, shape=${JSON.stringify({
            isArray: Array.isArray(chatData),
            hasMessagesObj: !!chatData?.messages,
            hasRecords: Array.isArray(chatData?.messages?.records),
          })}`
        );

        // Initialize vote map
        const votesByOption: Record<string, { count: number; voters: string[] }> = {};
        for (const option of message.poll_options || []) {
          votesByOption[option] = { count: 0, voters: [] };
        }

        // Poll updates often come as encrypted payloads (encPayload).
        // We'll only count when the API provides selectedOptions in plain text.
        const pollUpdateMessages = records.filter((m: any) => {
          const msgType = m?.messageType;
          const remoteJid = m?.key?.remoteJid;
          const tsMs = m?.messageTimestamp
            ? Number(String(m.messageTimestamp)) * 1000
            : m?.timestamp
              ? Number(m.timestamp)
              : 0;

          if (remoteJid !== groupJid) return false;
          if (sentAtMs && tsMs && tsMs < sentAtMs) return false;

          return msgType === "pollUpdateMessage" || !!m?.message?.pollUpdateMessage;
        });

        console.log(`Found ${pollUpdateMessages.length} pollUpdateMessage records after sent_at`);

        let countedVotes = 0;
        let encryptedVotes = 0;

        for (const m of pollUpdateMessages) {
          const voter = m?.key?.participant || m?.participant || "unknown";
          const vote = m?.message?.pollUpdateMessage?.vote;

          const selectedOptions = vote?.selectedOptions || vote?.pollOptionNames;

          if (Array.isArray(selectedOptions) && selectedOptions.length > 0) {
            for (const rawOpt of selectedOptions) {
              const opt = typeof rawOpt === "string" ? rawOpt : rawOpt?.name || rawOpt?.optionName;
              if (opt && votesByOption[opt]) {
                if (!votesByOption[opt].voters.includes(voter)) {
                  votesByOption[opt].count++;
                  votesByOption[opt].voters.push(voter);
                  countedVotes++;
                }
              }
            }
          } else {
            // Encrypted/unsupported vote format
            if (vote?.encPayload) encryptedVotes++;
          }
        }

        console.log(
          `Vote parsing summary for poll ${message.id}: countedVotes=${countedVotes}, encryptedVotes=${encryptedVotes}`
        );

        // Upsert all options (so UI can show 0 too)
        for (const [optionName, data] of Object.entries(votesByOption)) {
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
            console.error(`Error upserting poll result for option ${optionName}:`, upsertError);
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
