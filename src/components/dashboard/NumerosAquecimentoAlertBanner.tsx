import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, X, Eye, ExternalLink, Clock } from 'lucide-react';
import { useNumerosAlertCheck, useMarkAlertShown } from '@/hooks/useNumerosAquecimentoAlerts';
import { usePermissions } from '@/hooks/usePermissions';


const statusColorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400',
};

export function NumerosAquecimentoAlertBanner() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('view_numeros_aquecimento');
  
  const { data: alertData, isLoading } = useNumerosAlertCheck();
  const markAlertShown = useMarkAlertShown();
  
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Don't render if user doesn't have permission
  if (!canView) return null;
  
  // Don't render if loading or no alert needed
  if (isLoading || !alertData?.shouldAlert || dismissed) return null;

  const { numbers, config } = alertData;

  const handleDismiss = () => {
    setDismissed(true);
    markAlertShown.mutate();
  };

  const handleViewDetails = () => {
    setShowDetails(true);
  };

  const handleGoToModule = () => {
    navigate('/admin/numeros');
  };

  // Calculate time since status change for each number
  const getTimeSinceActivity = (numero: { ultima_atividade?: string | null }) => {
    // Extract date from ultima_atividade (format: "st - DD/MM/YYYY")
    const match = numero.ultima_atividade?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return 'Desconhecido';
    
    const [, day, month, year] = match;
    const activityDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h atrás`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
  };

  return (
    <>
      <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                  Atenção: Números requerem ação!
                </h4>
                <Badge variant="destructive" className="text-xs">
                  {numbers.length} número{numbers.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Existem números com status que precisam de sua atenção. 
                {config?.message_template?.replace('{count}', numbers.length.toString())}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300"
                  onClick={handleViewDetails}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Detalhes
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleGoToModule}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ir para o Módulo
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Números que Requerem Atenção
            </DialogTitle>
            <DialogDescription>
              Lista detalhada dos números com status monitorados
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.map((numero) => {
                    const status = numero.status;
                    return (
                      <TableRow key={numero.id}>
                        <TableCell className="font-medium">{numero.numero}</TableCell>
                        <TableCell>{numero.modelo?.nome || '-'}</TableCell>
                        <TableCell>
                          {status && (
                            <Badge className={statusColorMap[status.cor] || statusColorMap.gray}>
                              {status.nome}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {getTimeSinceActivity(numero)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {numero.observacoes || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Fechar
            </Button>
            <Button onClick={handleGoToModule}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir para o Módulo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
