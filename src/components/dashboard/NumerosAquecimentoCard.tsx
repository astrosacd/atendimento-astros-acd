import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, CheckCircle, Clock, XCircle, ShoppingCart, Loader2, ChevronRight } from 'lucide-react';
import { useNumerosAquecimento, useNumerosStatus } from '@/hooks/useNumerosAquecimento';
import { useTranslation } from 'react-i18next';

export function NumerosAquecimentoCard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: numeros = [], isLoading } = useNumerosAquecimento();
  const { data: statusList = [] } = useNumerosStatus();

  // Calculate stats
  const stats = {
    total: numeros.length,
    ativos: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Ativo').length,
    aquecimento: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Em Aquecimento').length,
    bloqueados: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Bloqueado').length,
    vendidos: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Vendido').length,
  };

  const statItems = [
    { label: t('numberStatus.total'), value: stats.total, icon: Smartphone, color: 'text-primary' },
    { label: t('numberStatus.active'), value: stats.ativos, icon: CheckCircle, color: 'text-green-500' },
    { label: t('numberStatus.warmingUp'), value: stats.aquecimento, icon: Clock, color: 'text-amber-500' },
    { label: t('numberStatus.blocked'), value: stats.bloqueados, icon: XCircle, color: 'text-red-500' },
    { label: t('numberStatus.sold'), value: stats.vendidos, icon: ShoppingCart, color: 'text-blue-500' },
  ];

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50"
      onClick={() => navigate('/admin/numeros-aquecimento')}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {t('numberStatus.title')}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {statItems.map((item) => (
              <div key={item.label} className="text-center">
                <item.icon className={`h-4 w-4 mx-auto mb-1 ${item.color}`} />
                <div className="text-lg font-bold">{item.value}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
