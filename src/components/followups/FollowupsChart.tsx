import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FollowupStats {
  total: number;
  pending: number;
  sent: number;
  converted: number;
  not_converted: number;
}

interface FollowupsChartProps {
  stats: FollowupStats;
  compact?: boolean;
}

const CHART_BARS = [
  { key: 'total',         label: 'Total',       fill: 'hsl(var(--primary))' },
  { key: 'pending',       label: 'Agendados',   fill: '#f59e0b' },
  { key: 'sent',          label: 'Enviados',    fill: '#3b82f6' },
  { key: 'converted',     label: 'Convertidos', fill: '#10b981' },
  { key: 'not_converted', label: 'Não Conv.',   fill: '#f43f5e' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { label, value, fill } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: fill }} />
        <span className="font-medium text-foreground">{label}</span>
        <span className="ml-1 font-bold text-foreground">{value}</span>
      </div>
    </div>
  );
};

export function FollowupsChart({ stats, compact = false }: FollowupsChartProps) {
  const chartData = CHART_BARS.map(b => ({
    label: b.label,
    value: stats[b.key as keyof FollowupStats],
    fill: b.fill,
  }));

  const height = compact ? 140 : 180;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Follow-ups — Visão Geral
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {CHART_BARS.map(b => (
            <span key={b.key} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: b.fill }} />
              {b.label}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            barSize={36}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
