import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Filter, ArrowRight } from "lucide-react";

interface FunnelData {
  views: number;
  checkout: number;
  sales: number;
}

export function ConversionFunnelCard() {
  const [data, setData] = useState<FunnelData>({ views: 0, checkout: 0, sales: 0 });
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchFunnelData = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Views (assuming event_type = 'view')
      const { count: views } = await supabase
        .from("gateway_events")
        .select("*", { count: 'exact', head: true })
        .eq('event_type', 'view')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Checkout Started (assuming event_type = 'checkout_started' or order created but not paid)
      const { count: checkout } = await supabase
        .from("gateway_events")
        .select("*", { count: 'exact', head: true })
        .eq('event_type', 'checkout_started')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Sales (order status = 'paid' or status = 'completed')
      const { count: sales } = await supabase
        .from("gateway_orders")
        .select("*", { count: 'exact', head: true })
        .in('status', ['paid', 'completed'])
        .gte('created_at', thirtyDaysAgo.toISOString());

      setData({
        views: views || 0,
        checkout: checkout || 0,
        sales: sales || 0
      });
      setLoading(false);
    };

    fetchFunnelData();
  }, []);

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          Funil de Conversão (30d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-3 w-full bg-muted rounded-full" />
            <div className="h-3 w-2/3 bg-muted rounded-full" />
            <div className="h-3 w-1/3 bg-muted rounded-full" />
          </div>
        ) : data.views === 0 && data.checkout === 0 && data.sales === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nenhum acesso ou pedido de checkout registrado nos últimos 30 dias.
          </p>
        ) : (
        <div className="space-y-6">

          {/* Views */}
          <div className="relative">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-medium uppercase tracking-wider">Visualizações</span>
              <span className="font-bold">{data.views}</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="flex justify-center -my-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
          </div>

          {/* Checkout */}
          <div className="relative">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-medium uppercase tracking-wider">Checkout Iniciado</span>
              <span className="font-bold">{data.checkout} ({getPercentage(data.checkout, data.views)}%)</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/80" style={{ width: `${getPercentage(data.checkout, data.views)}%` }} />
            </div>
          </div>

          <div className="flex justify-center -my-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
          </div>

          {/* Sales */}
          <div className="relative">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-medium uppercase tracking-wider">Venda Concluída</span>
              <span className="font-bold">{data.sales} ({getPercentage(data.sales, data.checkout)}%)</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${getPercentage(data.sales, data.views)}%` }} />
            </div>
          </div>
        </div>
        )}
      </CardContent>

    </Card>
  );
}
