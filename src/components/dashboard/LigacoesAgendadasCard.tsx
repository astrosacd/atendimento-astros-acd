import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, ChevronRight, Megaphone } from 'lucide-react';
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
      const [agendadasRes, campanhasRes] = await Promise.all([
        supabase
          .from('ligacoes_agendadas' as any)
          .select('status, campanha_id')
          .eq('dia_alvo', hoje),
        supabase
          .from('ligacoes_campanhas' as any)
          .select('id, nome, total, dia_alvo')
          .eq('dia_alvo', hoje),
      ]);
      if (agendadasRes.error) throw agendadasRes.error;
      const rows = ((agendadasRes.data ?? []) as unknown) as { status: string; campanha_id: string | null }[];
      const campanhas = ((campanhasRes.data ?? []) as unknown) as { id: string; nome: string; total: number }[];

      // Pending count per campaign
      const pendentesByCampanha = new Map<string, number>();
      rows.forEach((r) => {
        if (r.campanha_id && r.status === 'pendente') {
          pendentesByCampanha.set(r.campanha_id, (pendentesByCampanha.get(r.campanha_id) ?? 0) + 1);
        }
      });

      const campanhasAtivas = campanhas
        .map((c) => ({ ...c, pendentes: pendentesByCampanha.get(c.id) ?? 0 }))
        .filter((c) => c.pendentes > 0);

      return {
        total: rows.length,
        pendentes: rows.filter((r) => r.status === 'pendente').length,
        emAndamento: rows.filter((r) => r.status === 'em_andamento').length,
        finalizadas: rows.filter((r) => r.status === 'finalizada').length,
        falhou: rows.filter((r) => r.status === 'falhou').length,
        campanhasAtivas,
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
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-4">
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
        </div>

        {data.campanhasAtivas.length > 0 && (
          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-300 mb-1.5">
              <Megaphone className="h-3.5 w-3.5" /> Campanhas ativas hoje
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.campanhasAtivas.map((c) => (
                <Badge
                  key={c.id}
                  variant="outline"
                  className="border-fuchsia-500/40 text-fuchsia-200"
                  title={`${c.pendentes} pendente(s) de ${c.total}`}
                >
                  {c.nome} · {c.pendentes}/{c.total}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
