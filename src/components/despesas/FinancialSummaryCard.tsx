import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus, Wallet, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { DespesaStats } from '@/hooks/useDespesas';

interface FinancialSummaryCardProps {
  stats: DespesaStats;
}

interface RevenueData {
  mrrBrl: number;
  mrrUsd: number;
  vendasUnicasBrl: number;
  vendasUnicasUsd: number;
}

export function FinancialSummaryCard({ stats }: FinancialSummaryCardProps) {
  const [revenue, setRevenue] = useState<RevenueData>({
    mrrBrl: 0,
    mrrUsd: 0,
    vendasUnicasBrl: 0,
    vendasUnicasUsd: 0,
  });

  useEffect(() => {
    const fetchRevenue = async () => {
      // Fetch clients for MRR calculation (excluindo cadastros marcados como administrativo/parceiro/outros)
      const { data: clientes } = await supabase
        .from('clientes')
        .select('valor, moeda, cobranca_ativa, ciclo_cobranca, data_renovacao')
        .or('excluir_metricas.is.null,excluir_metricas.eq.false')
        .or('status_cliente.is.null,status_cliente.neq.agendado');

      // Fetch purchases
      const { data: purchases } = await supabase
        .from('client_purchases')
        .select('valor, moeda');

      if (!clientes) return;

      const today = new Date();
      const toleranciaDias = 7;
      const dataLimiteMrr = new Date(today);
      dataLimiteMrr.setHours(0, 0, 0, 0);
      dataLimiteMrr.setDate(dataLimiteMrr.getDate() - toleranciaDias);

      const CICLO_MESES: Record<string, number> = {
        mensal: 1,
        bimestral: 2,
        trimestral: 3,
        semestral: 6,
        anual: 12,
      };

      // Calculate MRR
      const clientesAtivosMRR = clientes.filter(c => {
        if (!c.cobranca_ativa) return false;
        const renovacao = new Date(c.data_renovacao);
        return renovacao >= dataLimiteMrr;
      });

      const mrrBrl = clientesAtivosMRR.reduce((acc, c) => {
        if (c.moeda === 'USD') return acc;
        const ciclo = c.ciclo_cobranca || 'mensal';
        const meses = CICLO_MESES[ciclo] || 1;
        return acc + ((c.valor || 0) / meses);
      }, 0);

      const mrrUsd = clientesAtivosMRR.reduce((acc, c) => {
        if (c.moeda !== 'USD') return acc;
        const ciclo = c.ciclo_cobranca || 'mensal';
        const meses = CICLO_MESES[ciclo] || 1;
        return acc + ((c.valor || 0) / meses);
      }, 0);

      // Calculate single sales (registro clients with value + purchases)
      const clientesRegistroComValor = clientes.filter(c => !c.cobranca_ativa && (c.valor || 0) > 0);
      
      const vendasClientesBrl = clientesRegistroComValor
        .filter(c => (c.moeda || 'BRL') === 'BRL')
        .reduce((acc, c) => acc + (c.valor || 0), 0);
      const vendasClientesUsd = clientesRegistroComValor
        .filter(c => c.moeda === 'USD')
        .reduce((acc, c) => acc + (c.valor || 0), 0);

      const purchasesBrl = purchases?.filter(p => (p.moeda || 'BRL') === 'BRL')
        .reduce((acc, p) => acc + (p.valor || 0), 0) || 0;
      const purchasesUsd = purchases?.filter(p => p.moeda === 'USD')
        .reduce((acc, p) => acc + (p.valor || 0), 0) || 0;

      setRevenue({
        mrrBrl,
        mrrUsd,
        vendasUnicasBrl: vendasClientesBrl + purchasesBrl,
        vendasUnicasUsd: vendasClientesUsd + purchasesUsd,
      });
    };

    fetchRevenue();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Calculate profit/loss
  const totalReceita = revenue.mrrBrl; // Monthly comparison
  const totalDespesa = stats.totalDespesasMes;
  const resultado = totalReceita - totalDespesa;
  const isLucro = resultado > 0;
  const isPrejuizo = resultado < 0;

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-info/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-primary" />
          Resumo Financeiro do Mês
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Receitas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUp className="h-4 w-4 text-primary" />
              Receita Recorrente (MRR)
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(revenue.mrrBrl)}
            </div>
            {revenue.mrrUsd > 0 && (
              <div className="text-sm text-muted-foreground">
                + {formatCurrencyUsd(revenue.mrrUsd)}
              </div>
            )}
          </div>

          {/* Despesas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDown className="h-4 w-4 text-destructive" />
              Despesas do Mês
            </div>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats.totalDespesasMes)}
            </div>
            {stats.totalDespesasMesUsd > 0 && (
              <div className="text-sm text-muted-foreground">
                + {formatCurrencyUsd(stats.totalDespesasMesUsd)}
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isLucro ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : isPrejuizo ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              Resultado
            </div>
            <div className={`text-2xl font-bold ${
              isLucro ? 'text-primary' : isPrejuizo ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {isLucro && '+'}{formatCurrency(resultado)}
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${
              isLucro 
                ? 'bg-primary/10 text-primary' 
                : isPrejuizo 
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {isLucro ? '✓ Lucro' : isPrejuizo ? '✗ Prejuízo' : '— Equilibrado'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
