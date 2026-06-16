import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

function toAsciiHeader(input: string): string {
  try {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  } catch {
    return input.replace(/[^\x20-\x7E]/g, '');
  }
}

function generateRemarketingEmailHtml(
  clientName: string,
  proposalTitle: string,
  proposalLink: string,
  senderName: string,
  dayNumber: number,
  companyName?: string
): string {
  const companyHtml = companyName
    ? `<p style="color:#6b7280;font-size:14px;margin:5px 0 0 0;">${companyName}</p>`
    : '';

  const messages = [
    `Percebi que voce visualizou a proposta "${proposalTitle}" mas ainda nao deu seu retorno. Posso ajudar com alguma duvida?`,
    `Gostaria de saber se teve oportunidade de analisar a proposta "${proposalTitle}". Estou a disposicao para esclarecer qualquer ponto.`,
    `Estou entrando em contato novamente sobre a proposta "${proposalTitle}". Caso tenha alguma duvida ou precise de ajustes, estou pronto para ajudar.`,
  ];

  const introText = messages[Math.min(dayNumber - 1, messages.length - 1)];

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Lembrete: Sua Proposta</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">Lembrete: Sua Proposta</h1></td></tr><tr><td style="padding:40px;"><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Ola <strong>${clientName}</strong>,</p><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">${introText}</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:30px 0;"><tr><td style="background-color:#f8fafc;border-radius:8px;padding:24px;border-left:4px solid #f97316;"><p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">PROPOSTA</p><p style="color:#1e293b;font-size:20px;font-weight:600;margin:0;">${proposalTitle}</p></td></tr></table><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px 0;">Clique no botao abaixo para visualizar todos os detalhes:</p><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center"><a href="${proposalLink}" style="display:inline-block;background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(249,115,22,0.4);">Visualizar Proposta</a></td></tr></table><p style="color:#6b7280;font-size:14px;line-height:1.6;margin:40px 0 0 0;text-align:center;">Caso o botao nao funcione, copie e cole o link abaixo no seu navegador:</p><p style="color:#f97316;font-size:12px;word-break:break-all;text-align:center;margin:10px 0 0 0;">${proposalLink}</p></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">Atenciosamente,</p><p style="color:#374151;font-size:16px;font-weight:600;margin:0;">${senderName}</p>${companyHtml}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">Remarketing automatico</p></td></tr></table></td></tr></table></body></html>`;
}

function generateRemarketingWhatsAppMessage(
  clientName: string,
  proposalTitle: string,
  proposalLink: string,
  senderName: string,
  dayNumber: number
): string {
  const messages = [
    `Percebi que você visualizou a proposta "${proposalTitle}" mas ainda não deu seu retorno. Posso ajudar com alguma dúvida?`,
    `Gostaria de saber se teve oportunidade de analisar a proposta "${proposalTitle}". Estou à disposição para esclarecer qualquer ponto.`,
    `Estou entrando em contato novamente sobre a proposta "${proposalTitle}". Caso tenha alguma dúvida ou precise de ajustes, estou pronto para ajudar.`,
  ];

  const msg = messages[Math.min(dayNumber - 1, messages.length - 1)];

  return `👋 *Olá, ${clientName}!*

${msg}

👇 *Acesse a proposta novamente:*
${proposalLink}

_Atenciosamente,_
*${senderName}*`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔄 Auto-remarketing cron started");

    // 1. Check if auto-remarketing is enabled
    const { data: config, error: configError } = await supabase
      .from('proposal_send_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !config) {
      console.log("❌ No send config found, skipping");
      return new Response(JSON.stringify({ message: "No config found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.auto_remarketing_enabled) {
      console.log("⏸️ Auto-remarketing is disabled, skipping");
      return new Response(JSON.stringify({ message: "Auto-remarketing disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxDays = config.auto_remarketing_max_days || 3;
    const channel = config.auto_remarketing_channel || 'email';

    console.log(`📋 Config: max_days=${maxDays}, channel=${channel}`);

    // 2. Find proposals with status 'viewed' (not signed, not rejected)
    const { data: proposals, error: proposalsError } = await supabase
      .from('proposals')
      .select('*, clientes(*)')
      .in('status', ['viewed', 'sent']); // Also check 'sent' for Ghost Mode

    if (proposalsError) {
      console.error("❌ Error fetching proposals:", proposalsError);
      return new Response(JSON.stringify({ error: proposalsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!proposals || proposals.length === 0) {
      console.log("📭 No active proposals found");
      return new Response(JSON.stringify({ message: "No proposals to process", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📊 Found ${proposals.length} viewed proposals`);

    let processedCount = 0;
    let sentCount = 0;
    let errorCount = 0;

    const publishedUrl = "https://atendimento-astros-acd.lovable.app";

    for (const proposal of proposals) {
      try {
        const viewCount = proposal.view_count || 0;
        const ghostThreshold = config.ghost_view_threshold || 3;
        const ghostDay = config.ghost_mode_day || 3;
        
        console.log(`🧐 Processing proposal ${proposal.id}: status=${proposal.status}, views=${viewCount}`);

        // 3. Check logs for this proposal
        const { data: existingLogs, error: logsError } = await supabase
          .from('proposal_auto_remarketing_logs')
          .select('id, sent_at, day_number, media_type')
          .eq('proposal_id', proposal.id)
          .eq('status', 'sent')
          .order('day_number', { ascending: false });

        if (logsError) {
          console.error(`❌ Error fetching logs for ${proposal.id}:`, logsError);
          continue;
        }

        const lastLog = existingLogs?.[0];
        const dayNumber = lastLog ? lastLog.day_number + 1 : 1;

        // 4. Check if we exceeded max days
        if (dayNumber > maxDays) {
          console.log(`⏭️ Proposal ${proposal.id}: already sent ${maxDays} days, skipping`);
          continue;
        }

        // 5. Check if already sent today
        if (lastLog) {
          const lastSentDate = new Date(lastLog.sent_at).toISOString().split('T')[0];
          const todayDate = new Date().toISOString().split('T')[0];
          if (lastSentDate === todayDate) {
            console.log(`⏭️ Proposal ${proposal.id}: already sent today, skipping`);
            continue;
          }
        }

        // Determine if this should be a Ghost Mode message
        // Gatilho: Se o modo ghost estiver ativado E (já atingiu o limite de visualizações OU é o dia programado)
        const isGhostMode = config.ghost_mode_enabled && (viewCount >= ghostThreshold || dayNumber === ghostDay);
        
        if (!isGhostMode && proposal.status !== 'viewed') {
          // Regular remarketing only for 'viewed' status
          continue;
        }

        // 6. Determine recipient info
        const clientName = proposal.manual_client_name || proposal.clientes?.nome || 'Cliente';
        const clientEmail = proposal.manual_client_email || proposal.clientes?.email;
        const clientPhone = proposal.manual_client_phone || proposal.clientes?.numero;
        const proposalLink = `${publishedUrl}/proposta/${proposal.id}?token=${proposal.share_token}`;
        const senderName = config.gmail_sender_name || 'Equipe Comercial';

        let emailSent = false;
        let whatsappSent = false;
        let errorMessage: string | null = null;

        // 7. Send via configured channel
        // Send Email
        if ((channel === 'email' || channel === 'both') && config.email_enabled && clientEmail) {
          try {
            if (config.gmail_user && config.gmail_app_password) {
              const htmlBody = generateRemarketingEmailHtml(
                clientName,
                proposal.title,
                proposalLink,
                senderName,
                dayNumber
              );

              const subject = toAsciiHeader(`Lembrete - Proposta Comercial: ${proposal.title}`) || 'Lembrete - Proposta Comercial';

              const client = new SMTPClient({
                connection: {
                  hostname: "smtp.gmail.com",
                  port: 465,
                  tls: true,
                  auth: {
                    username: config.gmail_user,
                    password: config.gmail_app_password,
                  },
                },
              });

              const fromAddress = config.gmail_sender_name
                ? `${toAsciiHeader(config.gmail_sender_name)} <${config.gmail_user}>`
                : config.gmail_user;

              await client.send({
                from: fromAddress,
                to: clientEmail,
                subject,
                content: `Ola ${clientName}, sua proposta "${proposal.title}" aguarda retorno. Visualizar: ${proposalLink}`,
                html: htmlBody,
              });

              await client.close();
              emailSent = true;
              console.log(`✅ Auto-remarketing email sent for ${proposal.id} (day ${dayNumber})`);
            }
          } catch (e: any) {
            console.error(`❌ Email error for ${proposal.id}:`, e.message);
            errorMessage = `Email: ${e.message}`;
          }
        }

        // Send WhatsApp
        if ((channel === 'whatsapp' || channel === 'both') && config.whatsapp_enabled && clientPhone) {
          try {
            if (config.evolution_api_url && config.evolution_api_key && config.evolution_instance_name) {
              let cleanNumber = clientPhone.replace(/\D/g, '');
              if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
                cleanNumber = '55' + cleanNumber;
              }

              const urlBase = `${config.evolution_api_url}/message`;
              let endpoint = `/sendText/${config.evolution_instance_name}`;
              let body: any = { number: cleanNumber };

              // Resolve mídia do ghost: dinâmico (TTS na hora) > estático (URL salva)
              let ghostMediaUrl: string | null = null;
              let ghostMediaType: 'audio' | 'video' | null = null;

              if (isGhostMode) {
                if (config.ghost_mode_type === 'dynamic' && config.elevenlabs_api_key && config.tts_text) {
                  try {
                    const ttsText = String(config.tts_text).replace(/\{\{nome_cliente\}\}/g, clientName);
                    const voiceId = config.elevenlabs_voice_id || 'JBFqnCBsd6RMkjVDRZzb';
                    console.log(`🎙️ Generating dynamic TTS for ${proposal.id} (voice=${voiceId})`);
                    const ttsRes = await fetch(
                      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
                      {
                        method: 'POST',
                        headers: { 'xi-api-key': config.elevenlabs_api_key, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          text: ttsText,
                          model_id: 'eleven_multilingual_v2',
                          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
                        }),
                      }
                    );
                    if (!ttsRes.ok) {
                      const errTxt = await ttsRes.text();
                      throw new Error(`TTS ${ttsRes.status}: ${errTxt.slice(0, 200)}`);
                    }
                    const audioBuf = new Uint8Array(await ttsRes.arrayBuffer());
                    const path = `ghost/auto-${proposal.id}-${Date.now()}.mp3`;
                    const { error: upErr } = await supabase.storage
                      .from('proposal-images')
                      .upload(path, audioBuf, { upsert: true, contentType: 'audio/mpeg' });
                    if (upErr) throw new Error(`Upload áudio: ${upErr.message}`);
                    const { data: pub } = supabase.storage.from('proposal-images').getPublicUrl(path);
                    ghostMediaUrl = pub.publicUrl;
                    ghostMediaType = 'audio';
                    console.log(`✅ Dynamic audio generated: ${ghostMediaUrl}`);
                  } catch (ttsErr: any) {
                    console.error(`❌ TTS dinâmico falhou para ${proposal.id}: ${ttsErr.message}`);
                    // Fallback: tenta URL estática se houver
                    if (config.ghost_audio_url) {
                      ghostMediaUrl = config.ghost_audio_url;
                      ghostMediaType = 'audio';
                    } else if (config.ghost_video_url) {
                      ghostMediaUrl = config.ghost_video_url;
                      ghostMediaType = 'video';
                    }
                  }
                } else if (config.ghost_audio_url) {
                  ghostMediaUrl = config.ghost_audio_url;
                  ghostMediaType = 'audio';
                } else if (config.ghost_video_url) {
                  ghostMediaUrl = config.ghost_video_url;
                  ghostMediaType = 'video';
                }
              }

              if (isGhostMode && ghostMediaUrl && ghostMediaType) {
                endpoint = ghostMediaType === 'audio'
                  ? `/sendWhatsAppAudio/${config.evolution_instance_name}`
                  : `/sendMedia/${config.evolution_instance_name}`;

                body = ghostMediaType === 'audio'
                  ? { number: cleanNumber, audio: ghostMediaUrl, delay: 1200, encoding: true }
                  : { number: cleanNumber, mediatype: 'video', media: ghostMediaUrl, mimetype: 'video/mp4', caption: `Vi que você olhou a proposta. Ficou alguma dúvida?`, delay: 1200 };

                console.log(`👻 GHOST MODE: Sending ${ghostMediaType} to ${cleanNumber}`);
              } else {
                if (isGhostMode) {
                  console.warn(`⚠️ Ghost mode ativo mas sem mídia disponível (proposal ${proposal.id}) — enviando texto de remarketing`);
                }
                const message = generateRemarketingWhatsAppMessage(
                  clientName,
                  proposal.title,
                  proposalLink,
                  senderName,
                  dayNumber
                );
                body.text = message;
              }

              const response = await fetch(urlBase + endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': config.evolution_api_key,
                },
                body: JSON.stringify(body),
              });

              if (!response.ok) {
                const responseText = await response.text();
                throw new Error(`HTTP ${response.status}: ${responseText}`);
              }

              whatsappSent = true;
              console.log(`✅ WhatsApp sent for ${proposal.id} (day ${dayNumber}${isGhostMode ? ' - GHOST/' + (ghostMediaType || 'texto') : ''})`);
            }
          } catch (e: any) {
            console.error(`❌ WhatsApp error for ${proposal.id}:`, e.message);
            errorMessage = errorMessage ? `${errorMessage}; WhatsApp: ${e.message}` : `WhatsApp: ${e.message}`;
          }
        }

        // 8. Log the send
        if (emailSent || whatsappSent) {
          await supabase.from('proposal_auto_remarketing_logs').insert({
            proposal_id: proposal.id,
            channel,
            day_number: dayNumber,
            status: 'sent',
            email_sent: emailSent,
            whatsapp_sent: whatsappSent,
            media_url: isGhostMode ? (config.ghost_audio_url || config.ghost_video_url) : null,
            media_type: isGhostMode ? (config.ghost_audio_url ? 'audio' : 'video') : null,
          });

          // Also log to proposal_history
          await supabase.from('proposal_history').insert({
            proposal_id: proposal.id,
            action: 'remarketing',
            user_email: 'sistema',
            user_name: 'Remarketing Automático',
            changes: {
              auto: true,
              day_number: dayNumber,
              email_sent: emailSent,
              whatsapp_sent: whatsappSent,
            },
          });

          // Log to proposal_send_logs
          if (emailSent && clientEmail) {
            await supabase.from('proposal_send_logs').insert({
              proposal_id: proposal.id,
              channel: 'email',
              recipient: clientEmail,
              status: 'sent',
              sent_by_email: 'auto-remarketing',
            });
          }
          if (whatsappSent && clientPhone) {
            await supabase.from('proposal_send_logs').insert({
              proposal_id: proposal.id,
              channel: 'whatsapp',
              recipient: clientPhone.replace(/\D/g, ''),
              status: 'sent',
              sent_by_email: 'auto-remarketing',
            });
          }

          sentCount++;
        } else if (errorMessage) {
          await supabase.from('proposal_auto_remarketing_logs').insert({
            proposal_id: proposal.id,
            channel,
            day_number: dayNumber,
            status: 'error',
            error_message: errorMessage,
            email_sent: false,
            whatsapp_sent: false,
          });
          errorCount++;
        }

        processedCount++;
      } catch (e: any) {
        console.error(`❌ Error processing proposal ${proposal.id}:`, e.message);
        errorCount++;
      }
    }

    const summary = {
      message: "Auto-remarketing completed",
      total_proposals: proposals.length,
      processed: processedCount,
      sent: sentCount,
      errors: errorCount,
    };

    console.log("📊 Summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
