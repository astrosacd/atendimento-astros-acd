import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, ShoppingCart, Info, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Suggestion {
  product_id: string;
  product_name: string;
  type: 'upsell' | 'cross-sell';
  reason: string;
  confidence: number;
  estimated_value: number;
}

interface AIResponse {
  suggestions: Suggestion[];
  strategy_summary: string;
}

interface ClientAIUpsellProps {
  clienteId: string;
  clienteNome: string;
}

export function ClientAIUpsell({ clienteId, clienteNome }: ClientAIUpsellProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const { toast } = useToast();

  const generateSuggestions = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('client-ai-upsell', {
        body: { clienteId }
      });

      if (error) throw error;
      setResult(data);
      
      toast({
        title: "Análise concluída!",
        description: `${data.suggestions.length} sugestões encontradas para ${clienteNome}.`,
      });
    } catch (error: any) {
      console.error('Error generating upsell suggestions:', error);
      toast({
        title: "Erro na análise",
        description: error.message || "Não foi possível gerar as sugestões.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
            Upsell & Cross-sell IA
          </CardTitle>
          <CardDescription>
            Sugestões inteligentes baseadas no comportamento de compra
          </CardDescription>
        </div>
        <Button 
          onClick={generateSuggestions} 
          disabled={isLoading}
          variant="outline"
          className="gap-2 border-primary/30 hover:bg-primary/10"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          Analisar Oportunidades
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {!result && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">Clique em "Analisar Oportunidades" para descobrir o que oferecer para {clienteNome}.</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">
                A IA está analisando o histórico e tendências...
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {result.strategy_summary && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-primary mb-1">Estratégia Recomendada</h4>
                    <p className="text-sm text-muted-foreground">{result.strategy_summary}</p>
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {result.suggestions.length > 0 ? (
                  result.suggestions.map((suggestion, index) => (
                    <div 
                      key={index} 
                      className="group relative overflow-hidden bg-background/50 border border-border rounded-xl p-4 hover:border-primary/50 transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {suggestion.product_name}
                          </h4>
                          <div className="flex gap-2">
                            <Badge variant={suggestion.type === 'upsell' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">
                              {suggestion.type}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-500">
                              {suggestion.confidence}% Confiança
                            </Badge>
                          </div>
                        </div>
                        {suggestion.estimated_value > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Valor Estimado</p>
                            <p className="font-bold text-emerald-500">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(suggestion.estimated_value)}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {suggestion.reason}
                      </p>
                      
                      <div className="mt-4 flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-emerald-500/30 hover:bg-emerald-500/10">
                          <CheckCircle2 className="w-3 h-3" />
                          Aceitar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground hover:text-destructive">
                          <XCircle className="w-3 h-3" />
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-xl">
                    <p className="text-sm">Nenhuma sugestão relevante no momento.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
