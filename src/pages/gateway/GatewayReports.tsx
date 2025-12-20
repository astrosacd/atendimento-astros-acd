import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGatewayDashboard, useGatewayOrders } from '@/hooks/useGateway';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted))', 'hsl(142 76% 36%)'];

export default function GatewayReports() {
  const { data: stats, isLoading: loadingStats } = useGatewayDashboard();
  const { orders, isLoading: loadingOrders } = useGatewayOrders();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loadingStats || loadingOrders) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  // Calculate status distribution
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

  // Calculate gateway distribution
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

  // Weekly data
  const weeklyData = stats?.chartData?.slice(-7) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Relatórios</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Vendas dos últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
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
            <CardTitle className="text-base">Receita por Gateway</CardTitle>
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
    </div>
  );
}
