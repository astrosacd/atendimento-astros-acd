import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, Search, Edit, Trash2, Users, Settings, ChevronRight, TrendingUp, 
  Calendar, Webhook, DollarSign, Clock, AlertTriangle, TrendingDown, 
  Bell, Download, FileText, Database, MessageSquare, Loader2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';

// Mapping of billing cycles to months
const CICLO_MESES: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

interface ClienteStats {
  totalClientes: number;
  pendingUsers: number;
  activeWebhooks: number;
  totalValor: number;
  renovacoesProximas: number;
  clientesPorMes: { mes: string; quantidade: number }[];
  clientesPorPlano: { plano: string; quantidade: number }[];
  // New metrics
  inadimplentes: number;
  taxaInadimplencia: number;
  mrr: number; // Monthly Recurring Revenue (normalized) in BRL
  mrrUsd: number; // Monthly Recurring Revenue (normalized) in USD
  previsaoFaturamento: number;
  clientesNovos30d: number;
  billingSuccess: number;
  billingErrors: number;
  // Chamados
  chamadosAbertos: number;
  chamadosEmAndamento: number;
}

interface CustomRole {
  name: string;
  display_name: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userRole, isAdmin, isApproved } = useAuth();
  const { isSupported, permission, requestPermission } = useNotifications();
  const [roleDisplayName, setRoleDisplayName] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [stats, setStats] = useState<ClienteStats>({
    totalClientes: 0,
    pendingUsers: 0,
    activeWebhooks: 0,
    totalValor: 0,
    renovacoesProximas: 0,
    clientesPorMes: [],
    clientesPorPlano: [],
    inadimplentes: 0,
    taxaInadimplencia: 0,
    mrr: 0,
    mrrUsd: 0,
    previsaoFaturamento: 0,
    clientesNovos30d: 0,
    billingSuccess: 0,
    billingErrors: 0,
    chamadosAbertos: 0,
    chamadosEmAndamento: 0,
  });

  useEffect(() => {
    if (user && !isApproved) {
      navigate('/auth');
    }
  }, [user, isApproved, navigate]);

  // Fetch role display name
  useEffect(() => {
    const fetchRoleDisplayName = async () => {
      if (!userRole) return;
      
      const { data } = await supabase
        .from('custom_roles')
        .select('display_name')
        .eq('name', userRole)
        .maybeSingle();
      
      if (data) {
        setRoleDisplayName(data.display_name);
      } else {
        const fallbackNames: Record<string, string> = {
          admin: 'Administrador',
          user: 'Visualizador',
          operador: 'Operador',
          gerente: 'Gerente',
        };
        setRoleDisplayName(fallbackNames[userRole] || userRole);
      }
    };
    
    fetchRoleDisplayName();
  }, [userRole]);

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch all clients for stats
      const { data: clientes } = await supabase
        .from('clientes')
        .select('*');

      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate total value
      const totalValor = clientes?.reduce((acc, c) => acc + (c.valor || 0), 0) || 0;

      // Calculate upcoming renewals (next 7 days)
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const renovacoesProximas = clientes?.filter(c => {
        const renovacao = new Date(c.data_renovacao);
        return renovacao >= today && renovacao <= nextWeek;
      }).length || 0;

      // Calculate overdue clients (inadimplentes)
      const inadimplentes = clientes?.filter(c => {
        const renovacao = new Date(c.data_renovacao);
        return renovacao < today;
      }).length || 0;

      // Calculate delinquency rate
      const taxaInadimplencia = clientes?.length ? (inadimplentes / clientes.length) * 100 : 0;

      // Calculate MRR (Monthly Recurring Revenue) - normalized by billing cycle
      // Separate by currency
      const mrrBrl = clientes?.reduce((acc, c) => {
        if (c.moeda === 'USD') return acc;
        const ciclo = c.ciclo_cobranca || 'mensal';
        const meses = CICLO_MESES[ciclo] || 1;
        return acc + ((c.valor || 0) / meses);
      }, 0) || 0;

      const mrrUsd = clientes?.reduce((acc, c) => {
        if (c.moeda !== 'USD') return acc;
        const ciclo = c.ciclo_cobranca || 'mensal';
        const meses = CICLO_MESES[ciclo] || 1;
        return acc + ((c.valor || 0) / meses);
      }, 0) || 0;

      // Revenue forecast (clients renewing in next 30 days)
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const previsaoFaturamento = clientes?.filter(c => {
        const renovacao = new Date(c.data_renovacao);
        return renovacao >= today && renovacao <= nextMonth;
      }).reduce((acc, c) => acc + (c.valor || 0), 0) || 0;

      // New clients in last 30 days
      const clientesNovos30d = clientes?.filter(c => {
        const created = new Date(c.created_at);
        return created >= thirtyDaysAgo;
      }).length || 0;

      // Group by month for chart
      const clientesPorMes = getClientesPorMes(clientes || []);

      // Group by plan for pie chart
      const clientesPorPlano = getClientesPorPlano(clientes || []);

      // Fetch pending users count (admin only)
      let pendingCount = 0;
      let webhookCount = 0;
      let billingSuccess = 0;
      let billingErrors = 0;
      let chamadosAbertos = 0;
      let chamadosEmAndamento = 0;

      if (isAdmin) {
        const { count: pending } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending');
        pendingCount = pending || 0;

        const { count: webhooks } = await supabase
          .from('webhooks')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        webhookCount = webhooks || 0;

        // Billing stats from last 30 days
        const { data: billingLogs } = await supabase
          .from('billing_logs')
          .select('status')
          .gte('sent_at', thirtyDaysAgo.toISOString());

        billingSuccess = billingLogs?.filter(l => l.status === 'sent').length || 0;
        billingErrors = billingLogs?.filter(l => l.status === 'error').length || 0;

        // Chamados stats
        const { count: abertos } = await supabase
          .from('chamados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aberto');
        chamadosAbertos = abertos || 0;

        const { count: emAndamento } = await supabase
          .from('chamados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'em_andamento');
        chamadosEmAndamento = emAndamento || 0;
      }

      setStats({
        totalClientes: clientes?.length || 0,
        pendingUsers: pendingCount,
        activeWebhooks: webhookCount,
        totalValor,
        renovacoesProximas,
        clientesPorMes,
        clientesPorPlano,
        inadimplentes,
        taxaInadimplencia,
        mrr: mrrBrl,
        mrrUsd,
        previsaoFaturamento,
        clientesNovos30d,
        billingSuccess,
        billingErrors,
        chamadosAbertos,
        chamadosEmAndamento,
      });
    };

    if (user) fetchStats();
  }, [user, isAdmin]);

  const getClientesPorMes = (clientes: any[]) => {
    const meses: { [key: string]: number } = {};
    const mesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    clientes.forEach(c => {
      const date = new Date(c.created_at);
      const mesKey = `${mesNomes[date.getMonth()]}`;
      meses[mesKey] = (meses[mesKey] || 0) + 1;
    });

    const result: { mes: string; quantidade: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mes = mesNomes[date.getMonth()];
      result.push({ mes, quantidade: meses[mes] || 0 });
    }
    return result;
  };

  const getClientesPorPlano = (clientes: any[]) => {
    const planos: { [key: string]: number } = {};
    clientes.forEach(c => {
      const plano = c.plano || 'Sem plano';
      planos[plano] = (planos[plano] || 0) + 1;
    });
    return Object.entries(planos).map(([plano, quantidade]) => ({ plano, quantidade }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({
        title: 'Notificações ativadas!',
        description: 'Você receberá alertas de novos usuários e erros.',
      });
    } else {
      toast({
        title: 'Notificações bloqueadas',
        description: 'Permita notificações nas configurações do navegador.',
        variant: 'destructive',
      });
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-data');
      
      if (error) throw error;

      // Create and download the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup realizado!',
        description: 'O arquivo foi baixado com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro no backup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const COLORS = ['hsl(152, 76%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(271, 81%, 56%)', 'hsl(38, 92%, 50%)'];

  const clientActions = [
    {
      title: 'Cadastrar',
      description: 'Adicionar novo cliente ao sistema',
      icon: UserPlus,
      path: '/cadastrar',
      adminOnly: true,
      color: 'from-primary to-primary/80',
      glow: 'glow-green',
    },
    {
      title: 'Consultar',
      description: 'Buscar e visualizar clientes',
      icon: Search,
      path: '/consultar',
      adminOnly: false,
      color: 'from-info to-info/80',
      glow: 'glow-blue',
    },
    {
      title: 'Atualizar',
      description: 'Editar informações de clientes',
      icon: Edit,
      path: '/atualizar',
      adminOnly: true,
      color: 'from-update to-update/80',
      glow: 'glow-violet',
    },
    {
      title: 'Excluir',
      description: 'Remover cliente do sistema',
      icon: Trash2,
      path: '/excluir',
      adminOnly: true,
      color: 'from-destructive to-destructive/80',
      glow: 'glow-red',
    },
  ];

  const adminActions = [
    { title: 'Gerenciar Usuários', description: 'Criar, editar e gerenciar acessos', icon: Users, path: '/usuarios' },
    { title: 'Webhooks', description: 'Integrações e automações', icon: Webhook, path: '/admin/webhooks' },
    { title: 'Configurações', description: 'Recuperação de senha e mais', icon: Settings, path: '/admin' },
  ];

  const visibleClientActions = clientActions.filter(item => isAdmin || !item.adminOnly);

  const billingData = [
    { name: 'Sucesso', value: stats.billingSuccess, fill: 'hsl(152, 76%, 45%)' },
    { name: 'Erros', value: stats.billingErrors, fill: 'hsl(0, 84%, 60%)' },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display text-gradient">
              Bem-vindo de volta!
            </h1>
            <p className="text-muted-foreground mt-1">
              {user?.email} • <span className="text-primary font-medium">{roleDisplayName || 'Carregando...'}</span>
            </p>
          </div>
          
          {isAdmin && (
            <div className="flex items-center gap-2">
              {isSupported && permission !== 'granted' && (
                <Button variant="outline" size="sm" onClick={handleEnableNotifications}>
                  <Bell className="h-4 w-4 mr-2" />
                  Ativar Notificações
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleBackup} disabled={isBackingUp}>
                <Database className="h-4 w-4 mr-2" />
                {isBackingUp ? 'Baixando...' : 'Backup'}
              </Button>
            </div>
          )}
        </div>

        {/* Primary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground font-display">{stats.totalClientes}</p>
                  <p className="text-xs text-muted-foreground">Clientes Cadastrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20 hover:border-info/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-info/20 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground font-display">{formatCurrency(stats.mrr)}</p>
                  <p className="text-xs text-muted-foreground">MRR (Reais)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground font-display">{formatCurrencyUsd(stats.mrrUsd)}</p>
                  <p className="text-xs text-muted-foreground">MRR (Dólar)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-update/10 to-update/5 border-update/20 hover:border-update/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-update/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-update" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground font-display">{stats.renovacoesProximas}</p>
                  <p className="text-xs text-muted-foreground">Renovações (7 dias)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground font-display">{stats.inadimplentes}</p>
                  <p className="text-xs text-muted-foreground">Inadimplentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chamados Cards - Admin Only */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card 
              className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40 transition-colors cursor-pointer group"
              onClick={() => navigate('/admin/chamados')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-foreground font-display">{stats.chamadosAbertos}</p>
                      <p className="text-xs text-muted-foreground">Chamados Abertos</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40 transition-colors cursor-pointer group"
              onClick={() => navigate('/admin/chamados')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-cyan-500" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-foreground font-display">{stats.chamadosEmAndamento}</p>
                      <p className="text-xs text-muted-foreground">Chamados Em Andamento</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Secondary Stats - Admin Only */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">{stats.taxaInadimplencia.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Taxa Inadimplência</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">{formatCurrency(stats.previsaoFaturamento)}</p>
                <p className="text-xs text-muted-foreground">Previsão 30 dias</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">{stats.clientesNovos30d}</p>
                <p className="text-xs text-muted-foreground">Novos (30 dias)</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">{stats.pendingUsers}</p>
                <p className="text-xs text-muted-foreground">Usuários Pendentes</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">{stats.activeWebhooks}</p>
                <p className="text-xs text-muted-foreground">Webhooks Ativos</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row - Admin Only */}
        {isAdmin && stats.clientesPorMes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Cadastros por Mês - Area Chart melhorado */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                    Cadastros por Mês
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    Últimos 6 meses
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.clientesPorMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorQtd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" vertical={false} />
                      <XAxis 
                        dataKey="mes" 
                        stroke="hsl(220, 10%, 55%)" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="hsl(220, 10%, 55%)" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(220, 18%, 12%)', 
                          border: '1px solid hsl(152, 76%, 35%)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                        labelStyle={{ color: 'hsl(0, 0%, 98%)', fontWeight: 'bold', marginBottom: '4px' }}
                        itemStyle={{ color: 'hsl(152, 76%, 55%)' }}
                        formatter={(value: number) => [`${value} clientes`, 'Cadastros']}
                        cursor={{ stroke: 'hsl(152, 76%, 45%)', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="quantidade" 
                        stroke="hsl(152, 76%, 45%)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorQtd)"
                        dot={{ fill: 'hsl(152, 76%, 45%)', strokeWidth: 2, r: 4, stroke: 'hsl(220, 18%, 8%)' }}
                        activeDot={{ r: 6, stroke: 'hsl(152, 76%, 45%)', strokeWidth: 2, fill: 'hsl(220, 18%, 8%)' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Total: {stats.clientesPorMes.reduce((acc, item) => acc + item.quantidade, 0)} cadastros</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clientes por Plano - Pie Chart melhorado */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-info animate-pulse" />
                    Clientes por Plano
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    {stats.clientesPorPlano.reduce((acc, item) => acc + item.quantidade, 0)} clientes
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {stats.clientesPorPlano.map((_, index) => (
                          <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={1}/>
                            <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.7}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={stats.clientesPorPlano}
                        dataKey="quantidade"
                        nameKey="plano"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={3}
                        stroke="hsl(220, 18%, 8%)"
                        strokeWidth={2}
                      >
                        {stats.clientesPorPlano.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={`url(#pieGradient-${index})`} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(220, 18%, 12%)', 
                          border: '1px solid hsl(217, 91%, 50%)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                          color: 'hsl(0, 0%, 98%)'
                        }}
                        labelStyle={{ color: 'hsl(0, 0%, 98%)' }}
                        itemStyle={{ color: 'hsl(0, 0%, 98%)' }}
                        formatter={(value: number, name: string) => [`${value} clientes`, name || 'Sem plano']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legenda customizada */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2">
                  {stats.clientesPorPlano.map((item, index) => (
                    <div key={item.plano} className="flex items-center gap-1.5 text-xs">
                      <div 
                        className="h-3 w-3 rounded-sm" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">
                        {item.plano} <span className="text-foreground font-medium">({item.quantidade})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cobranças - Bar Chart melhorado */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-warning animate-pulse" />
                    Cobranças (30 dias)
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    {stats.billingSuccess + stats.billingErrors} total
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={billingData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="successGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(152, 76%, 35%)" />
                          <stop offset="100%" stopColor="hsl(152, 76%, 50%)" />
                        </linearGradient>
                        <linearGradient id="errorGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(0, 84%, 50%)" />
                          <stop offset="100%" stopColor="hsl(0, 84%, 65%)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" horizontal={false} />
                      <XAxis 
                        type="number" 
                        stroke="hsl(220, 10%, 55%)" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="hsl(220, 10%, 55%)" 
                        fontSize={11} 
                        width={55}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(220, 18%, 12%)', 
                          border: '1px solid hsl(38, 92%, 50%)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                        formatter={(value: number, name: string) => [`${value} cobranças`, '']}
                        cursor={{ fill: 'hsl(220, 15%, 15%)' }}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 8, 8, 0]}
                        barSize={28}
                      >
                        {billingData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? 'url(#successGradient)' : 'url(#errorGradient)'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
                    <p className="text-2xl font-bold text-primary">{stats.billingSuccess}</p>
                    <p className="text-xs text-muted-foreground">Enviadas com sucesso</p>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
                    <p className="text-2xl font-bold text-destructive">{stats.billingErrors}</p>
                    <p className="text-xs text-muted-foreground">Falhas no envio</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Client Actions */}
        <section className="mb-10">
          <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 font-display">
            <span className="h-6 w-1.5 bg-primary rounded-full"></span>
            Gestão de Clientes
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleClientActions.map((item) => (
              <Card 
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`group cursor-pointer border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${item.glow}`}
              >
                <CardContent className="p-6">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <item.icon className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors font-display">
                    {item.title}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Admin Actions */}
        {isAdmin && (
          <section>
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 font-display">
              <span className="h-6 w-1.5 bg-warning rounded-full"></span>
              Administração
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {adminActions.map((item) => (
                <Card 
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="group cursor-pointer border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-xl transition-all duration-300"
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors font-display">
                          {item.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
