import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, TrendingUp, ShieldAlert, ShieldCheck, Activity, Clock, Ban, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { NumeroAquecimento, NumeroStatus } from '@/hooks/useNumerosAquecimento';

interface Props {
  numero: NumeroAquecimento;
  statusList: NumeroStatus[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map status name -> tailwind background color (for the timeline bar)
const STATUS_BG: Record<string, string> = {
  Ativo: 'bg-green-500',
  'Em Aquecimento': 'bg-amber-500',
  Bloqueado: 'bg-red-500',
  Pausado: 'bg-slate-400',
  Vendido: 'bg-blue-500',
};

const STATUS_TEXT: Record<string, string> = {
  Ativo: 'text-green-600 dark:text-green-400',
  'Em Aquecimento': 'text-amber-600 dark:text-amber-400',
  Bloqueado: 'text-red-600 dark:text-red-400',
  Pausado: 'text-slate-600 dark:text-slate-400',
  Vendido: 'text-blue-600 dark:text-blue-400',
};

interface StatusSegment {
  statusId: string | null;
  statusName: string;
  start: Date;
  end: Date;
  durationMs: number;
}

export interface AnaliseResult {
  segments: StatusSegment[];
  totalByStatus: Record<string, number>; // ms
  totalDurationMs: number;
  currentStatusName: string;
  currentStatusDurationMs: number;
  blockedCountLast30d: number;
  consecutiveDaysWarming: number; // streak in 'Em Aquecimento' since last block (only counts if currently warming)
  score: number; // 0-100
  verdict: 'apto' | 'instavel' | 'aquecendo' | 'novo' | 'pausado' | 'vendido';
}

function msToDays(ms: number) {
  return ms / (1000 * 60 * 60 * 24);
}

function formatDuration(ms: number): string {
  const days = Math.floor(msToDays(ms));
  if (days >= 1) {
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours >= 1) {
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
}

/**
 * Build segments of status over time from history records.
 * History entries with action 'edicao' contain dados_anteriores and dados_novos.
 * 'cadastro' marks the start.
 */
export function buildAnalise(
  numero: NumeroAquecimento,
  history: Array<{
    acao: string;
    dados_anteriores: Record<string, unknown> | null;
    dados_novos: Record<string, unknown> | null;
    campos_alterados: string[] | null;
    created_at: string;
  }>,
  statusList: NumeroStatus[]
): AnaliseResult {
  const statusMap = new Map(statusList.map((s) => [s.id, s.nome]));

  // Sort history asc
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Determine starting status & timestamp
  const cadastro = sorted.find((h) => h.acao === 'cadastro');
  const startTime = cadastro
    ? new Date(cadastro.created_at)
    : new Date(numero.created_at);

  let currentStatusId: string | null = null;
  if (cadastro?.dados_novos && typeof cadastro.dados_novos === 'object') {
    currentStatusId = (cadastro.dados_novos as Record<string, unknown>).status_id as string | null;
  } else {
    // fallback: use first edition's previous status_id
    const firstEdit = sorted.find(
      (h) => h.acao === 'edicao' && h.dados_anteriores && (h.dados_anteriores as Record<string, unknown>).status_id !== undefined
    );
    if (firstEdit?.dados_anteriores) {
      currentStatusId = (firstEdit.dados_anteriores as Record<string, unknown>).status_id as string | null;
    } else {
      currentStatusId = numero.status_id;
    }
  }

  const segments: StatusSegment[] = [];
  let segStart = startTime;

  for (const entry of sorted) {
    if (entry.acao !== 'edicao') continue;
    const novos = entry.dados_novos as Record<string, unknown> | null;
    const antes = entry.dados_anteriores as Record<string, unknown> | null;
    if (!novos || !antes) continue;

    const newStatusId = novos.status_id as string | null | undefined;
    const oldStatusId = antes.status_id as string | null | undefined;

    if (newStatusId === undefined || newStatusId === oldStatusId) continue;

    const segEnd = new Date(entry.created_at);
    segments.push({
      statusId: currentStatusId,
      statusName: currentStatusId ? statusMap.get(currentStatusId) || 'Desconhecido' : 'Sem status',
      start: segStart,
      end: segEnd,
      durationMs: Math.max(0, segEnd.getTime() - segStart.getTime()),
    });
    currentStatusId = newStatusId ?? null;
    segStart = segEnd;
  }

  // Final open segment
  const now = new Date();
  segments.push({
    statusId: numero.status_id,
    statusName: numero.status_id
      ? statusMap.get(numero.status_id) || 'Desconhecido'
      : 'Sem status',
    start: segStart,
    end: now,
    durationMs: Math.max(0, now.getTime() - segStart.getTime()),
  });

  // Aggregate
  const totalByStatus: Record<string, number> = {};
  for (const seg of segments) {
    totalByStatus[seg.statusName] = (totalByStatus[seg.statusName] || 0) + seg.durationMs;
  }
  const totalDurationMs = segments.reduce((acc, s) => acc + s.durationMs, 0);

  const currentSeg = segments[segments.length - 1];
  const currentStatusName = currentSeg.statusName;
  const currentStatusDurationMs = currentSeg.durationMs;

  // Blocks in last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const blockedCountLast30d = segments.filter(
    (s) => s.statusName === 'Bloqueado' && s.start.getTime() >= thirtyDaysAgo
  ).length;

  // Consecutive days warming (only matters if currently warming)
  let consecutiveDaysWarming = 0;
  if (currentStatusName === 'Em Aquecimento') {
    // walk back from end: count contiguous warming segments without a "Bloqueado" interruption
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i];
      if (s.statusName === 'Em Aquecimento') {
        consecutiveDaysWarming += msToDays(s.durationMs);
      } else if (s.statusName === 'Bloqueado') {
        break;
      } else {
        // 'Ativo' or 'Pausado' don't reset but don't add either
        continue;
      }
    }
  }

  // Score 0-100 (heuristic IA-like)
  // Base: % time active or warming over total
  const activeMs = totalByStatus['Ativo'] || 0;
  const warmingMs = totalByStatus['Em Aquecimento'] || 0;
  const blockedMs = totalByStatus['Bloqueado'] || 0;
  const positiveRatio = totalDurationMs > 0 ? (activeMs + warmingMs) / totalDurationMs : 0;
  let score = Math.round(positiveRatio * 70); // 0-70

  // Bonus: streak of warming days (up to +20)
  score += Math.min(20, Math.round(consecutiveDaysWarming * 3)); // 7+ days = +21 capped

  // Bonus: long active history (up to +10)
  if (msToDays(activeMs) >= 7) score += 10;
  else if (msToDays(activeMs) >= 3) score += 5;

  // Penalty: blocks in last 30 days
  score -= blockedCountLast30d * 15;

  // Penalty if currently blocked
  if (currentStatusName === 'Bloqueado') score -= 25;

  score = Math.max(0, Math.min(100, score));

  // Verdict
  let verdict: AnaliseResult['verdict'] = 'aquecendo';
  if (currentStatusName === 'Vendido') verdict = 'vendido';
  else if (currentStatusName === 'Pausado') verdict = 'pausado';
  else if (totalDurationMs < 1000 * 60 * 60 * 6) verdict = 'novo'; // <6h cadastro
  else if (blockedCountLast30d >= 3) verdict = 'instavel';
  else if (
    currentStatusName === 'Em Aquecimento' &&
    consecutiveDaysWarming >= 7 &&
    blockedCountLast30d === 0 &&
    score >= 70
  ) {
    verdict = 'apto';
  } else if (currentStatusName === 'Ativo' && blockedCountLast30d === 0 && score >= 75) {
    verdict = 'apto';
  } else if (blockedCountLast30d >= 2) verdict = 'instavel';

  return {
    segments,
    totalByStatus,
    totalDurationMs,
    currentStatusName,
    currentStatusDurationMs,
    blockedCountLast30d,
    consecutiveDaysWarming,
    score,
    verdict,
  };
}

export function useNumeroAnalise(numero: NumeroAquecimento, statusList: NumeroStatus[]) {
  return useQuery({
    queryKey: ['numero-analise', numero.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_history')
        .select('acao, dados_anteriores, dados_novos, campos_alterados, created_at')
        .eq('numero_id', numero.id)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return buildAnalise(numero, (data || []) as Parameters<typeof buildAnalise>[1], statusList);
    },
    enabled: statusList.length > 0,
    staleTime: 60 * 1000,
  });
}

export function NumeroAnaliseDialog({ numero, statusList, open, onOpenChange }: Props) {
  const { data: analise, isLoading } = useNumeroAnalise(numero, statusList);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Análise de {numero.numero}
          </DialogTitle>
          <DialogDescription>
            Histórico de tempo em cada status e indicadores de aptidão para venda
          </DialogDescription>
        </DialogHeader>

        {isLoading || !analise ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Verdict + Score */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <VerdictBadge verdict={analise.verdict} score={analise.score} />
                    <div>
                      <div className="text-sm text-muted-foreground">Score de saúde</div>
                      <div className="text-3xl font-bold">{analise.score}<span className="text-lg text-muted-foreground">/100</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Status atual:</span>
                      <span className={`font-medium ${STATUS_TEXT[analise.currentStatusName] || ''}`}>
                        {analise.currentStatusName}
                      </span>
                      <span className="text-muted-foreground">há {formatDuration(analise.currentStatusDurationMs)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Bloqueios (30d):</span>
                      <span className={`font-medium ${analise.blockedCountLast30d >= 2 ? 'text-red-500' : 'text-foreground'}`}>
                        {analise.blockedCountLast30d}
                      </span>
                    </div>
                    {analise.currentStatusName === 'Em Aquecimento' && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Aquecendo há:</span>
                        <span className="font-medium">{analise.consecutiveDaysWarming.toFixed(1)} dias seguidos</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Linha do tempo</h4>
                <span className="text-xs text-muted-foreground">
                  Total: {formatDuration(analise.totalDurationMs)}
                </span>
              </div>
              <TooltipProvider>
                <div className="flex h-8 w-full overflow-hidden rounded-md border">
                  {analise.segments.map((seg, idx) => {
                    const widthPct = analise.totalDurationMs > 0
                      ? (seg.durationMs / analise.totalDurationMs) * 100
                      : 0;
                    if (widthPct < 0.5) return null; // skip negligible segments
                    return (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <div
                            className={`${STATUS_BG[seg.statusName] || 'bg-gray-400'} hover:opacity-80 transition-opacity cursor-help`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-0.5">
                            <div className="font-semibold">{seg.statusName}</div>
                            <div>{formatDuration(seg.durationMs)} ({widthPct.toFixed(1)}%)</div>
                            <div className="text-muted-foreground">
                              {seg.start.toLocaleDateString('pt-BR')} → {seg.end.toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3">
                {Object.entries(analise.totalByStatus).map(([statusName, ms]) => {
                  const pct = analise.totalDurationMs > 0 ? (ms / analise.totalDurationMs) * 100 : 0;
                  return (
                    <div key={statusName} className="flex items-center gap-2 text-xs">
                      <div className={`h-3 w-3 rounded-sm ${STATUS_BG[statusName] || 'bg-gray-400'}`} />
                      <span className={STATUS_TEXT[statusName] || ''}>{statusName}</span>
                      <span className="text-muted-foreground">
                        {formatDuration(ms)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed breakdown */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Tempo total em cada status</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {statusList.map((status) => {
                  const ms = analise.totalByStatus[status.nome] || 0;
                  return (
                    <Card key={status.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-2 w-2 rounded-full ${STATUS_BG[status.nome] || 'bg-gray-400'}`} />
                          <span className="text-xs text-muted-foreground">{status.nome}</span>
                        </div>
                        <div className="text-lg font-semibold">{formatDuration(ms)}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Recent history */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Mudanças recentes</h4>
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {[...analise.segments].reverse().slice(0, 15).map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${STATUS_BG[seg.statusName] || 'bg-gray-400'}`} />
                      <span className={`font-medium ${STATUS_TEXT[seg.statusName] || ''}`}>
                        {seg.statusName}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDuration(seg.durationMs)} · {seg.start.toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VerdictBadge({ verdict, score }: { verdict: AnaliseResult['verdict']; score: number }) {
  switch (verdict) {
    case 'apto':
      return (
        <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 px-3 py-1.5">
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Apto pra venda
        </Badge>
      );
    case 'instavel':
      return (
        <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 px-3 py-1.5">
          <ShieldAlert className="h-4 w-4 mr-1.5" />
          Instável
        </Badge>
      );
    case 'aquecendo':
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-1.5">
          <TrendingUp className="h-4 w-4 mr-1.5" />
          Aquecendo
        </Badge>
      );
    case 'pausado':
      return (
        <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 px-3 py-1.5">
          <Clock className="h-4 w-4 mr-1.5" />
          Pausado
        </Badge>
      );
    case 'vendido':
      return (
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-3 py-1.5">
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Vendido
        </Badge>
      );
    case 'novo':
    default:
      return (
        <Badge className="bg-muted text-muted-foreground border px-3 py-1.5">
          <Activity className="h-4 w-4 mr-1.5" />
          Sem dados
        </Badge>
      );
  }
}
