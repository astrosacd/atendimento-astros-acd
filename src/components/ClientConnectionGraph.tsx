import { useMemo, useRef, useState } from 'react';
import { useClientConnectionGraph, GraphNode, GraphCategory } from '@/hooks/useClientConnectionGraph';
import {
  Loader2, ShoppingBag, FileSignature, CreditCard, Receipt, ListTodo, Ticket, CalendarDays,
  CalendarClock, User, Key, FileBox, Image, Lock, RotateCcw, GitBranch, History, Sparkles, Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ClientConnectionGraphProps {
  clienteId: string | null;
  height?: number;
  className?: string;
}

const CATEGORY_META: Record<GraphCategory, { label: string; short: string; icon: any; tokenBg: string; tokenText: string; line: string }> = {
  center:      { label: 'Cliente',      short: 'Cliente',  icon: User,          tokenBg: 'bg-primary',       tokenText: 'text-primary-foreground', line: 'hsl(var(--primary))' },
  compra:      { label: 'Compras',      short: 'Compras',  icon: ShoppingBag,   tokenBg: 'bg-emerald-500',   tokenText: 'text-white', line: 'hsl(152 76% 45%)' },
  proposta:    { label: 'Propostas',    short: 'Prop.',    icon: FileSignature, tokenBg: 'bg-violet-500',    tokenText: 'text-white', line: 'hsl(262 70% 60%)' },
  pagamento:   { label: 'Pagamentos',   short: 'Pgto.',    icon: CreditCard,    tokenBg: 'bg-sky-500',       tokenText: 'text-white', line: 'hsl(200 90% 55%)' },
  cobranca:    { label: 'Cobranças',    short: 'Cobr.',    icon: Receipt,       tokenBg: 'bg-amber-500',     tokenText: 'text-white', line: 'hsl(38 95% 55%)' },
  tarefa:      { label: 'Tarefas',      short: 'Tarefas',  icon: ListTodo,      tokenBg: 'bg-orange-500',    tokenText: 'text-white', line: 'hsl(20 90% 55%)' },
  chamado:     { label: 'Chamados',     short: 'Cham.',    icon: Ticket,        tokenBg: 'bg-rose-500',      tokenText: 'text-white', line: 'hsl(350 80% 60%)' },
  evento:      { label: 'Eventos',      short: 'Event.',   icon: CalendarDays,  tokenBg: 'bg-teal-500',      tokenText: 'text-white', line: 'hsl(175 70% 45%)' },
  followup:    { label: 'Follow-ups',   short: 'Follow.',  icon: CalendarClock, tokenBg: 'bg-indigo-500',    tokenText: 'text-white', line: 'hsl(238 70% 60%)' },
  licenca:     { label: 'Licenças',     short: 'Licen.',   icon: Key,           tokenBg: 'bg-yellow-500',    tokenText: 'text-white', line: 'hsl(48 95% 55%)' },
  arquivo:     { label: 'Arquivos',     short: 'Arq.',     icon: FileBox,       tokenBg: 'bg-slate-500',     tokenText: 'text-white', line: 'hsl(215 16% 55%)' },
  logo:        { label: 'Logos',        short: 'Logos',    icon: Image,         tokenBg: 'bg-pink-500',      tokenText: 'text-white', line: 'hsl(330 80% 60%)' },
  credencial:  { label: 'Credenciais',  short: 'Cred.',    icon: Lock,          tokenBg: 'bg-red-600',       tokenText: 'text-white', line: 'hsl(0 75% 50%)' },
  recuperacao: { label: 'Recuperação',  short: 'Recup.',   icon: RotateCcw,     tokenBg: 'bg-lime-600',      tokenText: 'text-white', line: 'hsl(85 70% 45%)' },
  historico:   { label: 'Histórico',    short: 'Hist.',    icon: History,       tokenBg: 'bg-stone-500',     tokenText: 'text-white', line: 'hsl(33 10% 50%)' },
  ia:          { label: 'IA Insights',  short: 'IA',       icon: Sparkles,      tokenBg: 'bg-purple-600',    tokenText: 'text-white', line: 'hsl(270 75% 55%)' },
  grupo:       { label: 'Grupos WPP',   short: 'Grupos',   icon: Users,         tokenBg: 'bg-green-600',     tokenText: 'text-white', line: 'hsl(142 70% 40%)' },
};

const TOTAL_KEY: Record<Exclude<GraphCategory, 'center'>, keyof import('@/hooks/useClientConnectionGraph').GraphTotals> = {
  compra: 'compras', proposta: 'propostas', pagamento: 'pagamentos', cobranca: 'cobrancas',
  tarefa: 'tarefas', chamado: 'chamados', evento: 'eventos', followup: 'followups',
  licenca: 'licencas', arquivo: 'arquivos', logo: 'logos', credencial: 'credenciais',
  recuperacao: 'recuperacoes', historico: 'historicos', ia: 'ias', grupo: 'grupos',
};

const SITUACAO_META = {
  cancelado:    { label: 'Cancelado',    className: 'bg-destructive/10 text-destructive border-destructive/30' },
  inadimplente: { label: 'Inadimplente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  agendado:     { label: 'Agendado',     className: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  registro:     { label: 'Registro',     className: 'bg-muted text-muted-foreground border-border' },
  ativo:        { label: 'Ativo',        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
} as const;

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  ringIndex: number;
}

function layoutNodes(nodes: GraphNode[], width: number, height: number): PositionedNode[] {
  const cx = width / 2;
  const cy = height / 2;

  const total = nodes.length || 1;
  const baseRadius = Math.min(width, height) * 0.32;
  const ringStep = 95;
  const perRing = Math.max(10, Math.min(20, Math.ceil(total / 3)));

  const positioned: PositionedNode[] = [];
  nodes.forEach((node, i) => {
    const ringIndex = Math.floor(i / perRing);
    const indexInRing = i % perRing;
    const inThisRing = Math.min(perRing, total - ringIndex * perRing);
    const radius = baseRadius + ringIndex * ringStep;
    const angleOffset = ringIndex % 2 === 0 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / inThisRing;
    const angle = angleOffset + (indexInRing / inThisRing) * Math.PI * 2;
    positioned.push({
      ...node,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      ringIndex,
    });
  });

  return positioned;
}

export function ClientConnectionGraph({ clienteId, height = 700, className }: ClientConnectionGraphProps) {
  const { data, loading, error } = useClientConnectionGraph(clienteId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<GraphCategory>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);

  // SVG é renderizado em um espaço grande (logical) e reescalado para caber no container
  const width = 1400;
  const svgHeight = Math.max(700, height);

  const visibleNodes = useMemo(() => {
    if (!data) return [];
    if (activeCategories.size === 0) return data.nodes;
    return data.nodes.filter((n) => activeCategories.has(n.category));
  }, [data, activeCategories]);

  const positioned = useMemo(() => layoutNodes(visibleNodes, width, svgHeight), [visibleNodes, svgHeight]);

  const cx = width / 2;
  const cy = svgHeight / 2;

  const toggleCategory = (cat: GraphCategory) => {
    const next = new Set(activeCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setActiveCategories(next);
  };

  if (!clienteId) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Selecione um cliente para visualizar o Mapa de Conexões 360°
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-20 text-destructive text-sm">
          {error || 'Não foi possível carregar o mapa'}
        </CardContent>
      </Card>
    );
  }

  const totalConnections = data.nodes.length;
  const visibleCategories = (Object.keys(CATEGORY_META) as GraphCategory[]).filter((c) => {
    if (c === 'center') return false;
    return ((data.totals as any)[TOTAL_KEY[c as Exclude<GraphCategory, 'center'>]] || 0) > 0;
  });

  // Tooltip: posicionado em coordenadas SVG e ajustado para não escapar
  const hoveredNode = hoveredId ? positioned.find((n) => n.id === hoveredId) : null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Header com totais */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base flex items-center gap-2 flex-wrap">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="truncate">{data.center.label}</span>
              {data.center.status && (() => {
                const s = SITUACAO_META[data.center.status as keyof typeof SITUACAO_META];
                if (!s) return null;
                return (
                  <Badge className={cn('text-[10px] font-semibold border', s.className)} variant="outline">
                    {s.label}
                    {data.center.date ? ` • ${data.center.date}` : ''}
                  </Badge>
                );
              })()}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalConnections} conexões mapeadas {data.totals.valorTotal > 0 && `• Movimentação: R$ ${data.totals.valorTotal.toFixed(2)}`}
            </p>
          </div>
          {/* Filtros por categoria — só mostra quem tem dados */}
          <div className="flex flex-wrap gap-1.5 max-w-full">
            {visibleCategories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = (data.totals as any)[TOTAL_KEY[cat as Exclude<GraphCategory, 'center'>]] || 0;
              const Icon = meta.icon;
              const isActive = activeCategories.size === 0 || activeCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-all',
                    isActive ? 'bg-background hover:bg-muted' : 'opacity-40 hover:opacity-70'
                  )}
                  title={meta.label}
                >
                  <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', meta.tokenBg)} />
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{meta.label}</span>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{count}</Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* SVG Graph */}
        <div ref={containerRef} className="relative w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
          <svg
            viewBox={`0 0 ${width} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="block w-full h-auto"
          >
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Glow central */}
            <circle cx={cx} cy={cy} r={140} fill="url(#centerGlow)" />

            {/* Linhas de conexão */}
            {positioned.map((node) => {
              const meta = CATEGORY_META[node.category];
              const isHighlighted = hoveredId === node.id;
              const isDimmed = hoveredId !== null && !isHighlighted;
              return (
                <line
                  key={`line-${node.id}`}
                  x1={cx}
                  y1={cy}
                  x2={node.x}
                  y2={node.y}
                  stroke={meta.line}
                  strokeWidth={isHighlighted ? 2.5 : 1}
                  strokeOpacity={isDimmed ? 0.08 : isHighlighted ? 0.95 : 0.3}
                  strokeDasharray={isHighlighted ? '0' : '4 3'}
                  style={{ transition: 'all 200ms ease' }}
                />
              );
            })}

            {/* Nó central */}
            <g style={{ cursor: 'default' }}>
              <circle cx={cx} cy={cy} r={52} fill="hsl(var(--primary))" filter="url(#softGlow)" />
              <circle cx={cx} cy={cy} r={52} fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.3} strokeWidth={8} />
              <foreignObject x={cx - 44} y={cy - 44} width={88} height={88}>
                <div className="h-full w-full flex flex-col items-center justify-center text-primary-foreground">
                  <User className="h-7 w-7 mb-0.5" />
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Cliente</div>
                </div>
              </foreignObject>
            </g>

            {/* Label do nó central */}
            <foreignObject x={cx - 130} y={cy + 58} width={260} height={50}>
              <div className="text-center">
                <div className="text-sm font-semibold text-foreground truncate">{data.center.label}</div>
                {data.center.sublabel && (
                  <div className="text-[11px] text-muted-foreground truncate font-mono">{data.center.sublabel}</div>
                )}
              </div>
            </foreignObject>

            {/* Nós ao redor */}
            {positioned.map((node) => {
              const meta = CATEGORY_META[node.category];
              const Icon = meta.icon;
              const isHighlighted = hoveredId === node.id;
              const isDimmed = hoveredId !== null && !isHighlighted;
              const r = isHighlighted ? 24 : 20;
              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer', opacity: isDimmed ? 0.35 : 1, transition: 'opacity 200ms' }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {isHighlighted && (
                    <circle cx={node.x} cy={node.y} r={r + 8} fill={meta.line} fillOpacity={0.15} />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={meta.line}
                    stroke="hsl(var(--background))"
                    strokeWidth={3}
                    style={{ transition: 'r 150ms ease' }}
                  />
                  <foreignObject x={node.x - 11} y={node.y - 11} width={22} height={22}>
                    <div className="h-full w-full flex items-center justify-center text-white">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </foreignObject>

                  {/* Label embaixo do nó com largura maior pra evitar truncate desnecessário */}
                  <foreignObject x={node.x - 85} y={node.y + r + 4} width={170} height={36}>
                    <div className="text-center pointer-events-none">
                      <div className="text-[11px] font-medium text-foreground leading-tight truncate px-1">
                        {node.label}
                      </div>
                      {node.sublabel && (
                        <div className="text-[10px] text-muted-foreground truncate px-1 leading-tight">
                          {node.sublabel}
                        </div>
                      )}
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {/* Tooltip dentro do SVG: posicionamento clamped pra nunca sair da tela */}
            {hoveredNode && (() => {
              const meta = CATEGORY_META[hoveredNode.category];
              const tooltipW = 240;
              const tooltipH = 90;
              const padding = 12;
              // Tenta acima do nó; se não couber, vai pra baixo
              let tx = hoveredNode.x - tooltipW / 2;
              let ty = hoveredNode.y - tooltipH - 30;
              if (ty < padding) ty = hoveredNode.y + 35;
              if (tx < padding) tx = padding;
              if (tx + tooltipW > width - padding) tx = width - padding - tooltipW;
              return (
                <foreignObject x={tx} y={ty} width={tooltipW} height={tooltipH} style={{ pointerEvents: 'none' }}>
                  <div className="rounded-lg border bg-popover px-3 py-2 shadow-xl text-xs">
                    <div className="flex items-center gap-1.5 font-semibold mb-1 text-foreground">
                      <span className={cn('inline-block h-2 w-2 rounded-full', meta.tokenBg)} />
                      {meta.label}
                    </div>
                    <div className="text-foreground font-medium truncate">{hoveredNode.label}</div>
                    {hoveredNode.sublabel && <div className="text-muted-foreground mt-0.5 truncate">{hoveredNode.sublabel}</div>}
                    {hoveredNode.date && <div className="text-muted-foreground mt-0.5">📅 {hoveredNode.date}</div>}
                  </div>
                </foreignObject>
              );
            })()}
          </svg>
        </div>

        {/* Legenda inferior — grid responsivo, item compacto, label curto, sem overflow */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-1.5 border-t bg-muted/20 p-2">
          {visibleCategories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const count = (data.totals as any)[TOTAL_KEY[cat as Exclude<GraphCategory, 'center'>]] || 0;
            return (
              <div
                key={cat}
                className="flex items-center gap-1.5 rounded-md bg-background px-1.5 py-1 border min-w-0"
                title={`${meta.label}: ${count}`}
              >
                <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0', meta.tokenBg)}>
                  <Icon className={cn('h-3 w-3', meta.tokenText)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground leading-none truncate">{meta.short}</div>
                  <div className="text-xs font-bold leading-tight">{count}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
