import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useClientTasks, ClientTask } from '@/hooks/useClientTasks';
import { usePermissions } from '@/hooks/usePermissions';

// Mapping of billing cycles to months
const CICLO_MESES: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export interface DashboardStats {
  totalClientes: number;
  clientesRecorrentes: number;
  clientesRegistro: number;
  pendingUsers: number;
  activeWebhooks: number;
  totalValor: number;
  renovacoesProximas: number;
  clientesPorMes: { mes: string; quantidade: number }[];
  clientesPorPlano: { plano: string; quantidade: number }[];
  inadimplentes: number;
  taxaInadimplencia: number;
  mrr: number;
  mrrUsd: number;
  previsaoFaturamento: number;
  previsaoFaturamentoUsd: number;
  clientesNovos30d: number;
  billingSuccess: number;
  billingErrors: number;
  chamadosAbertos: number;
  chamadosEmAndamento: number;
  chamadosAguardandoCliente: number;
  tarefasPendentes: number;
  tarefasEmAndamento: number;
  tarefasAtrasadas: number;
  tarefasConcluidas: number;
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
  divulgadorErrors: number;
  canceladosUltimos30d: number;
}

export interface UrgentTasksState {
  overdue: ClientTask[];
  dueSoon: ClientTask[];
}

const INITIAL_STATS: DashboardStats = {
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
  divulgadorErrors: 0,
  canceladosUltimos30d: 0,
};

function getClientesPorMes(clientes: any[]) {
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
}

function getClientesPorPlano(clientes: any[]) {
  const planos: { [key: string]: number } = {};
  clientes.forEach(c => {
    const plano = c.plano || 'Sem plano';
    planos[plano] = (planos[plano] || 0) + 1;
  });
  return Object.entries(planos).map(([plano, quantidade]) => ({ plano, quantidade }));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function useDashboardStats() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { permissions, canManageTasks, canViewPaymentSecurity, hasPermission, canViewDivulgador } = usePermissions();
  const { getTaskStats, getUrgentTasks } = useClientTasks();
  const permissionsKey = permissions.join('|');

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [urgentTasks, setUrgentTasks] = useState<UrgentTasksState>({ overdue: [], dueSoon: [] });
  const [alertsShown, setAlertsShown] = useState(false);

  // ============ Fetch principal + realtime de billing_logs ============
  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      const { data: allClientes } = await supabase.from('clientes').select('*');
      const clientes = allClientes?.filter(c => !c.excluir_metricas) || [];

      const { data: purchases } = await supabase
        .from('client_purchases')
        .select('valor, moeda, cliente_id');

      if (!isMounted) return;

      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const totalValor = clientes?.reduce((acc, c) => acc + (c.valor || 0), 0) || 0;

      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const nextWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;
      const renovacoesProximas = clientes?.filter(c => {
        if (!c.data_renovacao) return false;
        if (c.cobranca_ativa !== true) return false;
        const renovacaoStr = String(c.data_renovacao).slice(0, 10);
        return renovacaoStr >= todayStr && renovacaoStr <= nextWeekStr;
      }).length || 0;

      const clientesRecorrentes = clientes?.filter(c => c.cobranca_ativa === true).length || 0;
      const clientesRegistroComValor = clientes?.filter(c => c.cobranca_ativa === false && (c.valor || 0) > 0) || [];
      const clientesRegistroSemValor = clientes?.filter(c => c.cobranca_ativa === false && (c.valor || 0) === 0).length || 0;
      const clientesRegistro = clientesRegistroComValor.length;

      const vendasClientesBrl = clientesRegistroComValor
        .filter(c => (c.moeda || 'BRL') === 'BRL')
        .reduce((acc, c) => acc + (c.valor || 0), 0);
      const vendasClientesUsd = clientesRegistroComValor
        .filter(c => c.moeda === 'USD')
        .reduce((acc, c) => acc + (c.valor || 0), 0);

      const purchasesBrl = purchases?.filter(p => (p.moeda || 'BRL') === 'BRL')
        .reduce((acc, p) => acc + (p.valor || 0), 0) || 0;
      const purchasesUsd = purchases?.filter(p => p.moeda === 'USD')
        .reduce((acc, p) => acc + (p.valor || 0), 0) || 0;

      const vendasUnicasBrl = vendasClientesBrl + purchasesBrl;
      const vendasUnicasUsd = vendasClientesUsd + purchasesUsd;

      const inadimplentes = clientes?.filter(c => {
        if (!c.cobranca_ativa || !c.data_renovacao) return false;
        const renovacaoStr = String(c.data_renovacao).slice(0, 10);
        return renovacaoStr < todayStr;
      }).length || 0;

      const taxaInadimplencia = clientesRecorrentes > 0 ? (inadimplentes / clientesRecorrentes) * 100 : 0;

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

      const clientesNovos30d = clientes?.filter(c => {
        const created = new Date(c.created_at);
        return created >= thirtyDaysAgo;
      }).length || 0;

      const clientesPorMes = getClientesPorMes(clientes || []);
      const clientesPorPlano = getClientesPorPlano(clientes || []);

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
      let instagramTokenExpiryDate: string | null = null;
      let pagamentosPendentes = 0;

      let offlineIntegrations = 0;
      let criticalQuotasCount = 0;
      let divulgadorErrorsCount = 0;

      if (hasPermission('manage_system_health')) {
        const { data: statusData } = await supabase.from('integration_status').select('status');
        offlineIntegrations = statusData?.filter(s => s.status === 'offline').length || 0;

        const { data: quotasData } = await supabase.from('api_quotas').select('current_value, max_value, alert_threshold');
        criticalQuotasCount = quotasData?.filter(q => {
          const percentage = q.max_value ? (q.current_value / q.max_value) * 100 : 0;
          return percentage > (100 - (q.alert_threshold || 20));
        }).length || 0;
      }

      if (isAdmin) {
        const { data: igSettings } = await supabase
          .from('instagram_settings')
          .select('token_expires_at')
          .limit(1)
          .maybeSingle();

        if (igSettings?.token_expires_at) {
          const expiryDate = new Date(igSettings.token_expires_at);
          const now = new Date();
          const warningThreshold = new Date(now);
          warningThreshold.setDate(now.getDate() + 10);

          if (expiryDate <= warningThreshold) {
            instagramTokenExpiring = true;
            instagramTokenExpiryDate = igSettings.token_expires_at;
          }
        }

        const { data: allHistory } = await supabase
          .from('client_history')
          .select('cliente_id, created_at')
          .eq('action', 'update')
          .contains('changed_fields', ['cobranca_ativa'])
          .gte('created_at', thirtyDaysAgo.toISOString());

        const uniqueCanceledIds = new Set(allHistory?.map(h => h.cliente_id));

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

        const { data: billingLogs } = await supabase
          .from('billing_logs')
          .select('status')
          .gte('sent_at', thirtyDaysAgo.toISOString());

        billingSuccess = billingLogs?.filter(l => l.status === 'sent').length || 0;
        billingErrors = billingLogs?.filter(l => l.status === 'error').length || 0;

        const { count: recPending } = await supabase
          .from('client_recovery_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'sent')
          .is('converteu', null);
        recoveryPending = recPending || 0;

        const { count: skippedC } = await supabase
          .from('billing_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'skipped')
          .is('resolution', null);
        billingSkippedCount = skippedC || 0;

        const { count: errorsC } = await supabase
          .from('billing_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'error')
          .is('resolution', null);
        billingErrorsUnresolvedCount = errorsC || 0;

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

      if (canViewDivulgador()) {
        const { count: divErrors } = await supabase
          .from('divulgador_messages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .is('resolution', null);
        divulgadorErrorsCount = divErrors || 0;
      }

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
        divulgadorErrors: divulgadorErrorsCount,
      });
    };

    if (user) fetchStats();

    let billingChannel: ReturnType<typeof supabase.channel> | null = null;
    let divulgadorChannel: ReturnType<typeof supabase.channel> | null = null;

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

    if (user && canViewDivulgador()) {
      divulgadorChannel = supabase
        .channel('dashboard-divulgador-errors')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'divulgador_messages' },
          () => {
            if (isMounted) fetchStats();
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (billingChannel) supabase.removeChannel(billingChannel);
      if (divulgadorChannel) supabase.removeChannel(divulgadorChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, permissionsKey]);

  // ============ Tarefas urgentes + toasts ============
  useEffect(() => {
    if (!canManageTasks()) return;

    let isMounted = true;

    const fetchUrgentTasks = async () => {
      const urgent = await getUrgentTasks();

      if (!isMounted) return;

      setUrgentTasks(urgent);

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

  return { stats, urgentTasks };
}
