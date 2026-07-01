import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CalendarX, Bot, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useBusinessHoursStatus } from '@/hooks/useBusinessHoursStatus';
import { supabase } from '@/integrations/supabase/client';

const trim = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');
// Motivo já vem do banco no padrão "Motivo: (texto)" — só exibe
const showMotivo = (m?: string | null) => (m && m.trim() ? m.trim() : '');

// Notificação: mostrar quando cron apagou pelo menos N nas últimas 24h
const CRON_MIN_DELETED = 1;
const CRON_WINDOW_MS = 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'bh_cron_notif_dismissed_at';

export const BusinessHoursStatusCard = () => {
  const status = useBusinessHoursStatus();

  // Notificação da última execução do cron de limpeza
  const [cronLastRun, setCronLastRun] = useState<string | null>(null);
  const [cronLastDeleted, setCronLastDeleted] = useState<number>(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(() => localStorage.getItem(DISMISS_KEY));

  const loadCleanup = async () => {
    const { data } = await supabase.rpc('get_horario_cleanup_config');
    if (!data) return;
    const c: any = data;
    setCronLastRun(c.last_run_at ?? null);
    setCronLastDeleted(c.last_run_deleted ?? 0);
  };

  useEffect(() => {
    loadCleanup();
    // realtime: recarrega quando o cron insere no histórico
    const ch = supabase
      .channel('bh-cron-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bloqueios_historico', filter: 'origem=eq.cron' }, () => loadCleanup())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const showCronNotif = (() => {
    if (!cronLastRun) return false;
    if (cronLastDeleted < CRON_MIN_DELETED) return false;
    const runMs = new Date(cronLastRun).getTime();
    if (Date.now() - runMs > CRON_WINDOW_MS) return false;
    if (dismissedAt && new Date(dismissedAt).getTime() >= runMs) return false;
    return true;
  })();

  const dismissCronNotif = () => {
    const now = new Date().toISOString();
    localStorage.setItem(DISMISS_KEY, now);
    setDismissedAt(now);
  };

  const dotColor = status.isOpen ? 'bg-emerald-500' : 'bg-red-500';
  const dotRing = status.isOpen ? 'bg-emerald-500/30' : 'bg-red-500/30';
  const label = status.isOpen ? 'Aberto' : 'Fechado';
  const accentText = status.isOpen ? 'text-emerald-600' : 'text-red-600';

  // Bloqueios parciais do dia (mesmo quando não ativos no momento)
  const parciais = status.bloqueiosParciais || [];
  const parciaisFuturos = parciais.filter((b) => {
    // Se já é o bloqueio "ativo" que zerou o status, evita duplicar
    if (status.bloqueio && status.bloqueio.id === b.id) return false;
    return true;
  });

  return (
    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40 transition-all">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          Status do Horário Comercial
        </CardTitle>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] uppercase">
          Tempo Real
        </Badge>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-3 mt-2">
          <span className="relative flex h-3 w-3">
            {status.isOpen && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotRing}`} />
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`} />
          </span>
          <span className={`text-lg font-bold ${accentText}`}>{label}</span>
        </div>

        <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground min-w-0">
          {status.reason === 'blocked' ? (
            <CalendarX className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span className="break-words [overflow-wrap:anywhere] min-w-0 flex-1">
            {status.loading ? 'Carregando...' : status.todayLabel}
          </span>
        </div>

        {/* Bloqueios parciais agendados para hoje */}
        {parciaisFuturos.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-amber-500/20 pt-2">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-600 flex items-center gap-1">
              <CalendarX className="h-3 w-3" /> Bloqueios parciais hoje
            </div>
            {parciaisFuturos.map((b) => (
              <div key={b.id} className="text-xs text-muted-foreground flex items-start gap-1.5 min-w-0">
                <span className="font-medium text-foreground/80 shrink-0">
                  {trim(b.hora_inicio)}–{trim(b.hora_fim)}
                </span>
                <span className="break-words [overflow-wrap:anywhere] min-w-0 flex-1">
                  {showMotivo(b.motivo) || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
