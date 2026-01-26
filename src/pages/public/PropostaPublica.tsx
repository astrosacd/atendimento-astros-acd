import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, FileText, Calendar, User, PenLine, Lock, Eye, EyeOff } from 'lucide-react';
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
  
  // Password protection state
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [storedPassword, setStoredPassword] = useState('');
  const [passwordChannel, setPasswordChannel] = useState<'whatsapp' | 'email' | null>(null);
  // Tracking refs
  const hasTrackedOpen = useRef(false);
  const trackedSections = useRef<Set<string>>(new Set());
  const maxScrollPercent = useRef(0);
  const signatureSectionRef = useRef<HTMLDivElement>(null);
  const hasTrackedSignatureView = useRef(false);

  // Track event helper using secure RPC function
  const trackEvent = useCallback(async (eventType: string, eventData: object = {}) => {
    if (!id || !token) return;
    
    try {
      await supabase.rpc('record_proposal_view', {
        p_proposal_id: id,
        p_share_token: token,
        p_event_type: eventType,
        p_event_data: eventData as any,
        p_user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.error('Erro ao registrar evento:', err);
    }
  }, [id, token]);

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

    // Reset (evita ficar "desbloqueado" quando a proposta vira protegida depois)
    setIsPasswordProtected(false);
    setIsUnlocked(false);
    setPasswordInput('');
    setPasswordError('');
    setShowPassword(false);
    setStoredPassword('');
    setPasswordChannel(null);

    try {
      // Use secure RPC function to fetch proposal data
      // Using .rpc with manual typing since the function was just created
      const { data: result, error: rpcError } = await supabase.rpc(
        'get_proposal_by_share_token' as any,
        { p_share_token: token }
      ) as { data: any; error: any };

      if (rpcError || !result) {
        setError('Proposta não encontrada ou link expirado');
        setIsLoading(false);
        return;
      }

      const proposalData = result.proposal;
      const sectionsData = result.sections || [];
      
      if (!proposalData) {
        setError('Proposta não encontrada ou link expirado');
        setIsLoading(false);
        return;
      }

      // Transform proposal data to match expected format
      const transformedProposal: Proposal = {
        id: proposalData.id,
        user_id: '', // Not exposed in public view
        client_id: null,
        template_id: null,
        title: proposalData.title,
        status: proposalData.status as ProposalStatus,
        share_token: token,
        valid_until: proposalData.valid_until,
        total_value: proposalData.total_value || 0,
        notes: null,
        client_signature: null,
        signed_at: proposalData.signed_at,
        signed_status: proposalData.signed_status,
        signed_name: proposalData.signed_name,
        signature_image: proposalData.signature_image,
        rejection_reason: proposalData.rejection_reason,
        created_at: proposalData.created_at,
        updated_at: proposalData.created_at, // Not exposed separately
        manual_client_name: proposalData.manual_client_name,
        manual_client_email: proposalData.manual_client_email,
        client: null, // Client details not exposed in public RPC
      };

      setProposal(transformedProposal);
      
      // Check password protection using secure RPC
      if (proposalData.is_password_protected) {
        setIsPasswordProtected(true);
        setIsUnlocked(false);
        
        // Get password channel from secure RPC (without providing password)
        const { data: pwdCheck } = await supabase.rpc(
          'verify_proposal_password' as any,
          { p_share_token: token, p_password: null }
        ) as { data: any; error: any };
        
        if (pwdCheck?.password_channel) {
          setPasswordChannel(pwdCheck.password_channel);
        }
      } else {
        setIsPasswordProtected(false);
        setIsUnlocked(true);
      }
      
      // Set client name from proposal
      if (proposalData.manual_client_name) {
        setClientName(proposalData.manual_client_name);
      }

      // Set sections from RPC response
      const transformedSections: ProposalSection[] = sectionsData.map((s: any) => ({
        id: s.id,
        proposal_id: s.proposal_id,
        section_type: s.section_type,
        title: s.title,
        content: s.content || {},
        order_index: s.order_index,
        is_visible: s.is_visible,
        created_at: '',
        updated_at: '',
      }));
      
      setSections(transformedSections);

    } catch (err) {
      console.error('Erro ao carregar proposta:', err);
      setError('Erro ao carregar proposta');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password unlock - SERVER-SIDE VERIFICATION
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token || !passwordInput.trim()) {
      setPasswordError('Digite a senha');
      return;
    }

    try {
      // Use secure server-side password verification RPC
      const { data: result, error: verifyError } = await supabase.rpc(
        'verify_proposal_password' as any,
        { 
          p_share_token: token, 
          p_password: passwordInput.trim() 
        }
      ) as { data: any; error: any };

      if (verifyError) {
        console.error('Erro ao verificar senha:', verifyError);
        setPasswordError('Erro ao verificar senha. Tente novamente.');
        return;
      }

      if (result?.valid) {
        setIsUnlocked(true);
        setPasswordError('');

        // Track opened event after unlock using secure RPC
        if (!hasTrackedOpen.current && proposal && token) {
          hasTrackedOpen.current = true;
          
          try {
            await supabase.rpc('record_proposal_view', {
              p_proposal_id: id,
              p_share_token: token,
              p_event_type: 'opened',
              p_event_data: {
                referrer: document.referrer,
                screen_width: window.innerWidth,
                screen_height: window.innerHeight,
                password_protected: true,
              },
              p_user_agent: navigator.userAgent,
            });

            // Atualizar status para "viewed" se ainda estiver como "sent" (using secure RPC)
            if (proposal.status === 'sent') {
              const { error } = await supabase.rpc('sign_proposal', {
                p_proposal_id: id,
                p_share_token: token,
                p_status: 'viewed',
              });
              
              if (!error) {
                setProposal((prev) => (prev ? { ...prev, status: 'viewed' as ProposalStatus } : null));
              } else {
                console.error('Erro ao atualizar status para viewed:', error);
              }
            }
          } catch (err) {
            console.error('Erro ao registrar abertura:', err);
            hasTrackedOpen.current = false;
          }
        }

        toast.success('Proposta desbloqueada!');
      } else {
        setPasswordError(result?.error || 'Senha incorreta');
      }
    } catch (err) {
      console.error('Erro ao verificar senha:', err);
      setPasswordError('Erro ao verificar senha. Tente novamente.');
    }
  };

  // Track open for non-password proposals using secure RPC
  useEffect(() => {
    const trackOpenAndUpdateStatus = async () => {
      if (!isUnlocked || isPasswordProtected || !proposal || hasTrackedOpen.current || !token || !id) {
        return;
      }
      
      hasTrackedOpen.current = true;
      
      try {
        // Registrar evento de abertura
        await supabase.rpc('record_proposal_view', {
          p_proposal_id: id,
          p_share_token: token,
          p_event_type: 'opened',
          p_event_data: { 
            referrer: document.referrer,
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
          },
          p_user_agent: navigator.userAgent,
        });

        // Atualizar status para "viewed" se ainda estiver como "sent" (using secure RPC)
        if (proposal.status === 'sent') {
          const { error } = await supabase.rpc('sign_proposal', {
            p_proposal_id: id,
            p_share_token: token,
            p_status: 'viewed',
          });
          
          if (!error) {
            setProposal((prev) => (prev ? { ...prev, status: 'viewed' as ProposalStatus } : null));
          } else {
            console.error('Erro ao atualizar status para viewed:', error);
          }
        }
      } catch (err) {
        console.error('Erro ao registrar abertura:', err);
        // Reset para tentar novamente se houver erro
        hasTrackedOpen.current = false;
      }
    };
    
    trackOpenAndUpdateStatus();
  }, [isUnlocked, isPasswordProtected, proposal, id, token]);

  const handleAccept = async () => {
    if (!proposal || !clientSignature) {
      toast.error('Por favor, assine a proposta antes de aceitar');
      return;
    }

    if (!clientName.trim()) {
      toast.error('Por favor, informe seu nome');
      return;
    }

    if (!token) {
      toast.error('Token de proposta inválido');
      return;
    }

    setIsAccepting(true);
    try {
      const signedAt = new Date().toISOString();
      
      // Use secure RPC function instead of direct table update
      const { error } = await supabase.rpc('sign_proposal', {
        p_proposal_id: proposal.id,
        p_share_token: token,
        p_status: 'accepted',
        p_client_signature: clientSignature,
        p_signed_name: clientName.trim(),
      });

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
    if (!proposal || !token) return;

    setIsRejecting(true);
    try {
      const signedAt = new Date().toISOString();
      
      // Use secure RPC function instead of direct table update
      const { error } = await supabase.rpc('sign_proposal', {
        p_proposal_id: proposal.id,
        p_share_token: token,
        p_status: 'rejected',
        p_signed_name: clientName.trim(),
        p_rejection_reason: reason || null,
      });

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

  // Password protection screen
  if (isPasswordProtected && !isUnlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Proposta Protegida</CardTitle>
            <CardDescription>
              Esta proposta requer uma senha para ser visualizada.
              {passwordChannel === 'whatsapp' && (
                <span className="block mt-2 text-sm font-medium text-primary">
                  💡 Dica: A senha são os últimos 4 dígitos do seu número de telefone.
                </span>
              )}
              {passwordChannel === 'email' && (
                <span className="block mt-2 text-sm font-medium text-primary">
                  💡 Dica: A senha é a parte do seu email antes do @.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Digite a senha"
                    className={passwordError ? 'border-destructive' : ''}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
              </div>
              
              <Button type="submit" className="w-full">
                Desbloquear Proposta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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
