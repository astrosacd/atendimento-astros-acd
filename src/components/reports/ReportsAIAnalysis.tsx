import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, ChevronDown, History, Eye, Settings, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

interface ReportsAIAnalysisProps {
  metricsData: {
    mrrBRL: number;
    mrrUSD: number;
    ltvBRL: number;
    ltvUSD: number;
    churnMedio: number;
    tempoMedioMeses: number;
    totalClientes: number;
    clientesBRL: number;
    clientesUSD: number;
    ticketMedioBRL: number;
    ticketMedioUSD: number;
    churnHistory: Array<{ month: string; value: number }>;
    mrrHistory: Array<{ month: string; value: number }>;
    clientesAtRisk?: Array<{ nome: string; renovacao: string; valor: number }>;
  };
}

const AI_PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI', description: 'Padrão, sem necessidade de API key' },
  { value: 'openai', label: 'OpenAI', description: 'Requer API key da OpenAI' },
  { value: 'grok', label: 'Grok (xAI)', description: 'Requer API key do Grok' },
];

const LOVABLE_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (Rápido)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Avançado)' },
  { value: 'openai/gpt-5', label: 'GPT-5 (Premium)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (Equilibrado)' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

const GROK_MODELS = [
  { value: 'grok-3', label: 'Grok 3' },
  { value: 'grok-3-mini', label: 'Grok 3 Mini' },
];

export function ReportsAIAnalysis({ metricsData }: ReportsAIAnalysisProps) {
  const [provider, setProvider] = useState('lovable');
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [openaiKey, setOpenaiKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['reports-ai-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports_analysis_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const getModelsForProvider = () => {
    switch (provider) {
      case 'lovable': return LOVABLE_MODELS;
      case 'openai': return OPENAI_MODELS;
      case 'grok': return GROK_MODELS;
      default: return LOVABLE_MODELS;
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reports-ai-analysis', {
        body: {
          provider,
          model,
          metricsData,
          openaiApiKey: openaiKey || undefined,
          grokApiKey: grokKey || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setPromptUsed(data.prompt);
      refetchHistory();
      toast.success('Análise gerada com sucesso!');
    } catch (err: any) {
      console.error('AI analysis error:', err);
      toast.error(err.message || 'Erro ao gerar análise');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Análise IA
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          {/* Config Section */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <Collapsible open={showConfig} onOpenChange={setShowConfig}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configurações da IA
                    </CardTitle>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Provedor de IA</Label>
                      <Select value={provider} onValueChange={(v) => {
                        setProvider(v);
                        const models = v === 'lovable' ? LOVABLE_MODELS : v === 'openai' ? OPENAI_MODELS : GROK_MODELS;
                        setModel(models[0].value);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_PROVIDERS.map(p => (
                            <SelectItem key={p.value} value={p.value}>
                              <div>
                                <span>{p.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">— {p.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getModelsForProvider().map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {provider === 'openai' && (
                    <div className="space-y-2">
                      <Label>API Key da OpenAI</Label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={openaiKey}
                        onChange={e => setOpenaiKey(e.target.value)}
                      />
                    </div>
                  )}

                  {provider === 'grok' && (
                    <div className="space-y-2">
                      <Label>API Key do Grok (xAI)</Label>
                      <Input
                        type="password"
                        placeholder="xai-..."
                        value={grokKey}
                        onChange={e => setGrokKey(e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Action Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleAnalyze}
              disabled={loading || (provider === 'openai' && !openaiKey) || (provider === 'grok' && !grokKey)}
              className="gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  Gerar Análise com IA
                </>
              )}
            </Button>

            <Badge variant="outline" className="text-xs">
              {AI_PROVIDERS.find(p => p.value === provider)?.label} • {getModelsForProvider().find(m => m.value === model)?.label}
            </Badge>
          </div>

          {/* Analysis Result */}
          {analysis && (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Análise Gerada
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowPrompt(!showPrompt)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>

                {showPrompt && promptUsed && (
                  <Collapsible open={showPrompt}>
                    <CollapsibleContent>
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Prompt utilizado:</p>
                        <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{promptUsed}</pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {history.length === 0 ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhuma análise gerada ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {history.map((item: any) => (
                <Card key={item.id} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.ai_provider}
                        </Badge>
                        {item.ai_model && (
                          <Badge variant="secondary" className="text-xs">
                            {item.ai_model}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[300px]">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{item.analysis_text}</ReactMarkdown>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}