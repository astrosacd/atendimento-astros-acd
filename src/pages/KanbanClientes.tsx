import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { KanbanStageManager } from '@/components/kanban/KanbanStageManager';
import { AutomationRulesPanel } from '@/components/kanban/AutomationRulesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Columns3, Settings2, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  is_default: boolean;
}

export interface PipelineClient {
  id: string;
  cliente_id: string;
  stage_id: string | null;
  moved_at: string;
  notes: string | null;
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
  };
}

export default function KanbanClientes() {
  const { isAdmin } = useAuth();
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
        supabase.from('clientes').select('id, nome, produto, valor, moeda, data_renovacao, email, numero, tags, ciclo_cobranca'),
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

  const removeFromPipeline = async (clienteId: string) => {
    await supabase.from('client_pipeline').delete().eq('cliente_id', clienteId);
    await loadData();
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
            {isAdmin && (
              <>
                <TabsTrigger value="stages" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Settings2 className="h-4 w-4" /> Etapas
                </TabsTrigger>
                <TabsTrigger value="automations" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Zap className="h-4 w-4" /> Automações
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="kanban">
            <KanbanBoard
              stages={stages}
              clients={clients}
              allClients={allClients}
              loading={loading}
              onMoveClient={moveClient}
              onRemoveClient={removeFromPipeline}
              onRefresh={loadData}
            />
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="stages">
                <KanbanStageManager stages={stages} onRefresh={loadData} />
              </TabsContent>
              <TabsContent value="automations">
                <AutomationRulesPanel />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
