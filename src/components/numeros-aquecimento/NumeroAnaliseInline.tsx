import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, ShieldAlert, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { useNumeroAnalise, NumeroAnaliseDialog } from './NumeroAnaliseDialog';
import type { NumeroAquecimento, NumeroStatus } from '@/hooks/useNumerosAquecimento';

interface Props {
  numero: NumeroAquecimento;
  statusList: NumeroStatus[];
}

export function NumeroAnaliseInline({ numero, statusList }: Props) {
  const [open, setOpen] = useState(false);
  const { data: analise, isLoading } = useNumeroAnalise(numero, statusList);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5"
              onClick={() => setOpen(true)}
            >
              {isLoading || !analise ? (
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              ) : analise.verdict === 'apto' ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Apto</span>
                </>
              ) : analise.verdict === 'instavel' ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">Instável</span>
                </>
              ) : analise.verdict === 'aquecendo' ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-muted-foreground">{analise.score}</span>
                </>
              ) : (
                <>
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{analise.score}</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLoading || !analise ? (
              <p className="text-xs">Calculando análise...</p>
            ) : (
              <div className="text-xs space-y-0.5">
                <p className="font-semibold">Score: {analise.score}/100</p>
                <p>Bloqueios (30d): {analise.blockedCountLast30d}</p>
                {analise.currentStatusName === 'Em Aquecimento' && (
                  <p>Aquecendo há {analise.consecutiveDaysWarming.toFixed(1)} dias</p>
                )}
                <p className="text-muted-foreground italic">Clique para ver análise completa</p>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <NumeroAnaliseDialog
        numero={numero}
        statusList={statusList}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
