import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  CreditCard,
  QrCode,
  Link2,
  FileText,
  Download
} from 'lucide-react';

interface BillingConfig {
  [key: string]: string;
}

interface BillingLog {
  id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_numero: string;
  message_type: string;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string;
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
  totalValue: number;
  previousTotalValue: number;
  projectedValue: number;
  clientsWithPending: number;
  avgResponseTime: number;
}

const defaultMessages: Record<string, string> = {
  message_d_menos_3: 'Olá {nome}! Lembramos que sua renovação do plano {plano} - {produto} vence em 3 dias ({data_renovacao}). Valor: R$ {valor}. Não deixe para última hora!',
  message_d_zero: 'Olá {nome}! Hoje é o dia da renovação do seu plano {plano} - {produto}. Valor: R$ {valor}. Escolha a melhor forma de pagamento:',
  message_d_mais_1: 'Olá {nome}! Sua renovação do plano {plano} - {produto} venceu ontem. Valor: R$ {valor}. Regularize sua situação!',
  message_d_mais_2: 'Olá {nome}! URGENTE: Sua renovação do plano {plano} - {produto} está atrasada há 2 dias. Valor: R$ {valor}. Evite a suspensão do serviço!',
  message_d_mais_15: 'Olá {nome}! Sua renovação do plano {plano} - {produto} está pendente há 15 dias. Valor: R$ {valor}. Entre em contato para regularizar!',
  message_d_mais_30: 'Olá {nome}! ATENÇÃO: Sua renovação do plano {plano} - {produto} está pendente há 30 dias. Valor: R$ {valor}. Regularize para evitar o cancelamento do serviço!',
};

const CHART_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const AdminCobranca = () => {
  const { toast } = useToast();
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
  
  // Log filters
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');
  const [logChannelFilter, setLogChannelFilter] = useState<string>('all');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [logDateFilter, setLogDateFilter] = useState<string>('7days');
  const [metrics, setMetrics] = useState<MetricsData>({
    successRate: 0,
    previousSuccessRate: 0,
    totalValue: 0,
    previousTotalValue: 0,
    projectedValue: 0,
    clientsWithPending: 0,
    avgResponseTime: 0,
  });
  const [paymentStats, setPaymentStats] = useState<{
    total: number;
    paid: number;
    pending: number;
    rejected: number;
    totalPaid: number;
    totalPending: number;
  } | null>(null);
  const [dbCronSchedule, setDbCronSchedule] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<{ date: string; count: number; success: number; errors: number } | null>(null);
  const [nextExecution, setNextExecution] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadLogs();
    loadClientes();
    loadWhatsAppInstances();
    loadMetrics();
    loadPaymentStats();
    loadDbCronSchedule();
    loadLastExecution();
  }, []);

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
      }
    } catch (error) {
      console.error('Erro ao carregar última execução:', error);
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

      const { data: allClientes } = await supabase
        .from('clientes')
        .select('id, valor, data_renovacao');

      // Calculate metrics
      const currentSent = currentLogs?.filter(l => l.status === 'sent').length || 0;
      const currentTotal = currentLogs?.length || 1;
      const currentSuccessRate = (currentSent / currentTotal) * 100;

      const previousSent = previousLogs?.filter(l => l.status === 'sent').length || 0;
      const previousTotal = previousLogs?.length || 1;
      const previousSuccessRate = (previousSent / previousTotal) * 100;

      // Total value from clients
      const totalValue = allClientes?.reduce((sum, c) => sum + (c.valor || 0), 0) || 0;

      // Clients with pending (overdue)
      const today = new Date().toISOString().split('T')[0];
      const clientsWithPending = allClientes?.filter(c => c.data_renovacao < today).length || 0;

      // Projected value (clients renewing this month)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const projectedValue = allClientes?.filter(c => 
        c.data_renovacao >= today && c.data_renovacao <= endOfMonth
      ).reduce((sum, c) => sum + (c.valor || 0), 0) || 0;

      setMetrics({
        successRate: currentSuccessRate,
        previousSuccessRate: previousSuccessRate,
        totalValue: totalValue,
        previousTotalValue: totalValue * 0.95, // Approximate
        projectedValue: projectedValue,
        clientsWithPending: clientsWithPending,
        avgResponseTime: 2.5, // Placeholder
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

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.numero.includes(searchQuery)
  );

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

  const getStatusBadge = (status: string) => {
    if (status === 'sent') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />OK</Badge>;
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
                  Sistema de Cobrança Automática
                </h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Gerencie cobranças por Email e WhatsApp com IA
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
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Cobrança Manual Seletiva</DialogTitle>
                    <DialogDescription>
                      Selecione clientes específicos para enviar cobranças.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
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
                      <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                        <SelectTrigger className="w-full sm:w-48">
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
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead className="hidden md:table-cell">Telefone</TableHead>
                            <TableHead className="hidden lg:table-cell">Produto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClientes.map((cliente) => (
                            <TableRow key={cliente.id} className="cursor-pointer" onClick={() => toggleClienteSelection(cliente.id)}>
                              <TableCell>
                                <Checkbox checked={selectedClientes.includes(cliente.id)} />
                              </TableCell>
                              <TableCell className="font-medium">{cliente.nome}</TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground">{cliente.email}</TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">{cliente.numero}</TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground">{cliente.produto}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button variant="outline" onClick={() => setIsManualDialogOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={sendManualBilling}
                        disabled={isSendingManual || selectedClientes.length === 0}
                        className="bg-gradient-to-r from-purple-500 to-violet-600"
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
            { label: 'Total Enviados', value: stats.total, icon: Send, color: 'blue' },
            { label: 'Sucesso', value: stats.sent, icon: CheckCircle, color: 'emerald' },
            { label: 'Erros', value: stats.errors, icon: XCircle, color: 'red' },
            { label: 'Hoje', value: stats.today, icon: Calendar, color: 'amber' },
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

        <Tabs defaultValue="metrics" className="space-y-6">
          <TabsList className="bg-card/50 border border-border/50 p-1 flex-wrap h-auto">
            <TabsTrigger value="metrics"><TrendingUp className="w-4 h-4 mr-2" />Métricas</TabsTrigger>
            <TabsTrigger value="config"><Settings className="w-4 h-4 mr-2" />Geral</TabsTrigger>
            <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-2" />Pagamentos</TabsTrigger>
            <TabsTrigger value="ai"><Bot className="w-4 h-4 mr-2" />IA</TabsTrigger>
            <TabsTrigger value="channels"><MessageSquare className="w-4 h-4 mr-2" />Canais</TabsTrigger>
            <TabsTrigger value="messages"><Edit className="w-4 h-4 mr-2" />Mensagens</TabsTrigger>
            <TabsTrigger value="reports"><BarChart3 className="w-4 h-4 mr-2" />Relatórios</TabsTrigger>
            <TabsTrigger value="logs"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
          </TabsList>

          {/* Métricas Dashboard Tab */}
          <TabsContent value="metrics" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

              {/* Valor Total */}
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Valor Total (Carteira)</p>
                      <p className="text-3xl font-bold text-blue-400">
                        R$ {metrics.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {clientes.length} clientes ativos
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <DollarSign className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Previsão do Mês */}
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Previsão do Mês</p>
                      <p className="text-3xl font-bold text-purple-400">
                        R$ {metrics.projectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Renovações previstas
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/20">
                      <TrendingUp className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pendentes */}
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Clientes Inadimplentes</p>
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
            </div>

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

          {/* Configurações Gerais */}
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
                  
                  {/* Última e Próxima Execução */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
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

          {/* Pagamentos Tab (Mercado Pago) */}
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

              {/* PIX Config */}
              <Card className="border-border/50">
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
                  Verifica automaticamente o status dos pagamentos no Mercado Pago
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
                      <p className="text-xs text-muted-foreground">R$ {paymentStats.totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-xl font-bold text-amber-400">{paymentStats.pending}</p>
                      <p className="text-xs text-muted-foreground">R$ {paymentStats.totalPending.toFixed(2)}</p>
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
                  Consulta a API do Mercado Pago para atualizar o status de pagamentos pendentes
                </p>
              </CardContent>
            </Card>

            {/* Pending Payments List */}
            <PendingPaymentsList onPaymentUpdated={loadPaymentStats} />

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-blue-500 to-blue-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Pagamentos'}
              </Button>
            </div>
          </TabsContent>

          {/* IA Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Geração de Mensagens com IA
                </CardTitle>
                <CardDescription>
                  Configure uma IA para gerar mensagens personalizadas automaticamente
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

          {/* Canais Tab */}
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
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <span>Enviar por WhatsApp</span>
                    <Switch
                      checked={config.whatsapp_enabled === 'true'}
                      onCheckedChange={(c) => setConfig({ ...config, whatsapp_enabled: c ? 'true' : 'false' })}
                    />
                  </div>
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
                </CardContent>
              </Card>
            </div>

            {/* WhatsApp Instances */}
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

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={isSaving} className="bg-gradient-to-r from-emerald-500 to-green-600">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Canais'}
              </Button>
            </div>
          </TabsContent>

          {/* Mensagens Tab */}
          <TabsContent value="messages" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Templates de Mensagens</CardTitle>
                <CardDescription>
                  Usados quando a IA está desativada. Variáveis: {'{nome}'}, {'{produto}'}, {'{plano}'}, {'{valor}'}, {'{data_renovacao}'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { key: 'message_d_menos_3', label: 'D-3', desc: 'Lembrete (3 dias antes)', color: 'blue' },
                  { key: 'message_d_zero', label: 'D', desc: 'Dia do Vencimento', color: 'amber' },
                  { key: 'message_d_mais_1', label: 'D+1', desc: '1º Aviso', color: 'orange' },
                  { key: 'message_d_mais_2', label: 'D+2', desc: '2º Aviso', color: 'red' },
                  { key: 'message_d_mais_15', label: 'D+15', desc: 'Aviso de Pendência', color: 'purple' },
                  { key: 'message_d_mais_30', label: 'D+30', desc: 'Aviso Final', color: 'red' },
                ].map((msg) => (
                  <div key={msg.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Badge className={`bg-${msg.color}-500/20 text-${msg.color}-400 border-${msg.color}-500/30`}>
                        {msg.label}
                      </Badge>
                      {msg.desc}
                    </Label>
                    <Textarea
                      value={config[msg.key] || defaultMessages[msg.key] || ''}
                      onChange={(e) => setConfig({ ...config, [msg.key]: e.target.value })}
                      className="min-h-[80px]"
                    />
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

          {/* Relatórios Tab */}
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

          {/* Logs Tab - Enhanced */}
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
                              <TableHead className="hidden lg:table-cell">Erro</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLogs.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
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
                                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    {log.error_message ? (
                                      <span className="text-sm text-red-400 truncate max-w-[200px] block" title={log.error_message}>
                                        {log.error_message.substring(0, 50)}...
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminCobranca;
