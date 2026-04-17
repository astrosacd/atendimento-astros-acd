import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Wallet } from "lucide-react";

interface RevenueByCurrencyProps {
  brl: number;
  usd: number;
}

export function RevenueByCurrencyCard({ brl, usd }: RevenueByCurrencyProps) {
  const data = [
    { name: 'BRL', value: brl, color: 'hsl(152, 76%, 45%)' },
    { name: 'USD', value: usd, color: 'hsl(217, 91%, 60%)' },
  ].filter(d => d.value > 0);

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Receita por Moeda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [formatCurrency(value, name as string), name]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  borderColor: 'hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))'
                }}
                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Total BRL</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(brl, 'BRL')}</p>
          </div>
          <div className="text-center border-l">
            <p className="text-[10px] uppercase text-muted-foreground">Total USD</p>
            <p className="text-sm font-bold text-info">{formatCurrency(usd, 'USD')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
