import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMinus, TrendingDown, TrendingUp } from "lucide-react";

interface ChurnRateProps {
  churnRate: number;
}

export function ChurnRateCard({ churnRate }: ChurnRateProps) {
  const isHigh = churnRate > 5;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <UserMinus className="h-4 w-4 text-destructive" />
          Taxa de Churn Mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-bold font-display">{churnRate.toFixed(1)}%</p>
          <div className={`flex items-center gap-0.5 text-xs font-medium mb-1 ${isHigh ? 'text-destructive' : 'text-green-500'}`}>
            {isHigh ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isHigh ? 'Alto' : 'Saudável'}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Referente aos últimos 30 dias de cancelamentos.
        </p>
      </CardContent>
    </Card>
  );
}
