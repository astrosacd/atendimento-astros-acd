import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { usePermissions } from '@/hooks/usePermissions';

interface MonthlyData {
  mes: string;
  mesNumero: number;
  ano: number;
  totalBrl: number;
  totalUsd: number;
  quantidade: number;
}

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthlyPurchasesCard() {
  const { canViewClients } = usePermissions();
  
  // Only render if user has permission (same as Vendas Únicas section)
  if (!canViewClients) {
    return null;
  }
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Fetch purchases data
  const { data: purchasesData, isLoading } = useQuery({
    queryKey: ['monthly-purchases-stats'],
    queryFn: async () => {
      // Fetch client_purchases
      const { data: purchases, error: purchasesError } = await supabase
        .from('client_purchases')
        .select('valor, moeda, data_compra, created_at');
      
      if (purchasesError) throw purchasesError;

      // Fetch clientes registro (cobranca_ativa = false) with valor > 0
      // Excluindo cadastros marcados como administrativo/parceiro/outros
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('valor, moeda, created_at')
        .eq('cobranca_ativa', false)
        .gt('valor', 0)
        .or('excluir_metricas.is.null,excluir_metricas.eq.false')
        .or('status_cliente.is.null,status_cliente.neq.agendado');
      
      if (clientesError) throw clientesError;

      return { purchases: purchases || [], clientes: clientes || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Process data by month
  const monthlyStats = useMemo(() => {
    if (!purchasesData) return [];

    const monthMap = new Map<string, MonthlyData>();

    // Process purchases
    purchasesData.purchases.forEach(p => {
      const date = new Date(p.data_compra || p.created_at);
      const ano = date.getFullYear();
      const mesNumero = date.getMonth();
      const key = `${ano}-${mesNumero}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          mes: MESES_NOMES[mesNumero],
          mesNumero,
          ano,
          totalBrl: 0,
          totalUsd: 0,
          quantidade: 0,
        });
      }

      const entry = monthMap.get(key)!;
      entry.quantidade++;
      if ((p.moeda || 'BRL') === 'BRL') {
        entry.totalBrl += p.valor || 0;
      } else {
        entry.totalUsd += p.valor || 0;
      }
    });

    // Process clientes registro
    purchasesData.clientes.forEach(c => {
      const date = new Date(c.created_at);
      const ano = date.getFullYear();
      const mesNumero = date.getMonth();
      const key = `${ano}-${mesNumero}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          mes: MESES_NOMES[mesNumero],
          mesNumero,
          ano,
          totalBrl: 0,
          totalUsd: 0,
          quantidade: 0,
        });
      }

      const entry = monthMap.get(key)!;
      entry.quantidade++;
      if ((c.moeda || 'BRL') === 'BRL') {
        entry.totalBrl += c.valor || 0;
      } else {
        entry.totalUsd += c.valor || 0;
      }
    });

    return Array.from(monthMap.values()).sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mesNumero - a.mesNumero;
    });
  }, [purchasesData]);

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set(monthlyStats.map(s => s.ano));
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyStats]);

  // Filter data by selected year and month
  const filteredData = useMemo(() => {
    let data = monthlyStats.filter(s => s.ano === parseInt(selectedYear));
    
    if (selectedMonth !== 'all') {
      data = data.filter(s => s.mesNumero === parseInt(selectedMonth));
    }

    return data.sort((a, b) => a.mesNumero - b.mesNumero);
  }, [monthlyStats, selectedYear, selectedMonth]);

  // Calculate totals for selected period
  const totals = useMemo(() => {
    return filteredData.reduce((acc, d) => ({
      totalBrl: acc.totalBrl + d.totalBrl,
      totalUsd: acc.totalUsd + d.totalUsd,
      quantidade: acc.quantidade + d.quantidade,
    }), { totalBrl: 0, totalUsd: 0, quantidade: 0 });
  }, [filteredData]);

  // Chart data
  const chartData = useMemo(() => {
    if (selectedMonth !== 'all') {
      return filteredData.map(d => ({
        name: d.mes,
        valor: d.totalBrl + d.totalUsd,
        brl: d.totalBrl,
        usd: d.totalUsd,
      }));
    }

    // Show all months of the year
    return MESES_CURTOS.map((mes, idx) => {
      const data = filteredData.find(d => d.mesNumero === idx);
      return {
        name: mes,
        valor: data ? data.totalBrl + data.totalUsd : 0,
        brl: data?.totalBrl || 0,
        usd: data?.totalUsd || 0,
      };
    });
  }, [filteredData, selectedMonth]);

  // Find best and worst months
  const { bestMonth, worstMonth } = useMemo(() => {
    const yearData = monthlyStats.filter(s => s.ano === parseInt(selectedYear));
    if (yearData.length === 0) return { bestMonth: null, worstMonth: null };

    const sorted = [...yearData].sort((a, b) => (b.totalBrl + b.totalUsd) - (a.totalBrl + a.totalUsd));
    return {
      bestMonth: sorted[0],
      worstMonth: sorted[sorted.length - 1],
    };
  }, [monthlyStats, selectedYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-40">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            Vendas Únicas por Mês
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MESES_NOMES.map((mes, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>{mes}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div className="bg-background/50 rounded-lg p-2 border border-purple-500/10">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total (BRL)</p>
            <p className="text-lg font-bold text-purple-500">{formatCurrency(totals.totalBrl)}</p>
          </div>
          {totals.totalUsd > 0 && (
            <div className="bg-background/50 rounded-lg p-2 border border-purple-500/10">
              <p className="text-[10px] text-muted-foreground mb-0.5">Total (USD)</p>
              <p className="text-lg font-bold text-purple-500">{formatCurrencyUsd(totals.totalUsd)}</p>
            </div>
          )}
          <div className="bg-background/50 rounded-lg p-2 border border-purple-500/10">
            <p className="text-[10px] text-muted-foreground mb-0.5">Qtd. Vendas</p>
            <p className="text-lg font-bold text-foreground">{totals.quantidade}</p>
          </div>
          {selectedMonth === 'all' && bestMonth && (
            <div className="bg-background/50 rounded-lg p-2 border border-green-500/20">
              <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                Melhor mês
              </p>
              <p className="text-xs font-semibold text-green-500">{bestMonth.mes}</p>
              <p className="text-[10px] text-muted-foreground">{formatCurrency(bestMonth.totalBrl)}</p>
            </div>
          )}
        </div>

        {/* Chart */}
        {selectedMonth === 'all' && chartData.length > 0 && (
          <div className="h-32 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  className="fill-muted-foreground"
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.valor > 0 ? 'rgb(168, 85, 247)' : 'rgb(168, 85, 247, 0.2)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Month detail when single month selected */}
        {selectedMonth !== 'all' && filteredData.length > 0 && (
          <div className="mt-4 p-4 bg-background/50 rounded-lg border border-purple-500/10">
            <h4 className="font-semibold text-foreground mb-2">
              {MESES_NOMES[parseInt(selectedMonth)]} de {selectedYear}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total em BRL</p>
                <p className="text-2xl font-bold text-purple-500">{formatCurrency(totals.totalBrl)}</p>
              </div>
              {totals.totalUsd > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Total em USD</p>
                  <p className="text-2xl font-bold text-purple-500">{formatCurrencyUsd(totals.totalUsd)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {filteredData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma venda registrada neste período</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
