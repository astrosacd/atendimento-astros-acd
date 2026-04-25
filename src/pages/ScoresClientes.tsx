import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, Award, Medal, AlertTriangle, RefreshCw, Sparkles, Search, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoredClient {
  cliente_id: string;
  score: number;
  faixa: "ouro" | "prata" | "bronze" | "risco";
  justificativa: string | null;
  desconto_sugerido: number | null;
  calculated_at: string;
  cliente: { nome: string; produto: string; valor: number; moeda: string } | null;
}

const FAIXA_CONFIG = {
  ouro: { label: "Ouro", Icon: Trophy, color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
  prata: { label: "Prata", Icon: Award, color: "bg-slate-400/15 text-slate-700 dark:text-slate-300 border-slate-400/30" },
  bronze: { label: "Bronze", Icon: Medal, color: "bg-orange-600/15 text-orange-700 dark:text-orange-400 border-orange-600/30" },
  risco: { label: "Risco", Icon: AlertTriangle, color: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function ScoresClientes() {
  const [scores, setScores] = useState<ScoredClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalcAll, setRecalcAll] = useState(false);
  const [search, setSearch] = useState("");
  const [filterFaixa, setFilterFaixa] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_scores")
      .select(`
        cliente_id,
        score,
        faixa,
        justificativa,
        desconto_sugerido,
        calculated_at,
        cliente:clientes(nome, produto, valor, moeda)
      `)
      .order("score", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar scores: " + error.message);
    } else {
      setScores((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();

    // Realtime
    const channel = supabase
      .channel("client-scores-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_scores" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRecalcAll = async () => {
    setRecalcAll(true);
    toast.info("Recalculando scores via IA. Isso pode levar alguns minutos...");
    try {
      const { data, error } = await supabase.functions.invoke("calculate-client-score", {
        body: { recalc_all: true },
      });
      if (error) throw error;
      toast.success(`Scores recalculados: ${data.processed}/${data.total}`);
      await load();
    } catch (e: any) {
      toast.error("Erro ao recalcular: " + e.message);
    } finally {
      setRecalcAll(false);
    }
  };

  const handleRecalcOne = async (clienteId: string) => {
    try {
      const { error } = await supabase.functions.invoke("calculate-client-score", {
        body: { cliente_id: clienteId },
      });
      if (error) throw error;
      toast.success("Score atualizado");
      await load();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const filtered = scores.filter((s) => {
    if (filterFaixa !== "all" && s.faixa !== filterFaixa) return false;
    if (search && !s.cliente?.nome?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    ouro: scores.filter((s) => s.faixa === "ouro").length,
    prata: scores.filter((s) => s.faixa === "prata").length,
    bronze: scores.filter((s) => s.faixa === "bronze").length,
    risco: scores.filter((s) => s.faixa === "risco").length,
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Score de Clientes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Análise de risco interna estilo Serasa, calculada por IA com base no histórico de cada cliente.
            </p>
          </div>
          <Button onClick={handleRecalcAll} disabled={recalcAll} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", recalcAll && "animate-spin")} />
            {recalcAll ? "Recalculando..." : "Recalcular todos"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(FAIXA_CONFIG) as Array<keyof typeof FAIXA_CONFIG>).map((f) => {
            const cfg = FAIXA_CONFIG[f];
            const Icon = cfg.Icon;
            return (
              <Card
                key={f}
                className={cn("cursor-pointer transition", filterFaixa === f && "ring-2 ring-primary")}
                onClick={() => setFilterFaixa(filterFaixa === f ? "all" : f)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg border", cfg.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{cfg.label}</div>
                    <div className="text-2xl font-bold">{stats[f]}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 space-y-0">
            <CardTitle className="text-lg">Ranking de clientes</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">
                  Nenhum score calculado ainda. Clique em "Recalcular todos" para gerar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Desconto sugerido</TableHead>
                      <TableHead>Justificativa</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => {
                      const cfg = FAIXA_CONFIG[s.faixa];
                      const Icon = cfg.Icon;
                      return (
                        <TableRow key={s.cliente_id}>
                          <TableCell className="font-medium">{s.cliente?.nome || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.cliente?.produto || "—"}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-bold">{s.score}</span>
                            <span className="text-xs text-muted-foreground">/1000</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("gap-1 border", cfg.color)}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.desconto_sugerido && s.desconto_sugerido > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <TrendingDown className="h-3 w-3" />
                                {s.desconto_sugerido}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {s.justificativa || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRecalcOne(s.cliente_id)}
                              className="gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Recalcular
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
