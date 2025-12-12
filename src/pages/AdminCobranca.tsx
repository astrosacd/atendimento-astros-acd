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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  Search
} from 'lucide-react';

interface BillingConfig {
  cron_hour: string;
  cron_minute: string;
  billing_enabled: string;
  email_enabled: string;
  whatsapp_enabled: string;
  message_d_menos_3: string;
  message_d_zero: string;
  message_d_mais_1: string;
  message_d_mais_2: string;
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

interface GmailConfig {
  gmail_user: string;
  gmail_app_password: string;
}

interface MonthlyStats {
  month: string;
  sent: number;
  errors: number;
}

const defaultConfig: BillingConfig = {
  cron_hour: '10',
  cron_minute: '0',
  billing_enabled: 'false',
  email_enabled: 'true',
  whatsapp_enabled: 'true',
  message_d_menos_3: 'Olá {nome}! Lembramos que sua renovação do plano {plano} - {produto} vence em 3 dias ({data_renovacao}). Valor: R$ {valor}. Não deixe para última hora!',
  message_d_zero: 'Olá {nome}! Hoje é o dia da renovação do seu plano {plano} - {produto}. Valor: R$ {valor}. Entre em contato para renovar!',
  message_d_mais_1: 'Olá {nome}! Sua renovação do plano {plano} - {produto} venceu ontem. Valor: R$ {valor}. Regularize sua situação!',
  message_d_mais_2: 'Olá {nome}! URGENTE: Sua renovação do plano {plano} - {produto} está atrasada há 2 dias. Valor: R$ {valor}. Evite a suspensão do serviço!',
};

const CHART_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

const AdminCobranca = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BillingConfig>(defaultConfig);
  const [gmailConfig, setGmailConfig] = useState<GmailConfig>({ gmail_user: '', gmail_app_password: '' });
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

  useEffect(() => {
    loadConfig();
    loadLogs();
    loadClientes();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data: billingData, error: billingError } = await supabase
        .from('billing_config')
        .select('config_key, config_value');

      if (billingError) throw billingError;

      const loadedConfig: Partial<BillingConfig> = {};
      billingData?.forEach((item) => {
        loadedConfig[item.config_key as keyof BillingConfig] = item.config_value;
      });
      setConfig({ ...defaultConfig, ...loadedConfig });

      const { data: gmailData, error: gmailError } = await supabase
        .from('recovery_config')
        .select('config_key, config_value')
        .in('config_key', ['gmail_user', 'gmail_app_password']);

      if (gmailError) throw gmailError;

      const loadedGmail: Partial<GmailConfig> = {};
      gmailData?.forEach((item) => {
        loadedGmail[item.config_key as keyof GmailConfig] = item.config_value;
      });
      setGmailConfig({ gmail_user: '', gmail_app_password: '', ...loadedGmail });
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

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const total = data?.length || 0;
      const sent = data?.filter(l => l.status === 'sent').length || 0;
      const errors = data?.filter(l => l.status === 'error').length || 0;
      const todayLogs = data?.filter(l => l.sent_at.startsWith(today)).length || 0;

      setStats({ total, sent, errors, today: todayLogs });

      // Calculate monthly stats for last 6 months
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

      // Calculate channel stats
      const emailCount = data?.filter(l => l.channel === 'email').length || 0;
      const whatsappCount = data?.filter(l => l.channel === 'whatsapp').length || 0;
      setChannelStats([
        { name: 'Email', value: emailCount },
        { name: 'WhatsApp', value: whatsappCount },
      ]);

      // Calculate type stats
      const typeData: Record<string, { sent: number; errors: number }> = {
        'd_menos_3': { sent: 0, errors: 0 },
        'd_zero': { sent: 0, errors: 0 },
        'd_mais_1': { sent: 0, errors: 0 },
        'd_mais_2': { sent: 0, errors: 0 },
      };

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
      ]);
    } catch (error: any) {
      console.error('Error loading logs:', error);
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

      for (const [key, value] of Object.entries(gmailConfig)) {
        if (value) {
          await supabase
            .from('recovery_config')
            .upsert({ config_key: key, config_value: value }, { onConflict: 'config_key' });
        }
      }

      toast({
        title: 'Configurações salvas!',
        description: 'Todas as configurações foram atualizadas com sucesso.',
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

  const runBillingManually = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-cron');

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
        description: 'Selecione pelo menos um cliente para enviar cobrança.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-cron', {
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
        title: 'Erro ao enviar cobrança',
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
      'd_menos_3': 'D-3 (Lembrete)',
      'd_zero': 'D (Vencimento)',
      'd_mais_1': 'D+1 (1º Aviso)',
      'd_mais_2': 'D+2 (2º Aviso)',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  };

  const getChannelBadge = (channel: string) => {
    if (channel === 'email') {
      return <Badge variant="outline" className="border-blue-500/30 text-blue-400"><Mail className="w-3 h-3 mr-1" />Email</Badge>;
    }
    return <Badge variant="outline" className="border-green-500/30 text-green-400"><MessageSquare className="w-3 h-3 mr-1" />WhatsApp</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Sistema de Cobrança Automática
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure e gerencie cobranças automáticas por Email e WhatsApp
            </p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                  <Users className="w-4 h-4 mr-2" />
                  Cobrança Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Cobrança Manual Seletiva</DialogTitle>
                  <DialogDescription>
                    Selecione os clientes e o tipo de mensagem para enviar cobranças manualmente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-foreground">Buscar cliente</Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Nome, email ou telefone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-background/50 border-border/50"
                        />
                      </div>
                    </div>
                    <div className="w-48">
                      <Label className="text-foreground">Tipo de mensagem</Label>
                      <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                        <SelectTrigger className="mt-1 bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="d_menos_3">D-3 (Lembrete)</SelectItem>
                          <SelectItem value="d_zero">D (Vencimento)</SelectItem>
                          <SelectItem value="d_mais_1">D+1 (1º Aviso)</SelectItem>
                          <SelectItem value="d_mais_2">D+2 (2º Aviso)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Checkbox
                      checked={selectedClientes.length === filteredClientes.length && filteredClientes.length > 0}
                      onCheckedChange={selectAllClientes}
                    />
                    <span className="text-sm text-foreground">
                      Selecionar todos ({filteredClientes.length})
                    </span>
                    <Badge className="ml-auto bg-purple-500/20 text-purple-400">
                      {selectedClientes.length} selecionado(s)
                    </Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto border border-border/50 rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="text-foreground">Nome</TableHead>
                          <TableHead className="text-foreground">Email</TableHead>
                          <TableHead className="text-foreground">Telefone</TableHead>
                          <TableHead className="text-foreground">Produto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClientes.map((cliente) => (
                          <TableRow 
                            key={cliente.id} 
                            className="hover:bg-muted/20 cursor-pointer"
                            onClick={() => toggleClienteSelection(cliente.id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedClientes.includes(cliente.id)}
                                onCheckedChange={() => toggleClienteSelection(cliente.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{cliente.nome}</TableCell>
                            <TableCell className="text-muted-foreground">{cliente.email}</TableCell>
                            <TableCell className="text-muted-foreground">{cliente.numero}</TableCell>
                            <TableCell className="text-muted-foreground">{cliente.produto}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    <Button variant="outline" onClick={() => setIsManualDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={sendManualBilling}
                      disabled={isSendingManual || selectedClientes.length === 0}
                      className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
                    >
                      <Send className={`w-4 h-4 mr-2 ${isSendingManual ? 'animate-pulse' : ''}`} />
                      {isSendingManual ? 'Enviando...' : `Enviar para ${selectedClientes.length} cliente(s)`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={loadLogs}
              disabled={isLoading}
              className="border-border/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              onClick={runBillingManually}
              disabled={isRunning || config.billing_enabled !== 'true'}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              <Play className={`w-4 h-4 mr-2 ${isRunning ? 'animate-pulse' : ''}`} />
              {isRunning ? 'Executando...' : 'Executar Agora'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Enviados</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Send className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.sent}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Erros</p>
                  <p className="text-2xl font-bold text-red-400">{stats.errors}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/20">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hoje</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.today}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <Calendar className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="bg-card/50 border border-border/50 p-1">
            <TabsTrigger value="config" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageSquare className="w-4 h-4 mr-2" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Relatórios
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Configurações Tab */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Agendamento do Cron
                  </CardTitle>
                  <CardDescription>
                    Configure o horário de execução diária
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.billing_enabled === 'true' ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                        <AlertCircle className={`w-5 h-5 ${config.billing_enabled === 'true' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Sistema de Cobrança</p>
                        <p className="text-sm text-muted-foreground">
                          {config.billing_enabled === 'true' ? 'Ativo e funcionando' : 'Desativado'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={config.billing_enabled === 'true'}
                      onCheckedChange={(checked) => setConfig({ ...config, billing_enabled: checked ? 'true' : 'false' })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Hora</Label>
                      <Select
                        value={config.cron_hour}
                        onValueChange={(value) => setConfig({ ...config, cron_hour: value })}
                      >
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder="Hora" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Minuto</Label>
                      <Select
                        value={config.cron_minute}
                        onValueChange={(value) => setConfig({ ...config, cron_minute: value })}
                      >
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder="Minuto" />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 15, 30, 45].map((m) => (
                            <SelectItem key={m} value={m.toString()}>
                              {m.toString().padStart(2, '0')} min
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-400">
                      <Clock className="w-4 h-4 inline mr-2" />
                      Execução programada: todos os dias às {config.cron_hour.padStart(2, '0')}:{config.cron_minute.padStart(2, '0')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Send className="w-5 h-5 text-blue-400" />
                    Canais de Envio
                  </CardTitle>
                  <CardDescription>
                    Ative ou desative os canais de comunicação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.email_enabled === 'true' ? 'bg-blue-500/20' : 'bg-muted'}`}>
                        <Mail className={`w-5 h-5 ${config.email_enabled === 'true' ? 'text-blue-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Email</p>
                        <p className="text-sm text-muted-foreground">Enviar cobranças por email</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.email_enabled === 'true'}
                      onCheckedChange={(checked) => setConfig({ ...config, email_enabled: checked ? 'true' : 'false' })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.whatsapp_enabled === 'true' ? 'bg-green-500/20' : 'bg-muted'}`}>
                        <MessageSquare className={`w-5 h-5 ${config.whatsapp_enabled === 'true' ? 'text-green-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">WhatsApp</p>
                        <p className="text-sm text-muted-foreground">Enviar cobranças via Evolution API</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.whatsapp_enabled === 'true'}
                      onCheckedChange={(checked) => setConfig({ ...config, whatsapp_enabled: checked ? 'true' : 'false' })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Mail className="w-5 h-5 text-blue-400" />
                    Configurações de Email (Gmail)
                  </CardTitle>
                  <CardDescription>
                    Configure as credenciais do Gmail para envio de emails
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Email do Gmail</Label>
                    <Input
                      type="email"
                      placeholder="seu-email@gmail.com"
                      value={gmailConfig.gmail_user}
                      onChange={(e) => setGmailConfig({ ...gmailConfig, gmail_user: e.target.value })}
                      className="bg-background/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Senha de App do Gmail</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={gmailConfig.gmail_app_password}
                      onChange={(e) => setGmailConfig({ ...gmailConfig, gmail_app_password: e.target.value })}
                      className="bg-background/50 border-border/50"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={saveConfig}
                disabled={isSaving}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
              >
                <Save className={`w-4 h-4 mr-2 ${isSaving ? 'animate-pulse' : ''}`} />
                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </TabsContent>

          {/* Mensagens Tab */}
          <TabsContent value="messages" className="space-y-6">
            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Templates de Mensagens</CardTitle>
                <CardDescription>
                  Personalize as mensagens para cada tipo de cobrança. Use as variáveis: {'{nome}'}, {'{produto}'}, {'{plano}'}, {'{valor}'}, {'{data_renovacao}'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-foreground">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">D-3</Badge>
                    Lembrete (3 dias antes)
                  </Label>
                  <Textarea
                    value={config.message_d_menos_3}
                    onChange={(e) => setConfig({ ...config, message_d_menos_3: e.target.value })}
                    className="min-h-[100px] bg-background/50 border-border/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-foreground">
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">D</Badge>
                    Dia do Vencimento
                  </Label>
                  <Textarea
                    value={config.message_d_zero}
                    onChange={(e) => setConfig({ ...config, message_d_zero: e.target.value })}
                    className="min-h-[100px] bg-background/50 border-border/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-foreground">
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">D+1</Badge>
                    1º Aviso (1 dia após)
                  </Label>
                  <Textarea
                    value={config.message_d_mais_1}
                    onChange={(e) => setConfig({ ...config, message_d_mais_1: e.target.value })}
                    className="min-h-[100px] bg-background/50 border-border/50"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-foreground">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">D+2</Badge>
                    2º Aviso (2 dias após)
                  </Label>
                  <Textarea
                    value={config.message_d_mais_2}
                    onChange={(e) => setConfig({ ...config, message_d_mais_2: e.target.value })}
                    className="min-h-[100px] bg-background/50 border-border/50"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={saveConfig}
                disabled={isSaving}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
              >
                <Save className={`w-4 h-4 mr-2 ${isSaving ? 'animate-pulse' : ''}`} />
                {isSaving ? 'Salvando...' : 'Salvar Mensagens'}
              </Button>
            </div>
          </TabsContent>

          {/* Relatórios Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Barras - Mensal */}
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    Envios por Mês
                  </CardTitle>
                  <CardDescription>
                    Histórico de sucesso e erros nos últimos 6 meses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Bar dataKey="sent" name="Sucesso" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Pizza - Canais */}
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Send className="w-5 h-5 text-purple-400" />
                    Distribuição por Canal
                  </CardTitle>
                  <CardDescription>
                    Proporção de envios por Email vs WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={channelStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {channelStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#22c55e'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Barras - Por Tipo */}
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    Envios por Tipo de Mensagem
                  </CardTitle>
                  <CardDescription>
                    Comparação entre D-3, D, D+1 e D+2
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Bar dataKey="sent" name="Sucesso" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="logs">
            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Histórico de Envios</CardTitle>
                <CardDescription>
                  Últimos 500 envios de cobrança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-foreground">Cliente</TableHead>
                        <TableHead className="text-foreground">Contato</TableHead>
                        <TableHead className="text-foreground">Tipo</TableHead>
                        <TableHead className="text-foreground">Canal</TableHead>
                        <TableHead className="text-foreground">Status</TableHead>
                        <TableHead className="text-foreground">Data/Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum registro de cobrança encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.slice(0, 100).map((log) => (
                          <TableRow key={log.id} className="hover:bg-muted/20">
                            <TableCell className="font-medium text-foreground">{log.cliente_nome}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {log.channel === 'email' ? log.cliente_email : log.cliente_numero}
                            </TableCell>
                            <TableCell>{getMessageTypeLabel(log.message_type)}</TableCell>
                            <TableCell>{getChannelBadge(log.channel)}</TableCell>
                            <TableCell>
                              {getStatusBadge(log.status)}
                              {log.error_message && (
                                <p className="text-xs text-red-400 mt-1">{log.error_message}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(log.sent_at).toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminCobranca;
