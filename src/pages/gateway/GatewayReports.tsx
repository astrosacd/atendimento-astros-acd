import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGatewayDashboard, useGatewayOrders } from '@/hooks/useGateway';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, MousePointerClick, ShoppingCart, Tag, Gift, CreditCard, Eye, CheckCircle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted))', 'hsl(142 76% 36%)', 'hsl(45 93% 47%)'];

interface GatewayEvent {
  id: string;
  event_type: string;
  slug: string | null;
  product_id: string | null;
  order_id: string | null;
  order_bump_id: string | null;
  coupon_code: string | null;
  currency: string | null;
  payment_gateway: string | null;
  created_at: string;
}

export default function GatewayReports() {
  const [dateRange] = useState(7);
  const { data: stats, isLoading: loadingStats } = useGatewayDashboard();
  const { orders, isLoading: loadingOrders } = useGatewayOrders();

  // Fetch gateway events for conversion tracking
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['gateway-events', dateRange],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), dateRange));
      const { data, error } = await supabase
        .from('gateway_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GatewayEvent[];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loadingStats || loadingOrders || loadingEvents) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  // Event counts
  const eventCounts = events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Funnel data
  const funnelData = [
    { name: 'Visualizações', value: eventCounts['checkout_view'] || 0, icon: Eye },
    { name: 'Order Bumps', value: eventCounts['order_bump_selected'] || 0, icon: Gift },
    { name: 'Cupons Aplicados', value: eventCounts['coupon_applied'] || 0, icon: Tag },
    { name: 'Checkout Iniciado', value: eventCounts['checkout_submit'] || 0, icon: ShoppingCart },
    { name: 'Pedidos Criados', value: eventCounts['order_created'] || 0, icon: CheckCircle },
  ];

  // Calculate conversion rates
  const viewToSubmit = eventCounts['checkout_view'] > 0 
    ? ((eventCounts['checkout_submit'] || 0) / eventCounts['checkout_view'] * 100).toFixed(1) 
    : '0.0';
  const submitToOrder = eventCounts['checkout_submit'] > 0 
    ? ((eventCounts['order_created'] || 0) / eventCounts['checkout_submit'] * 100).toFixed(1) 
    : '0.0';
  const orderBumpRate = eventCounts['checkout_view'] > 0 
    ? ((eventCounts['order_bump_selected'] || 0) / eventCounts['checkout_view'] * 100).toFixed(1) 
    : '0.0';
  const couponRate = eventCounts['checkout_view'] > 0 
    ? ((eventCounts['coupon_applied'] || 0) / eventCounts['checkout_view'] * 100).toFixed(1) 
    : '0.0';

  // Order Bumps analysis
  const orderBumpEvents = events.filter(e => e.event_type === 'order_bump_selected');
  const orderBumpsByProduct = orderBumpEvents.reduce((acc, e) => {
    const key = e.order_bump_id || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const orderBumpData = Object.entries(orderBumpsByProduct)
    .map(([id, count]) => ({ name: id.slice(0, 8), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Coupons analysis
  const couponEvents = events.filter(e => e.event_type === 'coupon_applied');
  const couponUsage = couponEvents.reduce((acc, e) => {
    const code = e.coupon_code || 'unknown';
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const couponData = Object.entries(couponUsage)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Daily events chart
  const dailyEvents = events.reduce((acc, event) => {
    const day = format(new Date(event.created_at), 'yyyy-MM-dd');
    if (!acc[day]) {
      acc[day] = { date: day, views: 0, submits: 0, orders: 0 };
    }
    if (event.event_type === 'checkout_view') acc[day].views++;
    if (event.event_type === 'checkout_submit') acc[day].submits++;
    if (event.event_type === 'order_created') acc[day].orders++;
    return acc;
  }, {} as Record<string, { date: string; views: number; submits: number; orders: number }>);

  const chartData = Object.values(dailyEvents)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  // Status distribution
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = [
    { name: 'Pagos', value: statusCounts.paid || 0 },
    { name: 'Cancelados', value: statusCounts.cancelled || 0 },
    { name: 'Abandonados', value: statusCounts.abandoned || 0 },
    { name: 'Pendentes', value: statusCounts.pending || 0 },
  ];

  // Gateway distribution
  const gatewayRevenue = orders
    .filter(o => o.status === 'paid')
    .reduce((acc, order) => {
      const gw = order.payment_gateway || 'Desconhecido';
      acc[gw] = (acc[gw] || 0) + Number(order.total);
      return acc;
    }, {} as Record<string, number>);

  const gatewayData = Object.entries(gatewayRevenue).map(([name, value]) => ({
    name: name === 'stripe' ? 'Stripe' : name === 'mercadopago' ? 'Mercado Pago' : name,
    value,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Relatórios de Conversão</h2>

      <Tabs defaultValue="funnel" className="space-y-6">
        <TabsList>
          <TabsTrigger value="funnel">Funil de Conversão</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        {/* Funnel Tab */}
        <TabsContent value="funnel" className="space-y-6">
          {/* Conversion Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Eye className="h-4 w-4" />
                  <span>Visualizações → Checkout</span>
                </div>
                <p className="text-2xl font-bold text-primary mt-1">{viewToSubmit}%</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span>Checkout → Pedido</span>
                </div>
                <p className="text-2xl font-bold text-green-600 mt-1">{submitToOrder}%</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Gift className="h-4 w-4" />
                  <span>Taxa Order Bump</span>
                </div>
                <p className="text-2xl font-bold text-amber-600 mt-1">{orderBumpRate}%</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Tag className="h-4 w-4" />
                  <span>Taxa de Cupons</span>
                </div>
                <p className="text-2xl font-bold text-purple-600 mt-1">{couponRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Funnel Visualization */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Funil de Conversão (últimos {dateRange} dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnelData.map((step, index) => {
                  const maxValue = Math.max(...funnelData.map(s => s.value)) || 1;
                  const percentage = (step.value / maxValue) * 100;
                  const Icon = step.icon;
                  return (
                    <div key={step.name} className="flex items-center gap-4">
                      <div className="w-32 flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{step.name}</span>
                      </div>
                      <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                        <div
                          className="h-full rounded-full flex items-center justify-end pr-3 text-sm font-medium text-primary-foreground transition-all"
                          style={{
                            width: `${Math.max(percentage, 5)}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        >
                          {step.value}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Bumps Performance */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Order Bumps Mais Selecionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderBumpData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={orderBumpData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Nenhum order bump selecionado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coupons Performance */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Cupons Mais Utilizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {couponData.length > 0 ? (
                  <div className="space-y-3">
                    {couponData.map((coupon, index) => (
                      <div key={coupon.code} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{coupon.code}</code>
                        </div>
                        <span className="font-semibold">{coupon.count}x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Nenhum cupom utilizado
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-6">
          {/* Daily Events Chart */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Eventos por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(label) => format(new Date(label), "dd 'de' MMMM", { locale: ptBR })}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="views" name="Visualizações" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="submits" name="Checkouts" stroke="hsl(45 93% 47%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="orders" name="Pedidos" stroke="hsl(142 76% 36%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Event Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: 'checkout_view', label: 'Visualizações', icon: Eye },
              { key: 'order_bump_selected', label: 'Order Bumps', icon: Gift },
              { key: 'coupon_applied', label: 'Cupons', icon: Tag },
              { key: 'checkout_submit', label: 'Checkouts', icon: ShoppingCart },
              { key: 'order_created', label: 'Pedidos', icon: CheckCircle },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.key} className="border-border/50">
                  <CardContent className="pt-4 text-center">
                    <Icon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-2xl font-bold">{eventCounts[item.key] || 0}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Vendas dos últimos 7 dias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.chartData?.slice(-7) || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `R$${value}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Vendas']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                      />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Status dos Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {statusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Receita por Gateway
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {gatewayData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gatewayData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), 'Receita']} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Nenhuma venda registrada
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Total de pedidos</span>
                    <span className="font-semibold">{orders.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Pedidos pagos</span>
                    <span className="font-semibold text-green-600">{statusCounts.paid || 0}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Taxa de conversão</span>
                    <span className="font-semibold">{(stats?.conversionRate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Ticket médio</span>
                    <span className="font-semibold">{formatCurrency(stats?.avgTicket || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Receita total</span>
                    <span className="font-semibold text-lg">{formatCurrency(stats?.totalSales || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
