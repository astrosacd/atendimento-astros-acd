import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RevenueGoalProps {
  currentMrr: number;
  goal?: number;
}

export function RevenueGoalCard({ currentMrr, goal = 50000 }: RevenueGoalProps) {
  const percentage = Math.min((currentMrr / goal) * 100, 100);
  const remaining = Math.max(goal - currentMrr, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Meta Mensal
          </div>
          <span className="text-primary font-bold">{percentage.toFixed(1)}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Progress value={percentage} className="h-2" />
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Atual</p>
              <p className="text-sm font-bold">{formatCurrency(currentMrr)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Meta</p>
              <p className="text-sm font-bold">{formatCurrency(goal)}</p>
            </div>
          </div>

          {remaining > 0 ? (
            <div className="bg-primary/5 rounded-lg p-3 flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">
                Faltam <span className="font-bold text-foreground">{formatCurrency(remaining)}</span> para atingir a meta!
              </p>
            </div>
          ) : (
            <div className="bg-green-500/10 rounded-lg p-3 flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs text-green-700 font-medium">
                Meta atingida! Parabéns! 🎉
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
