import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Brain, AlertTriangle, Loader2, FileText, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ClientAIInsightsProps {
  clienteId: string;
  clienteName: string;
}

interface ChurnAcao {
  acao: string;
  prioridade: 'alta' | 'media' | 'baixa';
  prazo: 'imediato' | 'esta_semana' | 'este_mes';
}

interface ChurnAnalysis {
  risco: 'baixo' | 'medio' | 'alto' | 'critico';
  score: number;
  principais_sinais: string[];
  fatores_positivos: string[];
  acoes_recomendadas: ChurnAcao[];
  resumo_executivo: string;
}

const MODELOS = [
  { value: 'google/gemini-2.5-flash', label: 'Lovable AI - Gemini Flash (rápido)' },
  { value: 'google/gemini-2.5-pro', label: 'Lovable AI - Gemini Pro (preciso)' },
  { value: 'openai/gpt-5-mini', label: 'Lovable AI - GPT-5 Mini' },
  { value: 'openai/gpt-5', label: 'Lovable AI - GPT-5 (premium)' },
];

const RISCO_CONFIG = {
  baixo: { color: 'bg-success text-success-foreground', label: 'Baixo Risco', icon: '✅' },
  medio: { color: 'bg-warning text-warning-foreground', label: 'Risco Médio', icon: '⚠️' },
  alto: { color: 'bg-orange-500 text-white', label: 'Alto Risco', icon: '🔥' },
  critico: { color: 'bg-destructive text-destructive-foreground', label: 'Risco Crítico', icon: '🚨' },
};

export function ClientAIInsights({ clienteId, clienteName }: ClientAIInsightsProps) {
  const { user } = useAuth();
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [summary, setSummary] = useState<string>('');
  const [churn, setChurn] = useState<ChurnAnalysis | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingChurn, setLoadingChurn] = useState(false);

  const runAI = async (mode: 'summary' | 'churn') => {
    const setLoading = mode === 'summary' ? setLoadingSummary : setLoadingChurn;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-ai-insights', {
        body: { clienteId, mode, model },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (mode === 'summary') {
        setSummary(data.summary || '');
        toast.success('Briefing gerado com sucesso');
      } else {
        setChurn(data.analysis as ChurnAnalysis);
        toast.success('Análise de churn concluída');
      }

      // Log AI generation
      await supabase.from('client_ai_logs').insert({
        cliente_id: clienteId,
        user_id: user?.id,
        mode,
        model,
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao consultar IA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights de IA — {clienteName}
            </CardTitle>
            <CardDescription>
              Use IA para preparar reuniões e identificar risco de churn.
            </CardDescription>
          </div>
          <div className="w-full sm:w-72">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELOS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="summary" className="gap-2">
              <FileText className="h-4 w-4" /> Briefing
            </TabsTrigger>
            <TabsTrigger value="churn" className="gap-2">
              <TrendingDown className="h-4 w-4" /> Risco de Churn
            </TabsTrigger>
          </TabsList>

          {/* ---- Briefing ---- */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => runAI('summary')} disabled={loadingSummary}>
                {loadingSummary ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    {summary ? 'Gerar Novamente' : 'Gerar Briefing para Reunião'}
                  </>
                )}
              </Button>
            </div>

            {summary ? (
              <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 p-4 rounded-md border">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-md">
                <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Clique em "Gerar Briefing" para que a IA analise todo o histórico do cliente e prepare um resumo executivo para sua próxima reunião.</p>
              </div>
            )}
          </TabsContent>

          {/* ---- Churn ---- */}
          <TabsContent value="churn" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => runAI('churn')} disabled={loadingChurn} variant="destructive">
                {loadingChurn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {churn ? 'Reanalisar Churn' : 'Analisar Risco de Churn'}
                  </>
                )}
              </Button>
            </div>

            {churn ? (
              <div className="space-y-4">
                {/* Header risk */}
                <div className="flex items-center justify-between p-4 rounded-md border bg-card">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full ${RISCO_CONFIG[churn.risco].color} flex items-center justify-center text-2xl`}>
                      {RISCO_CONFIG[churn.risco].icon}
                    </div>
                    <div>
                      <div className="text-lg font-bold">{RISCO_CONFIG[churn.risco].label}</div>
                      <div className="text-sm text-muted-foreground">Score de churn: <span className="font-semibold">{churn.score}/100</span></div>
                    </div>
                  </div>
                </div>

                {/* Resumo */}
                <div className="p-4 bg-muted/30 rounded-md border">
                  <h4 className="font-semibold mb-1">Diagnóstico</h4>
                  <p className="text-sm">{churn.resumo_executivo}</p>
                </div>

                {/* Sinais e fatores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Sinais de Alerta
                    </h4>
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {churn.principais_sinais?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="p-4 rounded-md border border-emerald-500/30 bg-emerald-500/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      ✅ Fatores Positivos
                    </h4>
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {churn.fatores_positivos?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Ações */}
                <div className="p-4 rounded-md border bg-card">
                  <h4 className="font-semibold mb-3">🎯 Ações Recomendadas</h4>
                  <div className="space-y-2">
                    {churn.acoes_recomendadas?.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/40">
                        <Badge variant={a.prioridade === 'alta' ? 'destructive' : a.prioridade === 'media' ? 'default' : 'secondary'}>
                          {a.prioridade}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm">{a.acao}</p>
                          <p className="text-xs text-muted-foreground mt-1">Prazo: {a.prazo.replace('_', ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-md">
                <TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>A IA vai analisar pagamentos, tarefas, follow-ups e tentativas de recuperação para calcular o risco de cancelamento.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
