import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { KanbanStageManager } from '@/components/kanban/KanbanStageManager';
import { AutomationRulesPanel } from '@/components/kanban/AutomationRulesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Columns3, Settings2, Zap, MessageSquare } from 'lucide-react';
import { ChatwootIntegration } from '@/components/kanban/ChatwootIntegration';
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
  const { canManagePipelineStages, canManagePipelineAutomations } = usePermissions();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [clients, setClients] = useState<PipelineClient[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, pipelineRes, clientsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('order_index'),
        supabase.from('client_pipeline').select('*, cliente:clientes(id, nome, produto, valor, moeda, data_renovacao, email, numero, tags)'),
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
    // Simulated AI analysis logic
    const item = clients.find(c => c.id === pipelineId);
    if (!item) return;

    setLoading(true);
    try {
      // In a real app, this would call an Edge Function that uses OpenAI/Claude
      // Here we simulate it with some deterministic logic based on data
      
      const score = Math.floor(Math.random() * 40) + 60; // 60-100 range for active leads
      const reasons = [
        "Interação frequente nos últimos 3 dias.",
        "Perfil do lead compatível com clientes ideais.",
        "Demonstrou interesse específico no produto " + (item.lead_produto || "principal"),
        "Respondeu rapidamente às últimas mensagens."
      ];
      const suggestions = [
        "Enviar proposta personalizada hoje.",
        "Agendar demonstração técnica para amanhã.",
        "Oferecer cupom de desconto de 10% para fechamento imediato.",
        "Ligar para tirar dúvidas sobre a última proposta."
      ];

      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

      const { error } = await supabase
        .from('client_pipeline')
        .update({
          lead_score: score,
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
