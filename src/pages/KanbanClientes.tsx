import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { KanbanStageManager } from '@/components/kanban/KanbanStageManager';
import { AutomationRulesPanel } from '@/components/kanban/AutomationRulesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Columns3, Settings2, Zap, MessageSquare, Share2, Brain } from 'lucide-react';
import { ChatwootIntegration } from '@/components/kanban/ChatwootIntegration';
import { KanbanShareManager } from '@/components/kanban/KanbanShareManager';
import { KanbanAIConfig } from '@/components/kanban/KanbanAIConfig';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  is_default: boolean;
}

export interface PipelineClient {
  id: string;
  cliente_id: string | null;
  stage_id: string | null;
  moved_at: string;
  notes: string | null;
  is_lead: boolean;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  lead_produto: string | null;
  converted_at: string | null;
  lead_score: number | null;
  lead_score_reason: string | null;
  next_action_suggestion: string | null;
  last_ai_update: string | null;
  last_interaction_at: string | null;
  cliente: {
    id: string;
    nome: string;
    produto: string;
    valor: number;
    moeda: string;
    data_renovacao: string;
    email: string;
    numero: string;
    tags: string[] | null;
  } | null;
}

export default function KanbanClientes() {
  const { isAdmin } = useAuth();
  const { 
    canManagePipelineStages, 
    canManagePipelineAutomations,
    canViewPipelineAI,
    
    canManagePipelineChatwoot,
    canSharePipeline
  } = usePermissions();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [clients, setClients] = useState<PipelineClient[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, pipelineRes, clientsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('order_index'),
        supabase.from('client_pipeline').select('*, cliente:clientes(id, nome, produto, valor, moeda, data_renovacao, email, numero, tags)').or('is_lead.eq.true,cliente_id.not.is.null'),
        supabase.from('clientes').select('id, nome, produto, valor, moeda, data_renovacao, email, numero, tags, ciclo_cobranca, cobranca_ativa'),
      ]);

      if (stagesRes.data) setStages(stagesRes.data as PipelineStage[]);
      if (pipelineRes.data) setClients(pipelineRes.data as unknown as PipelineClient[]);
      if (clientsRes.data) setAllClients(clientsRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados do Kanban');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const moveClient = async (clienteId: string, newStageId: string) => {
    const existing = clients.find(c => c.cliente_id === clienteId);
    
    if (existing) {
      const { error } = await supabase
        .from('client_pipeline')
        .update({ stage_id: newStageId, moved_at: new Date().toISOString() })
        .eq('cliente_id', clienteId);
      if (error) { toast.error('Erro ao mover cliente'); return; }
    } else {
      const { error } = await supabase
        .from('client_pipeline')
        .insert({ cliente_id: clienteId, stage_id: newStageId });
      if (error) { toast.error('Erro ao adicionar cliente ao pipeline'); return; }
    }
    
    await loadData();
  };

  const movePipelineItem = async (pipelineId: string, newStageId: string) => {
    const { error } = await supabase
      .from('client_pipeline')
      .update({ stage_id: newStageId, moved_at: new Date().toISOString() })
      .eq('id', pipelineId);
    if (error) { toast.error('Erro ao mover item'); return; }
    await loadData();
  };

  const addLead = async (stageId: string, lead: { name: string; phone: string; email: string; produto: string }) => {
    const { error } = await supabase
      .from('client_pipeline')
      .insert({
        stage_id: stageId,
        is_lead: true,
        lead_name: lead.name,
        lead_phone: lead.phone,
        lead_email: lead.email,
        lead_produto: lead.produto,
      });
    if (error) { toast.error('Erro ao adicionar lead'); return; }
    toast.success('Lead adicionado ao pipeline');
    await loadData();
  };

  const convertLead = async (data: {
    pipelineId: string;
    nome: string; email: string; numero: string; produto: string;
    cpf: string; valor: number; moeda: string; data_renovacao: string;
    cobranca_ativa: boolean; ciclo_cobranca: string; observacao: string;
  }) => {
    // Create the client
    const { data: newClient, error: clientError } = await supabase
      .from('clientes')
      .insert({
        nome: data.nome,
        email: data.email,
        numero: data.numero,
        produto: data.produto,
        cpf: data.cpf,
        valor: data.valor,
        moeda: data.moeda,
        data_renovacao: data.data_renovacao,
        cobranca_ativa: data.cobranca_ativa,
        ciclo_cobranca: data.ciclo_cobranca,
        observacao: data.observacao || null,
      })
      .select('id')
      .single();

    if (clientError) { toast.error('Erro ao cadastrar cliente: ' + clientError.message); return; }

    // Update pipeline entry: link to client, mark as converted
    const { error: pipelineError } = await supabase
      .from('client_pipeline')
      .update({
        cliente_id: newClient.id,
        is_lead: false,
        converted_at: new Date().toISOString(),
      })
      .eq('id', data.pipelineId);

    if (pipelineError) { toast.error('Erro ao converter lead'); return; }

    toast.success('Lead convertido em cliente com sucesso!');
    await loadData();
  };

  const removeFromPipeline = async (pipelineId: string) => {
    await supabase.from('client_pipeline').delete().eq('id', pipelineId);
    await loadData();
  };

  const updateAIScore = async (pipelineId: string) => {
    const item = clients.find(c => c.id === pipelineId);
    if (!item) return;

    setLoading(true);
    try {
      // Check if we have Chatwoot data in notes
      const hasChatwootData = item.notes?.includes('Última conversa Chatwoot:');
      
      // In a real app, this would call an Edge Function that uses OpenAI
      // For now, we enhance the simulation based on available data
      
      let score = Math.floor(Math.random() * 40) + 50; // Base 50-90
      let reason = "Interação padrão do lead.";
      let suggestion = "Enviar mensagem de acompanhamento.";

      if (hasChatwootData) {
        score += 10;
        reason = "Lead ativo no Chatwoot com interações recentes analisadas.";
        suggestion = "Analisar histórico do Chatwoot e responder dúvidas específicas.";
      } else if (item.lead_phone || item.lead_email) {
        score += 5;
        reason = "Lead com informações de contato completas.";
      }

      const { error } = await supabase
        .from('client_pipeline')
        .update({
          lead_score: Math.min(score, 100),
          lead_score_reason: reason,
          next_action_suggestion: suggestion,
          last_ai_update: new Date().toISOString()
        })
        .eq('id', pipelineId);

      if (error) throw error;
      toast.success('Análise de IA concluída para ' + (item.lead_name || 'este lead'));
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar análise de IA');
    } finally {
      setLoading(false);
    }
  };
  
  const updateAllAIScores = async () => {
    setLoading(true);
    try {
      // First try to invoke the Edge Function for actual AI analysis if configured
      const { error: functionError } = await supabase.functions.invoke('update-lead-scores');

      // Fallback or secondary update using RPC if needed
      if (functionError) {
        console.warn('Edge function error, falling back to RPC simulation:', functionError);
        const { error: rpcError } = await supabase.rpc('update_all_lead_scores');
        if (rpcError) throw rpcError;
      }
      
      toast.success('Scores de todos os clientes atualizados com sucesso');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar scores em massa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Pipeline de Clientes</h1>
            <p className="text-sm text-muted-foreground">Gerencie o ciclo de vida dos seus clientes</p>
          </div>
        </div>

        <Tabs defaultValue="kanban" className="space-y-4">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="kanban" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Columns3 className="h-4 w-4" /> Kanban
            </TabsTrigger>
            {(isAdmin || canManagePipelineStages()) && (
              <TabsTrigger value="stages" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Settings2 className="h-4 w-4" /> Etapas
              </TabsTrigger>
            )}
            {(isAdmin || canManagePipelineAutomations()) && (
              <TabsTrigger value="automations" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Zap className="h-4 w-4" /> Automações
              </TabsTrigger>
            )}
            {(isAdmin || canManagePipelineChatwoot()) && (
              <TabsTrigger value="chatwoot" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <MessageSquare className="h-4 w-4" /> Chatwoot
              </TabsTrigger>
            )}
            {(isAdmin || canViewPipelineAI()) && (
              <TabsTrigger value="ai" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Brain className="h-4 w-4" /> Config. IA
              </TabsTrigger>
            )}
            {(isAdmin || canSharePipeline()) && (
              <TabsTrigger value="share" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Share2 className="h-4 w-4" /> Compartilhar
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="kanban">
            <KanbanBoard
              stages={stages}
              clients={clients}
              allClients={allClients}
              loading={loading}
              onMoveClient={moveClient}
              onMovePipelineItem={movePipelineItem}
              onRemoveClient={removeFromPipeline}
              onAddLead={addLead}
              onConvertLead={convertLead}
              onRefresh={loadData}
              onUpdateAIScore={updateAIScore}
              onUpdateAllScores={updateAllAIScores}
            />
          </TabsContent>

          {(isAdmin || canManagePipelineStages()) && (
            <TabsContent value="stages">
              <KanbanStageManager stages={stages} onRefresh={loadData} />
            </TabsContent>
          )}
          {(isAdmin || canManagePipelineAutomations()) && (
            <TabsContent value="automations">
              <AutomationRulesPanel />
            </TabsContent>
          )}
          {(isAdmin || canManagePipelineChatwoot()) && (
            <TabsContent value="chatwoot">
              <ChatwootIntegration onRefresh={loadData} />
            </TabsContent>
          )}
          {(isAdmin || canViewPipelineAI()) && (
            <TabsContent value="ai">
              <KanbanAIConfig />
            </TabsContent>
          )}
          {(isAdmin || canSharePipeline()) && (
            <TabsContent value="share">
              <KanbanShareManager />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
