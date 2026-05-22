import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, Settings, ChevronRight, TrendingUp, 
  Webhook, DollarSign, Clock, AlertTriangle, 
  Bell, Database, MessageSquare, Loader2, ListTodo, CheckCircle2, AlertCircle,
  ShieldCheck,
  Wallet, Phone, Headphones, ThumbsUp, User, Instagram
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { useClientTasks, ClientTask } from '@/hooks/useClientTasks';
import { usePermissions } from '@/hooks/usePermissions';
import { NumerosAquecimentoSection } from '@/components/dashboard/NumerosAquecimentoSection';
import { ConsultaNumerosSection } from '@/components/dashboard/ConsultaNumerosSection';
import { MonthlyPurchasesCard } from '@/components/dashboard/MonthlyPurchasesCard';
import { ProposalsStatsCard } from '@/components/dashboard/ProposalsStatsCard';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { DespesasSummaryCard } from '@/components/dashboard/DespesasSummaryCard';
import { FollowupsChart } from '@/components/followups/FollowupsChart';
import { useFollowups } from '@/hooks/useFollowups';
import { Badge } from '@/components/ui/badge';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivityCard } from '@/components/dashboard/RecentActivityCard';
import { ConversionFunnelCard } from '@/components/dashboard/ConversionFunnelCard';
import { RevenueGoalCard } from '@/components/dashboard/RevenueGoalCard';
import { ChurnRateCard } from '@/components/dashboard/ChurnRateCard';
import { RevenueByCurrencyCard } from '@/components/dashboard/RevenueByCurrencyCard';
import { SystemHealthCard } from '@/components/dashboard/SystemHealthCard';
import { LigacoesAgendadasCard } from '@/components/dashboard/LigacoesAgendadasCard';
import { AlertsCenter } from '@/components/dashboard/sections/AlertsCenter';
import { AnaliseAvancadaSection } from '@/components/dashboard/sections/AnaliseAvancadaSection';

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
  clientesRecorrentes: number; // Clients with cobranca_ativa = true
  clientesRegistro: number; // Clients with cobranca_ativa = false
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
  previsaoFaturamentoUsd: number;
  clientesNovos30d: number;
  billingSuccess: number;
  billingErrors: number;
  // Chamados
  chamadosAbertos: number;
  chamadosEmAndamento: number;
  chamadosAguardandoCliente: number;
  // Tasks
  tarefasPendentes: number;
  tarefasEmAndamento: number;
  tarefasAtrasadas: number;
  tarefasConcluidas: number;
  // Vendas Únicas (clientes registro)
  vendasUnicasBrl: number;
  vendasUnicasUsd: number;
  clientesRegistroSemValor: number;
  recuperacaoPendentes: number;
  billingSkipped: number;
  billingErrorsUnresolved: number;
  churnRate: number;
    instagramTokenExpiring: boolean;
    instagramTokenExpiryDate: string | null;
    pagamentosPendentes: number;
    offlineIntegrations: number;
    criticalQuotas: number;
  }

// Removed unused interface

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, userRole, isAdmin, isApproved } = useAuth();
  const { isSupported, permission, requestPermission } = useNotifications();
  const { canManageTasks, canViewChamados, canViewProposalsDashboard, canViewDespesas, canViewPaymentSecurity, hasPermission } = usePermissions();
  const { getTaskStats, getUrgentTasks } = useClientTasks();
  const canViewClients = hasPermission('view_clients');
  const canViewCharts = hasPermission('view_dashboard_charts');
  const { followups } = useFollowups();
  const [roleDisplayName, setRoleDisplayName] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [urgentTasks, setUrgentTasks] = useState<{ overdue: ClientTask[]; dueSoon: ClientTask[] }>({ overdue: [], dueSoon: [] });
  const [alertsShown, setAlertsShown] = useState(false);
  const [stats, setStats] = useState<ClienteStats>({
    totalClientes: 0,
    clientesRecorrentes: 0,
    clientesRegistro: 0,
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
    previsaoFaturamentoUsd: 0,
    clientesNovos30d: 0,
    billingSuccess: 0,
    billingErrors: 0,
    chamadosAbertos: 0,
    chamadosEmAndamento: 0,
    chamadosAguardandoCliente: 0,
    tarefasPendentes: 0,
    tarefasEmAndamento: 0,
    tarefasAtrasadas: 0,
    tarefasConcluidas: 0,
    vendasUnicasBrl: 0,
    vendasUnicasUsd: 0,
    clientesRegistroSemValor: 0,
    recuperacaoPendentes: 0,
    billingSkipped: 0,
    billingErrorsUnresolved: 0,
    churnRate: 0,
    instagramTokenExpiring: false,
    instagramTokenExpiryDate: null,
    pagamentosPendentes: 0,
    offlineIntegrations: 0,
    criticalQuotas: 0,
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
    let isMounted = true;
    
    const fetchStats = async () => {
      // Fetch all clients for stats
      const { data: allClientes } = await supabase
        .from('clientes')
        .select('*');

      // Filter out clients marked to be excluded from metrics
      const clientes = allClientes?.filter(c => !c.excluir_metricas) || [];

      // Fetch purchase history for registro clients
      const { data: purchases } = await supabase
        .from('client_purchases')
        .select('valor, moeda, cliente_id');

      if (!isMounted) return;

      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate total value
      const totalValor = clientes?.reduce((acc, c) => acc + (c.valor || 0), 0) || 0;

      // Calculate upcoming renewals (next 7 days) - timezone-safe string comparison
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const nextWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;
      const renovacoesProximas = clientes?.filter(c => {
        if (!c.data_renovacao) return false;
        // Apenas clientes recorrentes (cobrança ativa) — registros não renovam
        if (c.cobranca_ativa !== true) return false;
        // data_renovacao is stored as 'YYYY-MM-DD' string; compare lexicographically (timezone-safe)
        const renovacaoStr = String(c.data_renovacao).slice(0, 10);
        return renovacaoStr >= todayStr && renovacaoStr <= nextWeekStr;
      }).length || 0;

      // Count recurrent vs registration clients (only count registro clients with value > 0)
      const clientesRecorrentes = clientes?.filter(c => c.cobranca_ativa === true).length || 0;
      const clientesRegistroComValor = clientes?.filter(c => c.cobranca_ativa === false && (c.valor || 0) > 0) || [];
      const clientesRegistroSemValor = clientes?.filter(c => c.cobranca_ativa === false && (c.valor || 0) === 0).length || 0;
      const clientesRegistro = clientesRegistroComValor.length;

      // Calculate single sales (vendas únicas) from registration clients WITH value > 0 + purchase history
      const vendasClientesBrl = clientesRegistroComValor
        .filter(c => (c.moeda || 'BRL') === 'BRL')
        .reduce((acc, c) => acc + (c.valor || 0), 0);
      const vendasClientesUsd = clientesRegistroComValor
        .filter(c => c.moeda === 'USD')
        .reduce((acc, c) => acc + (c.valor || 0), 0);

      // Add purchase history totals
      const purchasesBrl = purchases?.filter(p => (p.moeda || 'BRL') === 'BRL')
        .reduce((acc, p) => acc + (p.valor || 0), 0) || 0;
      const purchasesUsd = purchases?.filter(p => p.moeda === 'USD')
        .reduce((acc, p) => acc + (p.valor || 0), 0) || 0;

      const vendasUnicasBrl = vendasClientesBrl + purchasesBrl;
      const vendasUnicasUsd = vendasClientesUsd + purchasesUsd;

      // Calculate overdue clients (inadimplentes) - exclude "Cliente Registro" (cobranca_ativa = false)
      const inadimplentes = clientes?.filter(c => {
        // Skip clients that have billing disabled (Cliente Registro)
        if (!c.cobranca_ativa || !c.data_renovacao) return false;
        
        // Use string comparison to be timezone-safe and avoid counting "today" as overdue
        const renovacaoStr = String(c.data_renovacao).slice(0, 10);
        return renovacaoStr < todayStr;
      }).length || 0;

      // Calculate delinquency rate (based on recurrent clients only)
      const taxaInadimplencia = clientesRecorrentes > 0 ? (inadimplentes / clientesRecorrentes) * 100 : 0;

      // Calculate MRR (Monthly Recurring Revenue) - normalized by billing cycle
      // Separate by currency - only from clients with future renewal (or up to 7 days overdue)
      const toleranciaDias = 7;
      const dataLimiteMrr = new Date(today);
      dataLimiteMrr.setHours(0, 0, 0, 0);
      dataLimiteMrr.setDate(dataLimiteMrr.getDate() - toleranciaDias);

      const clientesAtivosMRR = clientes?.filter(c => {
        if (!c.cobranca_ativa) return false;
        const renovacao = new Date(c.data_renovacao);
        return renovacao >= dataLimiteMrr;
      }) || [];

      const mrrBrl = clientesAtivosMRR.reduce((acc, c) => {
        if (c.moeda === 'USD') return acc;
        const ciclo = c.ciclo_cobranca || 'mensal';
        const meses = CICLO_MESES[ciclo] || 1;
        return acc + ((c.valor || 0) / meses);
      }, 0);

      const mrrUsd = clientesAtivosMRR.reduce((acc, c) => {
        if (c.moeda !== 'USD') return acc;
        const ciclo = c.ciclo_cobranca || 'mensal';
        const meses = CICLO_MESES[ciclo] || 1;
        return acc + ((c.valor || 0) / meses);
      }, 0);

      // Revenue forecast (clients renewing in next 30 days) - separated by currency
      const nextMonthDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDate.getDate()).padStart(2, '0')}`;
      
      const clientesRenovando30d = clientes?.filter(c => {
        if (!c.data_renovacao) return false;
        const renovacaoStr = String(c.data_renovacao).slice(0, 10);
        return renovacaoStr >= todayStr && renovacaoStr <= nextMonthStr;
      }) || [];

      const previsaoFaturamento = clientesRenovando30d
        .filter(c => (c.moeda || 'BRL') === 'BRL')
        .reduce((acc, c) => acc + (c.valor || 0), 0);

      const previsaoFaturamentoUsd = clientesRenovando30d
        .filter(c => c.moeda === 'USD')
        .reduce((acc, c) => acc + (c.valor || 0), 0);

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
      let chamadosAguardandoCliente = 0;
      let tarefasPendentes = 0;
      let tarefasEmAndamento = 0;
      let tarefasAtrasadas = 0;
      let tarefasConcluidas = 0;
      let recoveryPending = 0;
      let billingSkippedCount = 0;
      let billingErrorsUnresolvedCount = 0;
      let churnRate = 0;

      let instagramTokenExpiring = false;
      let instagramTokenExpiryDate = null;
      let pagamentosPendentes = 0;

      let offlineIntegrations = 0;
      let criticalQuotasCount = 0;

      if (hasPermission('manage_system_health')) {
        // Fetch System Health status
        const { data: statusData } = await supabase.from('integration_status').select('status');
        offlineIntegrations = statusData?.filter(s => s.status === 'offline').length || 0;

        const { data: quotasData } = await supabase.from('api_quotas').select('current_value, max_value, alert_threshold');
        criticalQuotasCount = quotasData?.filter(q => {
          const percentage = q.max_value ? (q.current_value / q.max_value) * 100 : 0;
          return percentage > (100 - (q.alert_threshold || 20));
        }).length || 0;
      }

      if (isAdmin) {

        // Check Instagram token status
        const { data: igSettings } = await supabase
          .from('instagram_settings')
          .select('token_expires_at')
          .limit(1)
          .maybeSingle();

        if (igSettings?.token_expires_at) {
          const expiryDate = new Date(igSettings.token_expires_at);
          const now = new Date();
          const warningThreshold = new Date(now);
          warningThreshold.setDate(now.getDate() + 10); // 10 days warning
          
          if (expiryDate <= warningThreshold) {
            instagramTokenExpiring = true;
            instagramTokenExpiryDate = igSettings.token_expires_at;
          }
        }

        // Calculate Churn Rate (last 30 days) - Customer Centric (Unique CPF/Nome)
        const { data: allHistory } = await supabase
          .from('client_history')
          .select('cliente_id, created_at')
          .eq('action', 'update')
          .contains('changed_fields', ['cobranca_ativa'])
          .gte('created_at', thirtyDaysAgo.toISOString());
        
        // Get unique clients who canceled at least one subscription
        const uniqueCanceledIds = new Set(allHistory?.map(h => h.cliente_id));
        
        // Of those, find who has NO active subscriptions now
        let lostCustomersCount = 0;
        for (const clientId of uniqueCanceledIds) {
          const clientData = clientes?.find(c => c.id === clientId);
          if (clientData) {
            const identifier = clientData.cpf || clientData.nome;
            const hasOtherActive = clientes?.some(c => (c.cpf || c.nome) === identifier && c.cobranca_ativa === true);
            if (!hasOtherActive) {
              lostCustomersCount++;
            }
          }
        }
        
        const uniqueActiveCount = new Set(clientes?.filter(c => c.cobranca_ativa === true).map(c => c.cpf || c.nome)).size;
        churnRate = uniqueActiveCount > 0 ? (lostCustomersCount / (uniqueActiveCount + lostCustomersCount)) * 100 : 0;

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

        // Recovery attempts pending conversion marking (only sent ones, not errors)
        const { count: recPending } = await supabase
          .from('client_recovery_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'sent')
          .is('converteu', null);
        recoveryPending = recPending || 0;

        // Billing skipped (unresolved)
        const { count: skippedC } = await supabase
          .from('billing_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'skipped')
          .is('resolution', null);
        billingSkippedCount = skippedC || 0;

        // Billing errors (unresolved)
        const { count: errorsC } = await supabase
          .from('billing_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'error')
          .is('resolution', null);
        billingErrorsUnresolvedCount = errorsC || 0;

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

        const { count: aguardandoC } = await supabase
          .from('chamados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aguardando_cliente');
        chamadosAguardandoCliente = aguardandoC || 0;

        if (canViewPaymentSecurity()) {
          const { count: pendingPayments } = await supabase
            .from('client_payments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_approval');
          pagamentosPendentes = pendingPayments || 0;
        }
      }

      // Task stats (only for users with task permission)
      if (canManageTasks()) {
        const taskStats = await getTaskStats();
        if (!isMounted) return;
        tarefasPendentes = taskStats.pendentes;
        tarefasEmAndamento = taskStats.em_andamento;
        tarefasAtrasadas = taskStats.atrasadas;
        tarefasConcluidas = taskStats.concluidas;
      }

      if (!isMounted) return;

      setStats({
        totalClientes: clientes?.length || 0,
        clientesRecorrentes,
        clientesRegistro,
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
        previsaoFaturamentoUsd,
        clientesNovos30d,
        billingSuccess,
        billingErrors,
        chamadosAbertos,
        chamadosEmAndamento,
        chamadosAguardandoCliente,
        tarefasPendentes,
        tarefasEmAndamento,
        tarefasAtrasadas,
        tarefasConcluidas,
        vendasUnicasBrl,
        vendasUnicasUsd,
        clientesRegistroSemValor,
        recuperacaoPendentes: recoveryPending || 0,
        billingSkipped: billingSkippedCount,
        billingErrorsUnresolved: billingErrorsUnresolvedCount,
        churnRate,
        instagramTokenExpiring,
        instagramTokenExpiryDate,
        pagamentosPendentes,
        offlineIntegrations,
        criticalQuotas: criticalQuotasCount,
      });
    };

    if (user) fetchStats();

    // Realtime: refetch when billing_logs change (errors arriving / being resolved)
    let billingChannel: ReturnType<typeof supabase.channel> | null = null;
    if (user && isAdmin) {
      billingChannel = supabase
        .channel('dashboard-billing-logs')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'billing_logs' },
          () => {
            if (isMounted) fetchStats();
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (billingChannel) supabase.removeChannel(billingChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  // Fetch urgent tasks and show alerts (only for users with task permission)
  useEffect(() => {
    if (!canManageTasks()) return;
    
    let isMounted = true;
    
    const fetchUrgentTasks = async () => {
      const urgent = await getUrgentTasks();
      
      if (!isMounted) return;
      
      setUrgentTasks(urgent);

      // Show alerts only once per session
      if (!alertsShown && (urgent.overdue.length > 0 || urgent.dueSoon.length > 0)) {
        setAlertsShown(true);
        
        if (urgent.overdue.length > 0) {
          toast({
            title: `⚠️ ${urgent.overdue.length} tarefa(s) atrasada(s)!`,
            description: urgent.overdue.slice(0, 3).map(t => t.title).join(', ') + (urgent.overdue.length > 3 ? '...' : ''),
            variant: 'destructive',
          });
        }
        
        if (urgent.dueSoon.length > 0) {
          setTimeout(() => {
            toast({
              title: `🔔 ${urgent.dueSoon.length} tarefa(s) vencem hoje!`,
              description: urgent.dueSoon.slice(0, 3).map(t => t.title).join(', ') + (urgent.dueSoon.length > 3 ? '...' : ''),
            });
          }, urgent.overdue.length > 0 ? 1500 : 0);
        }
      }
    };

    if (user) fetchUrgentTasks();
    
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, alertsShown]);

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

  const adminActions = [
    { title: t('dashboard.manageUsers'), description: t('dashboard.manageUsersDesc'), icon: Users, path: '/usuarios' },
    { title: t('sidebar.webhooks'), description: t('dashboard.integrations'), icon: Webhook, path: '/admin/webhooks' },
    { title: t('sidebar.settings'), description: t('dashboard.passwordRecoveryAndMore'), icon: Settings, path: '/admin' },
  ];

  const billingData = [
    { name: t('common.success'), value: stats.billingSuccess, fill: 'hsl(152, 76%, 45%)' },
    { name: t('common.error'), value: stats.billingErrors, fill: 'hsl(0, 84%, 60%)' },
  ];

  const failedFollowups = followups.filter(f => f.status === 'failed');

  // Follow-ups sent before today without conversion status
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pendingConversionFollowups = followups.filter(f => {
    const isSentOrCompleted = f.status === 'sent' || f.status === 'completed';
    const hasNoConversion = !f.conversion_status;
    const sentBeforeToday = new Date(f.scheduled_at) < today;
    return isSentOrCompleted && hasNoConversion && sentBeforeToday;
  });

  const priorityAlerts = [
    isAdmin && stats.billingErrorsUnresolved > 0
      ? {
          id: 'billing-errors',
          title: 'Erros de envio pendentes',
          description: `${stats.billingErrorsUnresolved} envio(s) com erro no histórico de cobrança precisam ser tratados.`,
          count: stats.billingErrorsUnresolved,
          onClick: () => navigate('/admin/cobranca?tab=logs&filter=error'),
          tone: 'critical' as const,
          icon: AlertCircle,
          pulse: true,
        }
      : null,
    isAdmin && stats.billingSkipped > 0
      ? {
          id: 'billing-skipped',
          title: 'Cobranças puladas pendentes',
          description: `${stats.billingSkipped} cobrança(s) precisam de análise para sair do dashboard.`,
          count: stats.billingSkipped,
          onClick: () => navigate('/admin/cobranca?tab=logs&filter=skipped'),
          tone: 'critical' as const,
          icon: AlertCircle,
          pulse: true,
        }
      : null,
    isAdmin && stats.recuperacaoPendentes > 0
      ? {
          id: 'billing-recovery',
          title: 'Recuperação aguardando revisão',
          description: `${stats.recuperacaoPendentes} tentativa(s) de recuperação ainda precisam de retorno manual.`,
          count: stats.recuperacaoPendentes,
          onClick: () => navigate('/admin/cobranca?tab=recovery'),
          tone: 'warning' as const,
          icon: AlertTriangle,
          pulse: false,
        }
      : null,
    isAdmin && stats.instagramTokenExpiring
      ? {
          id: 'instagram-token',
          title: 'Token do Instagram Expirando',
          description: `O seu Meta Access Token expira em ${stats.instagramTokenExpiryDate ? new Date(stats.instagramTokenExpiryDate).toLocaleDateString('pt-BR') : 'breve'}. Renove nas configurações do módulo.`,
          onClick: () => navigate('/instagram'),
          tone: 'warning' as const,
          icon: Instagram,
          pulse: true,
        }
      : null,
    hasPermission('manage_system_health') && (stats.offlineIntegrations > 0 || stats.criticalQuotas > 0)
      ? {
          id: 'system-health',
          title: 'Saúde do Sistema com Alertas',
          description: `${stats.offlineIntegrations > 0 ? `${stats.offlineIntegrations} integração(ões) offline. ` : ''}${stats.criticalQuotas > 0 ? `${stats.criticalQuotas} cota(s) crítica(s).` : ''}`,
          count: stats.offlineIntegrations + stats.criticalQuotas,
          onClick: () => navigate('/admin/saude'),
          tone: stats.offlineIntegrations > 0 ? 'critical' as const : 'warning' as const,
          icon: ShieldCheck,
          pulse: true,
        }
      : null,
    failedFollowups.length > 0
      ? {
          id: 'followups-failed',
          title: 'Follow-ups com falha',
          description: `${failedFollowups.length} follow-up(s) falharam e precisam de correção.`,
          count: failedFollowups.length,
          onClick: () => navigate('/followups'),
          tone: 'critical' as const,
          icon: AlertTriangle,
          pulse: true,
        }
      : null,
    pendingConversionFollowups.length > 0
      ? {
          id: 'followups-pending',
          title: 'Conversões aguardando marcação',
          description: `${pendingConversionFollowups.length} follow-up(s) enviados ainda precisam ser marcados.`,
          count: pendingConversionFollowups.length,
          onClick: () => navigate('/followups'),
          tone: 'warning' as const,
          icon: ThumbsUp,
          pulse: false,
        }
      : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));

  const followupStats = {
    total: followups.length,
    pending: followups.filter(f => f.status === 'pending').length,
    sent: followups.filter(f => f.status === 'sent' || f.status === 'completed').length,
    converted: followups.filter(f => f.conversion_status === 'converted').length,
    not_converted: followups.filter(f => f.conversion_status === 'not_converted').length,
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* ===================== HEADER ===================== */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display text-gradient">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {user?.email} • <span className="text-primary font-medium">{roleDisplayName || t('common.loading')}</span>
            </p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {isSupported && permission !== 'granted' && (
                <Button variant="outline" size="sm" onClick={handleEnableNotifications}>
                  <Bell className="h-4 w-4 mr-2" />
                  {t('dashboard.enableNotifications')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleBackup} disabled={isBackingUp}>
                <Database className="h-4 w-4 mr-2" />
                {isBackingUp ? t('common.loading') : t('dashboard.backup')}
              </Button>
            </div>
          )}
        </div>

        {/* ===================== AÇÕES RÁPIDAS ===================== */}
        <QuickActions />

        {/* ===================== CENTRAL DE ALERTAS (unificada) ===================== */}
        <AlertsCenter priorityAlerts={priorityAlerts} />

        {/* ===================== OPERAÇÃO DO DIA ===================== */}
        <section className="mb-8 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Phone className="h-4 w-4 text-cyan-500" />
            Operação do Dia
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LigacoesAgendadasCard />
            {hasPermission('manage_system_health') && <SystemHealthCard />}
          </div>
        </section>

        {/* ===================== FINANCEIRO ===================== */}
        <CollapsibleSection
          title="Financeiro"
          icon={Wallet}
          iconColor="bg-gradient-to-br from-info to-info/80"
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground font-display">{stats.totalClientes}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.totalClients')}</p>
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
                    <p className="text-xs text-muted-foreground">{t('dashboard.mrr')} (BRL)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-gradient-to-br from-update/10 to-update/5 border-update/20 hover:border-update/40 transition-colors cursor-pointer group"
              onClick={() => navigate('/consultar?filter=renovacao-proxima')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-update/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6 text-update" />
                  </div>
                  <div className="flex-1">
                    <p className="text-3xl font-bold text-foreground font-display">{stats.renovacoesProximas}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.upcomingRenewals')} (7d)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer group"
              onClick={() => navigate('/consultar?filter=inadimplente')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-destructive/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-3xl font-bold text-foreground font-display">{stats.inadimplentes}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.overduedClients')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {canViewCharts && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <RevenueGoalCard currentMrr={stats.mrr} />
              <ChurnRateCard churnRate={stats.churnRate} />
              <RevenueByCurrencyCard brl={stats.mrr} usd={stats.mrrUsd} />
              <ConversionFunnelCard />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
            <div className="flex flex-col min-h-0 h-[400px]">
              {canViewClients && canViewCharts && <MonthlyPurchasesCard />}
            </div>
            <div className="flex flex-col min-h-0 h-[400px]">
              <RecentActivityCard />
            </div>
          </div>

          {canViewProposalsDashboard() && canViewCharts && <ProposalsStatsCard />}

          {/* Despesas dentro de Financeiro */}
          {canViewDespesas() && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-4 w-0.5 bg-orange-500 rounded-full"></span>
                Despesas
              </h4>
              <DespesasSummaryCard />
            </div>
          )}

          {/* Follow-ups dentro de Financeiro */}
          {followups.length > 0 && canViewCharts && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-4 w-0.5 bg-blue-500 rounded-full"></span>
                Follow-ups
              </h4>
              <FollowupsChart stats={followupStats} />
            </div>
          )}
        </CollapsibleSection>

        {/* ===================== OPERACIONAL ===================== */}
        <CollapsibleSection
          title="Operacional"
          icon={Phone}
          iconColor="bg-gradient-to-br from-cyan-500 to-cyan-500/80"
          defaultOpen={true}
        >
          <NumerosAquecimentoSection />
          <ConsultaNumerosSection />
        </CollapsibleSection>

        {/* ===================== SUPORTE E GESTÃO ===================== */}
        {(canViewChamados() || canManageTasks()) && (
          <CollapsibleSection
            title="Suporte e Gestão"
            icon={Headphones}
            iconColor="bg-gradient-to-br from-amber-500 to-amber-500/80"
            defaultOpen={true}
            badge={
              (stats.chamadosAbertos + stats.tarefasAtrasadas > 0) ? (
                <Badge variant="destructive" className="ml-2">
                  {stats.chamadosAbertos + stats.tarefasAtrasadas} pendente(s)
                </Badge>
              ) : null
            }
          >
            {canViewChamados() && (
              <>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="h-4 w-0.5 bg-amber-500 rounded-full"></span>
                  {t('sidebar.tickets')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                            <p className="text-xs text-muted-foreground">{t('dashboard.openTickets')}</p>
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
                            <p className="text-xs text-muted-foreground">{t('dashboard.ticketsInProgress')}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:border-purple-500/40 transition-colors cursor-pointer group"
                    onClick={() => navigate('/admin/chamados')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <User className="h-6 w-6 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-foreground font-display">{stats.chamadosAguardandoCliente}</p>
                            <p className="text-xs text-muted-foreground">Aguardando Cliente</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {canViewPaymentSecurity() && stats.pagamentosPendentes > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2 mt-6">
                      <span className="h-4 w-0.5 bg-destructive rounded-full"></span>
                      Segurança de Pagamento
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card
                        className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer group"
                        onClick={() => navigate('/admin/seguranca-pagamento')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                                <ShieldCheck className="h-6 w-6 text-destructive" />
                              </div>
                              <div>
                                <p className="text-3xl font-bold text-foreground font-display">{stats.pagamentosPendentes}</p>
                                <p className="text-xs text-muted-foreground">Aguardando Aprovação</p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-destructive transition-colors" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </>
            )}

            {canManageTasks() && (
              <>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 mt-6 flex items-center gap-2">
                  <span className="h-4 w-0.5 bg-primary rounded-full"></span>
                  {t('sidebar.tasks')}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <Card
                    className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40 transition-colors cursor-pointer group"
                    onClick={() => navigate('/tarefas')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <ListTodo className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground font-display">{stats.tarefasPendentes}</p>
                          <p className="text-xs text-muted-foreground">{t('dashboard.pendingTasks')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40 transition-colors cursor-pointer group"
                    onClick={() => navigate('/tarefas')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground font-display">{stats.tarefasEmAndamento}</p>
                          <p className="text-xs text-muted-foreground">{t('dashboard.tasksInProgress')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={`bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer group ${stats.tarefasAtrasadas > 0 ? 'animate-pulse' : ''}`}
                    onClick={() => navigate('/tarefas')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground font-display">{stats.tarefasAtrasadas}</p>
                          <p className="text-xs text-muted-foreground">{t('dashboard.overdueTasks')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer group"
                    onClick={() => navigate('/tarefas')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground font-display">{stats.tarefasConcluidas}</p>
                          <p className="text-xs text-muted-foreground">{t('dashboard.completedTasks')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {(urgentTasks.overdue.length > 0 || urgentTasks.dueSoon.length > 0) && (
                  <Card className="bg-gradient-to-br from-destructive/5 to-amber-500/5 border-destructive/30 mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">{t('dashboard.tasksNeedAttention')}</h4>
                          <div className="space-y-2">
                            {urgentTasks.overdue.slice(0, 3).map((task) => (
                              <div key={task.id} className="flex items-center gap-2 text-sm">
                                <span className="h-2 w-2 rounded-full bg-destructive"></span>
                                <span className="text-destructive font-medium">{t('dashboard.overdueLabel')}:</span>
                                <span className="text-muted-foreground">{task.title}</span>
                                {task.cliente_nome && <span className="text-muted-foreground/70">• {task.cliente_nome}</span>}
                              </div>
                            ))}
                            {urgentTasks.dueSoon.slice(0, 3).map((task) => (
                              <div key={task.id} className="flex items-center gap-2 text-sm">
                                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                <span className="text-amber-500 font-medium">{t('dashboard.dueTodayLabel')}:</span>
                                <span className="text-muted-foreground">{task.title}</span>
                                {task.cliente_nome && <span className="text-muted-foreground/70">• {task.cliente_nome}</span>}
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="link"
                            className="p-0 h-auto mt-2 text-primary"
                            onClick={() => navigate('/tarefas')}
                          >
                            {t('dashboard.viewAllTasks')} <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </CollapsibleSection>
        )}

        {/* ===================== ANÁLISE AVANÇADA (admin, fechada) ===================== */}
        {isAdmin && (
          <AnaliseAvancadaSection
            stats={stats}
            formatCurrency={formatCurrency}
            formatCurrencyUsd={formatCurrencyUsd}
          />
        )}

        {/* ===================== ADMIN ACTIONS ===================== */}
        {isAdmin && (
          <section className="mt-8">
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 font-display">
              <span className="h-6 w-1.5 bg-warning rounded-full"></span>
              {t('sidebar.administration')}
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
