import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, UserMinus, Target, Calendar, Info, ShoppingBag, Bot } from 'lucide-react';
import { ReportsAIAnalysis } from '@/components/reports/ReportsAIAnalysis';
import { format, subMonths, startOfMonth, endOfMonth, differenceInMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface ClienteData {
  id: string;
  nome: string;
  created_at: string;
  data_renovacao: string;
  valor: number;
  ciclo_cobranca: string;
  moeda: string;
  plano: string | null;
}

interface GatewayOrder {
  id: string;
  created_at: string;
  status: string;
  total: number;
  currency: string;
}

interface GatewayEvent {
  id: string;
  event_type: string;
  created_at: string;
  slug: string | null;
}

interface MonthlyMetric {
  month: string;
  monthLabel: string;
  value: number;
  percentage?: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

const CICLO_MESES: Record<string, number> = {
  'mensal': 1,
  'bimestral': 2,
  'trimestral': 3,
  'semestral': 6,
  'anual': 12,
};

export default function AdminRelatorios() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [clientesRegistro, setClientesRegistro] = useState<ClienteData[]>([]);
  const [purchases, setPurchases] = useState<{ valor: number; moeda: string; cliente_id: string }[]>([]);
  const [clientesRegistroSemValor, setClientesRegistroSemValor] = useState(0);
  const [orders, setOrders] = useState<GatewayOrder[]>([]);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState('6');

  useEffect(() => {
    fetchData();
  }, [periodoMeses]);

  const fetchData = async () => {
    setLoading(true);
    const mesesAtras = parseInt(periodoMeses);
    const dataInicio = subMonths(new Date(), mesesAtras).toISOString();

    try {
      // Busca clientes recorrentes, clientes registro e histórico de compras
      const [clientesRecorrentesRes, clientesRegistroRes, clientesSemValorRes, purchasesRes, ordersRes, eventsRes] = await Promise.all([
        supabase.from('clientes').select('id, nome, created_at, data_renovacao, valor, ciclo_cobranca, moeda, plano').eq('cobranca_ativa', true),
        supabase.from('clientes').select('id, nome, created_at, data_renovacao, valor, ciclo_cobranca, moeda, plano').eq('cobranca_ativa', false).gt('valor', 0),
        supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('cobranca_ativa', false).or('valor.is.null,valor.eq.0'),
        supabase.from('client_purchases').select('valor, moeda, cliente_id'),
        supabase.from('gateway_orders').select('id, created_at, status, total, currency').gte('created_at', dataInicio),
        supabase.from('gateway_events').select('id, event_type, created_at, slug').gte('created_at', dataInicio),
      ]);

      if (clientesRecorrentesRes.data) setClientes(clientesRecorrentesRes.data);
      if (clientesRegistroRes.data) setClientesRegistro(clientesRegistroRes.data);
      setClientesRegistroSemValor(clientesSemValorRes.count || 0);
      if (purchasesRes.data) setPurchases(purchasesRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Métricas de Vendas Únicas (Clientes Registro + Histórico de Compras)
  const vendasUnicasMetrics = useMemo(() => {
    // Clientes registro com valor > 0
    const registroBRL = clientesRegistro.filter(c => (c.moeda || 'BRL') === 'BRL');
    const registroUSD = clientesRegistro.filter(c => c.moeda === 'USD');
    
    // Histórico de compras
    const purchasesBRL = purchases.filter(p => (p.moeda || 'BRL') === 'BRL');
    const purchasesUSD = purchases.filter(p => p.moeda === 'USD');

    const totalClientesBRL = registroBRL.reduce((acc, c) => acc + (c.valor || 0), 0);
    const totalClientesUSD = registroUSD.reduce((acc, c) => acc + (c.valor || 0), 0);
    const totalPurchasesBRL = purchasesBRL.reduce((acc, p) => acc + (p.valor || 0), 0);
    const totalPurchasesUSD = purchasesUSD.reduce((acc, p) => acc + (p.valor || 0), 0);

    const totalBRL = totalClientesBRL + totalPurchasesBRL;
    const totalUSD = totalClientesUSD + totalPurchasesUSD;
    const totalItems = clientesRegistro.length + purchases.length;

    return {
      totalClientes: clientesRegistro.length,
      totalCompras: purchases.length,
      totalBRL,
      totalUSD,
      clientesBRL: registroBRL.length,
      clientesUSD: registroUSD.length,
      ticketMedioBRL: totalItems > 0 ? totalBRL / (registroBRL.length + purchasesBRL.length || 1) : 0,
      ticketMedioUSD: (registroUSD.length + purchasesUSD.length) > 0 ? totalUSD / (registroUSD.length + purchasesUSD.length) : 0,
    };
  }, [clientesRegistro, purchases]);

  // Métricas de Conversão (Gateway)
  const conversaoMetrics = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];
    
    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      const monthEvents = events.filter(e => {
        const eventDate = parseISO(e.created_at);
        return eventDate >= monthStart && eventDate <= monthEnd;
      });

      const monthOrders = orders.filter(o => {
        const orderDate = parseISO(o.created_at);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });

      const pageViews = monthEvents.filter(e => e.event_type === 'page_view').length;
      const checkoutStarts = monthEvents.filter(e => e.event_type === 'checkout_started').length;
      const completedOrders = monthOrders.filter(o => o.status === 'completed').length;

      const taxaConversao = pageViews > 0 ? (completedOrders / pageViews) * 100 : 0;

      months.push({
        month: monthKey,
        monthLabel,
        value: taxaConversao,
        percentage: taxaConversao,
      });
    }

    return months;
  }, [events, orders, periodoMeses]);

  // Funnel de Conversão
  const funnelData = useMemo(() => {
    const pageViews = events.filter(e => e.event_type === 'page_view').length;
    const checkoutStarts = events.filter(e => e.event_type === 'checkout_started').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;

    return [
      { name: 'Visualizações', value: pageViews, percentage: 100 },
      { name: 'Iniciaram Checkout', value: checkoutStarts, percentage: pageViews > 0 ? (checkoutStarts / pageViews) * 100 : 0 },
      { name: 'Compraram', value: completedOrders, percentage: pageViews > 0 ? (completedOrders / pageViews) * 100 : 0 },
    ];
  }, [events, orders]);

  // Métricas de Churn
  const churnMetrics = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];
    const today = new Date();

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      // Agrupamento por CPF ou Nome para considerar "Empresa" ao invés de "Produto"
      // Clientes ativos no início do mês (tinham pelo menos uma assinatura ativa)
      const ativosInicio = new Set(clientes.filter(c => {
        const createdAt = parseISO(c.created_at);
        const renovacao = parseISO(c.data_renovacao);
        // Estava ativo no início do mês: criado antes e renovação após o início
        return createdAt < monthStart && renovacao >= monthStart;
      }).map(c => c.cpf || c.nome));

      const clientesAtivosInicioCount = ativosInicio.size;

      // Clientes que "saíram" no mês (não têm nenhuma assinatura ativa no fim do mês mas tinham no início)
      const perdidosNoMes = Array.from(ativosInicio).filter(identificador => {
        // Busca todas as assinaturas deste cliente
        const assinaturasDoCliente = clientes.filter(c => (c.cpf || c.nome) === identificador);
        
        // Verifica se TODAS as assinaturas dele venceram no mês ou antes e nenhuma renovou após o fim do mês
        const temAssinaturaAtivaNoFim = assinaturasDoCliente.some(c => {
          const renovacao = parseISO(c.data_renovacao);
          return renovacao >= monthEnd;
        });

        return !temAssinaturaAtivaNoFim;
      }).length;

      const taxaChurn = clientesAtivosInicioCount > 0 ? (perdidosNoMes / clientesAtivosInicioCount) * 100 : 0;

      months.push({
        month: monthKey,
        monthLabel,
        value: taxaChurn,
        percentage: taxaChurn,
      });
    }

    return months;
  }, [clientes, periodoMeses]);

  // Churn médio
  const churnMedio = useMemo(() => {
    if (churnMetrics.length === 0) return 0;
    const soma = churnMetrics.reduce((acc, m) => acc + m.value, 0);
    return soma / churnMetrics.length;
  }, [churnMetrics]);

  // LTV Calculation - Separado por moeda
  const ltvMetrics = useMemo(() => {
    if (clientes.length === 0) return { 
      ltvBRL: 0, ltvUSD: 0,
      ticketMedioBRL: 0, ticketMedioUSD: 0,
      tempoMedioMeses: 0, 
      mrrBRL: 0, mrrUSD: 0,
      clientesBRL: 0, clientesUSD: 0
    };

    const today = new Date();
    // Tolerância de 7 dias para considerar cliente ainda "ativo" para MRR
    const toleranciaDias = 7;
    const dataLimite = new Date(today);
    dataLimite.setDate(dataLimite.getDate() - toleranciaDias);

    // Filtrar clientes realmente ativos para MRR (renovação futura ou até 7 dias atrás)
    const clientesAtivosMRR = clientes.filter(c => {
      const renovacao = parseISO(c.data_renovacao);
      return renovacao >= dataLimite;
    });

    const clientesBRL = clientes.filter(c => c.moeda === 'BRL');
    const clientesUSD = clientes.filter(c => c.moeda === 'USD');
    
    // Para MRR: apenas clientes com renovação futura ou recente
    const clientesBRLAtivos = clientesAtivosMRR.filter(c => c.moeda === 'BRL');
    const clientesUSDAtivos = clientesAtivosMRR.filter(c => c.moeda === 'USD');

    const calcularMetricasPorMoeda = (clientesMoeda: ClienteData[], clientesMoedaAtivos: ClienteData[]) => {
      if (clientesMoeda.length === 0) return { ticketMedio: 0, mrr: 0, ltv: 0 };
      
      // Ticket médio considera todos os clientes (histórico)
      const valoresMensaisTodos = clientesMoeda.map(c => {
        const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
        return c.valor / cicloMeses;
      });
      const ticketMedio = valoresMensaisTodos.reduce((a, b) => a + b, 0) / valoresMensaisTodos.length;
      
      // MRR considera apenas clientes ativos (renovação futura ou até 7 dias atrás)
      const valoresMensaisAtivos = clientesMoedaAtivos.map(c => {
        const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
        return c.valor / cicloMeses;
      });
      const mrr = valoresMensaisAtivos.reduce((a, b) => a + b, 0);
      
      const temposMeses = clientesMoeda.map(c => {
        const createdAt = parseISO(c.created_at);
        const renovacao = parseISO(c.data_renovacao);
        const dataFim = renovacao < today ? renovacao : today;
        return Math.max(1, differenceInMonths(dataFim, createdAt));
      });
      const tempoMedio = temposMeses.reduce((a, b) => a + b, 0) / temposMeses.length;
      const ltv = ticketMedio * tempoMedio;
      
      return { ticketMedio, mrr, ltv };
    };

    const metricasBRL = calcularMetricasPorMoeda(clientesBRL, clientesBRLAtivos);
    const metricasUSD = calcularMetricasPorMoeda(clientesUSD, clientesUSDAtivos);

    // Tempo médio geral
    const temposMesesGeral = clientes.map(c => {
      const createdAt = parseISO(c.created_at);
      const renovacao = parseISO(c.data_renovacao);
      const dataFim = renovacao < today ? renovacao : today;
      return Math.max(1, differenceInMonths(dataFim, createdAt));
    });
    const tempoMedioMeses = temposMesesGeral.length > 0 ? temposMesesGeral.reduce((a, b) => a + b, 0) / temposMesesGeral.length : 0;

    return { 
      ltvBRL: metricasBRL.ltv, 
      ltvUSD: metricasUSD.ltv,
      ticketMedioBRL: metricasBRL.ticketMedio, 
      ticketMedioUSD: metricasUSD.ticketMedio,
      tempoMedioMeses, 
      mrrBRL: metricasBRL.mrr, 
      mrrUSD: metricasUSD.mrr,
      clientesBRL: clientesBRL.length,
      clientesUSD: clientesUSD.length
    };
  }, [clientes]);

  // LTV por Plano
  const ltvPorPlano = useMemo(() => {
    const planos: Record<string, { clientes: ClienteData[], valorTotal: number, count: number }> = {};

    clientes.forEach(c => {
      const plano = c.plano || 'Sem plano';
      if (!planos[plano]) {
        planos[plano] = { clientes: [], valorTotal: 0, count: 0 };
      }
      const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
      const valorMensal = c.valor / cicloMeses;
      planos[plano].clientes.push(c);
      planos[plano].valorTotal += valorMensal;
      planos[plano].count++;
    });

    return Object.entries(planos).map(([plano, data]) => ({
      plano,
      ticketMedio: data.valorTotal / data.count,
      clientes: data.count,
      mrr: data.valorTotal,
    })).sort((a, b) => b.mrr - a.mrr);
  }, [clientes]);

  // Crescimento MRR
  const mrrGrowth = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      // MRR no final do mês (clientes ativos com renovação >= final do mês)
      const clientesAtivos = clientes.filter(c => {
        const createdAt = parseISO(c.created_at);
        const renovacao = parseISO(c.data_renovacao);
        return createdAt <= monthEnd && renovacao >= monthEnd;
      });

      const mrr = clientesAtivos.reduce((acc, c) => {
        const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
        return acc + (c.valor / cicloMeses);
      }, 0);

      months.push({
        month: monthKey,
        monthLabel,
        value: mrr,
      });
    }

    return months;
  }, [clientes, periodoMeses]);

  // Novos clientes por mês
  const novosClientesMes = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      const novos = clientes.filter(c => {
        const createdAt = parseISO(c.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      }).length;

      months.push({
        month: monthKey,
        monthLabel,
        value: novos,
      });
    }

    return months;
  }, [clientes, periodoMeses]);

  const formatCurrency = (value: number, currency: 'BRL' | 'USD' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', { 
      style: 'currency', 
      currency 
    }).format(value);
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, info }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: any;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    info?: string;
  }) => (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {title}
          {info && (
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{info}</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && trendValue && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${
            trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('reports.title')}</h1>
            <p className="text-muted-foreground">{t('reports.subtitle')}</p>
          </div>
          <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">{t('reports.last3Months')}</SelectItem>
              <SelectItem value="6">{t('reports.last6Months')}</SelectItem>
              <SelectItem value="12">{t('reports.last12Months')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                MRR por Moeda
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Receita Recorrente Mensal separada por moeda</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">BRL</span>
                <span className="text-lg font-bold">{formatCurrency(ltvMetrics.mrrBRL, 'BRL')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">USD</span>
                <span className="text-lg font-bold">{formatCurrency(ltvMetrics.mrrUSD, 'USD')}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                {ltvMetrics.clientesBRL} clientes BRL • {ltvMetrics.clientesUSD} clientes USD
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                LTV por Moeda
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Lifetime Value separado por moeda</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">BRL</span>
                <span className="text-lg font-bold">{formatCurrency(ltvMetrics.ltvBRL, 'BRL')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">USD</span>
                <span className="text-lg font-bold">{formatCurrency(ltvMetrics.ltvUSD, 'USD')}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                Ticket: {formatCurrency(ltvMetrics.ticketMedioBRL, 'BRL')} • {formatCurrency(ltvMetrics.ticketMedioUSD, 'USD')}/mês
              </p>
            </CardContent>
          </Card>
          <MetricCard
            title="Tempo Médio"
            value={`${ltvMetrics.tempoMedioMeses.toFixed(1)} meses`}
            subtitle="Permanência média dos clientes"
            icon={Calendar}
            info="Tempo médio que um cliente permanece ativo desde o cadastro"
          />
          <MetricCard
            title="Churn Médio"
            value={`${churnMedio.toFixed(1)}%`}
            subtitle="Taxa de cancelamento mensal"
            icon={UserMinus}
            trend={churnMedio > 5 ? 'down' : 'up'}
            trendValue={churnMedio > 5 ? 'Acima do ideal' : 'Saudável'}
            info="Porcentagem de clientes que cancelam por mês. Ideal: abaixo de 5%"
          />
        </div>

        <Tabs defaultValue="conversao" className="space-y-4">
          <TabsList className="bg-muted/50 flex-wrap">
            <TabsTrigger value="conversao">Conversão</TabsTrigger>
            <TabsTrigger value="churn">Churn</TabsTrigger>
            <TabsTrigger value="ltv">LTV & Receita</TabsTrigger>
            <TabsTrigger value="crescimento">Crescimento</TabsTrigger>
            <TabsTrigger value="vendas-unicas">Vendas Únicas</TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" />
              Análise IA
            </TabsTrigger>
          </TabsList>

          {/* Tab Conversão */}
          <TabsContent value="conversao" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Funil de Conversão */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Funil de Conversão
                  </CardTitle>
                  <CardDescription>
                    Do visitante ao cliente (período selecionado)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {funnelData.map((item, index) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="font-medium">{item.value} ({item.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-8 bg-muted rounded-lg overflow-hidden">
                          <div 
                            className="h-full rounded-lg transition-all"
                            style={{ 
                              width: `${item.percentage}%`,
                              backgroundColor: COLORS[index % COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Taxa de Conversão por Mês */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle>Taxa de Conversão por Mês</CardTitle>
                  <CardDescription>
                    % de visitantes que compraram
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={conversaoMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Taxa de Conversão']}
                      />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Churn */}
          <TabsContent value="churn" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Churn por Mês */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserMinus className="h-5 w-5" />
                    Taxa de Churn Mensal
                  </CardTitle>
                  <CardDescription>
                    % de clientes que cancelaram por mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={churnMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Taxa de Churn']}
                      />
                      <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Explicação do Churn */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle>Entendendo o Churn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium">Como é calculado:</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Taxa de Churn</strong> = (Clientes perdidos no mês ÷ Clientes ativos no início) × 100
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-success" />
                      <span className="text-sm">Abaixo de 3%: Excelente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-warning" />
                      <span className="text-sm">Entre 3% e 7%: Aceitável</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                      <span className="text-sm">Acima de 7%: Crítico</span>
                    </div>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm">
                      <strong>Seu churn médio:</strong> {churnMedio.toFixed(1)}%
                      {churnMedio <= 3 && ' - Excelente! Continue assim.'}
                      {churnMedio > 3 && churnMedio <= 7 && ' - Aceitável, mas pode melhorar.'}
                      {churnMedio > 7 && ' - Atenção! Investigue as causas.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab LTV & Receita */}
          <TabsContent value="ltv" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LTV por Plano */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Receita por Plano
                  </CardTitle>
                  <CardDescription>
                    Ticket médio e MRR por plano
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={ltvPorPlano} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis type="category" dataKey="plano" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={100} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [formatCurrency(value), 'MRR']}
                      />
                      <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Explicação do LTV */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle>Entendendo o LTV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium">Como é calculado:</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>LTV</strong> = Ticket Médio Mensal × Tempo Médio de Permanência
                    </p>
                    <div className="text-sm text-muted-foreground mt-2 space-y-1">
                      <strong>Seus cálculos:</strong>
                      {ltvMetrics.clientesBRL > 0 && (
                        <p>BRL: {formatCurrency(ltvMetrics.ticketMedioBRL, 'BRL')} × {ltvMetrics.tempoMedioMeses.toFixed(1)} meses = <strong>{formatCurrency(ltvMetrics.ltvBRL, 'BRL')}</strong></p>
                      )}
                      {ltvMetrics.clientesUSD > 0 && (
                        <p>USD: {formatCurrency(ltvMetrics.ticketMedioUSD, 'USD')} × {ltvMetrics.tempoMedioMeses.toFixed(1)} meses = <strong>{formatCurrency(ltvMetrics.ltvUSD, 'USD')}</strong></p>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-info/10 rounded-lg">
                    <h4 className="font-medium mb-2">Por que isso importa?</h4>
                    <p className="text-sm text-muted-foreground">
                      O LTV ajuda a saber quanto você pode investir para adquirir um novo cliente. 
                      Quanto maior o LTV em relação ao custo de aquisição, melhor sua margem.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Ticket Médio BRL</p>
                      <p className="text-lg font-bold">{formatCurrency(ltvMetrics.ticketMedioBRL, 'BRL')}/mês</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Ticket Médio USD</p>
                      <p className="text-lg font-bold">{formatCurrency(ltvMetrics.ticketMedioUSD, 'USD')}/mês</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Crescimento */}
          <TabsContent value="crescimento" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* MRR Growth */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Evolução do MRR
                  </CardTitle>
                  <CardDescription>
                    Receita Recorrente Mensal ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={mrrGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [formatCurrency(value), 'MRR']}
                      />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--success))" fill="hsl(var(--success)/0.2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Novos Clientes */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Aquisição de Clientes
                  </CardTitle>
                  <CardDescription>
                    Novos clientes por mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={novosClientesMes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number) => [value, 'Novos Clientes']}
                      />
                      <Bar dataKey="value" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Vendas Únicas */}
          <TabsContent value="vendas-unicas" className="space-y-4">
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <ShoppingBag className="h-5 w-5" />
                  Vendas Únicas (Vitalícios / Compras Avulsas)
                  {clientesRegistroSemValor > 0 && (
                    <span 
                      className="text-xs font-normal text-muted-foreground ml-2 cursor-pointer hover:text-purple-500 hover:underline transition-colors"
                      onClick={() => navigate('/consultar?filter=registro-sem-valor')}
                    >
                      * {clientesRegistroSemValor} cliente(s) não contabilizado(s) por não ter valor
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Clientes que pagaram uma vez e não têm recorrência mensal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Esses valores representam vendas de produtos vitalícios ou compras avulsas. 
                  Não são contabilizados no MRR pois não há recorrência.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Clientes Registro
                  </CardTitle>
                  <Users className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{vendasUnicasMetrics.totalClientes}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vendasUnicasMetrics.clientesBRL} BRL • {vendasUnicasMetrics.clientesUSD} USD
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Vendas Únicas (BRL)
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(vendasUnicasMetrics.totalBRL, 'BRL')}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ticket médio: {formatCurrency(vendasUnicasMetrics.ticketMedioBRL, 'BRL')}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Vendas Únicas (USD)
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(vendasUnicasMetrics.totalUSD, 'USD')}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ticket médio: {formatCurrency(vendasUnicasMetrics.ticketMedioUSD, 'USD')}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Geral
                  </CardTitle>
                  <ShoppingBag className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-600">
                    {formatCurrency(vendasUnicasMetrics.totalBRL, 'BRL')}
                  </div>
                  {vendasUnicasMetrics.totalUSD > 0 && (
                    <div className="text-lg font-bold text-purple-600">
                      + {formatCurrency(vendasUnicasMetrics.totalUSD, 'USD')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detalhamento por Plano */}
            {clientesRegistro.length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    Vendas Únicas por Plano/Produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const planos: Record<string, { total: number; count: number }> = {};
                      clientesRegistro.forEach(c => {
                        const plano = c.plano || 'Sem plano';
                        if (!planos[plano]) planos[plano] = { total: 0, count: 0 };
                        planos[plano].total += c.valor || 0;
                        planos[plano].count++;
                      });
                      return Object.entries(planos)
                        .map(([plano, data]) => ({ plano, total: data.total, clientes: data.count }))
                        .sort((a, b) => b.total - a.total);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="plano" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => formatCurrency(value, 'BRL')} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number, name: string) => [
                          name === 'total' ? formatCurrency(value, 'BRL') : value,
                          name === 'total' ? 'Total' : 'Clientes'
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="total" fill="hsl(271, 81%, 56%)" name="Total" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Análise IA */}
          <TabsContent value="ai" className="space-y-4">
            <ReportsAIAnalysis
              metricsData={{
                mrrBRL: ltvMetrics.mrrBRL,
                mrrUSD: ltvMetrics.mrrUSD,
                ltvBRL: ltvMetrics.ltvBRL,
                ltvUSD: ltvMetrics.ltvUSD,
                churnMedio,
                tempoMedioMeses: ltvMetrics.tempoMedioMeses,
                totalClientes: clientes.length,
                clientesBRL: ltvMetrics.clientesBRL,
                clientesUSD: ltvMetrics.clientesUSD,
                ticketMedioBRL: ltvMetrics.ticketMedioBRL,
                ticketMedioUSD: ltvMetrics.ticketMedioUSD,
                churnHistory: churnMetrics.map(m => ({ month: m.monthLabel, value: m.value })),
                mrrHistory: mrrGrowth.map(m => ({ month: m.monthLabel, value: m.value })),
                clientesAtRisk: clientes
                  .filter(c => {
                    const renovacao = parseISO(c.data_renovacao);
                    const now = new Date();
                    const daysUntilRenewal = Math.ceil((renovacao.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return daysUntilRenewal <= 15 && daysUntilRenewal >= -30;
                  })
                  .map(c => ({
                    nome: c.nome,
                    renovacao: c.data_renovacao,
                    valor: c.valor,
                  })),
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
