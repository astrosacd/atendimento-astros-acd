import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get active rules
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) throw rulesError;

    let totalActions = 0;

    for (const rule of rules || []) {
      if (rule.trigger_type === 'renewal_delay') {
        const days = rule.trigger_config?.days || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Find clients with renewal date older than cutoff
        const { data: overdueClients } = await supabase
          .from('clientes')
          .select('id, nome, produto, valor, data_renovacao')
          .lte('data_renovacao', cutoffStr);

        // Dedup window: configurable via trigger_config.dedup_days, default 7
        const dedupDays = rule.trigger_config?.dedup_days ?? 7;

        for (const cliente of overdueClients || []) {
          // Check if we already created a task for this client from this rule recently
          const dedupCutoff = new Date();
          dedupCutoff.setDate(dedupCutoff.getDate() - dedupDays);
          
          const { data: recentLogs } = await supabase
            .from('automation_logs')
            .select('id')
            .eq('rule_id', rule.id)
            .eq('cliente_id', cliente.id)
            .gte('created_at', dedupCutoff.toISOString())
            .like('result', 'success')
            .limit(1);

          if (recentLogs && recentLogs.length > 0) continue;

          if (rule.action_type === 'create_task') {
            const config = rule.action_config || {};
            const title = (config.title || 'Tarefa automática')
              .replace('{nome}', cliente.nome)
              .replace('{produto}', cliente.produto)
              .replace('{valor}', String(cliente.valor))
              .replace('{data_renovacao}', cliente.data_renovacao);
            
            const description = (config.description || '')
              .replace('{nome}', cliente.nome)
              .replace('{produto}', cliente.produto)
              .replace('{valor}', String(cliente.valor))
              .replace('{data_renovacao}', cliente.data_renovacao);

            // Map English priority values to Portuguese (DB constraint)
            const priorityMap: Record<string, string> = {
              low: 'baixa', medium: 'media', high: 'alta', urgent: 'urgente',
              baixa: 'baixa', media: 'media', alta: 'alta', urgente: 'urgente',
            };
            const rawPriority = config.priority || 'urgente';
            const priority = priorityMap[rawPriority] || 'urgente';

            // Calculate due_date: today + due_date_days (configurable, default 5)
            const dueDateDays = config.due_date_days ?? 5;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + dueDateDays);
            const dueDateStr = dueDate.toISOString().split('T')[0];

            const { error: taskError } = await supabase
              .from('client_tasks')
              .insert({
                cliente_id: cliente.id,
                title,
                description,
                priority,
                status: 'pendente',
                due_date: dueDateStr,
              });

            if (!taskError) {
              await supabase.from('automation_logs').insert({
                rule_id: rule.id,
                cliente_id: cliente.id,
                action_taken: `Tarefa criada para ${cliente.nome}: ${title} (prazo: ${dueDateStr})`,
                result: 'success',
              });
              totalActions++;
            } else {
              console.error(`Task creation error for ${cliente.nome}:`, taskError);
              await supabase.from('automation_logs').insert({
                rule_id: rule.id,
                cliente_id: cliente.id,
                action_taken: `Falha ao criar tarefa para ${cliente.nome}`,
                result: `error: ${taskError.message}`,
              });
            }
          }
        }

        // Update last_run_at
        await supabase
          .from('automation_rules')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', rule.id);
      }
    }

    return new Response(JSON.stringify({ success: true, actions: totalActions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Automation error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
