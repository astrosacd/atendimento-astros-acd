import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, TrendingUp, RefreshCw, AlertTriangle, Lightbulb, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SalesForecast {
  id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  predicted_revenue_brl: number;
  predicted_revenue_usd: number;
  confidence_pct: number;
  pipeline_value_brl: number;
  pipeline_value_usd: number;
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  reasoning: string | null;
  recommended_actions: string[];
  risks: string[];
  opportunities: string[];
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatUSD = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);

export function SalesForecastCard() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [forecast, setForecast] = useState<SalesForecast | null>(null);

  const loadLatest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_forecasts')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setForecast(data as SalesForecast | null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const generateForecast = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('sales-forecast', {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Previsão gerada com sucesso!');
      setForecast(data.forecast);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Erro ao gerar previsão';
      if (msg.includes('429') || msg.toLowerCase().includes('limite')) {
        toast.error('Muitas requisições. Aguarde alguns segundos.');
      } else if (msg.includes('402') || msg.toLowerCase().includes('crédit')) {
        toast.error('Créditos da IA esgotados.');
      } else {
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const confidenceColor = (pct: number) =>
    pct >= 75 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-rose-500';

  const confidenceBadge = (pct: number) =>
    pct >= 75 ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
      : pct >= 50 ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-500 border-rose-500/30';

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Previsão de Vendas com IA</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Forecasting inteligente do pipeline
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={generateForecast}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              {forecast ? 'Atualizar' : 'Gerar previsão'}
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : !forecast ? (
          <div className="text-center py-8">
            <TrendingUp className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Nenhuma previsão gerada ainda
            </p>
            <p className="text-xs text-muted-foreground">
              Clique em "Gerar previsão" para a IA analisar seu pipeline
            </p>
          </div>
        ) : (
          <>
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Receita prevista (BRL)</p>
                <p className="text-xl font-bold text-foreground">
                  {formatBRL(forecast.predicted_revenue_brl)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Total: {formatBRL(forecast.pipeline_value_brl)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Receita prevista (USD)</p>
                <p className="text-xl font-bold text-foreground">
                  {formatUSD(forecast.predicted_revenue_usd)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Total: {formatUSD(forecast.pipeline_value_usd)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Confiança</span>
                  <Badge variant="outline" className={cn('text-[10px] h-4 font-bold px-1', confidenceBadge(forecast.confidence_pct))}>
                    {forecast.confidence_pct}%
                  </Badge>
                </div>
                <Progress value={forecast.confidence_pct} className="h-1.5" />
                <p className={cn('text-[10px] mt-2 leading-tight', confidenceColor(forecast.confidence_pct))}>
                  {forecast.confidence_pct >= 75
                    ? 'Alta confiança.'
                    : forecast.confidence_pct >= 50
                    ? 'Confiança média.'
                    : 'Baixa confiança.'}
                </p>
              </div>
            </div>

            {/* Lead Distribution */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xs text-muted-foreground">Quentes</p>
                <p className="text-lg font-bold text-emerald-500">{forecast.hot_leads}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xs text-muted-foreground">Mornos</p>
                <p className="text-lg font-bold text-amber-500">{forecast.warm_leads}</p>
              </div>
              <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-center">
                <p className="text-xs text-muted-foreground">Frios</p>
                <p className="text-lg font-bold text-sky-500">{forecast.cold_leads}</p>
              </div>
            </div>

            {/* Reasoning */}
            {forecast.reasoning && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-1">💡 Raciocínio da IA</p>
                <p className="text-sm text-foreground/90 leading-relaxed">{forecast.reasoning}</p>
              </div>
            )}

            {/* Actions, Risks, Opportunities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {forecast.recommended_actions?.length > 0 && (
                <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <p className="text-xs font-semibold">Ações recomendadas</p>
                  </div>
                  <ul className="space-y-1.5">
                    {forecast.recommended_actions.map((a, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-emerald-500 shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {forecast.opportunities?.length > 0 && (
                <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-semibold">Oportunidades</p>
                  </div>
                  <ul className="space-y-1.5">
                    {forecast.opportunities.map((o, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-amber-500 shrink-0">•</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {forecast.risks?.length > 0 && (
                <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    <p className="text-xs font-semibold">Riscos</p>
                  </div>
                  <ul className="space-y-1.5">
                    {forecast.risks.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
                        <span className="text-rose-500 shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-right">
              Gerado em {new Date(forecast.generated_at).toLocaleString('pt-BR')}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
