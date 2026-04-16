import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { PipelineStage, PipelineClient } from '@/pages/KanbanClientes';
import { Loader2, AlertCircle, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SharedKanban() {
  const { token } = useParams<{ token: string }>();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [clients, setClients] = useState<PipelineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_pipeline_data_by_token', {
        link_token: token
      });

      if (rpcError) throw rpcError;
      if (!data) {
        setError('Link inválido ou expirado.');
        return;
      }

      setStages(data.stages || []);
      setClients(data.clients || []);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar o quadro. Por favor, tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds for "sincronização"
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando quadro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full border-destructive/20">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-bold">Acesso Negado</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button asChild variant="outline">
              <Link to="/">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Voltar ao Início
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Visualização do Pipeline</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Modo Leitura</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Sincronizado automaticamente
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        <KanbanBoard
          stages={stages}
          clients={clients}
          allClients={[]} // Not needed for read-only
          loading={loading}
          isReadOnly={true}
          onRefresh={loadData}
        />
      </main>
    </div>
  );
}
