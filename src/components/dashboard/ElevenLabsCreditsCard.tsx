import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Mic, RefreshCw, AlertTriangle } from 'lucide-react';
import type { ElevenLabsSource } from '@/hooks/useElevenLabsCreditsMulti';

interface Props {
  data: ElevenLabsSource | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Sufixo opcional p/ identificar o módulo (ex.: "Ligações IA", "Propostas"). */
  moduleLabel?: string;
}

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

export function ElevenLabsCreditsCard({ data, loading, error, onRefresh, moduleLabel }: Props) {
  const configured = data?.configured !== false;
  const sourceError = error || data?.error || null;
  const pct = data?.pct ?? 0;
  const critical = configured && pct >= 90;
  const warning = configured && pct >= 80 && pct < 90;

  const toneBorder = critical
    ? 'border-destructive/40'
    : warning
      ? 'border-amber-500/40'
      : 'border-border/50';
  const toneBg = critical
    ? 'bg-destructive/10 text-destructive'
    : warning
      ? 'bg-amber-500/10 text-amber-500'
      : 'bg-fuchsia-500/10 text-fuchsia-500';
  const progressColor = critical
    ? '[&>div]:bg-destructive'
    : warning
      ? '[&>div]:bg-amber-500'
      : '[&>div]:bg-fuchsia-500';

  const title = moduleLabel
    ? `ElevenLabs — ${moduleLabel}`
    : 'ElevenLabs — Créditos';

  return (
    <Card className={`${toneBorder} transition-colors`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${toneBg} ${critical ? 'animate-pulse' : ''}`}>
            <Mic className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {data?.tier && (
                  <Badge variant="outline" className="text-[10px] uppercase">{data.tier}</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRefresh}
                  disabled={loading}
                  aria-label="Atualizar"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {!configured ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Chave da ElevenLabs não configurada{moduleLabel ? ` para ${moduleLabel}` : ''}.
              </div>
            ) : sourceError ? (
              <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="break-words">{sourceError}</span>
              </div>
            ) : !data && loading ? (
              <p className="text-xs text-muted-foreground mt-2">Consultando saldo...</p>
            ) : data ? (
              <>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="text-2xl font-bold text-foreground">
                    {fmt(data.remaining)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">restantes</span>
                  </p>
                  <span className={`text-sm font-semibold ${critical ? 'text-destructive' : warning ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {pct}% usado
                  </span>
                </div>
                <Progress value={pct} className={`h-2 mt-2 ${progressColor}`} />
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{fmt(data.used)} / {fmt(data.limit)} caracteres</span>
                  {data.next_reset_unix && (
                    <span>Renova {new Date(data.next_reset_unix * 1000).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
                {critical && (
                  <div className="mt-2 text-xs font-medium text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Saldo crítico — considere recarregar ou aguardar renovação.
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
