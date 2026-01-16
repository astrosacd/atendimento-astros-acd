import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, FileText, Calendar, User, PenLine } from 'lucide-react';
import { format, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProposalPreview } from '@/components/proposals/ProposalPreview';
import { SignatureCanvas } from '@/components/proposals/SignatureCanvas';
import { RejectProposalDialog } from '@/components/proposals/RejectProposalDialog';
import type { Proposal, ProposalSection, ProposalStatus } from '@/types/proposals';

export default function PropostaPublica() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState('');
  const [clientName, setClientName] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  
  // Tracking refs
  const hasTrackedOpen = useRef(false);
  const trackedSections = useRef<Set<string>>(new Set());
  const maxScrollPercent = useRef(0);
  const signatureSectionRef = useRef<HTMLDivElement>(null);
  const hasTrackedSignatureView = useRef(false);

  // Track event helper
  const trackEvent = useCallback(async (eventType: string, eventData: object = {}) => {
    if (!id) return;
    
    try {
      await supabase.from('proposal_views').insert([{
        proposal_id: id,
        event_type: eventType,
        event_data: eventData as any,
        user_agent: navigator.userAgent,
      }]);
    } catch (err) {
      console.error('Erro ao registrar evento:', err);
    }
  }, [id]);

  // Track scroll
  useEffect(() => {
    if (!proposal || proposal.status === 'accepted' || proposal.status === 'rejected') return;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);
      
      // Track significant scroll milestones (25%, 50%, 75%, 100%)
      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        if (scrollPercent >= milestone && maxScrollPercent.current < milestone) {
          maxScrollPercent.current = milestone;
          trackEvent('scroll', { percent: milestone });
        }
      }

      // Track signature section view
      if (signatureSectionRef.current && !hasTrackedSignatureView.current) {
        const rect = signatureSectionRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          hasTrackedSignatureView.current = true;
          trackEvent('signature_viewed');
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [proposal, trackEvent]);

  // Track gallery views
  const handleGalleryView = useCallback((sectionId: string) => {
    if (!trackedSections.current.has(`gallery_${sectionId}`)) {
      trackedSections.current.add(`gallery_${sectionId}`);
      trackEvent('gallery_viewed', { section_id: sectionId });
    }
  }, [trackEvent]);

  useEffect(() => {
    loadProposal();
  }, [id, token]);

  const loadProposal = async () => {
    if (!id || !token) {
      setError('Link inválido');
      setIsLoading(false);
      return;
    }

    try {
      // Buscar proposta
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select('*, client:clientes(id, nome, email, numero)')
        .eq('id', id)
        .eq('share_token', token)
        .single();

      if (proposalError || !proposalData) {
        setError('Proposta não encontrada ou link expirado');
        setIsLoading(false);
        return;
      }

      setProposal(proposalData as unknown as Proposal);
      
      // Set client name from proposal
      if (proposalData.client?.nome) {
        setClientName(proposalData.client.nome);
      } else if (proposalData.manual_client_name) {
        setClientName(proposalData.manual_client_name);
      }

      // Buscar seções
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('proposal_sections')
        .select('*')
        .eq('proposal_id', id)
        .order('order_index', { ascending: true });

      if (!sectionsError && sectionsData) {
        setSections(sectionsData as ProposalSection[]);
      }

      // Track opened event (only once)
      if (!hasTrackedOpen.current) {
        hasTrackedOpen.current = true;
        await supabase.from('proposal_views').insert({
          proposal_id: id,
          event_type: 'opened',
          event_data: { 
            referrer: document.referrer,
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
          },
          user_agent: navigator.userAgent,
        });

        // Atualizar status para "viewed" se ainda estiver como "sent"
        if (proposalData.status === 'sent') {
          await supabase
            .from('proposals')
            .update({ status: 'viewed' as ProposalStatus })
            .eq('id', id);
          setProposal((prev) => (prev ? { ...prev, status: 'viewed' as ProposalStatus } : null));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar proposta:', err);
      setError('Erro ao carregar proposta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!proposal || !clientSignature) {
      toast.error('Por favor, assine a proposta antes de aceitar');
      return;
    }

    if (!clientName.trim()) {
      toast.error('Por favor, informe seu nome');
      return;
    }

    setIsAccepting(true);
    try {
      const signedAt = new Date().toISOString();
      
      const { error } = await supabase
        .from('proposals')
        .update({
          status: 'accepted' as ProposalStatus,
          client_signature: clientSignature,
          signed_at: signedAt,
          signed_status: 'accepted',
          signed_name: clientName.trim(),
          signature_image: clientSignature,
        })
        .eq('id', proposal.id);

      if (error) throw error;

      // Track signing
      await trackEvent('signed_accepted', { 
        signed_name: clientName.trim(),
        signed_at: signedAt,
      });

      setProposal((prev) => (prev ? { 
        ...prev, 
        status: 'accepted' as ProposalStatus,
        signed_at: signedAt,
      } : null));
      
      toast.success('Proposta aceita com sucesso!');
    } catch (err) {
      console.error('Erro ao aceitar proposta:', err);
      toast.error('Erro ao aceitar proposta');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleOpenRejectDialog = () => {
    if (!clientName.trim()) {
      toast.error('Por favor, informe seu nome antes de recusar');
      return;
    }
    setShowRejectDialog(true);
  };

  const handleReject = async (reason: string) => {
    if (!proposal) return;

    setIsRejecting(true);
    try {
      const signedAt = new Date().toISOString();
      
      const { error } = await supabase
        .from('proposals')
        .update({ 
          status: 'rejected' as ProposalStatus,
          signed_at: signedAt,
          signed_status: 'rejected',
          signed_name: clientName.trim(),
          rejection_reason: reason || null,
        })
        .eq('id', proposal.id);

      if (error) throw error;

      // Track rejection
      await trackEvent('signed_rejected', { 
        signed_name: clientName.trim(),
        signed_at: signedAt,
        rejection_reason: reason || null,
      });

      setProposal((prev) => (prev ? { 
        ...prev, 
        status: 'rejected' as ProposalStatus,
        signed_at: signedAt,
        rejection_reason: reason || null,
      } : null));
      
      setShowRejectDialog(false);
      toast.success('Proposta recusada');
    } catch (err) {
      console.error('Erro ao recusar proposta:', err);
      toast.error('Erro ao recusar proposta');
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || 'Proposta não encontrada'}</h2>
            <p className="text-muted-foreground">
              O link pode estar incorreto ou a proposta foi removida.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFinalized = proposal.status === 'accepted' || proposal.status === 'rejected';

  // Check if proposal is expired (data do tipo DATE, sem shift de timezone)
  const isExpired = (() => {
    if (!proposal.valid_until) return false;

    // proposal.valid_until vem como "YYYY-MM-DD". Não use new Date("YYYY-MM-DD")
    // porque isso assume UTC e pode "voltar" um dia em fusos -03.
    const validDate = endOfDay(parseDateOnly(proposal.valid_until));
    const now = new Date();

    return validDate < now;
  })();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">{proposal.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {proposal.client && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {proposal.client.nome}
                </span>
              )}
              {proposal.valid_until && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Válida até {format(parseDateOnly(proposal.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={proposal.status} />
        </div>

        {/* Preview */}
        <ProposalPreview
          proposal={proposal}
          sections={sections}
          client={proposal.client}
          onGalleryView={handleGalleryView}
        />

        {/* Ações (apenas se não finalizada e não expirada) */}
        {!isFinalized && !isExpired && (
          <Card ref={signatureSectionRef}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <PenLine className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Sua Decisão</h3>
              </div>
              
              <div className="space-y-6">
                {/* Nome do Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="client-name">Seu Nome Completo *</Label>
                  <Input
                    id="client-name"
                    placeholder="Digite seu nome completo"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                {/* Assinatura */}
                <div className="space-y-2">
                  <Label>Assinatura *</Label>
                  <p className="text-sm text-muted-foreground">
                    Desenhe ou digite sua assinatura no campo abaixo para aceitar esta proposta:
                  </p>
                  <SignatureCanvas
                    signature={clientSignature}
                    onChange={setClientSignature}
                    clientName={clientName}
                  />
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    onClick={handleAccept}
                    disabled={isAccepting || !clientSignature || !clientName.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {isAccepting ? 'Aceitando...' : 'Aceitar Proposta'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOpenRejectDialog}
                    disabled={isRejecting}
                    className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    size="lg"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Recusar Proposta
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  ⚠️ Esta ação é permanente e não poderá ser desfeita.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Recusa */}
        <RejectProposalDialog
          open={showRejectDialog}
          onOpenChange={setShowRejectDialog}
          onConfirm={handleReject}
          clientName={clientName}
          isLoading={isRejecting}
        />

        {/* Mensagem de proposta expirada */}
        {isExpired && !isFinalized && (
          <Card className="border-amber-500/50">
            <CardContent className="py-8 text-center">
              <Calendar className="h-16 w-16 mx-auto text-amber-500 mb-4" />
              <h3 className="text-2xl font-bold mb-2 text-amber-600">Proposta Expirada</h3>
              <p className="text-muted-foreground">
                Esta proposta expirou em{' '}
                {proposal.valid_until &&
                  format(parseDateOnly(proposal.valid_until), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-muted-foreground mt-2">
                Entre em contato conosco para mais informações.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Mensagem de proposta finalizada */}
        {isFinalized && (
          <Card className={proposal.status === 'accepted' ? 'border-green-500/50' : 'border-destructive/50'}>
            <CardContent className="py-8 text-center">
              {proposal.status === 'accepted' ? (
                <>
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-2xl font-bold mb-2 text-green-600">Proposta Aceita!</h3>
                  <p className="text-muted-foreground mb-4">
                    Esta proposta foi aceita em{' '}
                    {proposal.signed_at &&
                      format(new Date(proposal.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {proposal.client_signature && (
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg inline-block">
                      <p className="text-sm text-muted-foreground mb-2">Assinatura:</p>
                      <img 
                        src={proposal.client_signature} 
                        alt="Assinatura do cliente" 
                        className="max-h-24 mx-auto"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                  <h3 className="text-2xl font-bold mb-2 text-destructive">Proposta Recusada</h3>
                  <p className="text-muted-foreground">
                    Esta proposta foi recusada em{' '}
                    {proposal.signed_at &&
                      format(new Date(proposal.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function parseDateOnly(value: string): Date {
  // Esperado: YYYY-MM-DD
  const [y, m, d] = value.split('-').map((n) => Number(n));
  if (!y || !m || !d) return new Date(value);
  return new Date(y, m - 1, d);
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const config: Record<ProposalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Rascunho', variant: 'secondary' },
    sent: { label: 'Enviada', variant: 'default' },
    viewed: { label: 'Visualizada', variant: 'outline' },
    accepted: { label: 'Aceita', variant: 'default' },
    rejected: { label: 'Recusada', variant: 'destructive' },
  };

  const { label, variant } = config[status];

  return (
    <Badge variant={variant} className={status === 'accepted' ? 'bg-green-500' : undefined}>
      {label}
    </Badge>
  );
}
