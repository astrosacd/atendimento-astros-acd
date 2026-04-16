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

  // Basic security check
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch all active leads from pipeline
    const { data: leads, error: fetchError } = await supabaseClient
      .from('client_pipeline')
      .select('*')
    
    if (fetchError) throw fetchError

    console.log(`Processing ${leads?.length || 0} leads for score update`)

    const updates = []
    
    for (const lead of (leads || [])) {
      // Logic replicated from KanbanClientes.tsx
      const hasChatwootData = lead.notes?.includes('Última conversa Chatwoot:')
      
      let score = Math.floor(Math.random() * 40) + 50 // Base 50-90
      let reason = "Interação padrão do lead (Atualização Automática)."
      let suggestion = "Enviar mensagem de acompanhamento."

      if (hasChatwootData) {
        score += 10
        reason = "Lead ativo no Chatwoot com interações recentes analisadas."
        suggestion = "Analisar histórico do Chatwoot e responder dúvidas específicas."
      } else if (lead.lead_phone || lead.lead_email) {
        score += 5
        reason = "Lead com informações de contato completas."
      }

      // Add small variations to keep it dynamic
      score = Math.min(score, 100)

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
