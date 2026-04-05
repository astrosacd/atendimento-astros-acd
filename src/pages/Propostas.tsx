import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  FileText,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Trash2,
  DollarSign,
  Settings,
  BarChart3,
  Mail,
  MessageSquare,
  Repeat,
  User,
} from 'lucide-react';
import { useProposals } from '@/hooks/useProposals';
import { useProposalSections } from '@/hooks/useProposalSections';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { ProposalViewsHistory } from '@/components/proposals/ProposalViewsHistory';
import { TemplateSelectionDialog } from '@/components/proposals/TemplateSelectionDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { statusConfig, type Proposal, type ProposalStatus } from '@/types/proposals';
import type { ProposalTemplate } from '@/data/proposalTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useScheduledSends } from '@/hooks/useScheduledProposals';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-3 w-3" />,
  sent: <Send className="h-3 w-3" />,
  viewed: <Eye className="h-3 w-3" />,
  accepted: <CheckCircle className="h-3 w-3" />,
  rejected: <XCircle className="h-3 w-3" />,
  scheduled: <Clock className="h-3 w-3" />,
};

export default function Propostas() {
  const navigate = useNavigate();
  const { proposals, isLoading, stats, createProposal, deleteProposal, proposalSendChannels } = useProposals();
  const { canCreateProposals } = usePermissions();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewHistoryProposalId, setViewHistoryProposalId] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all pending scheduled sends
  const proposalIds = proposals.map(p => p.id);
  const { data: allScheduledSends = [] } = useQuery({
    queryKey: ['all-scheduled-sends', proposalIds],
    queryFn: async () => {
      if (proposalIds.length === 0) return [];
      const { data, error } = await supabase
        .from('proposal_scheduled_sends')
        .select('proposal_id, status')
        .in('proposal_id', proposalIds)
        .eq('status', 'pending');
      if (error) return [];
      return data;
    },
    enabled: proposalIds.length > 0,
  });

  // Fetch remarketing logs per proposal
  const { data: remarketingLogs = [] } = useQuery({
    queryKey: ['proposal-remarketing-logs', proposalIds],
    queryFn: async () => {
      if (proposalIds.length === 0) return [];
      const { data, error } = await supabase
        .from('proposal_auto_remarketing_logs')
        .select('proposal_id, status, day_number, sent_at, channel')
        .in('proposal_id', proposalIds)
        .order('sent_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: proposalIds.length > 0,
  });

  // Build remarketing count map with details
  const remarketingCounts: Record<string, { sent: number; total: number; logs: any[] }> = {};
  remarketingLogs.forEach((log: any) => {
    if (!remarketingCounts[log.proposal_id]) {
      remarketingCounts[log.proposal_id] = { sent: 0, total: 0, logs: [] };
    }
    remarketingCounts[log.proposal_id].total++;
    remarketingCounts[log.proposal_id].logs.push(log);
    if (log.status === 'sent') remarketingCounts[log.proposal_id].sent++;
  });

  const proposalsWithPendingSchedule = new Set(allScheduledSends.map(s => s.proposal_id));

  const handleCreateWithTemplate = async (template: ProposalTemplate) => {
    setIsCreating(true);
    try {
      const result = await createProposal.mutateAsync(
        template.id === 'blank' ? 'Nova Proposta' : `Nova Proposta - ${template.name}`
      );
      
      if (result?.id && template.sections.length > 0) {
        // Criar seções do template
        for (let i = 0; i < template.sections.length; i++) {
          const section = template.sections[i];
          const insertData = {
            proposal_id: result.id,
            section_type: section.type as string,
            title: section.title,
            content: section.content,
            order_index: i,
            is_visible: true,
          };
          const { error } = await supabase
            .from('proposal_sections')
            .insert(insertData as any);
          if (error) console.error('Error creating section:', error);
        }
      }

      setShowTemplateDialog(false);
      if (result?.id) {
        navigate(`/propostas/${result.id}`);
      }
    } catch (error) {
      console.error('Erro ao criar proposta:', error);
      toast.error('Erro ao criar proposta');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProposal.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const filteredProposals = proposals.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.client?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.manual_client_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.manual_client_email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Propostas Comerciais</h1>
            <p className="text-muted-foreground">
              Gerencie suas propostas e acompanhe o status
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate('/propostas/config')}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            )}
            {canCreateProposals() && (
              <Button onClick={() => setShowTemplateDialog(true)} disabled={isCreating}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Proposta
              </Button>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enviadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.sent}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visualizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{stats.viewed}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aceitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.accepted}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar propostas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista de Propostas */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredProposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma proposta encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {search
                  ? 'Tente ajustar sua busca'
                  : 'Crie sua primeira proposta comercial'}
              </p>
              {!search && canCreateProposals() && (
                <Button onClick={() => setShowTemplateDialog(true)} disabled={isCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Proposta
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onClick={() => navigate(`/propostas/${proposal.id}`)}
                onDelete={isAdmin ? () => setDeleteId(proposal.id) : undefined}
                onViewHistory={() => setViewHistoryProposalId(proposal.id)}
                formatCurrency={formatCurrency}
                sendChannels={proposalSendChannels[proposal.id] || []}
                hasScheduledSend={proposalsWithPendingSchedule.has(proposal.id)}
                remarketingInfo={remarketingCounts[proposal.id]}
              />
            ))}
          </div>
        )}

        {/* Dialog de Histórico de Visualizações */}
        <Dialog open={!!viewHistoryProposalId} onOpenChange={() => setViewHistoryProposalId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Histórico de Interações
              </DialogTitle>
            </DialogHeader>
            <ProposalViewsHistory proposalId={viewHistoryProposalId || undefined} />
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A proposta e todas as suas seções serão
                permanentemente excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Seleção de Template */}
        <TemplateSelectionDialog
          open={showTemplateDialog}
          onOpenChange={setShowTemplateDialog}
          onSelect={handleCreateWithTemplate}
          isLoading={isCreating}
        />
      </div>
    </DashboardLayout>
  );
}

// Componente de Card de Proposta
function ProposalCard({
  proposal,
  onClick,
  onDelete,
  onViewHistory,
  formatCurrency,
  sendChannels,
  hasScheduledSend,
  remarketingInfo,
}: {
  proposal: Proposal;
  onClick: () => void;
  onDelete?: () => void;
  onViewHistory: () => void;
  formatCurrency: (value: number) => string;
  sendChannels: string[];
  hasScheduledSend?: boolean;
  remarketingInfo?: { sent: number; total: number; logs: any[] };
}) {
  const displayStatus = hasScheduledSend && proposal.status === 'draft' ? 'scheduled' : proposal.status;
  const config = displayStatus === 'scheduled'
    ? { label: 'Agendada', color: 'text-purple-600', bgColor: 'bg-purple-100' }
    : statusConfig[proposal.status];

  // Determinar se é cliente manual ou cadastrado
  const isManualClient = !proposal.client_id && proposal.manual_client_name;
  const clientName = proposal.client?.nome || proposal.manual_client_name || null;
  const clientType = isManualClient ? 'Manual' : proposal.client ? 'Cadastrado' : null;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'whatsapp':
        return <MessageSquare className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'email':
        return 'E-mail';
      case 'whatsapp':
        return 'WhatsApp';
      default:
        return channel;
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold truncate">{proposal.title}</h3>
              <Badge
                variant="secondary"
                className={`${config.bgColor} ${config.color} gap-1`}
              >
                {statusIcons[displayStatus] || statusIcons[proposal.status]}
                {config.label}
              </Badge>
              {remarketingInfo && remarketingInfo.total > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="outline"
                      className={`gap-1 text-xs cursor-pointer hover:opacity-80 ${
                        proposal.status === 'accepted' 
                          ? 'border-emerald-500 text-emerald-600' 
                          : proposal.status === 'rejected'
                            ? 'border-destructive text-destructive'
                            : 'border-amber-500 text-amber-600'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye className="h-3 w-3" />
                      {remarketingInfo.sent}x remarketing
                      {proposal.status === 'accepted' 
                        ? ' • Assinou' 
                        : proposal.status === 'rejected'
                          ? ' • Recusou'
                          : ''}
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start" onClick={(e) => e.stopPropagation()}>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <Repeat className="h-3.5 w-3.5" />
                      Histórico de Remarketing
                    </h4>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {remarketingInfo.logs.map((log: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'sent' ? 'bg-emerald-500' : 'bg-destructive'}`} />
                            <span>Dia {log.day_number}</span>
                            {log.channel && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {log.channel === 'email' ? 'E-mail' : log.channel === 'whatsapp' ? 'WhatsApp' : log.channel}
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {log.sent_at ? format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              {/* Nome do cliente com tipo */}
              {clientName && (
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{clientName}</span>
                  {clientType && (
                    <Badge variant="outline" className="text-xs">
                      {clientType}
                    </Badge>
                  )}
                </div>
              )}

              {/* Dados extras quando cliente for manual */}
              {isManualClient && (proposal.manual_client_email || proposal.manual_client_phone) && (
                <div className="text-xs text-muted-foreground">
                  {proposal.manual_client_email && <span>{proposal.manual_client_email}</span>}
                  {proposal.manual_client_email && proposal.manual_client_phone && <span> • </span>}
                  {proposal.manual_client_phone && <span>{proposal.manual_client_phone}</span>}
                </div>
              )}
              <div className="flex items-center gap-4">
                <span>
                  Atualizada em{' '}
                  {format(new Date(proposal.updated_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {proposal.creator && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {proposal.creator.name || proposal.creator.email || 'Usuário'}
                  </span>
                )}
                {sendChannels.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Send className="h-3 w-3" />
                    {sendChannels.map((channel, idx) => (
                      <span key={channel} className="flex items-center gap-0.5">
                        {idx > 0 && ', '}
                        {getChannelIcon(channel)}
                        {getChannelLabel(channel)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {proposal.total_value > 0 && (
              <div className="flex items-center gap-1 text-green-600 font-medium">
                <DollarSign className="h-4 w-4" />
                {formatCurrency(proposal.total_value)}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory();
              }}
              title="Ver histórico de visualizações"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
