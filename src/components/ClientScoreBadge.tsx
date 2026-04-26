import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, Award, Medal, AlertTriangle, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientScore {
  score: number;
  faixa: "ouro" | "prata" | "bronze" | "risco";
  justificativa: string | null;
  desconto_sugerido: number | null;
  calculated_at?: string | null;
}

interface Props {
  clienteId: string;
  size?: "sm" | "md";
  showScore?: boolean;
  className?: string;
  /** Se true, calcula automaticamente quando não houver score. Default: true */
  autoCalculate?: boolean;
  /** Callback após (re)cálculo. */
  onCalculated?: (score: ClientScore) => void;
}

const FAIXA_CONFIG = {
  ouro: {
    label: "Ouro",
    Icon: Trophy,
    classes: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  },
  prata: {
    label: "Prata",
    Icon: Award,
    classes: "bg-slate-400/15 text-slate-700 dark:text-slate-300 border-slate-400/30",
  },
  bronze: {
    label: "Bronze",
    Icon: Medal,
    classes: "bg-orange-600/15 text-orange-700 dark:text-orange-400 border-orange-600/30",
  },
  risco: {
    label: "Risco",
    Icon: AlertTriangle,
    classes: "bg-destructive/15 text-destructive border-destructive/30",
  },
} as const;

export function ClientScoreBadge({
  clienteId,
  size = "md",
  showScore = true,
  className,
  autoCalculate = true,
  onCalculated,
}: Props) {
  const [score, setScore] = useState<ClientScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const triggeredRef = useRef(false);

  const loadScore = useCallback(async () => {
    const { data } = await supabase
      .from("client_scores")
      .select("score, faixa, justificativa, desconto_sugerido, calculated_at")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    setScore(data as ClientScore | null);
    setLoading(false);
    return data as ClientScore | null;
  }, [clienteId]);

  const calculateOne = useCallback(async () => {
    if (calculating) return;
    setCalculating(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-client-score", {
        body: { cliente_id: clienteId },
      });
      if (!error) {
        const fresh = await loadScore();
        if (fresh && onCalculated) onCalculated(fresh);
      }
    } catch (e) {
      console.error("[ClientScoreBadge] calc error", e);
    } finally {
      setCalculating(false);
    }
  }, [clienteId, calculating, loadScore, onCalculated]);

  useEffect(() => {
    let mounted = true;
    triggeredRef.current = false;
    setLoading(true);
    setScore(null);
    loadScore().then((data) => {
      if (!mounted) return;
      // Auto-calcular se não houver score
      if (!data && autoCalculate && !triggeredRef.current) {
        triggeredRef.current = true;
        calculateOne();
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // Realtime: atualiza badge se score mudar (recalc externo, trigger, etc.)
  useEffect(() => {
    const channel = supabase
      .channel(`client-score-${clienteId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_scores", filter: `cliente_id=eq.${clienteId}` },
        () => {
          loadScore();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, loadScore]);

  const handleRecalc = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    calculateOne();
  };

  if (loading) {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">…</span>
      </Badge>
    );
  }

  if (!score) {
    return (
      <Badge
        variant="outline"
        onClick={handleRecalc}
        className={cn(
          "gap-1 cursor-pointer hover:bg-muted text-muted-foreground",
          size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs",
          className
        )}
      >
        {calculating ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Calculando…
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            Calcular score
          </>
        )}
      </Badge>
    );
  }

  const cfg = FAIXA_CONFIG[score.faixa];
  const Icon = cfg.Icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            onClick={handleRecalc}
            className={cn(
              "gap-1 border font-semibold cursor-pointer hover:opacity-80 transition",
              cfg.classes,
              size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs",
              className
            )}
          >
            {calculating ? (
              <Loader2 className={size === "sm" ? "h-3 w-3 animate-spin" : "h-3.5 w-3.5 animate-spin"} />
            ) : (
              <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
            )}
            {cfg.label}
            {showScore && <span className="opacity-80">· {score.score}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px]">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-2">
              Score: {score.score} / 1000
              <RefreshCw className="h-3 w-3 opacity-60" />
            </div>
            {score.justificativa && (
              <div className="text-xs text-muted-foreground">{score.justificativa}</div>
            )}
            {score.desconto_sugerido && score.desconto_sugerido > 0 ? (
              <div className="text-xs font-medium text-success">
                Desconto sugerido: {score.desconto_sugerido}%
              </div>
            ) : null}
            <div className="text-[10px] text-muted-foreground/70 pt-1 border-t">
              Clique para recalcular
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
