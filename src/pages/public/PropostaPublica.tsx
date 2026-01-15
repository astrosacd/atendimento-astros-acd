import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, FileText, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProposalPreview } from '@/components/proposals/ProposalPreview';
import { SignatureCanvas } from '@/components/proposals/SignatureCanvas';
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
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    loadProposal();
    logView();
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

      setProposal(proposalData as Proposal);

      // Buscar seções
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('proposal_sections')
        .select('*')
        .eq('proposal_id', id)
        .order('order_index', { ascending: true });

      if (!sectionsError && sectionsData) {
        setSections(sectionsData as ProposalSection[]);
      }

      // Atualizar status para "viewed" se ainda estiver como "sent"
      if (proposalData.status === 'sent') {
        await supabase
          .from('proposals')
          .update({ status: 'viewed' as ProposalStatus })
          .eq('id', id);
        setProposal((prev) => (prev ? { ...prev, status: 'viewed' as ProposalStatus } : null));
      }
    } catch (err) {
      console.error('Erro ao carregar proposta:', err);
      setError('Erro ao carregar proposta');
    } finally {
      setIsLoading(false);
    }
  };

  const logView = async () => {
    if (!id) return;

    try {
      await supabase.from('proposal_view_logs').insert({
        proposal_id: id,
        user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.error('Erro ao registrar visualização:', err);
    }
  };

  const handleAccept = async () => {
    if (!proposal || !clientSignature) {
      toast.error('Por favor, assine a proposta antes de aceitar');
      return;
    }

    setIsAccepting(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({
          status: 'accepted' as ProposalStatus,
          client_signature: clientSignature,
          signed_at: new Date().toISOString(),
        })
        .eq('id', proposal.id);

      if (error) throw error;

      setProposal((prev) => (prev ? { ...prev, status: 'accepted' as ProposalStatus } : null));
      toast.success('Proposta aceita com sucesso!');
    } catch (err) {
      console.error('Erro ao aceitar proposta:', err);
      toast.error('Erro ao aceitar proposta');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!proposal) return;

    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'rejected' as ProposalStatus })
        .eq('id', proposal.id);

      if (error) throw error;

      setProposal((prev) => (prev ? { ...prev, status: 'rejected' as ProposalStatus } : null));
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
                  Válida até {format(new Date(proposal.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
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
        />

        {/* Ações (apenas se não finalizada) */}
        {!isFinalized && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4">Sua Decisão</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Para aceitar esta proposta, por favor assine abaixo:
                  </p>
                  <SignatureCanvas
                    signature={clientSignature}
                    onChange={setClientSignature}
                  />
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={handleAccept}
                    disabled={isAccepting || !clientSignature}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isAccepting ? 'Aceitando...' : 'Aceitar Proposta'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={isRejecting}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {isRejecting ? 'Recusando...' : 'Recusar'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensagem de proposta finalizada */}
        {isFinalized && (
          <Card>
            <CardContent className="py-8 text-center">
              {proposal.status === 'accepted' ? (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Proposta Aceita</h3>
                  <p className="text-muted-foreground">
                    Esta proposta foi aceita em{' '}
                    {proposal.signed_at &&
                      format(new Date(proposal.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Proposta Recusada</h3>
                  <p className="text-muted-foreground">Esta proposta foi recusada.</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
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
