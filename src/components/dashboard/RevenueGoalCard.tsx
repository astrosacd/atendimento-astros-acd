import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, Edit2, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface RevenueGoalProps {
  currentMrr: number;
  goal?: number;
}

export function RevenueGoalCard({ currentMrr, goal: initialGoal = 50000 }: RevenueGoalProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [tempGoal, setTempGoal] = useState(initialGoal.toString());
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedGoal = localStorage.getItem('dashboard_revenue_goal');
    if (savedGoal) {
      setGoal(Number(savedGoal));
      setTempGoal(savedGoal);
    }
  }, []);

  const handleSave = () => {
    const newGoal = Number(tempGoal);
    if (isNaN(newGoal) || newGoal <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um valor válido para a meta.",
        variant: "destructive",
      });
      return;
    }
    
    setGoal(newGoal);
    localStorage.setItem('dashboard_revenue_goal', newGoal.toString());
    setIsOpen(false);
    toast({
      title: "Sucesso",
      description: "Meta mensal atualizada com sucesso!",
    });
  };

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
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold">{percentage.toFixed(1)}%</span>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                  <Edit2 className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60">
                <div className="space-y-3">
                  <h4 className="font-medium leading-none">Editar Meta</h4>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      className="h-8"
                      placeholder="Valor da meta"
                    />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSave}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
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
