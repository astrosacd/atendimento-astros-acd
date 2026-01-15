import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Send, Eye, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProposals } from '@/hooks/useProposals';
import { Skeleton } from '@/components/ui/skeleton';

export function ProposalsStatsCard() {
  const navigate = useNavigate();
  const { stats, isLoading } = useProposals();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total de Propostas',
      value: stats.total,
      icon: FileText,
      color: 'primary',
      bgFrom: 'from-primary/10',
      bgTo: 'to-primary/5',
      borderColor: 'border-primary/20',
      hoverBorder: 'hover:border-primary/40',
      iconBg: 'bg-primary/20',
      iconColor: 'text-primary',
    },
    {
      label: 'Enviadas',
      value: stats.sent,
      icon: Send,
      color: 'blue-500',
      bgFrom: 'from-blue-500/10',
      bgTo: 'to-blue-500/5',
      borderColor: 'border-blue-500/20',
      hoverBorder: 'hover:border-blue-500/40',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Visualizadas',
      value: stats.viewed,
      icon: Eye,
      color: 'amber-500',
      bgFrom: 'from-amber-500/10',
      bgTo: 'to-amber-500/5',
      borderColor: 'border-amber-500/20',
      hoverBorder: 'hover:border-amber-500/40',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-500',
    },
    {
      label: 'Aceitas',
      value: stats.accepted,
      icon: CheckCircle,
      color: 'green-500',
      bgFrom: 'from-green-500/10',
      bgTo: 'to-green-500/5',
      borderColor: 'border-green-500/20',
      hoverBorder: 'hover:border-green-500/40',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-500',
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 font-display">
          <span className="h-5 w-1 bg-primary rounded-full"></span>
          Propostas Comerciais
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary hover:text-primary/80"
          onClick={() => navigate('/propostas')}
        >
          Ver todas
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.label}
              className={`bg-gradient-to-br ${card.bgFrom} ${card.bgTo} ${card.borderColor} ${card.hoverBorder} transition-colors cursor-pointer group`}
              onClick={() => navigate('/propostas')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl ${card.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-6 w-6 ${card.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground font-display">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
