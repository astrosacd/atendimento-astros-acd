import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { targetDate } = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get config
    const { data: configRows } = await supabase.from("calendar_config").select("*");
    const config: Record<string, string> = {};
    (configRows || []).forEach((r: any) => { config[r.config_key] = r.config_value; });

    if (config.daily_summary_enabled !== "true" && !targetDate) {
      console.log("[calendar-physical-summary] Daily summary disabled");
      return new Response(JSON.stringify({ message: "Daily summary disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get date range in Brasilia time
    const now = targetDate ? new Date(targetDate) : new Date();
    
    // Get YYYY-MM-DD in Brasilia time
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatter.format(now);
    
    // Construct start and end of day in Brasilia time (UTC-3)
    const startOfDay = new Date(`${dateStr}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999-03:00`);

    console.log(`[calendar-physical-summary] Target Date: ${dateStr}`);

    console.log(`[calendar-physical-summary] Checking meetings between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const { data: events, error: eventsError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("meeting_type", "physical")
      .in("status", ["scheduled", "confirmed"])
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString());

    if (eventsError) throw eventsError;

    if (!events?.length) {
      console.log("[calendar-physical-summary] No physical meetings today");
      return new Response(JSON.stringify({ message: "No physical meetings today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by consultant phone
    const consultantMeetings: Record<string, any[]> = {};
    events.forEach(event => {
      const phones = event.consultant_phones || [];
      phones.forEach((phone: string) => {
        const cleanPhone = phone.replace(/\D/g, "");
        if (!cleanPhone) return;
        if (!consultantMeetings[cleanPhone]) consultantMeetings[cleanPhone] = [];
        consultantMeetings[cleanPhone].push(event);
      });
    });

    // Get active WhatsApp instances
    const { data: whatsappInstances } = await supabase
      .from("calendar_notification_whatsapp_instances")
      .select("*")
      .eq("is_active", true);

    if (!whatsappInstances?.length) {
      console.error("[calendar-physical-summary] No active WhatsApp instances found");
      throw new Error("No active WhatsApp instances found");
    }

    let sentCount = 0;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const BLOCK_DELAY_MS = 3000;
    let consultantIndex = 0;
    const totalConsultants = Object.keys(consultantMeetings).length;
    for (const [phone, meetings] of Object.entries(consultantMeetings)) {
      // Sort meetings by time
      meetings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      // Format date for the message (DD/MM/YYYY)
      const [y, m, d] = dateStr.split('-');
      const displayDate = `${d}/${m}/${y}`;

      let message = `🚀 *Suas Reuniões Presenciais de Hoje* (${displayDate})\n\n`;
      
      meetings.forEach((m, idx) => {
        const time = new Date(m.start_time).toLocaleTimeString("pt-BR", { 
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' 
        });
        message += `📍 *${idx + 1}. ${m.title}*\n`;
        message += `⏰ Horário: ${time}\n`;
        message += `👤 Cliente: ${m.client_name || 'N/A'}\n`;
        message += `🏠 Endereço: ${m.location || 'Não informado'}\n`;
        if (m.reference_point) message += `🚩 Referência: ${m.reference_point}\n`;
        const cleanNotes = (m.notes || '')
          .split('\n')
          .filter((l: string) => !l.startsWith('[NOTIFICADO'))
          .join('\n')
          .trim();
        if (cleanNotes) message += `📝 Observações internas: ${cleanNotes}\n`;
        message += `\n`;
      });

      message += `Boa sorte em suas visitas! 💪`;

      // Send via first available instance
      let sentToConsultant = false;
      for (const instance of whatsappInstances) {
        try {
          const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
          const res = await fetch(sendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.api_key },
            body: JSON.stringify({ number: phone, text: message }),
          });

          if (res.ok) {
            console.log(`[calendar-physical-summary] Summary sent to ${phone} via ${instance.instance_name}`);
            sentCount++;
            sentToConsultant = true;
            
            // Log notification
            await supabase.from("calendar_notification_logs").insert({
              channel: "whatsapp",
              recipient_type: "consultant_summary",
              recipient_contact: phone,
              message_sent: message,
              status: "sent",
              whatsapp_instance_id: instance.id,
            });
            
            break; 
          } else {
            const errText = await res.text();
            console.error(`[calendar-physical-summary] Instance ${instance.instance_name} failed:`, errText);
          }
        } catch (e) {
          console.error(`[calendar-physical-summary] Error sending summary to ${phone} via ${instance.instance_name}:`, e);
        }
      }
      
      if (!sentToConsultant) {
        await supabase.from("calendar_notification_logs").insert({
          channel: "whatsapp",
          recipient_type: "consultant_summary",
          recipient_contact: phone,
          message_sent: message,
          status: "error",
          error_message: "Failed to send via any active instance",
        });
      }

      consultantIndex++;
      // Delay between consultants to avoid WhatsApp throttling (skip last)
      if (consultantIndex < totalConsultants) {
        await sleep(BLOCK_DELAY_MS);
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount, consultantCount: Object.keys(consultantMeetings).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[calendar-physical-summary] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
