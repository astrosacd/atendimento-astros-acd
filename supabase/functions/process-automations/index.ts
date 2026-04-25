import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const priorityMap: Record<string, string> = {
  low: 'baixa',
  medium: 'media',
  high: 'alta',
  urgent: 'urgente',
  baixa: 'baixa',
  media: 'media',
  alta: 'alta',
  urgente: 'urgente',
};

function applyTemplate(template: string, cliente: {
  nome: string;
  produto: string;
  valor: number;
  data_renovacao: string;
}) {
  return template
    .replaceAll('{nome}', cliente.nome)
    .replaceAll('{produto}', cliente.produto)
    .replaceAll('{valor}', String(cliente.valor))
    .replaceAll('{data_renovacao}', cliente.data_renovacao);
}

function buildTaskContent(rule: any, cliente: {
  nome: string;
  produto: string;
  valor: number;
  data_renovacao: string;
}) {
  const config = rule.action_config || {};
  const title = applyTemplate(config.title || 'Tarefa automática', cliente);
  const description = applyTemplate(config.description || '', cliente);
  const rawPriority = config.priority || 'urgente';
  const priority = priorityMap[rawPriority] || 'urgente';
  const dueDateDays = config.due_date_days ?? 5;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDateDays);

  return {
    title,
    description,
    priority,
    dueDateStr: dueDate.toISOString().split('T')[0],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) throw rulesError;

    let totalActions = 0;
    let totalSkipped = 0;

    for (const rule of rules || []) {
      if (rule.trigger_type !== 'renewal_delay') continue;

      const days = rule.trigger_config?.days || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      // Apenas clientes com cobrança recorrente ativa (mensal).
      // Clientes do tipo "apenas registro" (cobranca_ativa = false) não possuem
      // recorrência mensal e devem ser ignorados pela regra de atraso de renovação.
      const { data: overdueClients, error: overdueClientsError } = await supabase
        .from('clientes')
        .select('id, nome, produto, valor, data_renovacao')
        .eq('cobranca_ativa', true)
        .lte('data_renovacao', cutoffStr);

      if (overdueClientsError) throw overdueClientsError;

      const overdueCount = overdueClients?.length || 0;
      console.log(
        `[Rule: ${rule.name}] Found ${overdueCount} overdue clients with active recurring billing (cutoff: ${cutoffStr}, delay: ${days} days)`,
      );

      if (overdueCount === 0) {
        await supabase.from('automation_logs').insert({
          rule_id: rule.id,
          cliente_id: null,
          action_taken: `Nenhum cliente inadimplente encontrado (atraso > ${days} dias, corte: ${cutoffStr})`,
          result: 'info',
        });
      }

      const dedupDays = rule.trigger_config?.dedup_days ?? 7;

      for (const cliente of overdueClients || []) {
        const { title, description, priority, dueDateStr } = buildTaskContent(rule, cliente);

        const dedupCutoff = new Date();
        dedupCutoff.setDate(dedupCutoff.getDate() - dedupDays);

        const { data: recentLogs } = await supabase
          .from('automation_logs')
          .select('id, created_at')
          .eq('rule_id', rule.id)
          .eq('cliente_id', cliente.id)
          .eq('result', 'success')
          .gte('created_at', dedupCutoff.toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        const { data: existingTask } = await supabase
          .from('client_tasks')
          .select('id, status, created_at')
          .eq('cliente_id', cliente.id)
          .eq('title', title)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Skip if there's a recent successful execution within the dedup window
        if (recentLogs && recentLogs.length > 0) {
          const lastRun = recentLogs[0].created_at;
          console.log(
            `[Rule: ${rule.name}] Skipping ${cliente.nome}: already executed on ${lastRun} (dedup window: ${dedupDays} days)`,
          );
          await supabase.from('automation_logs').insert({
            rule_id: rule.id,
            cliente_id: cliente.id,
            action_taken: `Pulado: última execução em ${new Date(lastRun).toLocaleDateString('pt-BR')} (janela de desduplicação: ${dedupDays} dias)`,
            result: 'skipped',
          });
          totalSkipped++;
          continue;
        }

        // Also skip if there's already an active (non-completed, non-cancelled) task with the same title
        if (existingTask && existingTask.status !== 'concluida' && existingTask.status !== 'cancelada') {
          console.log(
            `[Rule: ${rule.name}] Skipping ${cliente.nome}: active task already exists (status: ${existingTask.status})`,
          );
          await supabase.from('automation_logs').insert({
            rule_id: rule.id,
            cliente_id: cliente.id,
            action_taken: `Pulado: tarefa ativa já existe (status: ${existingTask.status})`,
            result: 'skipped',
          });
          totalSkipped++;
          continue;
        }

        if (rule.action_type === 'create_task') {
          const wasDeletedAfterPreviousRun = recentLogs && recentLogs.length > 0 && !existingTask;

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
              action_taken: wasDeletedAfterPreviousRun
                ? `Tarefa recriada para ${cliente.nome}: ${title} (tarefa anterior foi excluída, prazo: ${dueDateStr})`
                : `Tarefa criada para ${cliente.nome}: ${title} (prazo: ${dueDateStr})`,
              result: 'success',
            });
            totalActions++;
          } else {
            console.error(`Task creation error for ${cliente.nome}:`, taskError);
            await supabase.from('automation_logs').insert({
              rule_id: rule.id,
              cliente_id: cliente.id,
              action_taken: `Falha ao criar tarefa para ${cliente.nome}: ${taskError.message}`,
              result: `error: ${taskError.message}`,
            });
          }
        } else {
          console.log(`[Rule: ${rule.name}] Unknown action_type: ${rule.action_type} for client ${cliente.nome}`);
          await supabase.from('automation_logs').insert({
            rule_id: rule.id,
            cliente_id: cliente.id,
            action_taken: `Tipo de ação desconhecido: ${rule.action_type}`,
            result: 'skipped',
          });
          totalSkipped++;
        }
      }

      await supabase
        .from('automation_rules')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', rule.id);
    }

    console.log(`Automation finished: ${totalActions} actions, ${totalSkipped} skipped`);

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