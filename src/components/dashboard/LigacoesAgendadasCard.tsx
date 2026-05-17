import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, ChevronRight } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export function LigacoesAgendadasCard() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canView = hasPermission('view_ligacoes_ia');

  const { data } = useQuery({
    queryKey: ['ligacoes-agendadas-hoje'],
    enabled: canView,
    refetchInterval: 60_000,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('ligacoes_agendadas' as any)
        .select('status')
        .eq('dia_alvo', hoje);
      if (error) throw error;
      const rows = (data ?? []) as { status: string }[];
      return {
        total: rows.length,
        pendentes: rows.filter((r) => r.status === 'pendente').length,
        emAndamento: rows.filter((r) => r.status === 'em_andamento').length,
        finalizadas: rows.filter((r) => r.status === 'finalizada').length,
        falhou: rows.filter((r) => r.status === 'falhou').length,
      };
    },
  });

  if (!canView || !data || data.total === 0) return null;

  const pulsing = data.pendentes > 0;

  return (
    <Card
      className={`cursor-pointer border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 transition-all hover:border-fuchsia-500/60 ${
        pulsing ? 'animate-pulse-slow shadow-[0_0_25px_hsl(296_100%_60%/0.25)]' : ''
      }`}
      onClick={() => navigate('/ligacoes-ia?tab=fila')}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-xl bg-fuchsia-500/20 p-3">
          <PhoneCall className="h-6 w-6 text-fuchsia-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">Fila de ligações IA — hoje</div>
          <div className="text-2xl font-bold text-foreground">
            {data.pendentes} pendente{data.pendentes === 1 ? '' : 's'}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline" className="border-amber-500/40 text-amber-400">
              {data.emAndamento} em andamento
            </Badge>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
              {data.finalizadas} concluídas
            </Badge>
            {data.falhou > 0 && (
              <Badge variant="outline" className="border-red-500/40 text-red-400">
                {data.falhou} falhou
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" variant="ghost" className="text-fuchsia-300">
          Abrir fila <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
