import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users, Settings, ChevronRight, TrendingUp,
  Webhook, DollarSign, Clock, AlertTriangle,
  Bell, Database, MessageSquare, Loader2, ListTodo, CheckCircle2, AlertCircle,
  ShieldCheck,
  Wallet, Phone, Headphones, ThumbsUp, User, Instagram
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
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
import { useDashboardStats, formatCurrency, formatCurrencyUsd } from '@/hooks/useDashboardStats';
import { BackupDialog } from '@/components/dashboard/BackupDialog';

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, userRole, isAdmin, isApproved } = useAuth();
  const { isSupported, permission, requestPermission } = useNotifications();
  const { canManageTasks, canViewChamados, canViewProposalsDashboard, canViewDespesas, canViewPaymentSecurity, hasPermission } = usePermissions();
  const canViewClients = hasPermission('view_clients');
  const canViewCharts = hasPermission('view_dashboard_charts');
  const { followups } = useFollowups();
  const [roleDisplayName, setRoleDisplayName] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);

  const { stats, urgentTasks } = useDashboardStats();


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


  const handleEnableNotifications = async () => {
    // Check if permission is already denied
    if (Notification.permission === 'denied') {
      toast({
        title: 'Notificações Bloqueadas',
        description: 'Você bloqueou as notificações anteriormente. Para ativar, clique no cadeado ao lado da URL do navegador e altere para "Permitir".',
        variant: 'destructive',
      });
      return;
    }

    const granted = await requestPermission();
    if (granted) {
      toast({
        title: 'Notificações ativadas!',
        description: 'Você receberá alertas de novos usuários e erros.',
      });
    } else {
      toast({
        title: 'Notificações bloqueadas',
        description: 'Permita notificações nas configurações do navegador para receber alertas importantes.',
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
              <TooltipProvider>
                {isSupported && permission !== 'granted' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleEnableNotifications}>
                        <Bell className="h-4 w-4 mr-2" />
                        {t('dashboard.enableNotifications')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ativa alertas visuais no seu computador para novos usuários e falhas de cobrança.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setIsBackupDialogOpen(true)} disabled={isBackingUp}>
                      <Database className="h-4 w-4 mr-2" />
                      {isBackingUp ? t('common.loading') : t('dashboard.backup')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Baixa um arquivo com todas as configurações, clientes e dados do sistema para segurança.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
