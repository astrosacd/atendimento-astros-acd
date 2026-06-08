import { useProposalViews } from '@/hooks/useProposalViews';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Eye, 
  ArrowDown, 
  Image, 
  PenLine, 
  CheckCircle, 
  XCircle,
  Smartphone,
  Monitor,
  Clock
} from 'lucide-react';

interface ProposalViewsHistoryProps {
  proposalId: string | undefined;
}

const eventConfig: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string;
}> = {
  opened: { label: 'Proposta aberta', icon: Eye, color: 'bg-blue-500' },
  scroll: { label: 'Scroll na página', icon: ArrowDown, color: 'bg-gray-500' },
  section_viewed: { label: 'Seção visualizada', icon: Eye, color: 'bg-purple-500' },
  gallery_viewed: { label: 'Galeria visualizada', icon: Image, color: 'bg-indigo-500' },
  signature_viewed: { label: 'Área de assinatura vista', icon: PenLine, color: 'bg-orange-500' },
  signed_accepted: { label: 'Proposta ACEITA', icon: CheckCircle, color: 'bg-green-500' },
  signed_rejected: { label: 'Proposta RECUSADA', icon: XCircle, color: 'bg-red-500' },
};

function getDeviceType(userAgent: string | null): 'mobile' | 'desktop' {
  if (!userAgent) return 'desktop';
  const mobileKeywords = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileKeywords.test(userAgent) ? 'mobile' : 'desktop';
}

export function ProposalViewsHistory({ proposalId }: ProposalViewsHistoryProps) {
  const { views, isLoading } = useProposalViews(proposalId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Visualizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (views.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Visualizações
          </CardTitle>
          <CardDescription>
            Acompanhe as interações do cliente com a proposta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma visualização registrada ainda</p>
            <p className="text-sm">O histórico aparecerá quando o cliente acessar a proposta</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group views by date
  const viewsByDate = views.reduce((acc, view) => {
    // Usamos toLocaleDateString para garantir que a data seja interpretada no fuso local do navegador
    const dateObj = new Date(view.created_at);
    const date = format(dateObj, 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(view);
    return acc;
  }, {} as Record<string, typeof views>);

  // Summary stats
  const openCount = views.filter(v => v.event_type === 'opened').length;
  const maxScroll = Math.max(...views.filter(v => v.event_type === 'scroll').map(v => (v.event_data as any)?.percent || 0), 0);
  const hasViewedSignature = views.some(v => v.event_type === 'signature_viewed');
  const signatureEvent = views.find(v => v.event_type === 'signed_accepted' || v.event_type === 'signed_rejected');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Visualizações
        </CardTitle>
        <CardDescription>
          Acompanhe as interações do cliente com a proposta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{openCount}</p>
            <p className="text-xs text-muted-foreground">Visualizações</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{maxScroll}%</p>
            <p className="text-xs text-muted-foreground">Scroll Máximo</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {hasViewedSignature ? '✓' : '✗'}
            </p>
            <p className="text-xs text-muted-foreground">Viu Assinatura</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            {signatureEvent ? (
              <>
                <Badge 
                  variant={signatureEvent.event_type === 'signed_accepted' ? 'default' : 'destructive'}
                  className={signatureEvent.event_type === 'signed_accepted' ? 'bg-green-500' : ''}
                >
                  {signatureEvent.event_type === 'signed_accepted' ? 'Aceita' : 'Recusada'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Status</p>
              </>
            ) : (
              <>
                <Badge variant="secondary">Pendente</Badge>
                <p className="text-xs text-muted-foreground mt-1">Status</p>
              </>
            )}
          </div>
        </div>

        {/* Timeline */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-6">
            {Object.entries(viewsByDate).map(([date, dayViews]) => (
              <div key={date}>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <div className="space-y-2">
                  {dayViews.map((view) => {
                    const config = eventConfig[view.event_type] || { 
                      label: view.event_type, 
                      icon: Eye, 
                      color: 'bg-gray-500' 
                    };
                    const Icon = config.icon;
                    const deviceType = getDeviceType(view.user_agent);
                    const DeviceIcon = deviceType === 'mobile' ? Smartphone : Monitor;

                    return (
                      <div 
                        key={view.id} 
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className={`p-2 rounded-full ${config.color} text-white shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{config.label}</p>
                            <DeviceIcon className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(view.created_at), 'HH:mm:ss')}
                          </p>
                          {view.event_data && Object.keys(view.event_data).length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {view.event_type === 'scroll' && (
                                <span>Scrollou até {(view.event_data as any).percent}%</span>
                              )}
                              {view.event_type === 'opened' && (view.event_data as any).screen_width && (
                                <span>
                                  Tela: {(view.event_data as any).screen_width}x{(view.event_data as any).screen_height}
                                </span>
                              )}
                              {(view.event_type === 'signed_accepted' || view.event_type === 'signed_rejected') && (
                                <div>
                                  <span>
                                    Nome: {(view.event_data as any).signed_name}
                                  </span>
                                  {view.event_type === 'signed_rejected' && (view.event_data as any).rejection_reason && (
                                    <p className="mt-1 text-destructive">
                                      Motivo: {(view.event_data as any).rejection_reason}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
