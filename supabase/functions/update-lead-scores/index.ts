import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Basic security check: Allow if CRON_SECRET matches OR if it's a valid Supabase auth token
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const isCron = authHeader === `Bearer ${cronSecret}`
  
  if (!isCron) {
    // If not cron, check if it's a valid user session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
  }

  try {
    // Fetch AI configuration
    const { data: aiConfig } = await supabaseClient
      .from('pipeline_ai_config')
      .select('*')
      .eq('enabled', true)
      .single()

    // Fetch all active leads from pipeline
    const { data: leads, error: fetchError } = await supabaseClient
      .from('client_pipeline')
      .select('*')
    
    if (fetchError) throw fetchError

    console.log(`Processing ${leads?.length || 0} leads for score update`)

    const updates = []
    
    for (const lead of (leads || [])) {
      let score, reason, suggestion;

      // If AI config is enabled and we have a template, we call the LLM
      if (aiConfig && aiConfig.enabled && aiConfig.prompt_template) {
        try {
          // Prepare the prompt
          let prompt = aiConfig.prompt_template
            .replace('{{lead_name}}', lead.lead_name || 'N/A')
            .replace('{{lead_phone}}', lead.lead_phone || 'N/A')
            .replace('{{lead_email}}', lead.lead_email || 'N/A')
            .replace('{{notes}}', lead.notes || 'Sem notas extras.');

          const provider = aiConfig.provider || 'lovable'
          let apiKey = aiConfig.api_key
          let apiUrl = ""
          let model = aiConfig.model || 'gpt-4o'

          if (provider === 'lovable') {
            apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions"
            apiKey = Deno.env.get("LOVABLE_API_KEY")
          } else if (provider === 'openai') {
            apiUrl = "https://api.openai.com/v1/chat/completions"
          } else if (provider === 'anthropic') {
            apiUrl = "https://api.anthropic.com/v1/messages"
          } else if (provider === 'gemini') {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
          }

          if (apiKey && apiUrl) {
            console.log(`Requesting AI analysis for lead ${lead.id} using ${provider}`)
            
            const isGemini = provider === 'gemini'
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                ...(isGemini ? {} : { 'Authorization': `Bearer ${apiKey}` }),
                'Content-Type': 'application/json',
                ...(provider === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {})
              },
              body: JSON.stringify(
                isGemini ? {
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.7 }
                } : {
                  model: model,
                  messages: [{ role: 'user', content: prompt }],
                  ...(provider === 'anthropic' ? { 
                    system: "Responda APENAS em formato JSON: { \"score\": number, \"reason\": \"string\", \"suggestion\": \"string\" }",
                    messages: [{ role: 'user', content: prompt }]
                  } : {})
                }
              )
            })

            const aiData = await response.json()
            const content = provider === 'anthropic' 
              ? aiData.content[0].text 
              : aiData.choices[0].message.content

            // Parse result
            try {
              const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim()
              const result = JSON.parse(cleanContent)
              score = result.score
              reason = result.reason
              suggestion = result.suggestion
            } catch (e) {
              console.error("Failed to parse AI response:", content)
              throw new Error("Invalid AI response format")
            }
          } else {
            throw new Error(`Configuração incompleta para o provedor ${provider}`)
          }
        } catch (aiError) {
          console.error(`AI analysis failed for lead ${lead.id}:`, aiError.message)
          // Fallback to simulation if AI fails
          const hasChatwootData = lead.notes?.includes('Última conversa Chatwoot:')
          score = Math.floor(Math.random() * 20) + 75
          reason = `Processado via fallback. Erro na IA: ${aiError.message}`
          suggestion = "Verificar histórico para ação específica."
        }
      } else {
        // Logic replicated from KanbanClientes.tsx
        const hasChatwootData = lead.notes?.includes('Última conversa Chatwoot:')
        
        score = Math.floor(Math.random() * 40) + 50 // Base 50-90
        reason = "Interação padrão do lead (Atualização Automática)."
        suggestion = "Enviar mensagem de acompanhamento."

        if (hasChatwootData) {
          score += 10
          reason = "Lead ativo no Chatwoot com interações recentes analisadas."
          suggestion = "Analisar histórico do Chatwoot e responder dúvidas específicas."
        } else if (lead.lead_phone || lead.lead_email) {
          score += 5
          reason = "Lead com informações de contato completas."
        }
        score = Math.min(score, 100)
      }

      updates.push(
        supabaseClient
          .from('client_pipeline')
          .update({
            lead_score: score,
            lead_score_reason: reason,
            next_action_suggestion: suggestion,
            last_ai_update: new Date().toISOString()
          })
          .eq('id', lead.id)
      )
    }

    // Run updates in parallel
    const results = await Promise.all(updates)
    
    const errors = results.filter(r => r.error).map(r => r.error)
    if (errors.length > 0) {
      console.error(`Encountered ${errors.length} errors during updates:`, errors)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Lead scores updated successfully', 
        processed: leads?.length || 0,
        errors: errors.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
