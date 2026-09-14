import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import { Bot, Sparkles, ChevronDown, History, Eye, Settings, Loader2, Copy, Check, Clock, Mail, MessageSquare, Plus, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';

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
    biData?: {
      cac: number;
      ltvCac: number;
      payback: number;
      arpu: number;
      marketingSpend: number;
    };
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
  { value: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash (Equilibrado)' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Avançado)' },
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 (Premium)' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini (Econômico)' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

const GROK_MODELS = [
  { value: 'grok-3', label: 'Grok 3' },
  { value: 'grok-3-mini', label: 'Grok 3 Mini' },
];

export function ReportsAIAnalysis({ metricsData }: ReportsAIAnalysisProps) {
  const queryClient = useQueryClient();
  const { logActivity } = useSystemActivities();
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

  // Schedule config state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [whatsappNumbers, setWhatsappNumbers] = useState<string[]>([]);
  const [emailAddresses, setEmailAddresses] = useState<string[]>([]);
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [configId, setConfigId] = useState<string | null>(null);
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');
  const [gmailSenderName, setGmailSenderName] = useState('');

  // Notifications state removed as it's not needed for UI expansion anymore

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['reports-ai-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports_analysis_history')
        .select(`
          *,
          reports_notification_logs(*)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: notificationLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['reports-notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports_notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  // Load schedule config
  const { data: scheduleConfig } = useQuery({
    queryKey: ['reports-schedule-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports_analysis_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (scheduleConfig) {
      setConfigId(scheduleConfig.id);
      setScheduleEnabled(scheduleConfig.is_active || false);
      setScheduleFrequency(scheduleConfig.frequency || 'daily');
      setNotifyWhatsapp(scheduleConfig.notify_whatsapp || false);
      setNotifyEmail(scheduleConfig.notify_email || false);
      setWhatsappNumbers(scheduleConfig.whatsapp_recipients || []);
      setEmailAddresses(scheduleConfig.email_recipients || []);
      if (scheduleConfig.ai_provider) setProvider(scheduleConfig.ai_provider);
      if (scheduleConfig.ai_model) {
        // Modelos antigos descontinuados caem para o padrão atual
        const provId = scheduleConfig.ai_provider || 'lovable';
        const validModels = provId === 'openai' ? OPENAI_MODELS : provId === 'grok' ? GROK_MODELS : LOVABLE_MODELS;
        const isValid = validModels.some(m => m.value === scheduleConfig.ai_model);
        setModel(isValid ? scheduleConfig.ai_model : validModels[0].value);
      }
      if (scheduleConfig.openai_api_key) setOpenaiKey(scheduleConfig.openai_api_key);
      if (scheduleConfig.grok_api_key) setGrokKey(scheduleConfig.grok_api_key);
      if (scheduleConfig.gmail_user) setGmailUser(scheduleConfig.gmail_user);
      if (scheduleConfig.gmail_app_password) setGmailPass(scheduleConfig.gmail_app_password);
      if (scheduleConfig.gmail_sender_name) setGmailSenderName(scheduleConfig.gmail_sender_name);
    }
  }, [scheduleConfig]);

  const saveScheduleConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        is_active: scheduleEnabled,
        frequency: scheduleFrequency,
        ai_provider: provider,
        ai_model: model,
        openai_api_key: openaiKey || null,
        grok_api_key: grokKey || null,
        notify_whatsapp: notifyWhatsapp,
        notify_email: notifyEmail,
        whatsapp_recipients: whatsappNumbers,
        email_recipients: emailAddresses,
        gmail_user: gmailUser || null,
        gmail_app_password: gmailPass || null,
        gmail_sender_name: gmailSenderName || null,
      };

      if (configId) {
        const { error } = await supabase
          .from('reports_analysis_config')
          .update(payload)
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('reports_analysis_config')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      // Manage cron job
      if (scheduleEnabled) {
        const { error: cronError } = await supabase.rpc('update_reports_analysis_cron', {
          p_frequency: scheduleFrequency,
        });
        if (cronError) console.error('Cron update error:', cronError);
      } else {
        const { error: cronError } = await supabase.rpc('disable_reports_analysis_cron');
        if (cronError) console.error('Cron disable error:', cronError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-schedule-config'] });
      toast.success('Configurações de agendamento salvas!');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar: ' + err.message);
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
          scheduled: notifyWhatsapp || notifyEmail,
          notifyWhatsapp,
          notifyEmail,
          whatsappNumbers,
          emailAddresses,
          gmailUser: gmailUser || undefined,
          gmailPass: gmailPass || undefined,
          gmailSenderName: gmailSenderName || undefined,
          origin: window.location.origin,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setPromptUsed(data.prompt);
      refetchHistory();
      refetchLogs();
      logActivity(`Gerou análise de métricas com IA`, 'config', `Provedor: ${provider}`);
      toast.success('Análise gerada e notificações enviadas (se configuradas)!');
    } catch (err: any) {
      console.error('AI analysis error:', err);
      toast.error(err.message || 'Erro ao gerar análise');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    __copyToClipboard(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addWhatsappNumber = () => {
    if (newWhatsapp.trim() && !whatsappNumbers.includes(newWhatsapp.trim())) {
      setWhatsappNumbers([...whatsappNumbers, newWhatsapp.trim()]);
      setNewWhatsapp('');
    }
  };

  const addEmailAddress = () => {
    if (newEmail.trim() && !emailAddresses.includes(newEmail.trim())) {
      setEmailAddresses([...emailAddresses, newEmail.trim()]);
      setNewEmail('');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Análise IA
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AI_PROVIDERS.map(p => (
                            <SelectItem key={p.value} value={p.value}>
                              <span>{p.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">— {p.description}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Input type="password" placeholder="sk-..." value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} />
                    </div>
                  )}
                  {provider === 'grok' && (
                    <div className="space-y-2">
                      <Label>API Key do Grok (xAI)</Label>
                      <Input type="password" placeholder="xai-..." value={grokKey} onChange={e => setGrokKey(e.target.value)} />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {metricsData.clientesAtRisk && metricsData.clientesAtRisk.length > 0 && (
            <Card className="bg-destructive/5 border-destructive/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive" className="text-xs">⚠️ Atenção</Badge>
                  <span className="text-sm font-medium">{metricsData.clientesAtRisk.length} cliente(s) em risco de churn</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clientes com renovação nos próximos 15 dias ou até 30 dias atrasada. A IA incluirá esses dados na análise.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-4">
            <Button
              onClick={handleAnalyze}
              disabled={loading || (provider === 'openai' && !openaiKey) || (provider === 'grok' && !grokKey)}
              className="gap-2"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
              ) : (
                <><Bot className="h-4 w-4" />Gerar Análise com IA</>
              )}
            </Button>
            <Badge variant="outline" className="text-xs">
              {AI_PROVIDERS.find(p => p.value === provider)?.label} • {getModelsForProvider().find(m => m.value === model)?.label}
            </Badge>
          </div>

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
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Prompt utilizado:</p>
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{promptUsed}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Análise Agendada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Ativar agendamento automático</Label>
                  <p className="text-xs text-muted-foreground">A IA gerará análises automaticamente</p>
                </div>
                <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
              </div>

              {scheduleEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário (08:00)</SelectItem>
                        <SelectItem value="weekly">Semanal (Segunda 08:00)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Info about WhatsApp/Email sources */}
                  <Card className="bg-muted/30 border-border/50">
                    <CardContent className="py-3">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>WhatsApp:</strong> As notificações são enviadas usando as instâncias de WhatsApp configuradas no módulo de Cobrança (Instâncias ativas).</p>
                          <p><strong>E-mail:</strong> As notificações são enviadas via SMTP usando as credenciais do Gmail configuradas abaixo.</p>
                          <p><strong>Cron:</strong> O sistema executa automaticamente via cron: diário às 08:00 (horário de Brasília) ou semanal às segundas-feiras 08:00.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Notificações por WhatsApp
                    </h4>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Enviar por WhatsApp</Label>
                      <Switch checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} />
                    </div>
                    {notifyWhatsapp && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input placeholder="Ex: 5511999999999" value={newWhatsapp} onChange={e => setNewWhatsapp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWhatsappNumber()} />
                          <Button size="sm" variant="outline" onClick={addWhatsappNumber}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {whatsappNumbers.map((n, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                              {n}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => setWhatsappNumbers(whatsappNumbers.filter((_, j) => j !== i))} />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Notificações por E-mail
                    </h4>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Enviar por E-mail</Label>
                      <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                    </div>
                    {notifyEmail && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                          <div className="space-y-2">
                            <Label className="text-xs">Usuário Gmail</Label>
                            <Input 
                              placeholder="seu-email@gmail.com" 
                              value={gmailUser} 
                              onChange={e => setGmailUser(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Senha de App</Label>
                            <Input 
                              type="password"
                              placeholder="abcd efgh ijkl mnop" 
                              value={gmailPass} 
                              onChange={e => setGmailPass(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs">Nome do Remetente (Opcional)</Label>
                            <Input 
                              placeholder="Ex: Sistema de Relatórios" 
                              value={gmailSenderName} 
                              onChange={e => setGmailSenderName(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              Use uma "Senha de App" do Google, não a sua senha normal.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Destinatários</Label>
                          <div className="flex gap-2">
                            <Input placeholder="destinatario@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmailAddress()} />
                            <Button size="sm" variant="outline" onClick={addEmailAddress}><Plus className="h-4 w-4" /></Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {emailAddresses.map((e, i) => (
                              <Badge key={i} variant="secondary" className="gap-1">
                                {e}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setEmailAddresses(emailAddresses.filter((_, j) => j !== i))} />
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handleAnalyze} 
                      disabled={loading || !notifyEmail || emailAddresses.length === 0}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Testar Envio agora
                    </Button>
                    <Button onClick={() => saveScheduleConfig.mutate()} disabled={saveScheduleConfig.isPending}>
                      {saveScheduleConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Salvar Configurações
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 mb-4">
              <Bot className="h-4 w-4 text-primary" />
              Histórico de Análises e Envios
            </h3>
            
            {history.length === 0 ? (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma análise gerada ainda</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[700px]">
                <div className="space-y-6 pr-4">
                  {history.map((item: any) => (
                    <Card key={item.id} className="bg-card/50 border-border/50 overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-3">
                        {/* Analysis Content */}
                        <div className="md:col-span-2 p-6 border-b md:border-b-0 md:border-r border-border/50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="space-y-1">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] uppercase h-5">{item.ai_provider}</Badge>
                                <Badge variant="secondary" className="text-[10px] uppercase h-5">{item.ai_model}</Badge>
                              </div>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <Eye className="h-4 w-4" />
                                  Ver Completa
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <Bot className="h-4 w-4" />
                                    Análise - {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh]">
                                  <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                                    <ReactMarkdown>{item.analysis_text}</ReactMarkdown>
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </div>
                          
                          <div className="text-sm text-muted-foreground line-clamp-3">
                            {item.analysis_text.replace(/[#*`]/g, '').substring(0, 300)}...
                          </div>
                        </div>

                        {/* Notifications Content */}
                        <div className="bg-muted/30 p-6">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            Envios Realizados
                          </h4>
                          
                          {item.reports_notification_logs && item.reports_notification_logs.length > 0 ? (
                            <div className="space-y-3">
                              {item.reports_notification_logs.map((log: any) => (
                                <div key={log.id} className="bg-card/50 border border-border/50 rounded-md p-2 text-xs flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`p-1 rounded-full shrink-0 ${log.channel === 'whatsapp' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
                                      {log.channel === 'whatsapp' ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                                    </div>
                                    <div className="truncate">
                                      <p className="font-medium truncate">{log.recipient}</p>
                                      <p className="text-[10px] text-muted-foreground capitalize">{log.channel}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge 
                                      variant={log.status === 'sent' ? 'outline' : 'destructive'} 
                                      className={`text-[9px] px-1.5 h-4 shrink-0 ${log.status === 'sent' ? 'border-success/50 text-success bg-success/5' : ''}`}
                                    >
                                      {log.status === 'sent' ? 'OK' : 'Erro'}
                                    </Badge>
                                    {log.error_message && (
                                      <TooltipProvider>
                                        <UITooltip>
                                          <TooltipTrigger>
                                            <Info className="h-3 w-3 text-destructive cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent side="left" className="max-w-[200px] text-[10px]">
                                            {log.error_message}
                                          </TooltipContent>
                                        </UITooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-4">
                              <X className="h-6 w-6 text-muted-foreground/20 mb-2" />
                              <p className="text-[11px] text-muted-foreground">Nenhum envio registrado para esta análise</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
