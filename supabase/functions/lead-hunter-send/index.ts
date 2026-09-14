import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { leadIds } = await req.json();
    if (!leadIds?.length) {
      return new Response(JSON.stringify({ error: "leadIds é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get leads
    const { data: leads, error: leadsError } = await supabase
      .from("lead_hunter_leads")
      .select("*")
      .in("id", leadIds)
      .eq("status", "novo");
    
    if (leadsError) throw leadsError;
    if (!leads?.length) {
      return new Response(JSON.stringify({ message: "Nenhum lead novo para enviar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp instances
    const { data: instances } = await supabase
      .from("lead_hunter_whatsapp_instances")
      .select("*")
      .eq("is_active", true);

    if (!instances?.length) {
      return new Response(JSON.stringify({ error: "Nenhuma instância WhatsApp ativa" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get configs
    const { data: configRows } = await supabase.from("lead_hunter_config").select("*");
    const config: Record<string, string> = {};
    (configRows || []).forEach((r: any) => { config[r.config_key] = r.config_value; });

    // Get campaign info if leads have one
    const campanhaIds = [...new Set(leads.map(l => l.campanha_id).filter(Boolean))];
    let campanhas: Record<string, any> = {};
    if (campanhaIds.length) {
      const { data: campData } = await supabase.from("lead_hunter_campanhas").select("*").in("id", campanhaIds);
      (campData || []).forEach((c: any) => { campanhas[c.id] = c; });
    }

    // Get Baserow config
    const { data: baserowConfig } = await supabase
      .from("lead_hunter_baserow_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    let sent = 0;
    let errors = 0;
    let instanceIndex = 0;

    for (const lead of leads) {
      const instance = instances[instanceIndex % instances.length];
      instanceIndex++;

      try {
        // Generate message
        let message = "";
        const campanha = lead.campanha_id ? campanhas[lead.campanha_id] : null;

        if (campanha?.tipo_mensagem === "modelo_unico" && campanha?.mensagem_modelo) {
          message = campanha.mensagem_modelo
            .replace(/{nome}/g, lead.nome || "")
            .replace(/{empresa}/g, lead.empresa || "")
            .replace(/{categoria}/g, lead.categoria || "");
        } else {
          // Use AI to generate message
          const prompt = campanha?.prompt_ia || "Gere uma mensagem curta e persuasiva para WhatsApp (máximo 500 caracteres) apresentando nossos serviços. Seja direto e profissional.";
          
          // Try to scrape lead's website for personalized context
          let websiteContext = "";
          const skipDomains = config.scrape_skip_domains 
            ? (() => { try { return JSON.parse(config.scrape_skip_domains); } catch { return DEFAULT_SKIP_DOMAINS; } })()
            : DEFAULT_SKIP_DOMAINS;
          if (lead.website) {
            websiteContext = await scrapeWebsite(lead.website, skipDomains);
          }
          
          let leadContext = `Lead: ${lead.nome || 'Sem nome'}, Empresa: ${lead.empresa || 'N/A'}, Categoria: ${lead.categoria || 'N/A'}, Cidade: ${lead.cidade || 'N/A'}`;
          if (websiteContext) {
            leadContext += `\n\nInformações do site do lead:\n${websiteContext}`;
          }

          const provedor = campanha?.provedor_ia || "lovable";
          message = await generateAIMessage(provedor, prompt, leadContext, config, lovableApiKey, campanha?.modelo_ia);
        }

        if (!message) {
          throw new Error("Mensagem vazia gerada pela IA");
        }

        // Format phone
        const phone = lead.telefone.replace(/\D/g, "");
        const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
        
        let sendResult: any;

        // Send via Evolution API
        const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
        const sendResponse = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        sendResult = await sendResponse.json();

        if (!sendResponse.ok || sendResult?.error) {
          const errorMsg = sendResult?.error?.message || sendResult?.message || JSON.stringify(sendResult);
          throw new Error(errorMsg);
        }

        // Update lead status
        await supabase.from("lead_hunter_leads").update({
          status: "enviado",
          enviado_at: new Date().toISOString(),
          enviado_por_instancia: instance.instance_name,
        }).eq("id", lead.id);

        // Log success
        await supabase.from("lead_hunter_logs").insert({
          lead_id: lead.id,
          campanha_id: lead.campanha_id,
          tipo: "envio",
          resultado: "success",
          mensagem: `Enviado para ${phone} via ${instance.instance_name}`,
          detalhes: { phone, instance: instance.instance_name, message_preview: message.substring(0, 100) },
        });

        // Baserow integration
        if (baserowConfig?.is_enabled && baserowConfig?.api_token && baserowConfig?.table_id) {
          await syncToBaserow(baserowConfig, phone, lead);
          await supabase.from("lead_hunter_logs").insert({
            lead_id: lead.id,
            tipo: "baserow",
            resultado: "success",
            mensagem: `Sincronizado com Baserow: ${phone}`,
          });
        }

        sent++;

        // Update instance last_used
        await supabase.from("lead_hunter_whatsapp_instances").update({ last_used_at: new Date().toISOString() }).eq("id", instance.id);

        // Delay between messages
        const delay = campanha?.delay_entre_mensagens || 10;
        if (leads.indexOf(lead) < leads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }

      } catch (error: any) {
        errors++;
        console.error(`Error sending to ${lead.telefone}:`, error);

        await supabase.from("lead_hunter_leads").update({
          status: "erro",
          erro_mensagem: error.message || "Erro desconhecido",
        }).eq("id", lead.id);

        await supabase.from("lead_hunter_logs").insert({
          lead_id: lead.id,
          campanha_id: lead.campanha_id,
          tipo: "erro",
          resultado: "error",
          mensagem: `Erro ao enviar para ${lead.telefone}: ${error.message}`,
          detalhes: { phone: lead.telefone, error: error.message },
        });
      }
    }

    // Update campaign stats
    for (const cId of campanhaIds) {
      const { data: stats } = await supabase.from("lead_hunter_leads").select("status").eq("campanha_id", cId);
      if (stats) {
        await supabase.from("lead_hunter_campanhas").update({
          total_leads: stats.length,
          total_enviados: stats.filter((s: any) => s.status === "enviado").length,
          total_erros: stats.filter((s: any) => s.status === "erro").length,
        }).eq("id", cId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      errors,
      message: `${sent} enviados, ${errors} erros`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateAIMessage(
  provedor: string,
  prompt: string,
  leadContext: string,
  config: Record<string, string>,
  lovableApiKey: string | undefined,
  modelOverride?: string
): Promise<string> {
  const systemPrompt = prompt;
  const userMessage = leadContext;

  if (provedor === "lovable" || provedor === "lovable_ai") {
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const model = modelOverride || "google/gemini-3-flash-preview";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (provedor === "openai") {
    const apiKey = config.openai_api_key;
    if (!apiKey) throw new Error("OpenAI API Key não configurada");
    const model = modelOverride || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (provedor === "groq") {
    const apiKey = config.groq_api_key;
    if (!apiKey) throw new Error("Groq API Key não configurada");
    const model = modelOverride || "llama-3.1-70b-versatile";
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Groq error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(`Provedor de IA não suportado: ${provedor}`);
}

async function syncToBaserow(baserowConfig: any, phone: string, lead: any) {
  const apiUrl = baserowConfig.api_url || "https://api.baserow.io";
  const token = baserowConfig.api_token;
  const tableId = baserowConfig.table_id;

  if (!token || !tableId) return;

  // Normalize phone
  let normalizedPhone = phone.replace(/\D/g, "");
  if (!normalizedPhone.startsWith("55") && normalizedPhone.length <= 11) {
    normalizedPhone = "55" + normalizedPhone;
  }

  const whatsappId = `${normalizedPhone}@s.whatsapp.net`;
  const internationalPhone = `+${normalizedPhone}`;

  // Build auth header - add Token prefix if not present
  const authToken = token.startsWith("Token ") ? token : `Token ${token}`;
  const headers: Record<string, string> = {
    Authorization: authToken,
    "Content-Type": "application/json",
  };

  // Get field names from Baserow
  let fields: any[] = [];
  try {
    const fieldsRes = await fetch(`${apiUrl}/api/database/fields/table/${tableId}/`, { headers });
    if (!fieldsRes.ok) {
      console.error(`[Baserow] Fields API error: ${fieldsRes.status} ${await fieldsRes.text()}`);
      return;
    }
    fields = await fieldsRes.json();
    if (!Array.isArray(fields)) {
      console.error("[Baserow] Fields response is not an array:", fields);
      return;
    }
    console.log(`[Baserow] Found ${fields.length} fields:`, fields.map((f: any) => f.name).join(", "));
  } catch (err: any) {
    console.error("[Baserow] Error fetching fields:", err.message);
    return;
  }

  // Build field name map with fuzzy matching
  const fieldMap: Record<string, string> = {};
  for (const field of fields) {
    const name = (field.name || "").toLowerCase().replace(/[\s_-]+/g, "");
    // Phone field
    if (["telefone", "phone", "numero"].includes(name)) fieldMap.phone = field.name;
    // Boolean field
    if (["atendehumano", "atende_humano"].includes(name)) fieldMap.bool = field.name;
    // Additional fields
    if (["nome", "name"].includes(name)) fieldMap.nome = field.name;
    if (["empresa", "company"].includes(name)) fieldMap.empresa = field.name;
    if (["email", "e-mail"].includes(name)) fieldMap.email = field.name;
    if (["website", "site", "url"].includes(name)) fieldMap.website = field.name;
    if (["cidade", "city"].includes(name)) fieldMap.cidade = field.name;
    if (["estado", "state", "uf"].includes(name)) fieldMap.estado = field.name;
    if (["categoria", "category"].includes(name)) fieldMap.categoria = field.name;
  }

  const phoneFieldName = fieldMap.phone || "Telefone";
  const boolFieldName = fieldMap.bool || "AtendeHumano";

  console.log(`[Baserow] Using fields - phone: "${phoneFieldName}", bool: "${boolFieldName}"`);

  // Search for existing rows
  let page = 1;
  const existingRows: any[] = [];
  
  while (true) {
    const res = await fetch(
      `${apiUrl}/api/database/rows/table/${tableId}/?page=${page}&size=200&search=${normalizedPhone}`,
      { headers }
    );
    if (!res.ok) {
      console.error(`[Baserow] Search error: ${res.status}`);
      break;
    }
    const data = await res.json();
    if (data.results) existingRows.push(...data.results);
    if (!data.next) break;
    page++;
    if (page > 250) break;
  }

  console.log(`[Baserow] Found ${existingRows.length} existing rows for ${normalizedPhone}`);

  const hasWhatsApp = existingRows.some((r: any) => {
    const val = r[phoneFieldName];
    return val && val.includes("@s.whatsapp.net");
  });

  const hasInternational = existingRows.some((r: any) => {
    const val = r[phoneFieldName];
    return val && val.startsWith("+");
  });

  // Build extra fields from lead data
  const extraFields: Record<string, any> = {};
  if (fieldMap.nome && lead.nome) extraFields[fieldMap.nome] = lead.nome;
  if (fieldMap.empresa && lead.empresa) extraFields[fieldMap.empresa] = lead.empresa;
  if (fieldMap.email && lead.email) extraFields[fieldMap.email] = lead.email;
  if (fieldMap.website && lead.website) extraFields[fieldMap.website] = lead.website;
  if (fieldMap.cidade && lead.cidade) extraFields[fieldMap.cidade] = lead.cidade;
  if (fieldMap.estado && lead.estado) extraFields[fieldMap.estado] = lead.estado;
  if (fieldMap.categoria && lead.categoria) extraFields[fieldMap.categoria] = lead.categoria;

  // Create missing entries and mark as true
  const createRow = async (phoneValue: string) => {
    const body: any = {
      [phoneFieldName]: phoneValue,
      [boolFieldName]: true,
      ...extraFields,
    };
    
    console.log(`[Baserow] Creating row with body:`, JSON.stringify(body));
    
    const res = await fetch(`${apiUrl}/api/database/rows/table/${tableId}/`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Baserow] Create row error: ${res.status} ${errorText}`);
    } else {
      console.log(`[Baserow] Row created successfully for ${phoneValue}`);
    }
  };

  const patchRow = async (rowId: number) => {
    const body: any = { [boolFieldName]: true };
    
    const res = await fetch(`${apiUrl}/api/database/rows/table/${tableId}/${rowId}/`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Baserow] Patch row error: ${res.status} ${errorText}`);
    }
  };

  // Create or update WhatsApp format
  if (!hasWhatsApp) {
    await createRow(whatsappId);
  } else {
    const row = existingRows.find((r: any) => r[phoneFieldName]?.includes("@s.whatsapp.net"));
    if (row) await patchRow(row.id);
  }

  // Create or update international format
  if (!hasInternational) {
    await createRow(internationalPhone);
  } else {
    const row = existingRows.find((r: any) => r[phoneFieldName]?.startsWith("+"));
    if (row) await patchRow(row.id);
  }
}

// Default domains to skip scraping (fallback if not configured)
const DEFAULT_SKIP_DOMAINS = [
  "instagram.com", "facebook.com", "fb.com", "twitter.com", "x.com",
  "tiktok.com", "youtube.com", "youtu.be", "wa.me", "api.whatsapp.com",
  "web.whatsapp.com", "linktr.ee", "lnktr.ee", "bityli.com", "bit.ly",
  "goo.gl", "t.co", "linkedin.com", "pinterest.com", "threads.net", "t.me", "telegram.me",
];

function shouldSkipScraping(url: string, skipDomains: string[]): boolean {
  try {
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    const hostname = new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
    return skipDomains.some(d => {
      const cleanD = d.toLowerCase().replace(/^www\./, "");
      return hostname === cleanD || hostname.endsWith("." + cleanD);
    });
  } catch {
    return true;
  }
}

async function scrapeWebsite(url: string, skipDomains: string[]): Promise<string> {
  if (!url || shouldSkipScraping(url, skipDomains)) {
    return "";
  }

  try {
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }

    console.log(`[LeadHunter] Scraping website: ${normalized}`);
    
    const response = await fetch(`https://r.jina.ai/${normalized}`, {
      method: "GET",
      headers: {
        "Accept": "text/plain",
      },
    });

    if (!response.ok) {
      console.warn(`[LeadHunter] Scrape failed for ${normalized}: ${response.status}`);
      return "";
    }

    let content = await response.text();
    
    // Limit content to ~2000 chars to avoid huge AI prompts
    if (content.length > 2000) {
      content = content.substring(0, 2000) + "...";
    }

    console.log(`[LeadHunter] Scraped ${content.length} chars from ${normalized}`);
    return content;
  } catch (error: any) {
    console.warn(`[LeadHunter] Scrape error for ${url}:`, error.message);
    return "";
  }
}
