import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarX } from 'lucide-react';
import { useBusinessHoursStatus } from '@/hooks/useBusinessHoursStatus';

export const BusinessHoursStatusCard = () => {
  const status = useBusinessHoursStatus();

  const dotColor = status.isOpen ? 'bg-emerald-500' : 'bg-red-500';
  const dotRing = status.isOpen ? 'bg-emerald-500/30' : 'bg-red-500/30';
  const label = status.isOpen ? 'Aberto' : 'Fechado';
  const accentText = status.isOpen ? 'text-emerald-600' : 'text-red-600';

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

        <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          {status.reason === 'blocked' ? (
            <CalendarX className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{status.loading ? 'Carregando...' : status.todayLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
};
