import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, Award, Medal, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientScore {
  score: number;
  faixa: "ouro" | "prata" | "bronze" | "risco";
  justificativa: string | null;
  desconto_sugerido: number | null;
}

interface Props {
  clienteId: string;
  size?: "sm" | "md";
  showScore?: boolean;
  className?: string;
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

export function ClientScoreBadge({ clienteId, size = "md", showScore = true, className }: Props) {
  const [score, setScore] = useState<ClientScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("client_scores")
        .select("score, faixa, justificativa, desconto_sugerido")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (mounted) {
        setScore(data as ClientScore | null);
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [clienteId]);

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
      <Badge variant="outline" className={cn("text-xs text-muted-foreground", className)}>
        Sem score
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
            className={cn(
              "gap-1 border font-semibold cursor-help",
              cfg.classes,
              size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs",
              className
            )}
          >
            <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {cfg.label}
            {showScore && <span className="opacity-80">· {score.score}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">
          <div className="space-y-1">
            <div className="font-semibold">Score: {score.score} / 1000</div>
            {score.justificativa && (
              <div className="text-xs text-muted-foreground">{score.justificativa}</div>
            )}
            {score.desconto_sugerido && score.desconto_sugerido > 0 ? (
              <div className="text-xs font-medium text-success">
                Desconto sugerido: {score.desconto_sugerido}%
              </div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
