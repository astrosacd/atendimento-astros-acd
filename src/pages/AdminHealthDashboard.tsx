import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCcw, 
  ArrowLeft, 
  ShieldCheck,
  Zap,
  History,
  Info,
  HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const CHECK_DESCRIPTIONS: Record<string, string> = {
  meta_whatsapp: 'Verifica se o token oficial da Meta (WhatsApp Business API) está configurado nos Segredos / Cobrança.',
  evolution_api: 'Faz uma chamada real em /instance/fetchInstances usando EVOLUTION_API_URL e EVOLUTION_API_KEY e conta as instâncias ativas.',
  google_calendar: 'Consulta a tabela de tokens OAuth dos usuários conectados ao Google e verifica se algum token expirado precisa ser renovado.',
  mercadopago: 'Faz GET em api.mercadopago.com/users/me com o MERCADOPAGO_ACCESS_TOKEN. Se devolver 401/403, o token está inválido ou expirado.',
  stripe: 'Faz GET em api.stripe.com/v1/balance usando a STRIPE_SECRET_KEY (Secrets ou Cobrança → Stripe). HTTP 200 = chave válida.',
  serper_api: 'Envia uma busca mínima (q="health check") no google.serper.dev e lê o header de créditos restantes.',
  manychat: 'Faz GET em api.manychat.com/fb/page/getInfo com MANYCHAT_API_KEY para confirmar autenticação.',
  gmail: 'Confirma que GMAIL_USER e GMAIL_APP_PASSWORD estão presentes nos Segredos (usado para enviar emails do CRM).',
};

const AdminHealthDashboard = () => {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: statusData, refetch: refetchStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_status')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: quotasData, refetch: refetchQuotas, isLoading: loadingQuotas } = useQuery({
    queryKey: ['api-quotas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_quotas')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: logsData, refetch: refetchLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ['integration-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  });

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-health-check');
      if (error) throw error;
      
      await Promise.all([refetchStatus(), refetchQuotas(), refetchLogs()]);
      toast.success('Verificação concluída com sucesso');
    } catch (error) {
      console.error('Erro na verificação:', error);
      toast.error('Erro ao realizar verificação');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'offline': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Online</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Alerta</Badge>;
      case 'offline': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Offline</Badge>;
      default: return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Saúde do Sistema
              </h1>
              <p className="text-sm text-muted-foreground">Monitoramento de integrações e limites de API</p>
            </div>
          </div>
          <Button 
            onClick={handleManualCheck} 
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Verificar Agora
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Resumo de Alertas */}
        {statusData?.some(s => s.status !== 'online') && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-4 animate-pulse">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-bold text-red-500">Atenção: Algumas integrações precisam de manutenção</p>
              <p className="text-sm text-red-400">Verifique os itens marcados como 'Offline' ou 'Alerta' abaixo.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Status das Integrações */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Integrações Ativas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {statusData?.map((integration) => (
                <Card key={integration.id} className="border-border/40 hover:border-primary/20 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {integration.display_name}
                    </CardTitle>
                    {getStatusIcon(integration.status)}
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground capitalize">{integration.category}</span>
                      {getStatusBadge(integration.status)}
                    </div>
                    {integration.last_check && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Última verificação: {format(new Date(integration.last_check), "HH:mm:ss 'em' dd/MM", { locale: ptBR })}
                      </p>
                    )}
                    {integration.error_message && (
                      <p className="text-xs text-red-500 mt-2 line-clamp-1 italic">
                        {integration.error_message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Logs Recentes */}
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Logs de Eventos
              </h2>
              <Card className="border-border/40">
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {logsData?.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">Nenhum log registrado ainda.</div>
                    ) : (
                      logsData?.map((log) => (
                        <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                          <div className="mt-1">
                            {getStatusIcon(log.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="font-medium text-sm">{log.integration_name}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Coluna Lateral: Cotas e Alertas */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Limites e Créditos
            </h2>
            <div className="space-y-4">
              {quotasData?.map((quota) => {
                const percentage = quota.max_value ? (quota.current_value / quota.max_value) * 100 : 0;
                const isCritical = percentage > (100 - (quota.alert_threshold || 20));
                
                return (
                  <Card key={quota.id} className="border-border/40">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm">{quota.display_name}</CardTitle>
                      <CardDescription className="text-xs">
                        {quota.limit_type === 'credits' ? 'Créditos Disponíveis' : 'Uso de API'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex justify-between items-end mb-2">
                        <span className={`text-lg font-bold ${isCritical ? 'text-red-500' : 'text-foreground'}`}>
                          {quota.current_value.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          de {quota.max_value?.toLocaleString() || '∞'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${isCritical ? 'bg-red-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      {isCritical && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-red-500 font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          Créditos baixos! Considere recarregar.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Dica de Saúde</CardTitle>
                  </div>
                  <CardDescription className="text-xs leading-relaxed">
                    Mantenha suas integrações "Online" para garantir que o CRM funcione sem interrupções. 
                    Se uma integração ficar "Offline", verifique as credenciais no módulo correspondente.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminHealthDashboard;
