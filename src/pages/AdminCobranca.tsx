import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SalesForecastCard } from '@/components/dashboard/SalesForecastCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { exportBillingReportPDF } from '@/utils/exportPDF';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { PendingPaymentsList } from '@/components/PendingPaymentsList';
import { ClientRecoveryManager } from '@/components/billing/ClientRecoveryManager';
import { BillingWebhooksManager } from '@/components/billing/BillingWebhooksManager';
import { BillingBaserowConfig } from '@/components/billing/BillingBaserowConfig';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@/hooks/usePermissions';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { 
  Clock, 
  Mail, 
  MessageSquare, 
  Settings, 
  Play, 
  Save, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Send,
  History,
  Users,
  BarChart3,
  Search,
  Plus,
  Trash2,
  Bot,
  Key,
  Zap,
  Sparkles,
  Phone,
  Edit,
  Power,
  Bell,
  TrendingUp,
  DollarSign,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight, 
  Loader2, 
  Globe, 
  LayoutGrid, 
  Info,
  CreditCard,
  QrCode,
  Link2,
  FileText,
  Download,
  UserPlus,
  Database,
} from 'lucide-react';

interface BillingConfig {
  [key: string]: string;
}

interface BillingLog {
  id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_numero: string;
  cliente_produto?: string;
  cliente_observacoes?: string;
  message_type: string;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  resolution: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface Cliente {
  id: string;
  nome: string;
  email: string;
  numero: string;
  produto: string;
  plano: string | null;
  valor: number;
  data_renovacao: string;
  data_d_menos_3: string | null;
  data_d_mais_1: string | null;
  data_d_mais_2: string | null;
  data_d_mais_15: string | null;
  data_d_mais_30: string | null;
  cobranca_ativa: boolean;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
  last_used_at: string | null;
}

interface MonthlyStats {
  month: string;
  sent: number;
  errors: number;
}

interface MetricsData {
  successRate: number;
  previousSuccessRate: number;
  totalValueBrl: number;
  totalValueUsd: number;
  previousTotalValue: number;
  clientsWithPending: number;
  avgResponseTime: number;
  forecastTodayBrl: number;
  forecastTodayUsd: number;
  forecastMonthBrl: number;
  forecastMonthUsd: number;
}

const defaultMessages: Record<string, string> = {
  message_d_menos_3: 'Olá {nome}! Lembramos que sua renovação do plano {plano} - {produto} vence em 3 dias ({data_renovacao}). Valor: R$ {valor}. Não deixe para última hora!',
  message_d_zero: 'Olá {nome}! Hoje é o dia da renovação do seu plano {plano} - {produto}. Valor: R$ {valor}. Escolha a melhor forma de pagamento:',
  message_d_mais_1: 'Olá {nome}! Sua renovação do plano {plano} - {produto} venceu ontem. Valor: R$ {valor}. Regularize sua situação!',
  message_d_mais_2: 'Olá {nome}! URGENTE: Sua renovação do plano {plano} - {produto} está atrasada há 2 dias. Valor: R$ {valor}. Evite a suspensão do serviço!',
  message_d_mais_15: 'Olá {nome}! Sua renovação do plano {plano} - {produto} está pendente há 15 dias. Valor: R$ {valor}. Entre em contato para regularizar!',
  message_d_mais_30: 'Olá {nome}! ATENÇÃO: Sua renovação do plano {plano} - {produto} está pendente há 30 dias. Valor: R$ {valor}. Regularize para evitar o cancelamento do serviço!',
};



const AdminCobranca = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const {
    canViewCobrancaMetricas,
    canViewCobrancaRecuperacao,
    canViewCobrancaConfig,
    canViewCobrancaPagamentos,
    canViewCobrancaIA,
    canViewCobrancaCanais,
    canViewCobrancaMensagens,
    canViewCobrancaRecibo,
    canViewCobrancaRelatorios,
    canViewCobrancaLogs,
  } = usePermissions();
  const { checkPaymentStatus, getPaymentStats, isLoading: isCheckingPayments } = usePaymentStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BillingConfig>({});
  const [logs, setLogs] = useState<BillingLog[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, errors: 0, today: 0 });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageType, setSelectedMessageType] = useState('d_zero');
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [channelStats, setChannelStats] = useState<{ name: string; value: number }[]>([]);
  const [typeStats, setTypeStats] = useState<{ name: string; sent: number; errors: number }[]>([]);
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([]);
  const [newInstance, setNewInstance] = useState({ instance_name: '', api_url: '', api_key: '' });
  const [isAddingInstance, setIsAddingInstance] = useState(false);
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all'); // 'all', 'mensal', 'registro'
  const [dateFilter, setDateFilter] = useState<string>('none'); // 'none', 'd_menos_3', 'd_zero', 'd_mais_1', etc.
  
  // Log filters
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');
  const [logChannelFilter, setLogChannelFilter] = useState<string>('all');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [logDateFilter, setLogDateFilter] = useState<string>('7days');
  
  // Resolution dialog state
  const [resolvingLogId, setResolvingLogId] = useState<string | null>(null);
  const [resolutionType, setResolutionType] = useState<string>('erro_numero');
  const [resolutionNote, setResolutionNote] = useState('');
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  const isConnectionError = (errorMessage: string | null | undefined) => {
    if (!errorMessage) return false;
    const msg = errorMessage.toLowerCase();
    return (
      msg.includes('connection closed') ||
      msg.includes('connection_closed') ||
      msg.includes('connection failed') ||
      msg.includes('disconnected') ||
      msg.includes('desconectad') ||
      msg.includes('instance not connected') ||
      msg.includes('instância não conectada')
    );
  };

  const handleRetryLog = async (log: BillingLog) => {
    const clienteId = (log as any).cliente_id as string | undefined;
    if (!clienteId) {
      toast({
        title: 'Não foi possível reenviar',
        description: 'Este log não possui um cliente vinculado.',
        variant: 'destructive',
      });
      return;
    }
    setRetryingLogId(log.id);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-billing', {
        body: {
          clienteIds: [clienteId],
          messageType: log.message_type || 'd_zero',
        },
      });
      if (error) throw error;

      const sentCount = Number(data?.sent || 0);
      const errorCount = Number(data?.errors || 0);
      if (sentCount < 1 || errorCount > 0) {
        throw new Error(`Reenvio não confirmado. Enviados: ${sentCount}, Erros: ${errorCount}`);
      }

      const resolvedAt = new Date().toISOString();
      const userResponse = await supabase.auth.getUser();
      const resolvedBy = userResponse.data.user?.email || 'unknown';
      const retryNote = `Reenviado manualmente com sucesso em ${new Date(resolvedAt).toLocaleString('pt-BR')}. Erro anterior: ${log.error_message || 'não informado'}`;

      const { data: updatedLog, error: updateError } = await supabase
        .from('billing_logs')
        .update({
          status: 'sent',
          error_message: null,
          resolution: 'reenviado_manual',
          resolution_note: retryNote,
          resolved_at: resolvedAt,
          resolved_by: resolvedBy,
        })
        .eq('id', log.id)
        .select('id, status, error_message, resolution, resolution_note, resolved_at, resolved_by')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedLog) {
        throw new Error('Mensagem reenviada, mas não consegui atualizar o histórico antigo. Recarregue e tente resolver manualmente.');
      }

      setLogs((currentLogs) =>
        currentLogs.map((item) =>
          item.id === log.id
            ? {
                ...item,
                status: updatedLog.status,
                error_message: updatedLog.error_message,
                resolution: updatedLog.resolution,
                resolution_note: updatedLog.resolution_note,
                resolved_at: updatedLog.resolved_at,
                resolved_by: updatedLog.resolved_by,
              }
            : item
        )
      );

      toast({
        title: 'Reenviado e atualizado',
        description: 'O erro antigo foi marcado como OK e os detalhes foram atualizados.',
      });
      await loadLogs();
    } catch (err: any) {
      toast({
        title: 'Erro ao reenviar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setRetryingLogId(null);
    }
  };
  
  const [metrics, setMetrics] = useState<MetricsData>({
    successRate: 0,
    previousSuccessRate: 0,
    totalValueBrl: 0,
    totalValueUsd: 0,
    previousTotalValue: 0,
    clientsWithPending: 0,
    avgResponseTime: 0,
    forecastTodayBrl: 0,
    forecastTodayUsd: 0,
    forecastMonthBrl: 0,
    forecastMonthUsd: 0,
  });
  const [paymentStats, setPaymentStats] = useState<{
    total: number;
    paid: number;
    pending: number;
    rejected: number;
    totalPaidBrl: number;
    totalPaidUsd: number;
    totalPendingBrl: number;
    totalPendingUsd: number;
  } | null>(null);
  const [dbCronSchedule, setDbCronSchedule] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<{ date: string; count: number; success: number; errors: number } | null>(null);
  const [nextExecution, setNextExecution] = useState<string | null>(null);
  const [cronMissed, setCronMissed] = useState<boolean>(false);
  
  // Stripe configuration state
  const [stripeConfig, setStripeConfig] = useState<{
    stripe_secret_key: string;
    stripe_tax_percent: number;
    stripe_enabled: boolean;
  }>({
    stripe_secret_key: '',
    stripe_tax_percent: 2.99,
    stripe_enabled: false,
  });
  const [isSavingStripe, setIsSavingStripe] = useState(false);

  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const getMetaTemplateName = (template: any) => {
    const name = template?.name || template?.template_name || '';
    return typeof name === 'string' ? name.trim() : '';
  };
  const getMetaTemplateLanguage = (template: any) => {
    const language = template?.language || template?.language_code || '';
    return typeof language === 'string' ? language.trim() : '';
  };
  const validMetaTemplates = metaTemplates.filter((template) => getMetaTemplateName(template));
  const hasMetaTemplate = (templateName?: string) => Boolean(templateName && validMetaTemplates.some((template) => getMetaTemplateName(template) === templateName));

  useEffect(() => {
    loadConfig();
    loadLogs();
    loadClientes();
    loadWhatsAppInstances();
    loadMetrics();
    loadPaymentStats();
    loadDbCronSchedule();
    loadLastExecution();
    loadStripeConfig();
  }, []);

  // Handle URL filter param for skipped/error billing
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'skipped') {
      setLogStatusFilter('skipped');
      setLogDateFilter('all');
    } else if (filter === 'error') {
      setLogStatusFilter('error');
      setLogDateFilter('all');
    }
  }, [searchParams]);

  const handleResolveSkipped = async () => {
    if (!resolvingLogId) return;

    const resolvedAt = new Date().toISOString();
    const userResponse = await supabase.auth.getUser();
    const resolvedBy = userResponse.data.user?.email || 'unknown';

    try {
      const { data, error } = await supabase
        .from('billing_logs')
        .update({
          status: 'resolved',
          resolution: resolutionType,
          resolution_note: resolutionNote || null,
          resolved_at: resolvedAt,
          resolved_by: resolvedBy,
        })
        .eq('id', resolvingLogId)
        .is('resolution', null)
        .select('id, status, resolution, resolution_note, resolved_at, resolved_by')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Não foi possível atualizar este log. Recarregue a página e tente novamente.');
      }

      setLogs((currentLogs) =>
        currentLogs.map((log) =>
          log.id === resolvingLogId
            ? {
                ...log,
                status: data.status,
                resolution: data.resolution,
                resolution_note: data.resolution_note,
                resolved_at: data.resolved_at,
                resolved_by: data.resolved_by,
              }
            : log
        )
      );

      toast({ title: 'Resolvido!', description: 'Cobrança marcada como resolvida com sucesso.' });
      setResolvingLogId(null);
      setResolutionType('erro_numero');
      setResolutionNote('');
      await loadLogs();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<{ url: string, token: string } | null>(null);

  const syncMetaTemplates = async () => {
    if (!config.meta_access_token || !config.meta_waba_id) {
      toast({ title: "Erro", description: "Informe Access Token e WABA ID primeiro", variant: "destructive" });
      return;
    }
    
    setIsSyncingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-api', {
        body: { 
          action: 'fetch-templates',
          accessToken: config.meta_access_token,
          wabaId: config.meta_waba_id
        }
      });
      
      if (error) throw error;
      
      const templates = (data.templates || []).filter((template: any) => getMetaTemplateName(template));
      setMetaTemplates(templates);
      toast({ title: "Sucesso", description: `${templates.length} templates sincronizados!` });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncingMeta(false);
    }
  };

  const getWebhookInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-api', {
        body: { action: 'get-webhook-info' }
      });
      if (error) throw error;
      setWebhookInfo({ url: data.webhookUrl, token: data.verifyToken });
    } catch (err: any) {
      console.error("Erro ao buscar info do webhook", err);
    }
  };

  const loadStripeConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_stripe_config')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.error('Error loading Stripe config:', error);
        return;
      }

      if (data) {
        setStripeConfig({
          stripe_secret_key: data.stripe_secret_key || '',
          stripe_tax_percent: data.stripe_tax_percent ?? 2.99,
          stripe_enabled: data.stripe_enabled ?? false,
        });
      }
    } catch (error) {
      console.error('Error loading Stripe config:', error);
    }
  };

  const saveStripeConfig = async () => {
    setIsSavingStripe(true);
    try {
      const { error } = await supabase
        .from('billing_stripe_config')
        .update({
          stripe_secret_key: stripeConfig.stripe_secret_key,
          stripe_tax_percent: stripeConfig.stripe_tax_percent,
          stripe_enabled: stripeConfig.stripe_enabled,
        })
        .eq('id', (await supabase.from('billing_stripe_config').select('id').limit(1).single()).data?.id);

      if (error) throw error;

      toast({
        title: 'Configuração da Stripe salva!',
        description: 'As configurações foram atualizadas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingStripe(false);
    }
  };

  const loadDbCronSchedule = async () => {
    try {
      const { data, error } = await supabase.rpc('get_billing_cron_schedule');
      if (error) throw error;
      if (data && data.length > 0) {
        // Converter de UTC para Brasília (UTC-3)
        const schedule = data[0].schedule;
        const parts = schedule.split(' ');
        if (parts.length >= 2) {
          const utcMinute = parseInt(parts[0]);
          let utcHour = parseInt(parts[1]);
          let brHour = utcHour - 3;
          if (brHour < 0) brHour += 24;
          setDbCronSchedule(`${brHour.toString().padStart(2, '0')}:${utcMinute.toString().padStart(2, '0')}`);
          
          // Calcular próxima execução
          calculateNextExecution(brHour, utcMinute);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar horário do cron:', error);
    }
  };

  const calculateNextExecution = (hour: number, minute: number) => {
    const now = new Date();
    // Converter para horário de Brasília
    const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    const nextRun = new Date(brNow);
    nextRun.setHours(hour, minute, 0, 0);
    
    // Se o horário já passou hoje, próxima execução é amanhã
    if (nextRun <= brNow) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    setNextExecution(nextRun.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    }));
  };

  const loadLastExecution = async () => {
    try {
      // Buscar o último log
      const { data: lastLog, error: lastError } = await supabase
        .from('billing_logs')
        .select('sent_at')
        .order('sent_at', { ascending: false })
        .limit(1);
      
      if (lastError) throw lastError;
      if (lastLog && lastLog.length > 0) {
        const lastDate = new Date(lastLog[0].sent_at);
        
        // Definir janela de 5 minutos para considerar como mesma execução
        const windowStart = new Date(lastDate.getTime() - 5 * 60 * 1000);
        const windowEnd = new Date(lastDate.getTime() + 5 * 60 * 1000);
        
        // Contar logs nessa janela de tempo
        const { data: logsInWindow, error: countError } = await supabase
          .from('billing_logs')
          .select('status')
          .gte('sent_at', windowStart.toISOString())
          .lte('sent_at', windowEnd.toISOString());
        
        if (countError) throw countError;
        
        const total = logsInWindow?.length || 0;
        const success = logsInWindow?.filter(l => l.status === 'sent' || l.status === 'success').length || 0;
        const errors = logsInWindow?.filter(l => l.status === 'error' || l.status === 'failed').length || 0;
        
        setLastExecution({
          date: lastDate.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          count: total,
          success,
          errors
        });

        // Verificar se o cron perdeu a execução de hoje
        checkCronMissed(lastDate);
      } else {
        // Sem logs = verificar se deveria ter executado
        checkCronMissed(null);
      }
    } catch (error) {
      console.error('Erro ao carregar última execução:', error);
    }
  };

  const checkCronMissed = async (lastExecutionDate: Date | null) => {
    try {
      // Buscar configuração de horário do cron
      const { data: configData } = await supabase
        .from('billing_config')
        .select('config_key, config_value')
        .in('config_key', ['cron_hour', 'cron_minute', 'billing_enabled']);
      
      const configMap: Record<string, string> = {};
      configData?.forEach(item => {
        configMap[item.config_key] = item.config_value;
      });

      // Se billing não está habilitado, não verificar
      if (configMap.billing_enabled !== 'true') {
        setCronMissed(false);
        return;
      }

      const cronHour = parseInt(configMap.cron_hour || '10');
      const cronMinute = parseInt(configMap.cron_minute || '0');

      // Obter horário atual em Brasília
      const now = new Date();
      const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      
      // Calcular quando deveria ter executado hoje
      const expectedToday = new Date(brNow);
      expectedToday.setHours(cronHour, cronMinute, 0, 0);

      // Se ainda não chegou o horário de hoje, verificar ontem
      if (brNow < expectedToday) {
        expectedToday.setDate(expectedToday.getDate() - 1);
      }

      // Adicionar margem de 30 minutos após o horário esperado
      const expectedWithMargin = new Date(expectedToday.getTime() + 30 * 60 * 1000);

      // Se já passou o horário esperado + margem
      if (brNow > expectedWithMargin) {
        if (!lastExecutionDate) {
          // Nunca executou
          setCronMissed(true);
        } else {
          // Verificar se última execução foi antes do horário esperado de hoje
          const lastExecBr = new Date(lastExecutionDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
          if (lastExecBr < expectedToday) {
            setCronMissed(true);
          } else {
            setCronMissed(false);
          }
        }
      } else {
        setCronMissed(false);
      }
    } catch (error) {
      console.error('Erro ao verificar execução do cron:', error);
    }
  };

  const loadPaymentStats = async () => {
    const stats = await getPaymentStats();
    if (stats) {
      setPaymentStats(stats);
    }
  };

  const handleCheckPayments = async () => {
    await checkPaymentStatus();
    await loadPaymentStats();
  };

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('billing_config')
        .select('config_key, config_value');

      if (error) throw error;

      const loadedConfig: BillingConfig = {};
      data?.forEach((item) => {
        loadedConfig[item.config_key] = item.config_value;
      });
      
      // Set defaults
      Object.keys(defaultMessages).forEach(key => {
        if (!loadedConfig[key]) loadedConfig[key] = defaultMessages[key];
      });
      if (!loadedConfig.cron_hour) loadedConfig.cron_hour = '10';
      if (!loadedConfig.cron_minute) loadedConfig.cron_minute = '0';
      if (!loadedConfig.billing_enabled) loadedConfig.billing_enabled = 'false';
      if (!loadedConfig.email_enabled) loadedConfig.email_enabled = 'true';
      if (!loadedConfig.whatsapp_enabled) loadedConfig.whatsapp_enabled = 'true';
      if (!loadedConfig.ai_provider) loadedConfig.ai_provider = 'none';
      
      setConfig(loadedConfig);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadWhatsAppInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWhatsappInstances(data || []);
    } catch (error: any) {
      console.error('Error loading WhatsApp instances:', error);
    }
  };

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error('Error loading clients:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      setLogs(data || []);

      const today = new Date().toISOString().split('T')[0];
      const total = data?.length || 0;
      const sent = data?.filter(l => l.status === 'sent').length || 0;
      const errors = data?.filter(l => l.status === 'error').length || 0;
      const todayLogs = data?.filter(l => l.sent_at.startsWith(today)).length || 0;

      setStats({ total, sent, errors, today: todayLogs });

      // Monthly stats
      const monthlyData: Record<string, { sent: number; errors: number }> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { sent: 0, errors: 0 };
      }

      data?.forEach(log => {
        const month = log.sent_at.substring(0, 7);
        if (monthlyData[month]) {
          if (log.status === 'sent') monthlyData[month].sent++;
          else monthlyData[month].errors++;
        }
      });

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setMonthlyStats(Object.entries(monthlyData).map(([key, value]) => ({
        month: monthNames[parseInt(key.split('-')[1]) - 1],
        sent: value.sent,
        errors: value.errors,
      })));

      // Channel stats
      const emailCount = data?.filter(l => l.channel === 'email').length || 0;
      const whatsappCount = data?.filter(l => l.channel === 'whatsapp').length || 0;
      setChannelStats([
        { name: 'Email', value: emailCount },
        { name: 'WhatsApp', value: whatsappCount },
      ]);

      // Type stats
      const typeData: Record<string, { sent: number; errors: number }> = {};
      ['d_menos_3', 'd_zero', 'd_mais_1', 'd_mais_2', 'd_mais_15', 'd_mais_30'].forEach(type => {
        typeData[type] = { sent: 0, errors: 0 };
      });

      data?.forEach(log => {
        if (typeData[log.message_type]) {
          if (log.status === 'sent') typeData[log.message_type].sent++;
          else typeData[log.message_type].errors++;
        }
      });

      setTypeStats([
        { name: 'D-3', sent: typeData.d_menos_3.sent, errors: typeData.d_menos_3.errors },
        { name: 'D', sent: typeData.d_zero.sent, errors: typeData.d_zero.errors },
        { name: 'D+1', sent: typeData.d_mais_1.sent, errors: typeData.d_mais_1.errors },
        { name: 'D+2', sent: typeData.d_mais_2.sent, errors: typeData.d_mais_2.errors },
        { name: 'D+15', sent: typeData.d_mais_15.sent, errors: typeData.d_mais_15.errors },
        { name: 'D+30', sent: typeData.d_mais_30.sent, errors: typeData.d_mais_30.errors },
      ]);
    } catch (error: any) {
      console.error('Error loading logs:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      // Current month logs
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      const { data: currentLogs } = await supabase
        .from('billing_logs')
        .select('*')
        .gte('sent_at', currentMonthStart);

      const { data: previousLogs } = await supabase
        .from('billing_logs')
        .select('*')
        .gte('sent_at', previousMonthStart)
        .lt('sent_at', previousMonthEnd);

      // Excluindo cadastros marcados como administrativo/parceiro/outros (não contam em métricas)
      const { data: allClientes } = await supabase
        .from('clientes')
        .select('id, valor, data_renovacao, moeda, ciclo_cobranca, cobranca_ativa')
        .or('excluir_metricas.is.null,excluir_metricas.eq.false');

      // Calculate metrics
      const currentSent = currentLogs?.filter(l => l.status === 'sent').length || 0;
      const currentTotal = currentLogs?.length || 1;
      const currentSuccessRate = (currentSent / currentTotal) * 100;

      const previousSent = previousLogs?.filter(l => l.status === 'sent').length || 0;
      const previousTotal = previousLogs?.length || 1;
      const previousSuccessRate = (previousSent / previousTotal) * 100;

      // Filter only clients with active billing (cobranca_ativa = true)
      const clientesAtivos = allClientes?.filter(c => c.cobranca_ativa === true) || [];

      // Total value from active clients - separated by currency
      const totalValueBrl = clientesAtivos.reduce((sum, c) => {
        if (c.moeda === 'USD') return sum;
        return sum + (c.valor || 0);
      }, 0);

      const totalValueUsd = clientesAtivos.reduce((sum, c) => {
        if (c.moeda !== 'USD') return sum;
        return sum + (c.valor || 0);
      }, 0);

      // Metrics for the dashboard
      const todayDate = new Date().toISOString().split('T')[0];
      const clientsWithPending = clientesAtivos.filter(c => c.data_renovacao < todayDate).length;

      // Revenue forecast (today)
      const forecastTodayBrl = clientesAtivos
        .filter(c => c.data_renovacao === todayDate && (c.moeda || 'BRL') === 'BRL')
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      const forecastTodayUsd = clientesAtivos
        .filter(c => c.data_renovacao === todayDate && c.moeda === 'USD')
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      // Revenue forecast (next 30 days)
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const forecastMonthBrl = clientesAtivos
        .filter(c => c.data_renovacao >= todayDate && c.data_renovacao <= thirtyDaysFromNow && (c.moeda || 'BRL') === 'BRL')
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      const forecastMonthUsd = clientesAtivos
        .filter(c => c.data_renovacao >= todayDate && c.data_renovacao <= thirtyDaysFromNow && c.moeda === 'USD')
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      setMetrics({
        successRate: currentSuccessRate,
        previousSuccessRate: previousSuccessRate,
        totalValueBrl: totalValueBrl,
        totalValueUsd: totalValueUsd,
        previousTotalValue: totalValueBrl * 0.95, // Approximate
        clientsWithPending: clientsWithPending,
        avgResponseTime: 2.5, // Placeholder
        forecastTodayBrl,
        forecastTodayUsd,
        forecastMonthBrl,
        forecastMonthUsd,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      for (const [key, value] of Object.entries(config)) {
        await supabase
          .from('billing_config')
          .upsert({ config_key: key, config_value: value }, { onConflict: 'config_key' });
      }

      // Sincronizar horário do cron job no banco
      const hour = parseInt(config.cron_hour || '10');
      const minute = parseInt(config.cron_minute || '0');
      
      const { error: cronError } = await supabase.rpc('update_billing_cron_schedule', {
        p_hour: hour,
        p_minute: minute
      });

      if (cronError) {
        console.error('Erro ao atualizar cron:', cronError);
      }

      // Recarregar o horário do cron para confirmar sincronização
      await loadDbCronSchedule();

      toast({
        title: 'Configurações salvas!',
        description: 'Todas as configurações e agendamento do cron foram atualizados.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addWhatsAppInstance = async () => {
    if (!newInstance.instance_name || !newInstance.api_url || !newInstance.api_key) {
      toast({
        title: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingInstance(true);
    try {
      const { error } = await supabase
        .from('billing_whatsapp_instances')
        .insert(newInstance);

      if (error) throw error;

      toast({ title: 'Instância adicionada!' });
      setNewInstance({ instance_name: '', api_url: '', api_key: '' });
      loadWhatsAppInstances();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAddingInstance(false);
    }
  };

  const toggleInstanceStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('billing_whatsapp_instances')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadWhatsAppInstances();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteInstance = async (id: string) => {
    try {
      const { error } = await supabase
        .from('billing_whatsapp_instances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Instância removida!' });
      loadWhatsAppInstances();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const runBillingManually = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-billing');

      if (error) throw error;

      toast({
        title: 'Cobrança executada!',
        description: `Enviados: ${data.sent || 0}, Erros: ${data.errors || 0}`,
      });

      loadLogs();
    } catch (error: any) {
      toast({
        title: 'Erro ao executar cobrança',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const sendManualBilling = async () => {
    if (selectedClientes.length === 0) {
      toast({
        title: 'Nenhum cliente selecionado',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-billing', {
        body: {
          clienteIds: selectedClientes,
          messageType: selectedMessageType,
        },
      });

      if (error) throw error;

      toast({
        title: 'Cobrança manual enviada!',
        description: `Enviados: ${data.sent || 0}, Erros: ${data.errors || 0}`,
      });

      setSelectedClientes([]);
      setIsManualDialogOpen(false);
      loadLogs();
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSendingManual(false);
    }
  };

  const filteredClientes = clientes.filter(c => {
    // Filtro por texto (nome, email, telefone)
    const matchesSearch = 
      c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.numero.includes(searchQuery);
    
    if (!matchesSearch) return false;
    
    // Filtro por tipo de cliente (mensal vs registro)
    if (clientTypeFilter === 'mensal' && !c.cobranca_ativa) return false;
    if (clientTypeFilter === 'registro' && c.cobranca_ativa) return false;
    
    // Filtro por data de vencimento
    if (dateFilter !== 'none') {
      const today = new Date().toISOString().split('T')[0];
      
      switch (dateFilter) {
        case 'd_menos_3':
          return c.data_d_menos_3 === today;
        case 'd_zero':
          return c.data_renovacao === today;
        case 'd_mais_1':
          return c.data_d_mais_1 === today;
        case 'd_mais_2':
          return c.data_d_mais_2 === today;
        case 'd_mais_15':
          return c.data_d_mais_15 === today;
        case 'd_mais_30':
          return c.data_d_mais_30 === today;
        default:
          return true;
      }
    }
    
    return true;
  });

  const toggleClienteSelection = (id: string) => {
    setSelectedClientes(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllClientes = () => {
    if (selectedClientes.length === filteredClientes.length) {
      setSelectedClientes([]);
    } else {
      setSelectedClientes(filteredClientes.map(c => c.id));
    }
  };

  const getMessageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'd_menos_3': 'D-3',
      'd_zero': 'D',
      'd_mais_1': 'D+1',
      'd_mais_2': 'D+2',
      'd_mais_15': 'D+15',
      'd_mais_30': 'D+30',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string, resolution?: string | null) => {
    if (status === 'sent') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />OK</Badge>;
    }
    if (status === 'resolved' || resolution) {
      return <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle className="w-3 h-3 mr-1" />Resolvido</Badge>;
    }
    if (status === 'info') {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><AlertCircle className="w-3 h-3 mr-1" />Info</Badge>;
    }
    if (status === 'skipped') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" />Pulado</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  };

  const getChannelBadge = (channel: string) => {
    if (channel === 'email') {
      return <Badge variant="outline" className="border-blue-500/30 text-blue-400"><Mail className="w-3 h-3 mr-1" />Email</Badge>;
    }
    if (channel === 'sistema') {
      return <Badge variant="outline" className="border-gray-500/30 text-gray-400"><Settings className="w-3 h-3 mr-1" />Sistema</Badge>;
    }
    return <Badge variant="outline" className="border-green-500/30 text-green-400"><MessageSquare className="w-3 h-3 mr-1" />WhatsApp</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header with gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 p-6 border border-amber-500/20">
          <div className="absolute inset-0 bg-grid-white/5" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  {t('billing.title')}
                </h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  {t('billing.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                    <Users className="w-4 h-4 mr-2" />
                    Cobrança Seletiva
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Cobrança Manual Seletiva</DialogTitle>
                    <DialogDescription>
                      Selecione clientes específicos para enviar cobranças.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    <div className="flex flex-col gap-3 p-1">
                      {/* Primeira linha: busca e filtros */}
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 w-full">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar por nome, email ou telefone..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="w-full sm:w-auto sm:min-w-[140px] shrink-0">
                          <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="mensal">🔄 Mensal</SelectItem>
                              <SelectItem value="registro">📝 Registro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full sm:w-auto sm:min-w-[160px] shrink-0">
                          <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Filtrar por data" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem filtro de data</SelectItem>
                              <SelectItem value="d_menos_3">D-3 (Hoje)</SelectItem>
                              <SelectItem value="d_zero">D - Vencimento (Hoje)</SelectItem>
                              <SelectItem value="d_mais_1">D+1 (Hoje)</SelectItem>
                              <SelectItem value="d_mais_2">D+2 (Hoje)</SelectItem>
                              <SelectItem value="d_mais_15">D+15 (Hoje)</SelectItem>
                              <SelectItem value="d_mais_30">D+30 (Hoje)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Segunda linha: tipo de mensagem */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Mensagem:</span>
                        <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                          <SelectTrigger className="w-auto min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="d_menos_3">D-3 (Lembrete)</SelectItem>
                            <SelectItem value="d_zero">D (Vencimento)</SelectItem>
                            <SelectItem value="d_mais_1">D+1 (1º Aviso)</SelectItem>
                            <SelectItem value="d_mais_2">D+2 (2º Aviso)</SelectItem>
                            <SelectItem value="d_mais_15">D+15 (Pendência)</SelectItem>
                            <SelectItem value="d_mais_30">D+30 (Aviso Final)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <Checkbox
                        checked={selectedClientes.length === filteredClientes.length && filteredClientes.length > 0}
                        onCheckedChange={selectAllClientes}
                      />
                      <span className="text-sm">Selecionar todos ({filteredClientes.length})</span>
                      <Badge className="ml-auto">{selectedClientes.length} selecionado(s)</Badge>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                            <TableHead className="hidden md:table-cell">Telefone</TableHead>
                            <TableHead className="hidden lg:table-cell">Produto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClientes.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                {dateFilter !== 'none' 
                                  ? `Nenhum cliente com ${getMessageTypeLabel(dateFilter)} para hoje`
                                  : 'Nenhum cliente encontrado'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredClientes.map((cliente) => (
                              <TableRow key={cliente.id} className="cursor-pointer" onClick={() => toggleClienteSelection(cliente.id)}>
                                <TableCell>
                                  <Checkbox checked={selectedClientes.includes(cliente.id)} />
                                </TableCell>
                                <TableCell className="font-medium">{cliente.nome}</TableCell>
                                <TableCell>
                                  {cliente.cobranca_ativa ? (
                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                      🔄 Mensal
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                      📝 Registro
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-muted-foreground">
                                  {new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-muted-foreground">{cliente.numero}</TableCell>
                                <TableCell className="hidden lg:table-cell text-muted-foreground">{cliente.produto}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 mt-auto border-t border-border bg-background">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsManualDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={sendManualBilling}
                        disabled={isSendingManual || selectedClientes.length === 0}
                        className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {isSendingManual ? 'Enviando...' : `Enviar (${selectedClientes.length})`}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={() => { loadLogs(); loadConfig(); }} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={runBillingManually}
                disabled={isRunning || config.billing_enabled !== 'true'}
                className="bg-gradient-to-r from-amber-500 to-orange-600"
              >
                <Play className="w-4 h-4 mr-2" />
                {isRunning ? 'Executando...' : 'Executar Agora'}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('billing.stats.totalSent'), value: stats.total, icon: Send, color: 'blue' },
            { label: t('billing.stats.successRate'), value: stats.sent, icon: CheckCircle, color: 'emerald' },
            { label: t('billing.stats.errors'), value: stats.errors, icon: XCircle, color: 'red' },
            { label: t('billing.stats.sentToday'), value: stats.today, icon: Calendar, color: 'amber' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                    <p className={`text-xl sm:text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl bg-${stat.color}-500/20`}>
                    <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${stat.color}-400`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue={searchParams.get('tab') || (canViewCobrancaMetricas() ? "metrics" : canViewCobrancaRecuperacao() ? "recovery" : canViewCobrancaConfig() ? "config" : "logs")} className="space-y-6">
          <TabsList className="bg-card/50 border border-border/50 p-1 flex-wrap h-auto">
            {canViewCobrancaMetricas() && (
              <TabsTrigger value="metrics"><TrendingUp className="w-4 h-4 mr-2" />{t('billing.tabs.metrics')}</TabsTrigger>
            )}
            {canViewCobrancaRecuperacao() && (
              <TabsTrigger value="recovery"><UserPlus className="w-4 h-4 mr-2" />Recuperação</TabsTrigger>
            )}
            {canViewCobrancaConfig() && (
              <TabsTrigger value="config"><Settings className="w-4 h-4 mr-2" />{t('billing.tabs.config')}</TabsTrigger>
            )}
            {canViewCobrancaPagamentos() && (
              <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-2" />{t('billing.tabs.payments')}</TabsTrigger>
            )}
            {canViewCobrancaIA() && (
              <TabsTrigger value="ai"><Bot className="w-4 h-4 mr-2" />IA</TabsTrigger>
            )}
            {canViewCobrancaCanais() && (
              <TabsTrigger value="channels"><MessageSquare className="w-4 h-4 mr-2" />{t('billing.tabs.channels')}</TabsTrigger>
            )}
            {canViewCobrancaMensagens() && (
              <TabsTrigger value="messages"><Edit className="w-4 h-4 mr-2" />{t('billing.tabs.messages')}</TabsTrigger>
            )}
            {canViewCobrancaRecibo() && (
              <TabsTrigger value="receipt"><FileText className="w-4 h-4 mr-2" />Recibo</TabsTrigger>
            )}
            {canViewCobrancaRelatorios() && (
              <TabsTrigger value="reports"><BarChart3 className="w-4 h-4 mr-2" />Relatórios</TabsTrigger>
            )}
            {canViewCobrancaLogs() && (
              <TabsTrigger value="logs"><History className="w-4 h-4 mr-2" />{t('billing.tabs.logs')}</TabsTrigger>
            )}
            {canViewCobrancaConfig() && (
              <TabsTrigger value="baserow"><Database className="w-4 h-4 mr-2" />Baserow</TabsTrigger>
            )}
          </TabsList>

          {/* Métricas Dashboard Tab */}
          {canViewCobrancaMetricas() && (
          <TabsContent value="metrics" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Previsto Hoje */}
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Previsão Recebimento (Hoje)</p>
                      <p className="text-3xl font-bold text-purple-400">
                        R$ {metrics.forecastTodayBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {metrics.forecastTodayUsd > 0 && (
                        <p className="text-sm text-emerald-400 mt-2">
                          + $ {metrics.forecastTodayUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/20">
                      <Clock className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Previsto 30 Dias */}
              <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Previsão 30 Dias</p>
                      <p className="text-3xl font-bold text-indigo-400">
                        R$ {metrics.forecastMonthBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {metrics.forecastMonthUsd > 0 && (
                        <p className="text-sm text-emerald-400 mt-2">
                          + $ {metrics.forecastMonthUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-500/20">
                      <Calendar className="w-6 h-6 text-indigo-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Taxa de Sucesso */}
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Taxa de Sucesso</p>
                      <p className="text-3xl font-bold text-emerald-400">{metrics.successRate.toFixed(1)}%</p>
                      <div className={`flex items-center gap-1 mt-2 text-sm ${metrics.successRate >= metrics.previousSuccessRate ? 'text-emerald-400' : 'text-red-400'}`}>
                        {metrics.successRate >= metrics.previousSuccessRate ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                        <span>{Math.abs(metrics.successRate - metrics.previousSuccessRate).toFixed(1)}% vs mês anterior</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/20">
                      <Target className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Valor Total BRL */}
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Valor Total (BRL)</p>
                      <p className="text-3xl font-bold text-blue-400">
                        R$ {metrics.totalValueBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {metrics.totalValueUsd > 0 && (
                        <p className="text-sm text-emerald-400 mt-2">
                          + $ {metrics.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                        </p>
                      )}
                      {metrics.totalValueUsd === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {clientes.length} clientes ativos
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <DollarSign className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pendentes */}
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Inadimplentes</p>
                      <p className="text-3xl font-bold text-amber-400">{metrics.clientsWithPending}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Com pagamento pendente
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/20">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tempo Médio de Resposta (New Metric) */}
              <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Média de Resposta</p>
                      <p className="text-3xl font-bold text-cyan-400">
                        {metrics.avgResponseTime > 0 ? `${metrics.avgResponseTime}h` : 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Tempo de retorno/pagamento
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-500/20">
                      <MessageSquare className="w-6 h-6 text-cyan-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Previsão IA do Pipeline (Centralizada) */}
            <SalesForecastCard />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Comparativo Mensal */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    Comparativo Mensal
                  </CardTitle>
                  <CardDescription>Sucesso vs Erros por mês</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar dataKey="sent" name="Sucesso" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Evolução Taxa de Sucesso */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-emerald-400" />
                    Evolução Taxa de Sucesso
                  </CardTitle>
                  <CardDescription>Percentual de sucesso ao longo do tempo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlyStats.map(m => ({
                      ...m,
                      rate: m.sent + m.errors > 0 ? ((m.sent / (m.sent + m.errors)) * 100).toFixed(1) : 0
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Line type="monotone" dataKey="rate" name="Taxa %" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Por Canal */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Distribuição por Canal</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={channelStats} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {channelStats.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#3b82f6' : '#22c55e'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Por Tipo de Mensagem */}
              <Card className="border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Performance por Tipo de Mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={50} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar dataKey="sent" name="Sucesso" fill="#10b981" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          )}

          {/* Recuperação de Clientes Tab */}
          {canViewCobrancaRecuperacao() && (
          <TabsContent value="recovery" className="space-y-6">
            <ClientRecoveryManager />
          </TabsContent>
          )}

          {/* Configurações Gerais */}
          {canViewCobrancaConfig() && (
          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Power className="w-5 h-5 text-emerald-400" />
                    Status do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-background to-muted/30 border">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.billing_enabled === 'true' ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                        <Zap className={`w-5 h-5 ${config.billing_enabled === 'true' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-semibold">Cobrança Automática</p>
                        <p className="text-sm text-muted-foreground">
                          {config.billing_enabled === 'true' ? 'Sistema ativo' : 'Sistema desativado'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={config.billing_enabled === 'true'}
                      onCheckedChange={(checked) => setConfig({ ...config, billing_enabled: checked ? 'true' : 'false' })}
                    />
                  </div>
                  
                  <Separator />

                  {/* Error Notifications */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-red-500/5 to-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.error_notifications_enabled === 'true' ? 'bg-red-500/20' : 'bg-muted'}`}>
                          <Bell className={`w-5 h-5 ${config.error_notifications_enabled === 'true' ? 'text-red-400' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">Notificações de Erro</p>
                          <p className="text-sm text-muted-foreground">
                            Receber email quando houver falhas
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={config.error_notifications_enabled === 'true'}
                        onCheckedChange={(checked) => setConfig({ ...config, error_notifications_enabled: checked ? 'true' : 'false' })}
                      />
                    </div>

                    {config.error_notifications_enabled === 'true' && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email para Notificações de Erro
                        </Label>
                        <Input
                          type="email"
                          placeholder="admin@empresa.com"
                          value={config.error_notification_email || ''}
                          onChange={(e) => setConfig({ ...config, error_notification_email: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Você receberá um alerta por email sempre que uma cobrança falhar
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Agendamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Select value={config.cron_hour || '10'} onValueChange={(v) => setConfig({ ...config, cron_hour: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" className="max-h-60">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}h</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Minuto</Label>
                      <Select value={config.cron_minute || '0'} onValueChange={(v) => setConfig({ ...config, cron_minute: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" className="max-h-60">
                          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                            <SelectItem key={m} value={m.toString()}>{m.toString().padStart(2, '0')} min</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Execução: todos os dias às {(config.cron_hour || '10').padStart(2, '0')}:{(config.cron_minute || '0').padStart(2, '0')}
                  </div>
                  {dbCronSchedule && (
                    <div className={`p-3 rounded-lg text-sm ${
                      dbCronSchedule === `${(config.cron_hour || '10').padStart(2, '0')}:${(config.cron_minute || '0').padStart(2, '0')}`
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Cron no banco: {dbCronSchedule}
                      {dbCronSchedule === `${(config.cron_hour || '10').padStart(2, '0')}:${(config.cron_minute || '0').padStart(2, '0')}`
                        ? ' ✓ Sincronizado'
                        : ' ⚠️ Divergente - Salve para sincronizar'}
                    </div>
                  )}
                  
                  {/* Alerta de Cron Perdido */}
                  {cronMissed && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      <span className="font-medium">Atenção:</span> O cron não executou no horário previsto hoje!
                      <p className="text-xs mt-1 text-red-400/70">
                        Verifique se o CRON Secret está configurado corretamente ou execute manualmente.
                      </p>
                    </div>
                  )}
                  
                  {/* Última e Próxima Execução */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border ${cronMissed ? 'bg-red-500/5 border-red-500/20' : 'bg-muted/50 border-border/50'}`}>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <History className="w-3 h-3" />
                        Última execução
                      </div>
                      {lastExecution ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{lastExecution.date}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{lastExecution.count} envios</span>
                            {lastExecution.success > 0 && (
                              <span className="text-emerald-400">{lastExecution.success} ✓</span>
                            )}
                            {lastExecution.errors > 0 && (
                              <span className="text-red-400">{lastExecution.errors} ✗</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-muted-foreground">
                          Nenhuma execução registrada
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Próxima execução
                      </div>
                      <div className="text-sm font-medium">
                        {nextExecution || 'Não calculado'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cron Secret Config */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-purple-400" />
                    Autenticação do Cron
                  </CardTitle>
                  <CardDescription>
                    Secret para autenticação do job automático
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      CRON Secret
                    </Label>
                    <Input
                      type="password"
                      placeholder="Digite o secret do cron..."
                      value={config.cron_secret || ''}
                      onChange={(e) => setConfig({ ...config, cron_secret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este valor deve ser igual ao configurado nos secrets da Edge Function (CRON_SECRET)
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg text-sm ${config.cron_secret ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
                    {config.cron_secret ? (
                      <>
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        CRON Secret configurado
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        Configure o CRON Secret para o agendamento automático funcionar
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-emerald-500 to-green-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </TabsContent>
          )}

          {/* Pagamentos Tab (Mercado Pago) */}
          {canViewCobrancaPagamentos() && (
          <TabsContent value="payments" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mercado Pago Config */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                    Credenciais Mercado Pago
                  </CardTitle>
                  <CardDescription>
                    Configure sua conta para gerar links de pagamento e boletos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <span>Gerar Link de Pagamento</span>
                    <Switch
                      checked={config.mp_link_enabled === 'true'}
                      onCheckedChange={(c) => setConfig({ ...config, mp_link_enabled: c ? 'true' : 'false' })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <span>Gerar Boleto</span>
                    <Switch
                      checked={config.mp_boleto_enabled === 'true'}
                      onCheckedChange={(c) => setConfig({ ...config, mp_boleto_enabled: c ? 'true' : 'false' })}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Access Token do Mercado Pago
                    </Label>
                    <Input
                      type="password"
                      placeholder="APP_USR-..."
                      value={config.mp_access_token || ''}
                      onChange={(e) => setConfig({ ...config, mp_access_token: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Encontre em: Mercado Pago → Seu negócio → Configurações → Credenciais
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Taxa Cartão (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="4.99"
                        value={config.mp_taxa_cartao || ''}
                        onChange={(e) => setConfig({ ...config, mp_taxa_cartao: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Taxa Boleto (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1.99"
                        value={config.mp_taxa_boleto || ''}
                        onChange={(e) => setConfig({ ...config, mp_taxa_boleto: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mercado Pago Advanced Settings */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Opções do Link de Pagamento
                  </CardTitle>
                  <CardDescription>
                    Personalize o comportamento dos links gerados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Soft Descriptor (Fatura do Cartão)</Label>
                    <Input
                      placeholder="Ex: MINHAEMPRESA"
                      maxLength={16}
                      value={config.mp_statement_descriptor || ''}
                      onChange={(e) => setConfig({ ...config, mp_statement_descriptor: e.target.value.toUpperCase() })}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      O nome que aparecerá na fatura do cartão do cliente (máx 16 caracteres).
                    </p>
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-medium">Métodos de Pagamento Permitidos</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                        <span className="text-xs">Cartão de Crédito</span>
                        <Switch
                          checked={config.mp_allow_credit_card !== 'false'}
                          onCheckedChange={(c) => setConfig({ ...config, mp_allow_credit_card: c ? 'true' : 'false' })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                        <span className="text-xs">PIX</span>
                        <Switch
                          checked={config.mp_allow_pix !== 'false'}
                          onCheckedChange={(c) => setConfig({ ...config, mp_allow_pix: c ? 'true' : 'false' })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                        <span className="text-xs">Boleto</span>
                        <Switch
                          checked={config.mp_allow_boleto !== 'false'}
                          onCheckedChange={(c) => setConfig({ ...config, mp_allow_boleto: c ? 'true' : 'false' })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label>URL de Sucesso (Redirecionamento)</Label>
                    <Input
                      placeholder="https://seusite.com/obrigado"
                      value={config.mp_success_url || ''}
                      onChange={(e) => setConfig({ ...config, mp_success_url: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Para onde o cliente será enviado após pagar.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border mt-2">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">Pagamento Imediato (Cartão/PIX)</span>
                      <p className="text-[10px] text-muted-foreground">Desativa boleto e outros métodos lentos</p>
                    </div>
                    <Switch
                      checked={config.mp_immediate_payment === 'true'}
                      onCheckedChange={(c) => setConfig({ ...config, mp_immediate_payment: c ? 'true' : 'false' })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* PIX Config */}
              <Card className="border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-green-400" />
                    Configuração do PIX
                  </CardTitle>
                  <CardDescription>
                    Dados que serão enviados nas mensagens de cobrança
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Chave</Label>
                    <Select value={config.pix_tipo_chave || 'cnpj'} onValueChange={(v) => setConfig({ ...config, pix_tipo_chave: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Chave PIX</Label>
                    <Input
                      placeholder="Sua chave PIX"
                      value={config.pix_chave || ''}
                      onChange={(e) => setConfig({ ...config, pix_chave: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Beneficiário</Label>
                    <Input
                      placeholder="Nome que aparece no PIX"
                      value={config.pix_nome_beneficiario || ''}
                      onChange={(e) => setConfig({ ...config, pix_nome_beneficiario: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Banco (informativo)</Label>
                    <Input
                      placeholder="Ex: Cora SCD"
                      value={config.pix_banco || ''}
                      onChange={(e) => setConfig({ ...config, pix_banco: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stripe Config for USD */}
            <Card className="border-border/50 bg-gradient-to-br from-violet-500/5 to-purple-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-violet-400" />
                  Stripe - Cobrança em Dólar (USD)
                </CardTitle>
                <CardDescription>
                  Configure a Stripe para cobranças automáticas de clientes em USD. 
                  <strong className="text-violet-400"> Seleção automática:</strong> clientes em USD usam Stripe, clientes em BRL usam Mercado Pago.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <div>
                    <span className="font-medium">Ativar Stripe para USD</span>
                    <p className="text-xs text-muted-foreground">Quando ativo, clientes com moeda USD receberão links de pagamento da Stripe</p>
                  </div>
                  <Switch
                    checked={stripeConfig.stripe_enabled}
                    onCheckedChange={(c) => setStripeConfig({ ...stripeConfig, stripe_enabled: c })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Stripe Secret Key
                  </Label>
                  <Input
                    type="password"
                    placeholder="sk_live_..."
                    value={stripeConfig.stripe_secret_key || ''}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, stripe_secret_key: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Stripe Dashboard → Developers → API Keys → Secret key
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Taxa Stripe (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="2.99"
                    value={stripeConfig.stripe_tax_percent ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStripeConfig({ 
                        ...stripeConfig, 
                        stripe_tax_percent: value === '' ? 0 : parseFloat(value) 
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentual a ser adicionado ao valor da cobrança para cobrir taxas
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={saveStripeConfig} 
                    disabled={isSavingStripe}
                    className="bg-gradient-to-r from-violet-500 to-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSavingStripe ? 'Salvando...' : 'Salvar Stripe'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Link de Pagamento Fixo (opcional) */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-purple-400" />
                  Link de Pagamento Fixo (Opcional)
                </CardTitle>
                <CardDescription>
                  Se preenchido, será usado este link ao invés de gerar um novo no Mercado Pago
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="https://link.mercadopago.com.br/seulink"
                  value={config.mp_link_fixo || ''}
                  onChange={(e) => setConfig({ ...config, mp_link_fixo: e.target.value })}
                />
              </CardContent>
            </Card>

            {/* Payment Status Check */}
            <Card className="border-border/50 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  Verificação Automática de Pagamentos
                </CardTitle>
                <CardDescription>
                  Verifica automaticamente o status dos pagamentos no Mercado Pago e Stripe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-xl font-bold text-blue-400">{paymentStats.total}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs text-muted-foreground">Pagos</p>
                      <p className="text-xl font-bold text-emerald-400">{paymentStats.paid}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {paymentStats.totalPaidBrl.toFixed(2)}
                      </p>
                      {paymentStats.totalPaidUsd > 0 && (
                        <p className="text-xs text-emerald-400">
                          + $ {paymentStats.totalPaidUsd.toFixed(2)} USD
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-xl font-bold text-amber-400">{paymentStats.pending}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {paymentStats.totalPendingBrl.toFixed(2)}
                      </p>
                      {paymentStats.totalPendingUsd > 0 && (
                        <p className="text-xs text-amber-400">
                          + $ {paymentStats.totalPendingUsd.toFixed(2)} USD
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-muted-foreground">Rejeitados</p>
                      <p className="text-xl font-bold text-red-400">{paymentStats.rejected}</p>
                    </div>
                  </div>
                )}
                <Button 
                  onClick={handleCheckPayments} 
                  disabled={isCheckingPayments}
                  className="bg-gradient-to-r from-emerald-500 to-green-600"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingPayments ? 'animate-spin' : ''}`} />
                  {isCheckingPayments ? 'Verificando...' : 'Verificar Status Agora'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Consulta a API do Mercado Pago e Stripe para atualizar o status de pagamentos pendentes
                </p>
              </CardContent>
            </Card>

            {/* Webhooks de Pagamento (recebimento automático MP + Stripe) */}
            <BillingWebhooksManager />

            {/* Pending Payments List */}
            <PendingPaymentsList onPaymentUpdated={loadPaymentStats} />

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-blue-500 to-blue-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Pagamentos'}
              </Button>
            </div>
          </TabsContent>
          )}

          {/* IA Tab */}
          {canViewCobrancaIA() && (
          <TabsContent value="ai" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Geração de Mensagens com IA (Recuperação)
                </CardTitle>
                <CardDescription>
                  Configure a IA para gerar mensagens personalizadas de recuperação de clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label>Provedor de IA</Label>
                    <Select value={config.recovery_ai_provider || 'lovable'} onValueChange={(v) => setConfig({ ...config, recovery_ai_provider: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lovable">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            Lovable AI (Gemini) - Recomendado
                          </div>
                        </SelectItem>
                        <SelectItem value="openai">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-green-400" />
                            OpenAI (GPT)
                          </div>
                        </SelectItem>
                        <SelectItem value="grok">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            Grok (xAI)
                          </div>
                        </SelectItem>
                        <SelectItem value="none">Desativado (usar mensagem padrão)</SelectItem>
                      </SelectContent>
                    </Select>
                    {config.recovery_ai_provider === 'lovable' && (
                      <p className="text-xs text-muted-foreground">
                        Usa Gemini via Lovable AI. Não precisa de API key.
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Label>Modelo</Label>
                    <Select 
                      value={config.recovery_ai_model || 'google/gemini-2.5-flash'} 
                      onValueChange={(v) => setConfig({ ...config, recovery_ai_model: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(config.recovery_ai_provider === 'lovable' || !config.recovery_ai_provider) && (
                          <>
                            <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Rápido)</SelectItem>
                            <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Mais rápido)</SelectItem>
                            <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (Melhor qualidade)</SelectItem>
                            <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                            <SelectItem value="openai/gpt-5-nano">GPT-5 Nano (Mais rápido)</SelectItem>
                          </>
                        )}
                        {config.recovery_ai_provider === 'openai' && (
                          <>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (Recomendado)</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          </>
                        )}
                        {config.recovery_ai_provider === 'grok' && (
                          <>
                            <SelectItem value="grok-3">Grok 3 (Mais rápido)</SelectItem>
                            <SelectItem value="grok-3-mini">Grok 3 Mini</SelectItem>
                          </>
                        )}
                        {config.recovery_ai_provider === 'none' && (
                          <SelectItem value="none">IA desativada</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {config.recovery_ai_provider === 'openai' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key da OpenAI
                    </Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={config.recovery_openai_api_key || ''}
                      onChange={(e) => setConfig({ ...config, recovery_openai_api_key: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtenha em: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">platform.openai.com/api-keys</a>
                    </p>
                  </div>
                )}

                {config.recovery_ai_provider === 'grok' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key do Grok (xAI)
                    </Label>
                    <Input
                      type="password"
                      placeholder="xai-..."
                      value={config.recovery_grok_api_key || ''}
                      onChange={(e) => setConfig({ ...config, recovery_grok_api_key: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtenha em: <a href="https://console.x.ai" target="_blank" rel="noreferrer" className="text-primary underline">console.x.ai</a>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Contexto/Prompt da IA</Label>
                  <Textarea
                    placeholder="Instruções para a IA gerar as mensagens de recuperação..."
                    value={config.recovery_ai_prompt || 'Você é um especialista em recuperação de clientes inadimplentes. Gere uma mensagem persuasiva e personalizada para recuperar o cliente.'}
                    onChange={(e) => setConfig({ ...config, recovery_ai_prompt: e.target.value })}
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Defina o tom e estilo das mensagens de recuperação que a IA deve gerar.
                  </p>
                </div>

                {/* Status indicator */}
                <div className="p-4 rounded-lg bg-background border">
                  <div className="flex items-center gap-3">
                    {config.recovery_ai_provider === 'none' ? (
                      <>
                        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                        <span className="text-muted-foreground">IA desativada - será usada mensagem padrão</span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-400">
                          IA ativa: {config.recovery_ai_provider === 'lovable' ? 'Lovable AI' : config.recovery_ai_provider === 'openai' ? 'OpenAI' : 'Grok'} 
                          {' '}({config.recovery_ai_model || 'google/gemini-2.5-flash'})
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legacy AI Config for billing messages */}
            <Card className="border-border/50 opacity-75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-muted-foreground" />
                  IA para Mensagens de Cobrança (Legado)
                </CardTitle>
                <CardDescription>
                  Configuração antiga para geração de mensagens de cobrança automática
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label>Provedor de IA</Label>
                    <Select value={config.ai_provider || 'none'} onValueChange={(v) => setConfig({ ...config, ai_provider: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Desativado (usar templates)</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label>Modelo</Label>
                    <Select value={config.ai_model || 'gpt-4o-mini'} onValueChange={(v) => setConfig({ ...config, ai_model: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {config.ai_provider === 'openai' && (
                          <>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          </>
                        )}
                        {config.ai_provider === 'groq' && (
                          <>
                            <SelectItem value="llama-3.1-70b-versatile">Llama 3.1 70B</SelectItem>
                            <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B</SelectItem>
                            <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                          </>
                        )}
                        {(!config.ai_provider || config.ai_provider === 'none') && (
                          <SelectItem value="none">Selecione um provedor primeiro</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {config.ai_provider === 'openai' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key da OpenAI
                    </Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={config.openai_api_key || ''}
                      onChange={(e) => setConfig({ ...config, openai_api_key: e.target.value })}
                    />
                  </div>
                )}

                {config.ai_provider === 'groq' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key do Groq
                    </Label>
                    <Input
                      type="password"
                      placeholder="gsk_..."
                      value={config.groq_api_key || ''}
                      onChange={(e) => setConfig({ ...config, groq_api_key: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Contexto/Prompt da IA</Label>
                  <Textarea
                    placeholder="Instruções para a IA gerar as mensagens..."
                    value={config.ai_prompt_context || ''}
                    onChange={(e) => setConfig({ ...config, ai_prompt_context: e.target.value })}
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Defina o tom e estilo das mensagens que a IA deve gerar.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-purple-500 to-violet-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Configurações de IA'}
              </Button>
            </div>
          </TabsContent>
          )}

          {/* Canais Tab */}
          {canViewCobrancaCanais() && (
          <TabsContent value="channels" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Config */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-400" />
                    Configuração de Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <span>Enviar por Email</span>
                    <Switch
                      checked={config.email_enabled === 'true'}
                      onCheckedChange={(c) => setConfig({ ...config, email_enabled: c ? 'true' : 'false' })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email do Gmail</Label>
                    <Input
                      type="email"
                      placeholder="seu-email@gmail.com"
                      value={config.billing_gmail_user || ''}
                      onChange={(e) => setConfig({ ...config, billing_gmail_user: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha de App do Gmail</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={config.billing_gmail_password || ''}
                      onChange={(e) => setConfig({ ...config, billing_gmail_password: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* WhatsApp Config */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-green-400" />
                    Configuração WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4 mb-4 border-b pb-4">
                    <Label className="text-sm font-semibold mb-2 block">Provedor WhatsApp</Label>
                    <Select value={config.whatsapp_provider || 'evolution'} onValueChange={(v) => setConfig({ ...config, whatsapp_provider: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o provedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="evolution">Evolution API (Instâncias)</SelectItem>
                        <SelectItem value="official">WhatsApp Business API Oficial (Meta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <span>Enviar por WhatsApp</span>
                    <Switch
                      checked={config.whatsapp_enabled === 'true'}
                      onCheckedChange={(c) => setConfig({ ...config, whatsapp_enabled: c ? 'true' : 'false' })}
                    />
                  </div>
                  {config.whatsapp_provider !== 'official' && (
                    <>
                      <div className="space-y-2">
                        <Label>Delay entre mensagens (segundos)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          placeholder="3"
                          value={config.whatsapp_delay || ''}
                          onChange={(e) => setConfig({ ...config, whatsapp_delay: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Tempo de espera entre cada envio de WhatsApp para evitar bloqueio. Recomendado: 3-5 segundos.
                        </p>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                        <div>
                          <span>Rotação aleatória de instâncias</span>
                          <p className="text-xs text-muted-foreground">Distribui envios aleatoriamente entre instâncias ativas</p>
                        </div>
                        <Switch
                          checked={config.whatsapp_random_rotation === 'true'}
                          onCheckedChange={(c) => setConfig({ ...config, whatsapp_random_rotation: c ? 'true' : 'false' })}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* WhatsApp Config Content based on Provider */}
            {config.whatsapp_provider === 'official' ? (
              <div className="grid grid-cols-1 gap-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Credenciais WhatsApp Oficial (Meta)
                    </CardTitle>
                    <CardDescription>
                      Configure as chaves da API Oficial para este módulo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Access Token</Label>
                        <Input 
                          type="password" 
                          value={config.meta_access_token || ''} 
                          onChange={(e) => setConfig({...config, meta_access_token: e.target.value})}
                          placeholder="EAAB..." 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number ID</Label>
                        <Input 
                          value={config.meta_phone_number_id || ''} 
                          onChange={(e) => setConfig({...config, meta_phone_number_id: e.target.value})}
                          placeholder="1234567890..." 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>WABA ID</Label>
                        <Input 
                          value={config.meta_waba_id || ''} 
                          onChange={(e) => setConfig({...config, meta_waba_id: e.target.value})}
                          placeholder="1234567890..." 
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={syncMetaTemplates} 
                        disabled={isSyncingMeta}
                        className="gap-2"
                      >
                        {isSyncingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sincronizar Templates
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={getWebhookInfo}
                        className="gap-2 text-xs"
                      >
                        <Globe className="w-3 h-3" /> Configurar Webhook (Opcional)
                      </Button>
                    </div>

                    {webhookInfo && (
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs space-y-2">
                        <p className="font-semibold text-blue-400">Configuração de Webhook na Meta:</p>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">URL de Retorno:</p>
                          <code className="block p-1 bg-background border rounded truncate">{webhookInfo.url}</code>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Token de Verificação:</p>
                          <code className="block p-1 bg-background border rounded">{webhookInfo.token}</code>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Use esses dados no Portal Meta Developers &gt; WhatsApp &gt; Configuração para receber status de entrega e respostas.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5 text-primary" />
                      Mapeamento de Templates
                    </CardTitle>
                    <CardDescription>
                      Associe eventos de cobrança aos seus templates da Meta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { key: 'template_d_menos_3', label: 'D-3 (Lembrete)', color: 'blue' },
                        { key: 'template_d_zero', label: 'D-0 (Vencimento)', color: 'amber' },
                        { key: 'template_d_mais_1', label: 'D+1 (Atraso)', color: 'orange' },
                        { key: 'template_d_mais_2', label: 'D+2 (Atraso)', color: 'red' },
                        { key: 'template_d_mais_15', label: 'D+15 (Pendência)', color: 'purple' },
                        { key: 'template_d_mais_30', label: 'D+30 (Cancelamento)', color: 'red' },
                      ].map((tmpl) => (
                        <div key={tmpl.key} className="flex items-center gap-4 border-b pb-3 last:border-0 last:pb-0">
                          <div className="min-w-[150px]">
                            <Badge className={`bg-${tmpl.color}-500/20 text-${tmpl.color}-400`}>
                              {tmpl.label}
                            </Badge>
                          </div>
                          <Select 
                            value={hasMetaTemplate(config[tmpl.key]) ? config[tmpl.key] : 'none'} 
                            onValueChange={(val) => setConfig({...config, [tmpl.key]: val})}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione o template" />
                            </SelectTrigger>
                            <SelectContent>
                              {validMetaTemplates.length > 0 ? (
                                <>
                                  <SelectItem value="none">Nenhum</SelectItem>
                                  {validMetaTemplates.map(t => (
                                    <SelectItem key={t.id || getMetaTemplateName(t)} value={getMetaTemplateName(t)}>{getMetaTemplateName(t)}</SelectItem>
                                  ))}
                                </>
                              ) : (
                                <SelectItem value="none" disabled>Sincronize primeiro</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/40">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4 text-primary" />
                        Mapeamento de Variáveis (Meta)
                      </h4>
                       <p className="text-xs text-muted-foreground mb-4">
                        Escolha o que enviar em cada variável {"{{1}}, {{2}}"}, etc. do template. 
                        <strong>Dica:</strong> Para não enviar nada em uma variável, selecione "Vazio (Nenhum)".
                      </p>
                      
                      <div className="space-y-4 mb-6">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-400">
                          <p><strong>Configuração:</strong> Mapeie abaixo quais dados do cliente devem preencher as variáveis do seu template da Meta.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <div key={num} className="space-y-2 p-3 bg-background/50 rounded-md border border-border/30">
                              <Label className="text-xs flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <code className="bg-muted px-1.5 py-0.5 rounded text-primary">{"{{"}{num}{"}}"}</code>
                                  Variável {num}
                                </div>
                                <Select 
                                  value={config[`meta_var_${num}_target`] || 'body'}
                                  onValueChange={(val) => setConfig({...config, [`meta_var_${num}_target`]: val})}
                                >
                                  <SelectTrigger className="h-6 w-[100px] text-[10px] bg-transparent border-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="body">Corpo</SelectItem>
                                    <SelectItem value="header">Cabeçalho</SelectItem>
                                    <SelectItem value="button_1">Botão 1</SelectItem>
                                    <SelectItem value="button_2">Botão 2</SelectItem>
                                  </SelectContent>
                                </Select>
                              </Label>
                              <Select 
                                value={config[`meta_var_${num}_field`] || 'none'}
                                onValueChange={(val) => setConfig({...config, [`meta_var_${num}_field`]: val})}
                              >
                                <SelectTrigger className="h-8 text-[11px]">
                                  <SelectValue placeholder="Selecione o dado" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nome">Nome do Cliente</SelectItem>
                                  <SelectItem value="valor">Valor da Cobrança</SelectItem>
                                  <SelectItem value="data_renovacao">Data de Vencimento</SelectItem>
                                  <SelectItem value="link_pagamento">Link de Pagamento (MP/Stripe)</SelectItem>
                                  <SelectItem value="produto">Nome do Produto</SelectItem>
                                  <SelectItem value="plano">Nome do Plano</SelectItem>
                                  <SelectItem value="cpf">CPF/CNPJ</SelectItem>
                                  <SelectItem value="email">E-mail</SelectItem>
                                  <SelectItem value="none">Vazio (Nenhum)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border/40">
                      <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                        <Send className="w-4 h-4 text-primary" />
                        Envio de Teste (Oficial)
                      </h4>
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1">
                          <Input 
                            placeholder="Número (Ex: 5511999999999)"
                            id="test_phone_official"
                            className="h-10"
                          />
                        </div>
                        <Select onValueChange={(v) => {
                          const el = document.getElementById('test_template_official_val') as HTMLInputElement;
                          if (el) el.value = v;
                        }}>
                          <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Selecione o template" />
                          </SelectTrigger>
                          <SelectContent>
                            {validMetaTemplates.length > 0 ? (
                              validMetaTemplates.map(tmpl => (
                                <SelectItem key={tmpl.id || getMetaTemplateName(tmpl)} value={getMetaTemplateName(tmpl)}>
                                  {getMetaTemplateLanguage(tmpl) ? `${getMetaTemplateName(tmpl)} (${getMetaTemplateLanguage(tmpl)})` : getMetaTemplateName(tmpl)}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>Sincronize primeiro</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <input type="hidden" id="test_template_official_val" />
                        <Button 
                          variant="secondary"
                          onClick={async () => {
                            const phone = (document.getElementById('test_phone_official') as HTMLInputElement)?.value;
                            const template = (document.getElementById('test_template_official_val') as HTMLInputElement)?.value;
                            
                            if (!phone) {
                              toast({ title: "Erro", description: "Informe o número", variant: "destructive" });
                              return;
                            }
                            if (!template || template.startsWith('none_')) {
                              toast({ title: "Erro", description: "Selecione um template configurado", variant: "destructive" });
                              return;
                            }

                            try {
                              const { data, error } = await supabase.functions.invoke('billing-cron', {
                                body: { 
                                  isTest: true,
                                  phone,
                                  templateName: template,
                                  clienteTeste: {
                                    nome: "Cliente Teste",
                                    valor: 150.00,
                                    produto: "Produto Teste",
                                    link: "https://teste.com/pagamento"
                                  }
                                }
                              });
                              if (error) throw error;
                              toast({ title: "Sucesso", description: "Mensagem de teste enviada!" });
                            } catch (err: any) {
                              toast({ title: "Erro ao enviar teste", description: err.message, variant: "destructive" });
                            }
                          }}
                          className="gap-2"
                        >
                          <Send className="w-4 h-4" /> Enviar Teste
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-400" />
                    Instâncias WhatsApp (Evolution API)
                  </CardTitle>
                  <CardDescription>
                    Gerencie múltiplas instâncias para rotação de envio (exclusivas para cobrança)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      placeholder="Nome da instância"
                      value={newInstance.instance_name}
                      onChange={(e) => setNewInstance({ ...newInstance, instance_name: e.target.value })}
                    />
                    <Input
                      placeholder="URL da API"
                      value={newInstance.api_url}
                      onChange={(e) => setNewInstance({ ...newInstance, api_url: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="API Key"
                      value={newInstance.api_key}
                      onChange={(e) => setNewInstance({ ...newInstance, api_key: e.target.value })}
                    />
                    <Button onClick={addWhatsAppInstance} disabled={isAddingInstance}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  {whatsappInstances.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Instância</TableHead>
                            <TableHead className="hidden sm:table-cell">URL</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {whatsappInstances.map((inst) => (
                            <TableRow key={inst.id}>
                              <TableCell className="font-medium">{inst.instance_name}</TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground truncate max-w-[200px]">{inst.api_url}</TableCell>
                              <TableCell>
                                <Badge className={inst.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}>
                                  {inst.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => toggleInstanceStatus(inst.id, inst.is_active)}>
                                    <Power className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => deleteInstance(inst.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-emerald-500 to-green-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Canais'}
              </Button>
            </div>
          </TabsContent>
          )}

          {/* Mensagens Tab */}
          {canViewCobrancaMensagens() && (
          <TabsContent value="messages" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Templates de Mensagens</CardTitle>
                <CardDescription>
                  {config.whatsapp_provider === 'official' 
                    ? 'Selecione os templates da Meta para cada evento de cobrança. Os templates devem seguir o mapeamento de variáveis {{1}} a {{4}}.' 
                    : 'Usados quando a IA está desativada. Variáveis: {nome}, {produto}, {plano}, {valor}, {data_renovacao}'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-background to-muted/30 border mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.whatsapp_provider === 'official' ? 'bg-primary/20' : 'bg-emerald-500/20'}`}>
                      {config.whatsapp_provider === 'official' ? <Sparkles className="w-5 h-5 text-primary" /> : <MessageSquare className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div>
                      <p className="font-semibold">Provedor de WhatsApp</p>
                      <p className="text-sm text-muted-foreground">
                        {config.whatsapp_provider === 'official' ? 'Usando API Oficial (Templates)' : 'Usando Evolution API (Texto Livre)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Evolution</Label>
                    <Switch
                      checked={config.whatsapp_provider === 'official'}
                      onCheckedChange={(checked) => setConfig({ ...config, whatsapp_provider: checked ? 'official' : 'evolution' })}
                    />
                    <Label className="text-xs text-primary font-medium">Oficial (Meta)</Label>
                  </div>
                </div>

                {[
                  { key: 'message_d_menos_3', templateKey: 'template_d_menos_3', label: 'D-3', desc: 'Lembrete (3 dias antes)', color: 'blue' },
                  { key: 'message_d_zero', templateKey: 'template_d_zero', label: 'D', desc: 'Dia do Vencimento', color: 'amber' },
                  { key: 'message_d_mais_1', templateKey: 'template_d_mais_1', label: 'D+1', desc: '1º Aviso', color: 'orange' },
                  { key: 'message_d_mais_2', templateKey: 'template_d_mais_2', label: 'D+2', desc: '2º Aviso', color: 'red' },
                  { key: 'message_d_mais_15', templateKey: 'template_d_mais_15', label: 'D+15', desc: 'Aviso de Pendência', color: 'purple' },
                  { key: 'message_d_mais_30', templateKey: 'template_d_mais_30', label: 'D+30', desc: 'Aviso Final', color: 'red' },
                ].map((msg) => (
                  <div key={msg.key} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Badge className={`bg-${msg.color}-500/20 text-${msg.color}-400 border-${msg.color}-500/30`}>
                          {msg.label}
                        </Badge>
                        {msg.desc}
                      </Label>
                    </div>
                    
                    {config.whatsapp_provider === 'official' ? (
                      <div className="space-y-2">
                        <Select
                          value={hasMetaTemplate(config[msg.templateKey]) ? config[msg.templateKey] : 'none'}
                          onValueChange={(v) => setConfig({ ...config, [msg.templateKey]: v })}
                        >
                          <SelectTrigger className="font-mono">
                            <SelectValue placeholder="Selecione o template aprovado" />
                          </SelectTrigger>
                          <SelectContent>
                            {validMetaTemplates.length > 0 && <SelectItem value="none">Nenhum</SelectItem>}
                            {validMetaTemplates.map((t) => (
                              <SelectItem key={t.id || getMetaTemplateName(t)} value={getMetaTemplateName(t)}>
                                {getMetaTemplateName(t)}
                              </SelectItem>
                            ))}
                            {validMetaTemplates.length === 0 && (
                              <SelectItem value="none" disabled>Sincronize primeiro</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Certifique-se de que o template possui as 4 variáveis padrão: {'{{1}}'}, {'{{2}}'}, {'{{3}}'}, {'{{4}}'}.
                        </p>
                      </div>
                    ) : (
                      <Textarea
                        value={config[msg.key] || defaultMessages[msg.key] || ''}
                        onChange={(e) => setConfig({ ...config, [msg.key]: e.target.value })}
                        className="min-h-[80px]"
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-emerald-500 to-green-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Mensagens'}
              </Button>
            </div>
          </TabsContent>
          )}

          {/* Relatórios Tab */}
          {canViewCobrancaRelatorios() && (
          <TabsContent value="reports" className="space-y-6">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  const stats = {
                    totalEnviados: logs.length,
                    totalErros: logs.filter(l => l.status === 'error').length,
                    taxaSucesso: logs.length ? ((logs.filter(l => l.status === 'sent').length / logs.length) * 100) : 0,
                    porCanal: {
                      email: logs.filter(l => l.channel === 'email').length,
                      whatsapp: logs.filter(l => l.channel === 'whatsapp').length,
                    },
                    porTipo: {},
                  };
                  const today = new Date();
                  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  exportBillingReportPDF(logs, stats, {
                    start: thirtyDaysAgo.toLocaleDateString('pt-BR'),
                    end: today.toLocaleDateString('pt-BR'),
                  });
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Envios por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar dataKey="sent" name="Sucesso" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Por Canal</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={channelStats} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {channelStats.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#3b82f6' : '#22c55e'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Por Tipo de Mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={typeStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar dataKey="sent" name="Sucesso" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          )}

          {/* Logs Tab - Enhanced */}
          {canViewCobrancaLogs() && (
          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente, email ou telefone..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="sent">Sucesso</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="skipped">Pulado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={logChannelFilter} onValueChange={setLogChannelFilter}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Canal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Canais</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="sistema">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Tipos</SelectItem>
                        <SelectItem value="d_menos_3">D-3</SelectItem>
                        <SelectItem value="d_zero">D</SelectItem>
                        <SelectItem value="d_mais_1">D+1</SelectItem>
                        <SelectItem value="d_mais_2">D+2</SelectItem>
                        <SelectItem value="d_mais_15">D+15</SelectItem>
                        <SelectItem value="d_mais_30">D+30</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={logDateFilter} onValueChange={setLogDateFilter}>
                      <SelectTrigger className="w-[140px]">
                        <Calendar className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="7days">Últimos 7 dias</SelectItem>
                        <SelectItem value="30days">Últimos 30 dias</SelectItem>
                        <SelectItem value="90days">Últimos 90 dias</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Summary */}
            {(() => {
              const filteredLogs = logs.filter(log => {
                const matchesSearch = logSearchQuery === '' || 
                  log.cliente_nome.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                  log.cliente_email?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                  log.cliente_numero?.includes(logSearchQuery);
                const matchesStatus = logStatusFilter === 'all' || log.status === logStatusFilter;
                const matchesChannel = logChannelFilter === 'all' || log.channel === logChannelFilter;
                const matchesType = logTypeFilter === 'all' || log.message_type === logTypeFilter;
                
                let matchesDate = true;
                if (logDateFilter !== 'all') {
                  const logDate = new Date(log.sent_at);
                  const now = new Date();
                  let startDate: Date;
                  switch (logDateFilter) {
                    case 'today':
                      startDate = new Date(now.setHours(0, 0, 0, 0));
                      break;
                    case '7days':
                      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      break;
                    case '30days':
                      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      break;
                    case '90days':
                      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                      break;
                    default:
                      startDate = new Date(0);
                  }
                  matchesDate = logDate >= startDate;
                }
                
                return matchesSearch && matchesStatus && matchesChannel && matchesType && matchesDate;
              });

              const logStats = {
                total: filteredLogs.length,
                sent: filteredLogs.filter(l => l.status === 'sent').length,
                errors: filteredLogs.filter(l => l.status === 'error').length,
                pending: filteredLogs.filter(l => l.status === 'pending').length,
              };

              const exportLogsToCSV = () => {
                const headers = ['Data/Hora', 'Cliente', 'Email', 'Telefone', 'Tipo', 'Canal', 'Status', 'Erro'];
                const rows = filteredLogs.map(log => [
                  new Date(log.sent_at).toLocaleString('pt-BR'),
                  log.cliente_nome,
                  log.cliente_email || '',
                  log.cliente_numero || '',
                  getMessageTypeLabel(log.message_type),
                  log.channel,
                  log.status,
                  log.error_message || ''
                ]);

                const csvContent = [
                  headers.join(','),
                  ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `logs-cobranca-${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              };

              return (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Filtrados</p>
                            <p className="text-2xl font-bold">{logStats.total}</p>
                          </div>
                          <History className="w-6 h-6 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Sucesso</p>
                            <p className="text-2xl font-bold text-emerald-400">{logStats.sent}</p>
                          </div>
                          <CheckCircle className="w-6 h-6 text-emerald-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Erros</p>
                            <p className="text-2xl font-bold text-red-400">{logStats.errors}</p>
                          </div>
                          <XCircle className="w-6 h-6 text-red-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Pendentes</p>
                            <p className="text-2xl font-bold text-amber-400">{logStats.pending}</p>
                          </div>
                          <AlertCircle className="w-6 h-6 text-amber-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Export Button */}
                  <div className="flex justify-end">
                    <Button onClick={exportLogsToCSV} variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                      <Send className="w-4 h-4 mr-2" />
                      Exportar CSV ({logStats.total})
                    </Button>
                  </div>

                  {/* Logs Table */}
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-amber-400" />
                        Histórico de Envios
                      </CardTitle>
                      <CardDescription>
                        Mostrando {Math.min(filteredLogs.length, 200)} de {filteredLogs.length} registros
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border overflow-x-auto max-h-[500px] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                              <TableHead className="w-[160px]">Data/Hora</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="hidden md:table-cell">Contato</TableHead>
                              <TableHead className="w-[80px]">Tipo</TableHead>
                              <TableHead className="w-[100px]">Canal</TableHead>
                              <TableHead className="w-[100px]">Status</TableHead>
                              <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
                              <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLogs.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  Nenhum registro encontrado com os filtros aplicados
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredLogs.slice(0, 200).map((log) => (
                                <TableRow key={log.id} className="hover:bg-muted/30">
                                  <TableCell className="font-mono text-sm text-muted-foreground">
                                    {new Date(log.sent_at).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{log.cliente_nome}</div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                    {log.channel === 'email' ? log.cliente_email : log.cliente_numero}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {getMessageTypeLabel(log.message_type)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{getChannelBadge(log.channel)}</TableCell>
                                  <TableCell>{getStatusBadge(log.status, log.resolution)}</TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    {log.resolution ? (
                                      <span className="text-sm text-emerald-400" title={log.resolution_note || ''}>
                                        ✅ {log.resolution === 'reenviado_manual' ? 'Reenviado manualmente' : log.resolution === 'erro_numero' ? 'Erro de número' : log.resolution === 'erro_sistema' ? 'Erro do sistema' : log.resolution === 'sem_dados' ? 'Sem dados' : log.resolution === 'ignorar' ? 'Ignorado' : log.resolution}
                                      </span>
                                    ) : log.error_message ? (
                                      <span className="text-sm text-red-400 truncate max-w-[200px] block" title={log.error_message}>
                                        {log.error_message.substring(0, 50)}{log.error_message.length > 50 ? '...' : ''}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {log.status === 'error' && !log.resolution && (
                                        <Button
                                          onClick={() => handleRetryLog(log)}
                                          variant="outline"
                                          size="sm"
                                          disabled={retryingLogId === log.id}
                                          className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                        >
                                          {retryingLogId === log.id ? (
                                            <>
                                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                              Processando...
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="h-3 w-3 mr-1" />
                                              Reenviar
                                            </>
                                          )}
                                        </Button>
                                      )}
                                      {(log.status === 'skipped' || log.status === 'error') && !log.resolution && (
                                        <Button
                                          onClick={() => {
                                            setResolvingLogId(log.id);
                                            setResolutionType(log.status === 'error' ? 'erro_sistema' : 'erro_numero');
                                            setResolutionNote('');
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className={`text-xs ${log.status === 'error' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}`}
                                        >
                                          Resolver
                                        </Button>
                                      )}
                                      {log.resolution && (
                                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                          Resolvido
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>
          )}

          {/* Recibo Tab */}
          {canViewCobrancaRecibo() && (
          <TabsContent value="receipt" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status do Recibo */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    Emissão de Recibo
                  </CardTitle>
                  <CardDescription>
                    Configure o envio automático de recibos quando um pagamento for confirmado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-background to-muted/30 border">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.receipt_enabled === 'true' ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                        <FileText className={`w-5 h-5 ${config.receipt_enabled === 'true' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-semibold">Recibo Automático</p>
                        <p className="text-sm text-muted-foreground">
                          {config.receipt_enabled === 'true' ? 'Recibo será enviado ao confirmar pagamento' : 'Recibo desativado'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={config.receipt_enabled === 'true'}
                      onCheckedChange={(checked) => setConfig({ ...config, receipt_enabled: checked ? 'true' : 'false' })}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-500/5 to-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.receipt_email_enabled === 'true' ? 'bg-blue-500/20' : 'bg-muted'}`}>
                          <Mail className={`w-5 h-5 ${config.receipt_email_enabled === 'true' ? 'text-blue-400' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">Enviar por Email</p>
                          <p className="text-sm text-muted-foreground">
                            Usa as credenciais Gmail já configuradas
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={config.receipt_email_enabled === 'true'}
                        onCheckedChange={(checked) => setConfig({ ...config, receipt_email_enabled: checked ? 'true' : 'false' })}
                        disabled={config.receipt_enabled !== 'true'}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-green-500/5 to-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.receipt_whatsapp_enabled === 'true' ? 'bg-green-500/20' : 'bg-muted'}`}>
                          <Phone className={`w-5 h-5 ${config.receipt_whatsapp_enabled === 'true' ? 'text-green-400' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">Enviar por WhatsApp</p>
                          <p className="text-sm text-muted-foreground">
                            {config.whatsapp_provider === 'official' ? 'Usa a API Oficial da Meta' : 'Usa a instância Evolution ativa'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={config.receipt_whatsapp_enabled === 'true'}
                        onCheckedChange={(checked) => setConfig({ ...config, receipt_whatsapp_enabled: checked ? 'true' : 'false' })}
                        disabled={config.receipt_enabled !== 'true'}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-400">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      <strong>Como funciona:</strong> Quando você marca um pagamento como "Pago" no sistema, 
                      o recibo é enviado automaticamente por Email e/ou WhatsApp para o cliente.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Variáveis disponíveis */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Variáveis Disponíveis
                  </CardTitle>
                  <CardDescription>
                    Use estas variáveis nos templates de recibo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { var: '{nome}', desc: 'Nome do cliente' },
                      { var: '{email}', desc: 'Email do cliente' },
                      { var: '{cpf}', desc: 'CPF/CNPJ' },
                      { var: '{produto}', desc: 'Produto contratado' },
                      { var: '{plano}', desc: 'Plano do cliente' },
                      { var: '{valor}', desc: 'Valor pago (com moeda)' },
                      { var: '{data_pagamento}', desc: 'Data do pagamento' },
                      { var: '{proxima_renovacao}', desc: 'Próxima renovação' },
                    ].map((item) => (
                      <div key={item.var} className="p-2 rounded-lg bg-muted/50 border">
                        <code className="text-purple-400 font-mono text-xs">{item.var}</code>
                        <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Templates */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Template */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-400" />
                    Template de Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assunto do Email</Label>
                    <Input
                      value={config.receipt_email_subject || 'Recibo de Pagamento - {produto}'}
                      onChange={(e) => setConfig({ ...config, receipt_email_subject: e.target.value })}
                      placeholder="Recibo de Pagamento - {produto}"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Corpo do Email (HTML)</Label>
                    <Textarea
                      value={config.receipt_email_template || ''}
                      onChange={(e) => setConfig({ ...config, receipt_email_template: e.target.value })}
                      placeholder="Template HTML do recibo..."
                      rows={12}
                      className="font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* WhatsApp Template */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-400" />
                    Template de WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mensagem do Recibo</Label>
                    <Textarea
                      value={config.receipt_whatsapp_template || ''}
                      onChange={(e) => setConfig({ ...config, receipt_whatsapp_template: e.target.value })}
                      placeholder="Template da mensagem de recibo..."
                      rows={15}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use *texto* para negrito no WhatsApp
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="min-w-[150px]">
                {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </TabsContent>
          )}

          {/* Baserow Tab */}
          {canViewCobrancaConfig() && (
          <TabsContent value="baserow" className="space-y-6">
            <BillingBaserowConfig />
          </TabsContent>
          )}
        </Tabs>

        {/* Resolution Dialog */}
        <Dialog
          open={!!resolvingLogId}
          onOpenChange={(open) => {
            if (!open) {
              setResolvingLogId(null);
              setResolutionType('erro_numero');
              setResolutionNote('');
            }
          }}
        >
          <DialogContent className="bg-card border-border max-w-md sm:max-w-lg">
            {(() => {
              const currentLog = logs.find(l => l.id === resolvingLogId);
              const isError = currentLog?.status === 'error';
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-foreground">
                      {isError ? 'Resolver erro de envio' : 'Resolver cobrança pulada'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      {isError
                        ? 'Explique o que aconteceu para esta cobrança sair da Central de Atenção.'
                        : 'Informe o motivo pelo qual esta cobrança foi pulada'}
                    </DialogDescription>
                  </DialogHeader>
                  {isError && currentLog?.error_message && (
                    <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Mensagem de erro original
                      </p>
                      <p className="text-xs text-destructive/90 break-words leading-relaxed font-mono">
                        {currentLog.error_message}
                      </p>
                    </div>
                  )}
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">Motivo</Label>
                      <Select value={resolutionType} onValueChange={setResolutionType}>
                        <SelectTrigger className="bg-secondary border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-[100] shadow-lg">
                          {isError && (
                            <>
                              <SelectItem value="whatsapp_desconectado">WhatsApp desconectado</SelectItem>
                              <SelectItem value="numero_invalido">Número inválido / não existe no WhatsApp</SelectItem>
                              <SelectItem value="email_invalido">E-mail inválido / inexistente</SelectItem>
                              <SelectItem value="instancia_indisponivel">Instância indisponível</SelectItem>
                              <SelectItem value="reenviado_manual">Reenviado manualmente</SelectItem>
                            </>
                          )}
                          <SelectItem value="erro_numero">Erro de número</SelectItem>
                          <SelectItem value="erro_email">Erro de e-mail</SelectItem>
                          <SelectItem value="erro_sistema">Erro do sistema</SelectItem>
                          <SelectItem value="sem_dados">Sem dados de contato</SelectItem>
                          <SelectItem value="cliente_inativo">Cliente inativo</SelectItem>
                          <SelectItem value="ignorar">Ignorar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">
                        Observação {isError ? '(recomendado)' : '(opcional)'}
                      </Label>
                      <Input
                        placeholder={isError ? 'Ex: WhatsApp ficou offline às 14h, religado depois.' : 'Detalhes adicionais...'}
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleResolveSkipped} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                        Confirmar
                      </Button>
                      <Button
                        onClick={() => {
                          setResolvingLogId(null);
                          setResolutionType('erro_numero');
                          setResolutionNote('');
                        }}
                        variant="outline"
                        className="border-border"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCobranca;
