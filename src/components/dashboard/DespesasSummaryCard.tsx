import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown, TrendingUp, Minus, ArrowRight } from 'lucide-react';

interface DespesasSummary {
  totalDespesasMes: number;
  despesasPendentes: number;
  despesasAtrasadas: number;
  mrrBrl: number;
  resultado: number;
}

export function DespesasSummaryCard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DespesasSummary>({
    totalDespesasMes: 0,
    despesasPendentes: 0,
    despesasAtrasadas: 0,
    mrrBrl: 0,
    resultado: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Fetch despesas do mês
      const { data: despesas } = await supabase
        .from('despesas')
        .select('valor, moeda, status, data_vencimento');

      // Fetch clientes para MRR (excluindo cadastros marcados como administrativo/parceiro/outros)
      const { data: clientes } = await supabase
        .from('clientes')
        .select('valor, moeda, cobranca_ativa, ciclo_cobranca, data_renovacao')
        .or('excluir_metricas.is.null,excluir_metricas.eq.false')
        .or('status_cliente.is.null,status_cliente.neq.agendado');

      if (!despesas || !clientes) {
        setIsLoading(false);
        return;
      }

      // Filter despesas for current month
      const despesasDoMes = despesas.filter(d => {
        const venc = new Date(d.data_vencimento);
        return venc.getMonth() === currentMonth && 
               venc.getFullYear() === currentYear &&
               d.status !== 'cancelado';
      });

      // Calculate despesas totals
      const totalDespesasMes = despesasDoMes
        .filter(d => (d.moeda || 'BRL') === 'BRL')
        .reduce((acc, d) => acc + (d.valor || 0), 0);

      // Update status for counting
      const despesasPendentes = despesasDoMes.filter(d => {
        if (d.status === 'pago') return false;
        const vencStr = String(d.data_vencimento).slice(0, 10);
        return vencStr >= todayStr;
      }).length;

      const despesasAtrasadas = despesasDoMes.filter(d => {
        if (d.status === 'pago') return false;
        const vencStr = String(d.data_vencimento).slice(0, 10);
        return vencStr < todayStr;
      }).length;

      // Calculate MRR
      const toleranciaDias = 7;
      const dataLimiteMrr = new Date(today);
      dataLimiteMrr.setDate(dataLimiteMrr.getDate() - toleranciaDias);

      const CICLO_MESES: Record<string, number> = {
        mensal: 1,
        bimestral: 2,
        trimestral: 3,
        semestral: 6,
        anual: 12,
      };

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

      const resultado = mrrBrl - totalDespesasMes;

      setSummary({
        totalDespesasMes,
        despesasPendentes,
        despesasAtrasadas,
        mrrBrl,
        resultado,
      });
      setIsLoading(false);
    };

    fetchSummary();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isLucro = summary.resultado > 0;
  const isPrejuizo = summary.resultado < 0;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 hover:border-orange-500/40 transition-colors cursor-pointer group"
      onClick={() => navigate('/despesas')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingDown className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground font-display">
                {formatCurrency(summary.totalDespesasMes)}
              </p>
              <p className="text-xs text-muted-foreground">Despesas do Mês</p>
              {(summary.despesasPendentes > 0 || summary.despesasAtrasadas > 0) && (
                <div className="flex gap-2 mt-1">
                  {summary.despesasPendentes > 0 && (
                    <span className="text-xs text-amber-500">{summary.despesasPendentes} pendente(s)</span>
                  )}
                  {summary.despesasAtrasadas > 0 && (
                    <span className="text-xs text-destructive">{summary.despesasAtrasadas} atrasada(s)</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`text-sm font-semibold flex items-center gap-1 ${
              isLucro ? 'text-primary' : isPrejuizo ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {isLucro ? (
                <TrendingUp className="h-4 w-4" />
              ) : isPrejuizo ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {isLucro && '+'}{formatCurrency(summary.resultado)}
            </div>
            <span className="text-[10px] text-muted-foreground">resultado mensal</span>
            <ArrowRight className="h-4 w-4 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
