import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Activity, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SystemHealthCard = () => {
  const navigate = useNavigate();

  const { data: statusData } = useQuery({
    queryKey: ['integration-status-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_status')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: quotasData } = useQuery({
    queryKey: ['api-quotas-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_quotas')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  const onlineCount = statusData?.filter(s => s.status === 'online').length || 0;
  const warningCount = statusData?.filter(s => s.status === 'warning').length || 0;
  const offlineCount = statusData?.filter(s => s.status === 'offline').length || 0;
  const totalIntegrations = statusData?.length || 0;

  const criticalQuotas = quotasData?.filter(q => {
    const percentage = q.max_value ? (q.current_value / q.max_value) * 100 : 0;
    return percentage > (100 - (q.alert_threshold || 20));
  }) || [];

  return (
    <Card 
      className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer group"
      onClick={() => navigate('/admin/saude')}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-500" />
          Saúde do Sistema
        </CardTitle>
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px] uppercase">
          Tempo Real
        </Badge>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Integrações</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {offlineCount > 0 && <XCircle className="h-4 w-4 text-red-500 relative z-30" />}
                {warningCount > 0 && <AlertTriangle className="h-4 w-4 text-amber-500 relative z-20" />}
                <CheckCircle2 className="h-4 w-4 text-emerald-500 relative z-10" />
              </div>
              <span className="text-sm font-bold">{onlineCount}/{totalIntegrations} Online</span>
            </div>
          </div>
          
          <div className="space-y-1 text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cotas & API</p>
            <div className="flex items-center justify-end gap-2 text-sm font-bold">
              {criticalQuotas.length > 0 ? (
                <span className="text-red-500 flex items-center gap-1">
                  <Activity className="h-3 w-3 animate-pulse" />
                  {criticalQuotas.length} Alerta(s)
                </span>
              ) : (
                <span className="text-emerald-500">Operacional</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-muted-foreground group-hover:text-indigo-600 transition-colors border-t border-indigo-500/10 pt-3">
          Ver detalhes completos
          <ChevronRight className="h-3 w-3" />
        </div>
      </CardContent>
    </Card>
  );
};
