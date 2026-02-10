import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("⏰ Processing scheduled proposal sends...");

    // Fetch pending sends that are due
    const { data: pendingSends, error: fetchError } = await supabase
      .from("proposal_scheduled_sends")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (fetchError) {
      console.error("❌ Error fetching scheduled sends:", fetchError);
      throw fetchError;
    }

    if (!pendingSends || pendingSends.length === 0) {
      console.log("✅ No pending scheduled sends");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📋 Found ${pendingSends.length} scheduled send(s) to process`);

    let processed = 0;
    let errors = 0;

    for (const scheduled of pendingSends) {
      try {
        // Call the existing send-proposal function internally
        const sendResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-proposal`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              proposalId: scheduled.proposal_id,
              channel: scheduled.channel,
              recipientEmail: scheduled.recipient_email,
              recipientPhone: scheduled.recipient_phone,
              recipientName: scheduled.recipient_name,
              enablePasswordProtection: scheduled.enable_password_protection,
            }),
          }
        );

        const result = await sendResponse.json();

        if (sendResponse.ok && result.success) {
          // Mark as sent
          await supabase
            .from("proposal_scheduled_sends")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", scheduled.id);

          console.log(`✅ Scheduled send ${scheduled.id} processed successfully`);
          processed++;
        } else {
          const errorMsg = result.error || JSON.stringify(result.results || "Unknown error");
          await supabase
            .from("proposal_scheduled_sends")
            .update({
              status: "error",
              error_message: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", scheduled.id);

          console.error(`❌ Scheduled send ${scheduled.id} failed:`, errorMsg);
          errors++;
        }
      } catch (err: any) {
        await supabase
          .from("proposal_scheduled_sends")
          .update({
            status: "error",
            error_message: err.message || "Erro desconhecido",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        console.error(`❌ Error processing scheduled send ${scheduled.id}:`, err);
        errors++;
      }
    }

    console.log(`✅ Finished: ${processed} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
