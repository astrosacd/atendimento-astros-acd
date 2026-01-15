import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  FileDown,
  Save,
  Send,
  Layout,
  Type,
  DollarSign,
  Calendar,
  Users,
  MessageSquare,
  Image,
  FileText,
  PenTool,
  Loader2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useProposals } from '@/hooks/useProposals';
import { useProposalSections, type SectionType, type ProposalSection } from '@/hooks/useProposalSections';
import { useClientes } from '@/hooks/useClientes';
import { usePermissions } from '@/hooks/usePermissions';
import { SectionEditor } from '@/components/proposals/SectionEditor';
import { ProposalPreview } from '@/components/proposals/ProposalPreview';
import { SortableSectionList } from '@/components/proposals/SortableSectionList';
import { statusConfig } from '@/types/proposals';
import type { ProposalStatus, SignatureContent } from '@/types/proposals';

const sectionTypeConfig: Record<SectionType, { label: string; icon: string }> = {
  cover: { label: 'Capa', icon: 'Layout' },
  text: { label: 'Texto', icon: 'Type' },
  pricing: { label: 'Preços', icon: 'DollarSign' },
  timeline: { label: 'Cronograma', icon: 'Calendar' },
  team: { label: 'Equipe', icon: 'Users' },
  testimonials: { label: 'Depoimentos', icon: 'MessageSquare' },
  gallery: { label: 'Galeria', icon: 'Image' },
  terms: { label: 'Termos', icon: 'FileText' },
  signature: { label: 'Assinatura', icon: 'PenTool' },
};

const sectionButtons: { type: SectionType; icon: React.ReactNode }[] = [
  { type: 'cover', icon: <Layout className="h-5 w-5" /> },
  { type: 'text', icon: <Type className="h-5 w-5" /> },
  { type: 'pricing', icon: <DollarSign className="h-5 w-5" /> },
  { type: 'timeline', icon: <Calendar className="h-5 w-5" /> },
  { type: 'team', icon: <Users className="h-5 w-5" /> },
  { type: 'testimonials', icon: <MessageSquare className="h-5 w-5" /> },
  { type: 'gallery', icon: <Image className="h-5 w-5" /> },
  { type: 'terms', icon: <FileText className="h-5 w-5" /> },
  { type: 'signature', icon: <PenTool className="h-5 w-5" /> },
];

export default function PropostaEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { useProposal, updateProposal } = useProposals();
  const { data: proposal, isLoading: isLoadingProposal } = useProposal(id);
  const { sections, isLoading: isLoadingSections, createSection, updateSection, deleteSection, reorderSections } = useProposalSections(id);
  const { fetchClientes } = useClientes();
  const { canShareProposals, canEditProposals } = usePermissions();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState<'registered' | 'manual'>('registered');
  const [manualClientName, setManualClientName] = useState('');
  const [status, setStatus] = useState<ProposalStatus>('draft');
  const [validUntil, setValidUntil] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string; email: string; numero: string }[]>([]);

  // Carregar clientes
  useEffect(() => {
    fetchClientes().then((data) => {
      setClientes(data.map(c => ({ id: c.id, nome: c.nome, email: c.email, numero: c.numero })));
    });
  }, []);

  // Sincroniza estado local com dados do banco
  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title);
      setClientId(proposal.client_id);
      setStatus(proposal.status);
      setValidUntil(proposal.valid_until || '');
    }
  }, [proposal]);

  // Calcula o valor total das seções de pricing
  const totalValue = useMemo(() => {
    return sections
      .filter((s) => s.section_type === 'pricing' && s.is_visible)
      .reduce((total, section) => {
        const items = (section.content as { items?: { quantity: number; unitPrice: number }[] })?.items || [];
        return total + items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
      }, 0);
  }, [sections]);

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await updateProposal.mutateAsync({
        id,
        title,
        client_id: clientId,
        status,
        valid_until: validUntil || null,
        total_value: totalValue,
      });
      toast.success('Proposta salva!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    // Validar se tem seção de assinatura com assinatura do responsável
    const signatureSection = sections.find((s) => s.section_type === 'signature');
    if (signatureSection) {
      const content = signatureSection.content as SignatureContent;
      if (!content?.signerSignature) {
        toast.error('A proposta precisa ter a assinatura do responsável antes de ser enviada.');
        return;
      }
    }

    if (!id) return;
    setIsSaving(true);
    try {
      await updateProposal.mutateAsync({
        id,
        title,
        client_id: clientId,
        status: 'sent' as ProposalStatus,
        valid_until: validUntil || null,
        total_value: totalValue,
      });
      setStatus('sent');
      toast.success('Proposta enviada!');
    } catch (error) {
      console.error('Erro ao enviar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!proposal) return;
    const url = `${window.location.origin}/p/${proposal.id}?token=${proposal.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleExportPdf = async () => {
    const element = document.getElementById('proposal-preview');
    if (!element) {
      toast.error('Erro ao gerar PDF');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${title || 'proposta'}.pdf`);
      toast.success('PDF gerado!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleAddSection = async (type: SectionType) => {
    await createSection.mutateAsync({ type, title: sectionTypeConfig[type].label });
  };

  if (isLoadingProposal) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!proposal) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Proposta não encontrada</h2>
          <Button onClick={() => navigate('/propostas')}>Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-0 z-10 bg-background py-4 border-b -mx-6 px-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/propostas')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold max-w-md"
              placeholder="Título da proposta"
              disabled={!canEditProposals()}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canShareProposals() && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isGeneratingPdf}
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  PDF
                </Button>
              </>
            )}
            {canEditProposals() && (
              <>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
                {status === 'draft' && (
                  <Button size="sm" onClick={handleSend} disabled={isSaving}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="preview">Visualizar</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Coluna Esquerda - Configurações */}
              <div className="space-y-6">
                {/* Configurações */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Configurações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <div className="flex gap-2 mb-2">
                        <Button
                          type="button"
                          variant={clientMode === 'registered' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setClientMode('registered');
                            setManualClientName('');
                          }}
                          disabled={!canEditProposals()}
                          className="flex-1"
                        >
                          Cadastrado
                        </Button>
                        <Button
                          type="button"
                          variant={clientMode === 'manual' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setClientMode('manual');
                            setClientId(null);
                          }}
                          disabled={!canEditProposals()}
                          className="flex-1"
                        >
                          Manual
                        </Button>
                      </div>
                      {clientMode === 'registered' ? (
                        <Select
                          value={clientId || 'none'}
                          onValueChange={(value) => setClientId(value === 'none' ? null : value)}
                          disabled={!canEditProposals()}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {clientes.filter(c => c.id).map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="Nome do cliente"
                          value={manualClientName}
                          onChange={(e) => setManualClientName(e.target.value)}
                          disabled={!canEditProposals()}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={status}
                        onValueChange={(value) => setStatus(value as ProposalStatus)}
                        disabled={!canEditProposals()}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Válida até</Label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        disabled={!canEditProposals()}
                      />
                    </div>

                    {totalValue > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Valor total:</span>
                          <span className="font-semibold text-green-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(totalValue)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Adicionar Seção */}
                {canEditProposals() && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Adicionar Seção</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {sectionButtons.map(({ type, icon }) => (
                          <Button
                            key={type}
                            variant="outline"
                            className="flex flex-col h-auto py-3 gap-1"
                            onClick={() => handleAddSection(type)}
                            disabled={createSection.isPending}
                          >
                            {icon}
                            <span className="text-xs">{sectionTypeConfig[type].label}</span>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Colunas da Direita - Seções */}
              <div className="lg:col-span-2">
                {isLoadingSections ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32" />
                    ))}
                  </div>
                ) : sections.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma seção adicionada</h3>
                      <p className="text-muted-foreground">
                        Use os botões à esquerda para adicionar seções à proposta
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <SortableSectionList
                    sections={sections}
                    onReorder={(reordered) => reorderSections.mutateAsync(reordered)}
                    onUpdate={(id, updates) => updateSection.mutateAsync({ id, ...updates })}
                    onDelete={(id) => deleteSection.mutateAsync(id)}
                    canEdit={canEditProposals()}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <ProposalPreview
              proposal={proposal}
              sections={sections}
              client={clientes.find((c) => c.id === clientId)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
