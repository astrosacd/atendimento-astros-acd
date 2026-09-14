import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, UserMinus, Target, Calendar, Info, ShoppingBag, Bot, Calculator, PiggyBank, Briefcase, AlertTriangle, CalendarClock } from 'lucide-react';
import { ReportsAIAnalysis } from '@/components/reports/ReportsAIAnalysis';
import { WeeklyRenewalsReportConfig } from '@/components/reports/WeeklyRenewalsReportConfig';
import { format, subMonths, startOfMonth, endOfMonth, differenceInMonths, parseISO, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// Status de pedidos do gateway considerados pagos
const PAID_ORDER_STATUSES = ['paid', 'approved', 'completed'];

interface ClienteData {
  id: string;
  nome: string;
  cpf: string | null;
  created_at: string;
  updated_at?: string;
  data_renovacao: string;
  valor: number;
  ciclo_cobranca: string;
  moeda: string;
  plano: string | null;
  cobranca_ativa?: boolean;
  cancelado_em?: string | null;
  status_cliente?: string | null;
  servico_agendado?: string | null;
  data_agendamento?: string | null;
}


interface MarketingExpense {
  id: string;
  mes: number;
  ano: number;
  valor: number;
  descricao: string | null;
  dividir_12?: boolean;
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
  const [clientesInativos, setClientesInativos] = useState<ClienteData[]>([]);
  const [clientesRegistro, setClientesRegistro] = useState<ClienteData[]>([]);
  const [purchases, setPurchases] = useState<{ valor: number; moeda: string; cliente_id: string }[]>([]);
  const [marketingExpenses, setMarketingExpenses] = useState<MarketingExpense[]>([]);
  const [newExpenseValue, setNewExpenseValue] = useState('');
  const [clientesRegistroSemValor, setClientesRegistroSemValor] = useState(0);
  const [clientesAgendados, setClientesAgendados] = useState<ClienteData[]>([]);
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
      // Busca clientes recorrentes (ativos + inativos para churn/histórico), registro, compras e gastos
      const naoExcluido = 'excluir_metricas.is.null,excluir_metricas.eq.false';
      // Clientes "Agendado" ficam fora de TODAS as métricas (não é cliente ainda)
      const naoAgendado = 'status_cliente.is.null,status_cliente.neq.agendado';
      const cols = 'id, nome, cpf, created_at, updated_at, data_renovacao, valor, ciclo_cobranca, moeda, plano, cobranca_ativa, cancelado_em, status_cliente, servico_agendado, data_agendamento';
      const [clientesRecorrentesRes, clientesInativosRes, clientesRegistroRes, clientesSemValorRes, agendadosRes, purchasesRes, ordersRes, eventsRes, marketingRes] = await Promise.all([
        supabase.from('clientes').select(cols).eq('cobranca_ativa', true).or(naoExcluido).or(naoAgendado),
        // Inativos recorrentes: cobranca_ativa=false MAS com valor > 0 e ciclo recorrente (não vitalícios)
        supabase.from('clientes').select(cols).eq('cobranca_ativa', false).gt('valor', 0).neq('ciclo_cobranca', 'vitalicio').or(naoExcluido).or(naoAgendado),
        // Vendas únicas: cobranca_ativa=false, valor > 0 e SEM ciclo recorrente (vitalício / sem ciclo)
        supabase.from('clientes').select(cols).eq('cobranca_ativa', false).gt('valor', 0).or('ciclo_cobranca.is.null,ciclo_cobranca.eq.,ciclo_cobranca.eq.vitalicio').or(naoExcluido).or(naoAgendado),
        supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('cobranca_ativa', false).or('valor.is.null,valor.eq.0').or(naoExcluido).or(naoAgendado),
        // Agendados: fora das métricas, exibidos em card próprio
        supabase.from('clientes').select(cols).eq('status_cliente', 'agendado'),
        supabase.from('client_purchases').select('valor, moeda, cliente_id'),
        supabase.from('gateway_orders').select('id, created_at, status, total, currency').gte('created_at', dataInicio),
        supabase.from('gateway_events').select('id, event_type, created_at, slug').gte('created_at', dataInicio),
        supabase.from('marketing_expenses').select('*')
      ]);

      if (clientesRecorrentesRes.data) setClientes(clientesRecorrentesRes.data);
      if (clientesInativosRes.data) setClientesInativos(clientesInativosRes.data);
      if (clientesRegistroRes.data) setClientesRegistro(clientesRegistroRes.data);
      setClientesRegistroSemValor(clientesSemValorRes.count || 0);
      if (agendadosRes.data) setClientesAgendados(agendadosRes.data as ClienteData[]);
      if (purchasesRes.data) setPurchases(purchasesRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (marketingRes.data) setMarketingExpenses(marketingRes.data);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const [newExpenseDesc, setNewExpenseDesc] = useState('');

  const [newExpenseDivide12, setNewExpenseDivide12] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleRequestSave = () => {
    if (!newExpenseValue || isNaN(parseFloat(newExpenseValue))) {
      toast.error('Insira um valor válido');
      return;
    }
    setConfirmDialogOpen(true);
  };

  const handleSaveMarketingExpense = async () => {
    setConfirmDialogOpen(false);
    const today = new Date();
    const mes = getMonth(today) + 1;
    const ano = getYear(today);

    try {
      const { error } = await supabase
        .from('marketing_expenses')
        .upsert({ 
          mes, 
          ano, 
          valor: parseFloat(newExpenseValue),
          dividir_12: newExpenseDivide12,
          descricao: newExpenseDesc || `Gasto de marketing de ${format(today, 'MMMM/yyyy', { locale: ptBR })}`
        }, { onConflict: 'mes,ano' });

      if (error) throw error;
      
      toast.success('Gasto de marketing atualizado!');
      setNewExpenseValue('');
      setNewExpenseDesc('');
      setNewExpenseDivide12(false);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
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

  // LTV Calculation - Separado por moeda
  // Considera ATIVOS + INATIVOS para tempo médio real de vida
  const ltvMetrics = useMemo(() => {
    if (clientes.length === 0 && clientesInativos.length === 0) return {
      ltvBRL: 0, ltvUSD: 0,
      ticketMedioBRL: 0, ticketMedioUSD: 0,
      tempoMedioMeses: 0,
      mrrBRL: 0, mrrUSD: 0,
      clientesBRL: 0, clientesUSD: 0,
      arrBRL: 0, arrUSD: 0,
    };

    const today = new Date();
    // Tolerância de 7 dias para considerar cliente ainda "ativo" para MRR
    const toleranciaDias = 7;
    const dataLimite = new Date(today);
    dataLimite.setDate(dataLimite.getDate() - toleranciaDias);

    // MRR: somente clientes ativos com renovação futura ou recente
    const clientesAtivosMRR = clientes.filter(c => {
      const renovacao = parseISO(c.data_renovacao);
      return renovacao >= dataLimite;
    });

    // BUG FIX: inclui moeda null como BRL (legado)
    const isBRL = (c: ClienteData) => (c.moeda || 'BRL') === 'BRL';
    const isUSD = (c: ClienteData) => c.moeda === 'USD';

    // Universo p/ ticket médio e tempo de vida: ativos + inativos recorrentes
    const todosRecorrentes = [...clientes, ...clientesInativos];
    const todosBRL = todosRecorrentes.filter(isBRL);
    const todosUSD = todosRecorrentes.filter(isUSD);

    const clientesBRLAtivos = clientesAtivosMRR.filter(isBRL);
    const clientesUSDAtivos = clientesAtivosMRR.filter(isUSD);

    // Tempo real de vida (em meses): para ativos = hoje - created_at; para inativos = updated_at (cancelamento aprox) - created_at
    const tempoRealMeses = (c: ClienteData): number => {
      const createdAt = parseISO(c.created_at);
      const ativo = c.cobranca_ativa !== false;
      const dataFim = ativo
        ? today
        : (c.updated_at ? parseISO(c.updated_at) : parseISO(c.data_renovacao));
      const dataFimEfetiva = dataFim < createdAt ? createdAt : dataFim;
      return Math.max(1, differenceInMonths(dataFimEfetiva, createdAt));
    };

    const calcularMetricasPorMoeda = (todos: ClienteData[], ativos: ClienteData[]) => {
      if (todos.length === 0) return { ticketMedio: 0, mrr: 0, ltv: 0, tempoMedio: 0 };

      const valoresMensaisTodos = todos.map(c => {
        const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
        return (c.valor || 0) / cicloMeses;
      });
      const ticketMedio = valoresMensaisTodos.reduce((a, b) => a + b, 0) / valoresMensaisTodos.length;

      const mrr = ativos.reduce((acc, c) => {
        const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
        return acc + (c.valor || 0) / cicloMeses;
      }, 0);

      const temposMeses = todos.map(tempoRealMeses);
      const tempoMedio = temposMeses.reduce((a, b) => a + b, 0) / temposMeses.length;
      const ltv = ticketMedio * tempoMedio;

      return { ticketMedio, mrr, ltv, tempoMedio };
    };

    const metricasBRL = calcularMetricasPorMoeda(todosBRL, clientesBRLAtivos);
    const metricasUSD = calcularMetricasPorMoeda(todosUSD, clientesUSDAtivos);

    // Tempo médio geral (ativos + inativos)
    const todosTempos = todosRecorrentes.map(tempoRealMeses);
    const tempoMedioMeses = todosTempos.length > 0
      ? todosTempos.reduce((a, b) => a + b, 0) / todosTempos.length
      : 0;

    return {
      ltvBRL: metricasBRL.ltv,
      ltvUSD: metricasUSD.ltv,
      ticketMedioBRL: metricasBRL.ticketMedio,
      ticketMedioUSD: metricasUSD.ticketMedio,
      tempoMedioMeses,
      mrrBRL: metricasBRL.mrr,
      mrrUSD: metricasUSD.mrr,
      clientesBRL: clientesAtivosMRR.filter(isBRL).length,
      clientesUSD: clientesAtivosMRR.filter(isUSD).length,
      arrBRL: metricasBRL.mrr * 12,
      arrUSD: metricasUSD.mrr * 12,
    };
  }, [clientes, clientesInativos]);


  // Métricas Profissionais (Business Intelligence)
  const biMetrics = useMemo(() => {
    const today = new Date();
    const currentMonth = getMonth(today) + 1;
    const currentYear = getYear(today);

    // Gasto do mês atual: gastos normais do mês + 1/12 de qualquer gasto com dividir_12 nos últimos 12 meses
    const startOfCalc = subMonths(today, 11); // Olhar 12 meses para trás
    
    const monthlyNormalSpend = marketingExpenses.find(e => e.mes === currentMonth && e.ano === currentYear && !e.dividir_12)?.valor || 0;
    
    const proratedSpend = marketingExpenses
      .filter(e => {
        if (!e.dividir_12) return false;
        const expenseDate = new Date(e.ano, e.mes - 1, 1);
        // O gasto deve estar dentro dos últimos 12 meses em relação ao mês atual do relatório
        return expenseDate <= today && expenseDate >= startOfCalc;
      })
      .reduce((acc, e) => acc + (e.valor / 12), 0);

    const currentMarketingSpend = monthlyNormalSpend + proratedSpend;
    
    // Novos clientes do mês atual (ativos + inativos + registro) — evita subnotificar quem entrou e cancelou
    const startOfThisMonth = startOfMonth(today);
    const endOfThisMonth = endOfMonth(today);
    const noMesAtual = (c: ClienteData) => {
      const createdAt = parseISO(c.created_at);
      return createdAt >= startOfThisMonth && createdAt <= endOfThisMonth;
    };
    const newClientsThisMonth =
      clientes.filter(noMesAtual).length +
      clientesInativos.filter(noMesAtual).length +
      clientesRegistro.filter(noMesAtual).length;

    // CAC = Gasto / Novos Clientes
    const cac = newClientsThisMonth > 0 ? currentMarketingSpend / newClientsThisMonth : 0;

    // ARPU BRL: somente clientes BRL ativos (não dilui com USD)
    const arpu = ltvMetrics.clientesBRL > 0 ? ltvMetrics.mrrBRL / ltvMetrics.clientesBRL : 0;
    const arpuUSD = ltvMetrics.clientesUSD > 0 ? ltvMetrics.mrrUSD / ltvMetrics.clientesUSD : 0;

    // LTV / CAC (BRL — CAC é em BRL)
    const ltvCacRatio = cac > 0 ? ltvMetrics.ltvBRL / cac : 0;

    // Payback = CAC / Ticket Médio Mensal BRL
    const payback = ltvMetrics.ticketMedioBRL > 0 ? cac / ltvMetrics.ticketMedioBRL : 0;

    return {
      cac,
      arpu,
      arpuUSD,
      ltvCacRatio,
      payback,
      newClientsThisMonth,
      currentMarketingSpend
    };
  }, [marketingExpenses, clientes, clientesInativos, clientesRegistro, ltvMetrics]);


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

      const pageViews = monthEvents.filter(e => e.event_type === 'checkout_view').length;
      const checkoutStarts = monthEvents.filter(e => e.event_type === 'checkout_submit').length;
      const completedOrders = monthOrders.filter(o => PAID_ORDER_STATUSES.includes(o.status)).length;

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

  // Funnel de Conversão (dedupe checkout_view por slug+dia para evitar inflar)
  const funnelData = useMemo(() => {
    const viewKeys = new Set<string>();
    events.forEach(e => {
      if (e.event_type === 'checkout_view') {
        const dia = e.created_at.slice(0, 10);
        viewKeys.add(`${e.slug || 'unknown'}::${dia}`);
      }
    });
    const pageViews = viewKeys.size;
    const checkoutStarts = events.filter(e => e.event_type === 'checkout_submit').length;
    const completedOrders = orders.filter(o => PAID_ORDER_STATUSES.includes(o.status)).length;

    return [
      { name: 'Visualizações (únicas)', value: pageViews, percentage: 100 },
      { name: 'Iniciaram Checkout', value: checkoutStarts, percentage: pageViews > 0 ? (checkoutStarts / pageViews) * 100 : 0 },
      { name: 'Compraram', value: completedOrders, percentage: pageViews > 0 ? (completedOrders / pageViews) * 100 : 0 },
    ];
  }, [events, orders]);


  // Separação: cancelado de verdade (tem cancelado_em) x em atraso (só parou de renovar)
  const clientesCancelados = useMemo(
    () => clientesInativos.filter(c => !!c.cancelado_em),
    [clientesInativos]
  );
  const clientesEmAtraso = useMemo(
    () => clientesInativos.filter(c => !c.cancelado_em),
    [clientesInativos]
  );

  // Agendados: fora de todas as métricas, exibidos em card próprio
  const agendadosPrevisto = useMemo(() => {
    const brl = clientesAgendados
      .filter(c => (c.moeda || 'BRL') === 'BRL')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    const usd = clientesAgendados
      .filter(c => c.moeda === 'USD')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    return { brl, usd };
  }, [clientesAgendados]);

  const agendadosVencidos = useMemo(() => {
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return clientesAgendados.filter(c => c.data_agendamento && String(c.data_agendamento).slice(0, 10) < hojeStr).length;
  }, [clientesAgendados]);

  // Receita em risco: MRR dos clientes recorrentes em atraso (não cancelados)
  const receitaEmRisco = useMemo(() => {
    const brl = clientesEmAtraso
      .filter(c => (c.moeda || 'BRL') === 'BRL')
      .reduce((acc, c) => acc + (c.valor || 0) / (CICLO_MESES[c.ciclo_cobranca] || 1), 0);
    const usd = clientesEmAtraso
      .filter(c => c.moeda === 'USD')
      .reduce((acc, c) => acc + (c.valor || 0) / (CICLO_MESES[c.ciclo_cobranca] || 1), 0);
    return { brl, usd, count: clientesEmAtraso.length };
  }, [clientesEmAtraso]);

  // Métricas de Churn — só considera cancelamentos registrados (em atraso não é churn)
  const churnMetrics = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];
    const today = new Date();
    const universo = [...clientes, ...clientesCancelados];

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      // Agrupado por CPF/Nome (empresa, não produto)
      const ativosInicio = new Set(universo.filter(c => {
        const createdAt = parseISO(c.created_at);
        const renovacao = parseISO(c.data_renovacao);
        return createdAt < monthStart && renovacao >= monthStart;
      }).map(c => c.cpf || c.nome));

      const clientesAtivosInicioCount = ativosInicio.size;

      // Perdidos = cancelamento registrado dentro do mês (agrupado por CPF/Nome)
      const perdidosNoMes = new Set(
        clientesCancelados
          .filter(c => {
            if (!c.cancelado_em) return false;
            const cancelado = parseISO(c.cancelado_em);
            return cancelado >= monthStart && cancelado <= monthEnd;
          })
          .map(c => c.cpf || c.nome)
      ).size;

      const taxaChurn = clientesAtivosInicioCount > 0 ? (perdidosNoMes / clientesAtivosInicioCount) * 100 : 0;

      months.push({
        month: monthKey,
        monthLabel,
        value: taxaChurn,
        percentage: taxaChurn,
      });
    }

    return months;
  }, [clientes, clientesCancelados, periodoMeses]);


  // Churn médio
  const churnMedio = useMemo(() => {
    if (churnMetrics.length === 0) return 0;
    const soma = churnMetrics.reduce((acc, m) => acc + m.value, 0);
    return soma / churnMetrics.length;
  }, [churnMetrics]);

  // LTV Calculation - Separado por moeda (Already defined above as part of biMetrics derivation or logic flow)
  // Removing duplicate definition to fix TS2451

  // LTV por Plano
  const ltvPorPlano = useMemo(() => {
    const planos: Record<string, { clientes: ClienteData[], valorTotal: number, count: number }> = {};

    // Apenas BRL: misturar USD distorce ticket médio e MRR por plano
    clientes.filter(c => (c.moeda || 'BRL') === 'BRL').forEach(c => {
      // Normalizar planos: null, undefined, 'Nenhum' ou 'Sem plano' viram 'Individual'
      let plano = c.plano;
      if (!plano || plano === 'Nenhum' || plano === 'Sem plano') {
        plano = 'Individual';
      }
      
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

  // Crescimento MRR — usa ativos + inativos para histórico correto
  const mrrGrowth = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];
    // Série em BRL: somar USD junto inflaria o MRR (1 USD ≠ 1 BRL)
    const universo = [...clientes, ...clientesInativos].filter(c => (c.moeda || 'BRL') === 'BRL');

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      // Cliente estava ativo no fim do mês se foi criado antes e renovação >= fim do mês
      const clientesAtivos = universo.filter(c => {
        const createdAt = parseISO(c.created_at);
        const renovacao = parseISO(c.data_renovacao);
        return createdAt <= monthEnd && renovacao >= monthEnd;
      });

      const mrr = clientesAtivos.reduce((acc, c) => {
        const cicloMeses = CICLO_MESES[c.ciclo_cobranca] || 1;
        return acc + ((c.valor || 0) / cicloMeses);
      }, 0);

      months.push({ month: monthKey, monthLabel, value: mrr });
    }

    return months;
  }, [clientes, clientesInativos, periodoMeses]);

  // Novos clientes por mês (ativos + inativos + registro — incluir quem entrou mesmo que tenha cancelado)
  const novosClientesMes = useMemo(() => {
    const mesesAtras = parseInt(periodoMeses);
    const months: MonthlyMetric[] = [];
    const universo = [...clientes, ...clientesInativos, ...clientesRegistro];

    for (let i = mesesAtras - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });

      const novos = new Set(universo.filter(c => {
        const createdAt = parseISO(c.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      }).map(c => c.cpf || c.nome)).size;

      months.push({ month: monthKey, monthLabel, value: novos });
    }

    return months;
  }, [clientes, clientesInativos, clientesRegistro, periodoMeses]);

  // MRR Waterfall — Novo MRR e Churn MRR do mês corrente (BRL)
  const mrrWaterfall = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const isBRL = (c: ClienteData) => (c.moeda || 'BRL') === 'BRL';
    const valorMensal = (c: ClienteData) => (c.valor || 0) / (CICLO_MESES[c.ciclo_cobranca] || 1);

    const novoMRR = [...clientes, ...clientesInativos]
      .filter(isBRL)
      .filter(c => {
        const createdAt = parseISO(c.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      })
      .reduce((acc, c) => acc + valorMensal(c), 0);

    // Churn MRR: apenas cancelamentos registrados neste mês (em atraso não conta)
    const churnMRR = clientesCancelados
      .filter(isBRL)
      .filter(c => {
        if (!c.cancelado_em) return false;
        const cancelado = parseISO(c.cancelado_em);
        return cancelado >= monthStart && cancelado <= monthEnd;
      })
      .reduce((acc, c) => acc + valorMensal(c), 0);

    const netNovo = novoMRR - churnMRR;
    return { novoMRR, churnMRR, netNovo };
  }, [clientes, clientesCancelados, clientesInativos]);

  // Top 10 clientes por MRR (BRL + USD em colunas separadas)
  const topClientes = useMemo(() => {
    return clientes
      .filter(c => {
        const renovacao = parseISO(c.data_renovacao);
        const limite = new Date();
        limite.setDate(limite.getDate() - 7);
        return renovacao >= limite;
      })
      .map(c => ({
        id: c.id,
        nome: c.nome,
        plano: c.plano || 'Individual',
        moeda: (c.moeda || 'BRL') as 'BRL' | 'USD',
        mrr: (c.valor || 0) / (CICLO_MESES[c.ciclo_cobranca] || 1),
      }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);
  }, [clientes]);

  // NRR (Net Revenue Retention) — aproximação: MRR atual / MRR de 1 mês atrás
  const nrrMetrics = useMemo(() => {
    if (mrrGrowth.length < 2) return { nrrBRL: 0, grrBRL: 0 };
    const mrrAtual = mrrGrowth[mrrGrowth.length - 1].value;
    const mrrAnterior = mrrGrowth[mrrGrowth.length - 2].value;
    const nrrBRL = mrrAnterior > 0 ? (mrrAtual / mrrAnterior) * 100 : 0;
    // GRR aproximado: (MRR anterior - churn) / MRR anterior
    const grrBRL = mrrAnterior > 0 ? ((mrrAnterior - mrrWaterfall.churnMRR) / mrrAnterior) * 100 : 0;
    return { nrrBRL, grrBRL };
  }, [mrrGrowth, mrrWaterfall]);



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
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 min-h-[3.25rem]">
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
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">{subtitle}</p>}
        </div>
        <div className={`flex items-center gap-1 mt-2 text-xs min-h-[1rem] ${
          trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
        }`}>
          {trend && trendValue ? (
            <>
              {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
              {trendValue}
            </>
          ) : null}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
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
            info="Porcentagem de clientes que cancelam por mês. Só conta cancelamento registrado. Ideal: abaixo de 5%"
          />
          <MetricCard
            title="Receita em Risco"
            value={formatCurrency(receitaEmRisco.brl, 'BRL')}
            subtitle={`${receitaEmRisco.count} cliente(s) em atraso${receitaEmRisco.usd > 0 ? ` • ${formatCurrency(receitaEmRisco.usd, 'USD')}` : ''}`}
            icon={AlertTriangle}
            trend={receitaEmRisco.brl > 0 ? 'down' : 'up'}
            trendValue={receitaEmRisco.brl > 0 ? 'Requer contato' : 'Sem pendências'}
            info="Clientes recorrentes que pararam de renovar mas nunca cancelaram formalmente. Não entram no churn nem no MRR."
          />
          <MetricCard
            title="Agendados"
            value={`${clientesAgendados.length}`}
            subtitle={`Valor previsto: ${formatCurrency(agendadosPrevisto.brl, 'BRL')}${agendadosPrevisto.usd > 0 ? ` • ${formatCurrency(agendadosPrevisto.usd, 'USD')}` : ''}${agendadosVencidos > 0 ? ` • ${agendadosVencidos} vencido(s)` : ''}`}
            icon={CalendarClock}
            trend="up"
            trendValue={agendadosVencidos > 0 ? 'Tem vencido' : 'Em dia'}
            info="Cadastros que agendaram um serviço e ainda não fecharam. Não entram em MRR, churn, receita nem receita em risco."
          />
        </div>

        <Tabs defaultValue="conversao" className="space-y-4">
          <TabsList className="bg-muted/50 flex flex-wrap h-auto w-full justify-start gap-1 p-1">
            <TabsTrigger value="conversao" className="flex-shrink-0 text-xs sm:text-sm">Conversão</TabsTrigger>
            <TabsTrigger value="bi" className="flex items-center gap-1 flex-shrink-0 text-xs sm:text-sm">
              <Calculator className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inteligência de Negócio</span>
              <span className="sm:hidden">BI</span>
            </TabsTrigger>
            <TabsTrigger value="churn" className="flex-shrink-0 text-xs sm:text-sm">Churn</TabsTrigger>
            <TabsTrigger value="ltv" className="flex-shrink-0 text-xs sm:text-sm">LTV & Receita</TabsTrigger>
            <TabsTrigger value="crescimento" className="flex-shrink-0 text-xs sm:text-sm">Crescimento</TabsTrigger>
            <TabsTrigger value="vendas-unicas" className="flex-shrink-0 text-xs sm:text-sm">Vendas Únicas</TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1 flex-shrink-0 text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5" />
              Análise IA
            </TabsTrigger>
            <TabsTrigger value="semanal" className="flex items-center gap-1 flex-shrink-0 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5" />
              Relatório Semanal
            </TabsTrigger>
          </TabsList>

          {/* Tab Inteligência de Negócio (BI) */}
          <TabsContent value="bi" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <MetricCard
                title="CAC (Custo por Cliente)"
                value={formatCurrency(biMetrics.cac, 'BRL')}
                subtitle={`Gasto em ${format(new Date(), 'MMMM', { locale: ptBR })}`}
                icon={Users}
                trend={biMetrics.cac > ltvMetrics.ticketMedioBRL ? 'down' : 'up'}
                trendValue={biMetrics.cac > ltvMetrics.ticketMedioBRL ? 'Custo Alto' : 'Custo Bom'}
                info="CAC é o Custo de Aquisição de Cliente. É quanto você pagou para 'comprar' cada cliente novo. Se você gastou R$ 1000 e entraram 10 clientes, seu CAC é R$ 100. Ideal que seja sempre menor que o valor da primeira mensalidade."
              />
              <MetricCard
                title="LTV / CAC (Lucratividade)"
                value={`${biMetrics.ltvCacRatio.toFixed(1)}x`}
                subtitle="ROI sobre a aquisição"
                icon={TrendingUp}
                trend={biMetrics.ltvCacRatio >= 3 ? 'up' : 'down'}
                trendValue={biMetrics.ltvCacRatio >= 3 ? 'Excelente' : 'Atenção'}
                info="Indica quantas vezes o cliente te paga de volta o que você gastou para trazer ele. Ex: 3.0x significa que o cliente te dá 3 vezes mais dinheiro do que custou para trazê-lo. Menos de 1.0x significa prejuízo."
              />
              <MetricCard
                title="Payback (Meses p/ Pagar)"
                value={`${biMetrics.payback.toFixed(1)} meses`}
                subtitle="Tempo de retorno"
                icon={PiggyBank}
                trend={biMetrics.payback <= 6 ? 'up' : 'down'}
                trendValue={biMetrics.payback <= 6 ? 'Recuperação Rápida' : 'Recuperação Lenta'}
                info="O Payback diz quantos meses o cliente precisa ficar pagando a mensalidade para 'se pagar'. Se o Payback é 2 meses, a partir do 3º mês o cliente é lucro puro. Ideal que seja abaixo de 6 meses."
              />
              <MetricCard
                title="ARPU BRL (Faturamento Médio)"
                value={formatCurrency(biMetrics.arpu, 'BRL')}
                subtitle={`USD: ${formatCurrency(biMetrics.arpuUSD, 'USD')}`}
                icon={Briefcase}
                info="ARPU é o faturamento médio por usuário ativo. Calculado separadamente por moeda (BRL e USD) para evitar diluição."
              />
            </div>

            {/* KPIs adicionais — ARR, NRR/GRR, MRR Waterfall */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <MetricCard
                title="ARR BRL (Receita Anual)"
                value={formatCurrency(ltvMetrics.arrBRL, 'BRL')}
                subtitle={`USD: ${formatCurrency(ltvMetrics.arrUSD, 'USD')}`}
                icon={DollarSign}
                info="ARR (Annual Recurring Revenue) = MRR × 12. Mostra a receita recorrente projetada para os próximos 12 meses se nada mudar."
              />
              <MetricCard
                title="NRR (Retenção de Receita)"
                value={`${nrrMetrics.nrrBRL.toFixed(1)}%`}
                subtitle="MRR atual / MRR mês anterior"
                icon={TrendingUp}
                trend={nrrMetrics.nrrBRL >= 100 ? 'up' : 'down'}
                trendValue={nrrMetrics.nrrBRL >= 100 ? 'Crescendo' : 'Encolhendo'}
                info="NRR > 100% significa que a base existente está crescendo (mais upgrades/renovações que cancelamentos). Ideal: > 110% para SaaS."
              />
              <MetricCard
                title="GRR (Retenção Bruta)"
                value={`${nrrMetrics.grrBRL.toFixed(1)}%`}
                subtitle="Sem contar expansões"
                icon={TrendingDown}
                trend={nrrMetrics.grrBRL >= 90 ? 'up' : 'down'}
                trendValue={nrrMetrics.grrBRL >= 90 ? 'Saudável' : 'Alto churn'}
                info="GRR (Gross Revenue Retention) ignora upgrades — mede só quanto da receita você manteve dos clientes que já tinha. Ideal: > 90%."
              />
              <MetricCard
                title="Novo MRR (este mês)"
                value={formatCurrency(mrrWaterfall.novoMRR, 'BRL')}
                subtitle={`Churn: -${formatCurrency(mrrWaterfall.churnMRR, 'BRL')}`}
                icon={TrendingUp}
                trend={mrrWaterfall.netNovo >= 0 ? 'up' : 'down'}
                trendValue={`Líquido: ${formatCurrency(mrrWaterfall.netNovo, 'BRL')}`}
                info="Novo MRR = receita recorrente trazida por clientes novos no mês. Churn MRR = receita perdida com cancelamentos. Líquido positivo = base cresceu."
              />
            </div>

            {/* Top 10 Clientes por MRR */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top 10 Clientes por MRR
                </CardTitle>
                <CardDescription>
                  Quem mais contribui para sua receita recorrente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topClientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente ativo.</p>
                ) : (
                  <div className="space-y-2">
                    {topClientes.map((c, idx) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.plano}</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm whitespace-nowrap">
                          {formatCurrency(c.mrr, c.moeda)}/mês
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>



            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Registrar Investimento do Mês
                  </CardTitle>
                  <CardDescription>
                    Some tudo que você gastou (Anúncios, VPS, ferramentas) para o sistema calcular seu CAC real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="marketing-desc" className="h-5 block truncate">Descrição do gasto</Label>
                      <Input 
                        id="marketing-desc"
                        type="text" 
                        placeholder="Ex: Facebook Ads + VPS + Ferramentas" 
                        value={newExpenseDesc}
                        onChange={(e) => setNewExpenseDesc(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marketing-spend" className="h-5 block truncate">Valor total (R$)</Label>
                      <Input 
                        id="marketing-spend"
                        type="number" 
                        placeholder="Ex: 5000.00" 
                        value={newExpenseValue}
                        onChange={(e) => setNewExpenseValue(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox 
                        id="divide-12" 
                        checked={newExpenseDivide12} 
                        onCheckedChange={(checked) => setNewExpenseDivide12(!!checked)}
                      />
                      <Label 
                        htmlFor="divide-12" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Diluir valor em 12 meses (Investimento anual)
                      </Label>
                    </div>
                  </div>

                  {newExpenseValue && !isNaN(parseFloat(newExpenseValue)) && parseFloat(newExpenseValue) > 0 && (
                    <div className="p-4 rounded-lg border bg-gradient-to-br from-muted/40 to-muted/10 space-y-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <Calculator className="h-3 w-3" /> Pré-visualização do impacto no CAC
                      </p>
                      {newExpenseDivide12 ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-info/10 border border-info/30 rounded-md">
                              <p className="text-[10px] uppercase text-muted-foreground">Por mês (12x)</p>
                              <p className="text-lg font-bold text-info">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(newExpenseValue) / 12)}
                              </p>
                            </div>
                            <div className="p-3 bg-muted/40 rounded-md">
                              <p className="text-[10px] uppercase text-muted-foreground">Total anual</p>
                              <p className="text-lg font-bold text-foreground">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(newExpenseValue))}
                              </p>
                            </div>
                          </div>
                          <div className="border-t border-border/40 pt-2 space-y-1 max-h-40 overflow-y-auto">
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">Cronograma de diluição:</p>
                            {Array.from({ length: 12 }, (_, i) => {
                              const date = new Date();
                              date.setMonth(date.getMonth() + i);
                              const parcela = parseFloat(newExpenseValue) / 12;
                              return (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground capitalize">
                                    {i + 1}ª · {format(date, 'MMM/yyyy', { locale: ptBR })}
                                  </span>
                                  <span className="font-mono font-medium">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-warning/10 border border-warning/30 rounded-md">
                            <p className="text-[10px] uppercase text-muted-foreground">Impacto neste mês</p>
                            <p className="text-lg font-bold text-warning">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(newExpenseValue))}
                            </p>
                          </div>
                          <div className="p-3 bg-muted/40 rounded-md">
                            <p className="text-[10px] uppercase text-muted-foreground">Próximos meses</p>
                            <p className="text-lg font-bold text-foreground">R$ 0,00</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Button 
                    className="w-full md:w-auto"
                    onClick={handleRequestSave}
                  >
                    Salvar e Calcular Métricas
                  </Button>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                    <p className="text-xs font-bold text-primary flex items-center gap-1">
                      <Info className="h-3 w-3" /> DICA DE INVESTIMENTO:
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use a opção <strong>"Diluir em 12 meses"</strong> para gastos que valem pelo ano todo (como licenças anuais ou VPS paga uma vez). Assim o seu CAC não fica "sujo" com um valor altíssimo só no mês que você pagou, e sim distribuído pelo tempo que a ferramenta vai ser usada.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle>Histórico de Investimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {marketingExpenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum gasto registrado ainda.</p>
                    ) : (
                      marketingExpenses.slice(0, 5).map((exp) => (
                        <div key={exp.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">
                              {format(new Date(exp.ano, exp.mes - 1), 'MMMM yyyy', { locale: ptBR })}
                              {exp.dividir_12 && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase">Anual (1/12)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{exp.descricao || 'Investimento em Marketing'}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold block">{formatCurrency(exp.valor, 'BRL')}</span>
                            {exp.dividir_12 && <span className="text-[10px] text-muted-foreground">Rateado: {formatCurrency(exp.valor / 12, 'BRL')}/mês</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

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
                      <strong>Taxa de Churn</strong> = (Cancelamentos registrados no mês ÷ Clientes ativos no início) × 100
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Só conta quem cancelou de verdade. Quem apenas parou de renovar entra em <strong>Receita em Risco</strong>, e vendas de registro (sem renovação) não contam como churn.
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
                    Ticket médio e MRR por plano (somente BRL)
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
                    Receita Recorrente Mensal ao longo do tempo (somente BRL)
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
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
                // Novos campos de BI para IA analisar
                biData: {
                  cac: biMetrics.cac,
                  ltvCac: biMetrics.ltvCacRatio,
                  payback: biMetrics.payback,
                  arpu: biMetrics.arpu,
                  marketingSpend: biMetrics.currentMarketingSpend
                },
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

          <TabsContent value="semanal" className="space-y-4">
            <WeeklyRenewalsReportConfig />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Confirmar Investimento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">Valor total informado</p>
                  <p className="text-2xl font-bold text-foreground">
                    {newExpenseValue && !isNaN(parseFloat(newExpenseValue))
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(newExpenseValue))
                      : 'R$ 0,00'}
                  </p>
                  {newExpenseDesc && (
                    <p className="text-xs text-muted-foreground italic">"{newExpenseDesc}"</p>
                  )}
                </div>

                {newExpenseDivide12 ? (
                  <div className="p-3 bg-info/10 border border-info/30 rounded-lg space-y-2">
                    <p className="text-sm font-bold text-info flex items-center gap-1">
                      <PiggyBank className="h-4 w-4" /> DILUIR EM 12 MESES
                    </p>
                    <p className="text-sm text-foreground">
                      Este investimento será considerado como{' '}
                      <strong className="text-info">
                        {newExpenseValue && !isNaN(parseFloat(newExpenseValue))
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(newExpenseValue) / 12)
                          : 'R$ 0,00'}
                        /mês
                      </strong>{' '}
                      no cálculo do CAC durante os próximos 12 meses.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use esta opção para gastos anuais (ex: licenças, VPS pagas uma vez ao ano).
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg space-y-2">
                    <p className="text-sm font-bold text-warning flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> APLICAR INTEGRALMENTE NESTE MÊS
                    </p>
                    <p className="text-sm text-foreground">
                      O valor cheio será debitado no CAC{' '}
                      <strong className="text-warning">
                        apenas neste mês ({format(new Date(), 'MMMM/yyyy', { locale: ptBR })})
                      </strong>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use esta opção para gastos pontuais (ex: anúncios pagos no mês corrente).
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveMarketingExpense}>
              Confirmar e Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
