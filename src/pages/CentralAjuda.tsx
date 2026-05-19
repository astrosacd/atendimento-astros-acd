import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Loader2, Copy, Check, HelpCircle, RefreshCw, Trash2, BookOpen, ChevronDown, FileCode, Zap, Wand2, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSystemActivities } from '@/hooks/useSystemActivities';

interface AnswerResult {
  message: string;
  sources?: { internal: string[]; external: string[] };
  matched_internal?: number;
  matched_external?: number;
  provider?: string;
  model?: string;
}

export default function CentralAjuda() {
  const { logActivity } = useSystemActivities();
  const [question, setQuestion] = useState('');
  const [clientName, setClientName] = useState('');
  const [produto, setProduto] = useState('');
  const [tone, setTone] = useState<'amigavel' | 'formal' | 'tecnico'>('amigavel');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiConfig, setAiConfig] = useState<{ provider: string; model: string }>({ provider: 'lovable', model: '' });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('followup_config')
        .select('config_key, config_value')
        .in('config_key', ['ai_provider', 'ai_model']);
      if (data) {
        const get = (k: string) => data.find((c: any) => c.config_key === k)?.config_value || '';
        setAiConfig({
          provider: get('ai_provider') || 'lovable',
          model: get('ai_model') || '',
        });
      }
    })();
  }, []);

  const SYSTEM_PROMPT_PREVIEW = `Você é um assistente especialista da agência, atuando como uma "Central de Ajuda" para o operador responder clientes.

SUA MISSÃO:
Ler a PERGUNTA EXATA do cliente e gerar uma RESPOSTA PRONTA que responda ESPECIFICAMENTE àquela pergunta.

REGRAS DE FOCO:
1. RESPONDA APENAS O QUE FOI PERGUNTADO (preço → preço; prazo → prazo).
2. Se houver MÚLTIPLOS produtos no contexto, escolha o que melhor corresponde à pergunta. Não misture produtos diferentes.
3. NÃO faça introduções genéricas. Vá direto ao ponto.

REGRAS PARA TABELA DE VALORES / PREÇOS:
- Quando pedirem "tabela de valores", "preços", "planos" ou "quanto custa", LISTE TODOS OS PLANOS do produto identificado, com nome e valor.
- Use a seção "💰 INFORMAÇÕES DE PREÇO/PLANOS" do contexto como FONTE PRIMÁRIA.
- Se houver múltiplas modalidades (mensal/anual, por número, com seguro), inclua TODAS de forma organizada.
- Se o cliente não especificou o produto, pergunte qual quer saber OU liste 2-3 principais com seus preços.

REGRAS DE CONTEÚDO:
- Use APENAS as informações do contexto. NÃO invente valores, prazos ou políticas.
- Se a informação EXATA não estiver no contexto, diga que vai confirmar com o time.

REGRAS DE FORMATO:
- Tom de voz: <amigável | formal | técnico> (selecionável na interface).
- Português brasileiro.
- Para tabela de preços: use bullets ou linhas separadas para ficar legível.
- Formatação WhatsApp (*negrito* para nomes de planos e valores).
- Emojis com moderação (máx. 2).
- NUNCA mencione "base de dados", "contexto" ou que você é uma IA.`;

  const USER_PROMPT_PREVIEW = `Cliente: <nome>
Produto/Assunto relacionado: <produto> (se informado)

PERGUNTA EXATA DO CLIENTE (responda SOMENTE isto):
"""
<pergunta digitada>
"""

CONHECIMENTO DISPONÍVEL:
=== BASE INTERNA (Produtos da Agência) ===
<top 4 produtos relevantes — busca expande sinônimos (disparo↔disparador↔acdbot, valor↔preço↔plano), pondera título 6x>

=== BASE EXTERNA (Catálogo de Produtos) ===
<top 4 itens — anon key compartilhada com o Follow-up>
Para perguntas de preço, é destacada a seção "💰 INFORMAÇÕES DE PREÇO/PLANOS" extraída do conteúdo.
Conteúdo completo até 4000 caracteres por item (descrição + FAQ).

INSTRUÇÕES FINAIS:
1. Releia a pergunta.
2. Identifique o trecho que responde EXATAMENTE.
3. Se for sobre valores: liste TODOS os planos do produto identificado.
4. Se não encontrar, diga que vai confirmar com o time.`;

  const handleAsk = async () => {
    if (!question.trim() || question.trim().length < 3) {
      toast.error('Descreva a pergunta do cliente (mínimo 3 caracteres)');
      return;
    }
    setLoading(true);
    setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke('central-ajuda-ia', {
        body: {
          question: question.trim(),
          client_name: clientName.trim() || undefined,
          produto: produto.trim() || undefined,
          tone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.message) {
        setAnswer(data as AnswerResult);
        logActivity('Consultou Central de Ajuda', 'consulta', question.slice(0, 80));
      } else {
        throw new Error('Resposta vazia');
      }
    } catch (err: any) {
      toast.error('Erro ao consultar IA: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!answer?.message) return;
    try {
      await navigator.clipboard.writeText(answer.message);
      setCopied(true);
      toast.success('Resposta copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = answer.message;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); toast.success('Resposta copiada!'); } catch { toast.error('Falha ao copiar'); }
      document.body.removeChild(el);
    }
  };

  const handleClear = () => {
    setQuestion('');
    setClientName('');
    setProduto('');
    setAnswer(null);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
            <HelpCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Ajuda</h1>
            <p className="text-sm text-muted-foreground">
              A IA lê a pergunta do cliente, consulta a base de conhecimento e gera uma resposta pronta para você enviar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" />
                Pergunta do cliente
              </CardTitle>
              <CardDescription>
                Cole abaixo a dúvida que o cliente enviou. A IA buscará a resposta nas bases configuradas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ca-client">Nome do cliente (opcional)</Label>
                  <Input
                    id="ca-client"
                    placeholder="Ex: João Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ca-produto">Produto / Assunto (opcional)</Label>
                  <Input
                    id="ca-produto"
                    placeholder="Ex: Plano Premium, Chip..."
                    value={produto}
                    onChange={(e) => setProduto(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ca-tone">Tom de voz</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger id="ca-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amigavel">Amigável e profissional</SelectItem>
                    <SelectItem value="formal">Formal e corporativo</SelectItem>
                    <SelectItem value="tecnico">Técnico e objetivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ca-question">Dúvida do cliente <span className="text-destructive">*</span></Label>
                <Textarea
                  id="ca-question"
                  placeholder="Cole aqui a pergunta exata do cliente. Ex: Quanto custa o plano X? Posso parcelar? Qual o prazo de entrega?..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">{question.length}/2000 caracteres</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleAsk}
                  disabled={loading || !question.trim()}
                  className="flex-1 gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Consultando IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Gerar resposta
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={loading}
                  title="Limpar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Answer */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Resposta sugerida
                  </CardTitle>
                  <CardDescription>
                    Revise antes de enviar. A IA pode cometer erros.
                  </CardDescription>
                </div>
                {answer?.message && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAsk}
                      disabled={loading}
                      title="Gerar novamente"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant={copied ? 'default' : 'outline'}
                      size="sm"
                      onClick={handleCopy}
                      className="gap-1"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Consultando a base de conhecimento...</p>
                </div>
              ) : answer?.message ? (
                <div className="space-y-3">
                  <Textarea
                    value={answer.message}
                    onChange={(e) => setAnswer({ ...answer, message: e.target.value })}
                    rows={12}
                    className="resize-none font-sans text-sm leading-relaxed"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {!!answer.matched_internal && (
                      <Badge variant="secondary" className="text-xs">
                        {answer.matched_internal} produto(s) interno(s)
                      </Badge>
                    )}
                    {!!answer.matched_external && (
                      <Badge variant="secondary" className="text-xs">
                        {answer.matched_external} item(s) externo(s)
                      </Badge>
                    )}
                    {answer.provider && (
                      <Badge variant="outline" className="text-xs">
                        {answer.provider}{answer.model ? ` · ${answer.model}` : ''}
                      </Badge>
                    )}
                  </div>
                  {(answer.sources?.internal?.length || answer.sources?.external?.length) ? (
                    <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                      <p className="font-medium text-foreground">Fontes consultadas:</p>
                      {answer.sources?.internal?.length ? (
                        <p>• Internas: {answer.sources.internal.join(', ')}</p>
                      ) : null}
                      {answer.sources?.external?.length ? (
                        <p>• Externas: {answer.sources.external.join(', ')}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center text-muted-foreground">
                  <HelpCircle className="h-10 w-10 opacity-30" />
                  <p className="text-sm max-w-xs">
                    Preencha a pergunta do cliente ao lado e clique em <strong>Gerar resposta</strong>.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="space-y-1 flex-1">
                <p className="text-foreground font-medium">Como funciona</p>
                <p>
                  A IA consulta automaticamente a base interna de produtos da agência e a base externa
                  configurada (mesma chave usada no módulo de Follow-up). Use este módulo quando precisar
                  responder o cliente sem ter que abrir o banco de dados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transparência: provedor de IA + prompt usado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              Configuração de IA ativa
            </CardTitle>
            <CardDescription>
              A Central de Ajuda reaproveita o provedor configurado no módulo Follow-up.
              Para trocar (Lovable / OpenAI / Groq), edite em <strong>Follow-up → Configurações → IA</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="text-xs">
                Provedor: {aiConfig.provider}
              </Badge>
              {aiConfig.model && (
                <Badge variant="secondary" className="text-xs">
                  Modelo: {aiConfig.model}
                </Badge>
              )}
              {!aiConfig.model && (
                <Badge variant="outline" className="text-xs">
                  Modelo: padrão do provedor
                </Badge>
              )}
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileCode className="h-4 w-4" />
                  Ver prompt usado pela IA
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    System Prompt (instruções fixas no servidor)
                  </Label>
                  <pre className="bg-muted/50 border rounded-md p-3 text-xs whitespace-pre-wrap font-mono text-foreground/80 max-h-72 overflow-auto">
{SYSTEM_PROMPT_PREVIEW}
                  </pre>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    User Prompt (montado dinamicamente a cada consulta)
                  </Label>
                  <pre className="bg-muted/50 border rounded-md p-3 text-xs whitespace-pre-wrap font-mono text-foreground/80 max-h-72 overflow-auto">
{USER_PROMPT_PREVIEW}
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  ℹ️ Este prompt é <strong>independente</strong> do prompt do Follow-up. O Follow-up usa um
                  prompt de vendas/reengajamento; aqui usamos um prompt de atendimento/suporte.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
