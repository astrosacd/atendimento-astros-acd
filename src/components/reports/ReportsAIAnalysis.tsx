import { useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Sparkles, ChevronDown, History, Eye, Settings, Loader2, Copy, Check, Clock, Mail, MessageSquare, Plus, X } from 'lucide-react';
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
];

const GROK_MODELS = [
  { value: 'grok-3', label: 'Grok 3' },
  { value: 'grok-3-mini', label: 'Grok 3 Mini' },
];

export function ReportsAIAnalysis({ metricsData }: ReportsAIAnalysisProps) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState('lovable');
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [openaiKey, setOpenaiKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
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
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');

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

  // Load schedule config
  const { data: scheduleConfig } = useQuery({
    queryKey: ['reports-schedule-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports_analysis_config')
        .select('*');
      if (error) throw error;
      const configMap: Record<string, string> = {};
      (data || []).forEach((c: any) => { configMap[c.config_key] = c.config_value; });
      return configMap;
    },
    meta: {
      onSuccess: (data: Record<string, string>) => {
        if (data) {
          setScheduleEnabled(data.schedule_enabled === 'true');
          setScheduleFrequency(data.schedule_frequency || 'daily');
          setNotifyWhatsapp(data.notify_whatsapp === 'true');
          setNotifyEmail(data.notify_email === 'true');
          setWhatsappNumbers(data.whatsapp_numbers ? JSON.parse(data.whatsapp_numbers) : []);
          setEmailAddresses(data.email_addresses ? JSON.parse(data.email_addresses) : []);
          setGmailUser(data.gmail_user || '');
          setGmailPass(data.gmail_password || '');
        }
      },
    },
  });

  // Sync state when config loads
  useState(() => {
    if (scheduleConfig) {
      setScheduleEnabled(scheduleConfig.schedule_enabled === 'true');
      setScheduleFrequency(scheduleConfig.schedule_frequency || 'daily');
      setNotifyWhatsapp(scheduleConfig.notify_whatsapp === 'true');
      setNotifyEmail(scheduleConfig.notify_email === 'true');
      setWhatsappNumbers(scheduleConfig.whatsapp_numbers ? JSON.parse(scheduleConfig.whatsapp_numbers) : []);
      setEmailAddresses(scheduleConfig.email_addresses ? JSON.parse(scheduleConfig.email_addresses) : []);
      setGmailUser(scheduleConfig.gmail_user || '');
      setGmailPass(scheduleConfig.gmail_password || '');
    }
  });

  const saveScheduleConfig = useMutation({
    mutationFn: async () => {
      const configs: Record<string, string> = {
        schedule_enabled: scheduleEnabled.toString(),
        schedule_frequency: scheduleFrequency,
        notify_whatsapp: notifyWhatsapp.toString(),
        notify_email: notifyEmail.toString(),
        whatsapp_numbers: JSON.stringify(whatsappNumbers),
        email_addresses: JSON.stringify(emailAddresses),
        gmail_user: gmailUser,
        gmail_password: gmailPass,
      };

      for (const [key, value] of Object.entries(configs)) {
        const { data: existing } = await supabase
          .from('reports_analysis_config')
          .select('id')
          .eq('config_key', key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('reports_analysis_config')
            .update({ config_value: value })
            .eq('config_key', key);
        } else {
          await supabase
            .from('reports_analysis_config')
            .insert({ config_key: key, config_value: value });
        }
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

          {/* At-risk clients alert */}
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
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário (08:00)</SelectItem>
                        <SelectItem value="weekly">Semanal (Segunda 08:00)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                          <Input
                            placeholder="Ex: 5511999999999"
                            value={newWhatsapp}
                            onChange={e => setNewWhatsapp(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addWhatsappNumber()}
                          />
                          <Button size="sm" variant="outline" onClick={addWhatsappNumber}>
                            <Plus className="h-4 w-4" />
                          </Button>
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
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Gmail (remetente)</Label>
                            <Input type="email" placeholder="seu@gmail.com" value={gmailUser} onChange={e => setGmailUser(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Senha de app Gmail</Label>
                            <Input type="password" placeholder="****" value={gmailPass} onChange={e => setGmailPass(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="destinatario@email.com"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addEmailAddress()}
                          />
                          <Button size="sm" variant="outline" onClick={addEmailAddress}>
                            <Plus className="h-4 w-4" />
                          </Button>
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
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t">
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
                        <Badge variant="outline" className="text-xs">{item.ai_provider}</Badge>
                        {item.ai_model && <Badge variant="secondary" className="text-xs">{item.ai_model}</Badge>}
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
