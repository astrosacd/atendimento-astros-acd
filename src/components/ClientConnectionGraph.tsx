import { useMemo, useState } from 'react';
import { useClientConnectionGraph, GraphNode } from '@/hooks/useClientConnectionGraph';
import { Loader2, ShoppingBag, FileSignature, CreditCard, Receipt, ListTodo, Ticket, CalendarDays, CalendarClock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ClientConnectionGraphProps {
  clienteId: string | null;
  height?: number;
  className?: string;
}

type Category = GraphNode['category'];

const CATEGORY_META: Record<Category, { label: string; icon: any; tokenBg: string; tokenRing: string; tokenText: string; line: string }> = {
  center: { label: 'Cliente', icon: User, tokenBg: 'bg-primary', tokenRing: 'ring-primary/40', tokenText: 'text-primary-foreground', line: 'hsl(var(--primary))' },
  compra: { label: 'Compras', icon: ShoppingBag, tokenBg: 'bg-emerald-500', tokenRing: 'ring-emerald-500/30', tokenText: 'text-white', line: 'hsl(152 76% 45%)' },
  proposta: { label: 'Propostas', icon: FileSignature, tokenBg: 'bg-violet-500', tokenRing: 'ring-violet-500/30', tokenText: 'text-white', line: 'hsl(262 70% 60%)' },
  pagamento: { label: 'Pagamentos', icon: CreditCard, tokenBg: 'bg-sky-500', tokenRing: 'ring-sky-500/30', tokenText: 'text-white', line: 'hsl(200 90% 55%)' },
  cobranca: { label: 'Cobranças', icon: Receipt, tokenBg: 'bg-amber-500', tokenRing: 'ring-amber-500/30', tokenText: 'text-white', line: 'hsl(38 95% 55%)' },
  tarefa: { label: 'Tarefas', icon: ListTodo, tokenBg: 'bg-orange-500', tokenRing: 'ring-orange-500/30', tokenText: 'text-white', line: 'hsl(20 90% 55%)' },
  chamado: { label: 'Chamados', icon: Ticket, tokenBg: 'bg-rose-500', tokenRing: 'ring-rose-500/30', tokenText: 'text-white', line: 'hsl(350 80% 60%)' },
  evento: { label: 'Eventos', icon: CalendarDays, tokenBg: 'bg-teal-500', tokenRing: 'ring-teal-500/30', tokenText: 'text-white', line: 'hsl(175 70% 45%)' },
  followup: { label: 'Follow-ups', icon: CalendarClock, tokenBg: 'bg-indigo-500', tokenRing: 'ring-indigo-500/30', tokenText: 'text-white', line: 'hsl(238 70% 60%)' },
};

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  ringIndex: number;
}

function layoutNodes(nodes: GraphNode[], width: number, height: number): PositionedNode[] {
  const cx = width / 2;
  const cy = height / 2;

  // Agrupar por categoria
  const byCat = new Map<Category, GraphNode[]>();
  nodes.forEach((n) => {
    if (!byCat.has(n.category)) byCat.set(n.category, []);
    byCat.get(n.category)!.push(n);
  });

  const positioned: PositionedNode[] = [];
  const cats = Array.from(byCat.keys());

  // Distribui nós em uma única órbita ao redor do centro, agrupados por categoria
  const allOrdered: { node: GraphNode; cat: Category }[] = [];
  cats.forEach((cat) => {
    byCat.get(cat)!.forEach((n) => allOrdered.push({ node: n, cat }));
  });

  const total = allOrdered.length || 1;
  const baseRadius = Math.min(width, height) * 0.36;
  const ringStep = 70;

  // Se houver muitos nós, distribuir em múltiplas órbitas
  const perRing = Math.min(18, Math.max(8, Math.ceil(total / 2)));

  allOrdered.forEach((item, i) => {
    const ringIndex = Math.floor(i / perRing);
    const indexInRing = i % perRing;
    const inThisRing = Math.min(perRing, total - ringIndex * perRing);
    const radius = baseRadius + ringIndex * ringStep;
    const angleOffset = ringIndex % 2 === 0 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / inThisRing;
    const angle = angleOffset + (indexInRing / inThisRing) * Math.PI * 2;
    positioned.push({
      ...item.node,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      ringIndex,
    });
  });

  return positioned;
}

export function ClientConnectionGraph({ clienteId, height = 600, className }: ClientConnectionGraphProps) {
  const { data, loading, error } = useClientConnectionGraph(clienteId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());

  const width = 1100;

  const visibleNodes = useMemo(() => {
    if (!data) return [];
    if (activeCategories.size === 0) return data.nodes;
    return data.nodes.filter((n) => activeCategories.has(n.category));
  }, [data, activeCategories]);

  const positioned = useMemo(() => layoutNodes(visibleNodes, width, height), [visibleNodes, height]);

  const cx = width / 2;
  const cy = height / 2;

  const toggleCategory = (cat: Category) => {
    const next = new Set(activeCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setActiveCategories(next);
  };

  if (!clienteId) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Selecione um cliente para visualizar o Grafo de Conexões 360°
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
          {error || 'Não foi possível carregar o grafo'}
        </CardContent>
      </Card>
    );
  }

  const totalConnections = data.nodes.length;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Header com totais */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              {data.center.label}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalConnections} conexões mapeadas {data.totals.valorTotal > 0 && `• Movimentação total: R$ ${data.totals.valorTotal.toFixed(2)}`}
            </p>
          </div>
          {/* Filtros por categoria */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_META) as Category[])
              .filter((c) => c !== 'center')
              .map((cat) => {
                const meta = CATEGORY_META[cat];
                const count = (data.totals as any)[cat === 'compra' ? 'compras' : cat === 'proposta' ? 'propostas' : cat === 'pagamento' ? 'pagamentos' : cat === 'cobranca' ? 'cobrancas' : cat === 'tarefa' ? 'tarefas' : cat === 'chamado' ? 'chamados' : cat === 'evento' ? 'eventos' : 'followups'] || 0;
                if (count === 0) return null;
                const Icon = meta.icon;
                const isActive = activeCategories.size === 0 || activeCategories.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all',
                      isActive ? 'bg-background hover:bg-muted' : 'opacity-40 hover:opacity-70'
                    )}
                  >
                    <span className={cn('inline-block h-2 w-2 rounded-full', meta.tokenBg)} />
                    <Icon className="h-3 w-3" />
                    <span className="font-medium">{meta.label}</span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{count}</Badge>
                  </button>
                );
              })}
          </div>
        </div>

        {/* SVG Graph */}
        <div className="relative w-full overflow-x-auto bg-gradient-to-br from-background via-background to-muted/20">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full"
            style={{ minHeight: height }}
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
            <circle cx={cx} cy={cy} r={120} fill="url(#centerGlow)" />

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
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isDimmed ? 0.1 : isHighlighted ? 0.9 : 0.35}
                  strokeDasharray={isHighlighted ? '0' : '4 3'}
                  style={{ transition: 'all 200ms ease' }}
                />
              );
            })}

            {/* Nó central */}
            <g style={{ cursor: 'default' }}>
              <circle
                cx={cx}
                cy={cy}
                r={48}
                fill="hsl(var(--primary))"
                filter="url(#softGlow)"
                className="drop-shadow-lg"
              />
              <circle cx={cx} cy={cy} r={48} fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.3} strokeWidth={8} />
              <foreignObject x={cx - 40} y={cy - 40} width={80} height={80}>
                <div className="h-full w-full flex flex-col items-center justify-center text-primary-foreground">
                  <User className="h-6 w-6 mb-0.5" />
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Cliente</div>
                </div>
              </foreignObject>
            </g>

            {/* Label do nó central */}
            <foreignObject x={cx - 110} y={cy + 52} width={220} height={50}>
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
              const r = isHighlighted ? 26 : 22;
              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer', opacity: isDimmed ? 0.4 : 1, transition: 'opacity 200ms' }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Halo no hover */}
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
                  <foreignObject x={node.x - 12} y={node.y - 12} width={24} height={24}>
                    <div className="h-full w-full flex items-center justify-center text-white">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </foreignObject>

                  {/* Label */}
                  <foreignObject x={node.x - 75} y={node.y + r + 4} width={150} height={40}>
                    <div className="text-center pointer-events-none">
                      <div className="text-[11px] font-medium text-foreground leading-tight truncate px-1">
                        {node.label}
                      </div>
                      {node.sublabel && (
                        <div className="text-[10px] text-muted-foreground truncate px-1">
                          {node.sublabel}
                        </div>
                      )}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* Tooltip flutuante para nó selecionado */}
          {hoveredId && (() => {
            const node = positioned.find((n) => n.id === hoveredId);
            if (!node) return null;
            const meta = CATEGORY_META[node.category];
            const Icon = meta.icon;
            return (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 shadow-lg text-xs"
                style={{
                  left: `${(node.x / width) * 100}%`,
                  top: `${((node.y - 40) / height) * 100}%`,
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </div>
                <div className="text-foreground">{node.label}</div>
                {node.sublabel && <div className="text-muted-foreground mt-0.5">{node.sublabel}</div>}
                {node.date && <div className="text-muted-foreground mt-0.5">📅 {node.date}</div>}
              </div>
            );
          })()}
        </div>

        {/* Legenda inferior com estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 border-t bg-muted/20 p-3">
          {(Object.keys(CATEGORY_META) as Category[])
            .filter((c) => c !== 'center')
            .map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const count = (data.totals as any)[cat === 'compra' ? 'compras' : cat === 'proposta' ? 'propostas' : cat === 'pagamento' ? 'pagamentos' : cat === 'cobranca' ? 'cobrancas' : cat === 'tarefa' ? 'tarefas' : cat === 'chamado' ? 'chamados' : cat === 'evento' ? 'eventos' : 'followups'] || 0;
              return (
                <div key={cat} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 border">
                  <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', meta.tokenBg)}>
                    <Icon className={cn('h-3.5 w-3.5', meta.tokenText)} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{meta.label}</div>
                    <div className="text-sm font-bold leading-tight">{count}</div>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
