import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';

const COLORS = ['hsl(152, 76%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(271, 81%, 56%)', 'hsl(38, 92%, 50%)'];

interface AnaliseAvancadaSectionProps {
  stats: {
    taxaInadimplencia: number;
    previsaoFaturamento: number;
    previsaoFaturamentoUsd: number;
    clientesNovos30d: number;
    pendingUsers: number;
    activeWebhooks: number;
    clientesPorMes: { mes: string; quantidade: number }[];
    clientesPorPlano: { plano: string; quantidade: number }[];
    billingSuccess: number;
    billingErrors: number;
  };
  formatCurrency: (v: number) => string;
  formatCurrencyUsd: (v: number) => string;
}

export function AnaliseAvancadaSection({ stats, formatCurrency, formatCurrencyUsd }: AnaliseAvancadaSectionProps) {
  const { t } = useTranslation();

  const billingData = [
    { name: t('common.success'), value: stats.billingSuccess, fill: 'hsl(152, 76%, 45%)' },
    { name: t('common.error'), value: stats.billingErrors, fill: 'hsl(0, 84%, 60%)' },
  ];

  return (
    <CollapsibleSection
      title="Análise Avançada"
      icon={TrendingUp}
      iconColor="bg-gradient-to-br from-update to-update/80"
      defaultOpen={false}
    >
      {/* Métricas Detalhadas */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-display">{stats.taxaInadimplencia.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.delinquencyRate')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-display">{formatCurrency(stats.previsaoFaturamento)}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.forecast30DaysBrl')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-display">{formatCurrencyUsd(stats.previsaoFaturamentoUsd)}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.forecast30DaysUsd')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-display">{stats.clientesNovos30d}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.newClientsLast30Days')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-display">{stats.pendingUsers}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.pendingApprovals')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-display">{stats.activeWebhooks}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.activeWebhooks')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {stats.clientesPorMes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                  {t('dashboard.clientsByMonth')}
                </CardTitle>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                  {t('dashboard.last6Months')}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.clientesPorMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorQtd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0.4} />
                        <stop offset="50%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" vertical={false} />
                    <XAxis dataKey="mes" stroke="hsl(220, 10%, 55%)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(220, 10%, 55%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(220, 18%, 12%)',
                        border: '1px solid hsl(152, 76%, 35%)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      }}
                      labelStyle={{ color: 'hsl(0, 0%, 98%)', fontWeight: 'bold', marginBottom: '4px' }}
                      itemStyle={{ color: 'hsl(152, 76%, 55%)' }}
                      formatter={(value: number) => [`${value} ${t('dashboard.clients')}`, t('dashboard.registrations')]}
                      cursor={{ stroke: 'hsl(152, 76%, 45%)', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="quantidade"
                      stroke="hsl(152, 76%, 45%)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorQtd)"
                      dot={{ fill: 'hsl(152, 76%, 45%)', strokeWidth: 2, r: 4, stroke: 'hsl(220, 18%, 8%)' }}
                      activeDot={{ r: 6, stroke: 'hsl(152, 76%, 45%)', strokeWidth: 2, fill: 'hsl(220, 18%, 8%)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>
                    {t('common.total')}: {stats.clientesPorMes.reduce((acc, item) => acc + item.quantidade, 0)} {t('dashboard.registrations')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-info animate-pulse" />
                  {t('dashboard.clientsByPlan')}
                </CardTitle>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                  {stats.clientesPorPlano.reduce((acc, item) => acc + item.quantidade, 0)} {t('dashboard.clients')}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {stats.clientesPorPlano.map((_, index) => (
                        <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={1} />
                          <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={stats.clientesPorPlano}
                      dataKey="quantidade"
                      nameKey="plano"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="hsl(220, 18%, 8%)"
                      strokeWidth={2}
                    >
                      {stats.clientesPorPlano.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieGradient-${index})`} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(220, 18%, 12%)',
                        border: '1px solid hsl(217, 91%, 50%)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        color: 'hsl(0, 0%, 98%)',
                      }}
                      labelStyle={{ color: 'hsl(0, 0%, 98%)' }}
                      itemStyle={{ color: 'hsl(0, 0%, 98%)' }}
                      formatter={(value: number, name: string) => [`${value} clientes`, name || 'Sem plano']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2">
                {stats.clientesPorPlano.map((item, index) => (
                  <div key={item.plano} className="flex items-center gap-1.5 text-xs">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-muted-foreground">
                      {item.plano} <span className="text-foreground font-medium">({item.quantidade})</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-warning animate-pulse" />
                  Cobranças (30 dias)
                </CardTitle>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                  {stats.billingSuccess + stats.billingErrors} total
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={billingData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="successGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(152, 76%, 35%)" />
                        <stop offset="100%" stopColor="hsl(152, 76%, 50%)" />
                      </linearGradient>
                      <linearGradient id="errorGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(0, 84%, 50%)" />
                        <stop offset="100%" stopColor="hsl(0, 84%, 65%)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" horizontal={false} />
                    <XAxis type="number" stroke="hsl(220, 10%, 55%)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="hsl(220, 10%, 55%)" fontSize={11} width={55} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(220, 18%, 12%)',
                        border: '1px solid hsl(38, 92%, 50%)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      }}
                      formatter={(value: number) => [`${value} cobranças`, '']}
                      cursor={{ fill: 'hsl(220, 15%, 15%)' }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                      {billingData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#successGradient)' : 'url(#errorGradient)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
                  <p className="text-2xl font-bold text-primary">{stats.billingSuccess}</p>
                  <p className="text-xs text-muted-foreground">Enviadas com sucesso</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
                  <p className="text-2xl font-bold text-destructive">{stats.billingErrors}</p>
                  <p className="text-xs text-muted-foreground">Falhas no envio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </CollapsibleSection>
  );
}
