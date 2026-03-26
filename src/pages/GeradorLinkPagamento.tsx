import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Link2, Copy, ExternalLink, Loader2, Clock, Trash2, Share2, History,
  DollarSign, Building2, Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function GeradorLinkPagamento() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [empresa, setEmpresa] = useState('');
  const [valorVenda, setValorVenda] = useState('');
  const [validadeHoras, setValidadeHoras] = useState('24');
  const [generatedLink, setGeneratedLink] = useState<{
    payment_url: string;
    valor_original: number;
    valor_com_taxa: number;
    taxa_percentual: number;
    expires_at: string;
  } | null>(null);

  // Share token dialog
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareExpiry, setShareExpiry] = useState('1');

  // History query
  const { data: linkHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['payment-links-history'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_links')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Share tokens query
  const { data: shareTokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ['payment-link-share-tokens'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_link_share_tokens')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Generate link mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await supabase.functions.invoke('generate-payment-link', {
        body: {
          empresa: empresa.trim(),
          valor_da_venda: valorVenda.replace(',', '.'),
          validade_horas: parseInt(validadeHoras),
        },
      });
      if (res.error) throw new Error(res.error.message || 'Erro ao gerar link');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedLink(data);
      queryClient.invalidateQueries({ queryKey: ['payment-links-history'] });
      toast.success('Link de pagamento gerado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao gerar link');
    },
  });

  // Create share token mutation
  const createShareTokenMutation = useMutation({
    mutationFn: async (expiryHours: number) => {
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('payment_link_share_tokens')
        .insert({
          created_by: user?.id,
          created_by_email: user?.email,
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-link-share-tokens'] });
      const baseUrl = window.location.hostname.includes('lovable')
        ? 'https://atendimento-astros-acd.lovable.app'
        : window.location.origin;
      const link = `${baseUrl}/link-pagamento/${data.token}`;
      navigator.clipboard.writeText(link);
      toast.success('Link de acesso temporário copiado!');
      setShowShareDialog(false);
    },
    onError: () => toast.error('Erro ao gerar link temporário'),
  });

  // Delete share token
  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_link_share_tokens')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-link-share-tokens'] });
      toast.success('Link temporário revogado');
    },
  });

  const handleGenerate = () => {
    if (!empresa.trim()) return toast.error('Informe o nome da empresa');
    const val = parseFloat(valorVenda.replace(',', '.'));
    if (isNaN(val) || val <= 0) return toast.error('Informe um valor válido');
    generateMutation.mutate();
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const canGenerate = hasPermission('generate_payment_links');
  const canShare = hasPermission('share_payment_links');

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Link2 className="h-6 w-6 text-primary" />
              Link de Pagamento
            </h1>
            <p className="text-muted-foreground">Gere links de pagamento do Mercado Pago rapidamente</p>
          </div>
          {canShare && (
            <Button variant="outline" onClick={() => setShowShareDialog(true)} className="gap-2">
              <Share2 className="h-4 w-4" />
              Gerar Acesso Temporário
            </Button>
          )}
        </div>

        <Tabs defaultValue="gerar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="gerar" className="gap-2">
              <Plus className="h-4 w-4" />
              Gerar Link
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            {canShare && (
              <TabsTrigger value="acessos" className="gap-2">
                <Share2 className="h-4 w-4" />
                Acessos Temporários
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="gerar" className="space-y-4">
            {canGenerate ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Gerar Novo Link
                    </CardTitle>
                    <CardDescription>
                      O valor será ajustado automaticamente com a taxa de 4.99% do Mercado Pago
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="empresa">Nome da Empresa / Título</Label>
                        <Input
                          id="empresa"
                          value={empresa}
                          onChange={(e) => setEmpresa(e.target.value)}
                          placeholder="Ex: Gravum Digital"
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valor">Valor da Venda (R$)</Label>
                        <Input
                          id="valor"
                          value={valorVenda}
                          onChange={(e) => setValorVenda(e.target.value)}
                          placeholder="Ex: 150,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="validade">Validade do Link</Label>
                        <Select value={validadeHoras} onValueChange={setValidadeHoras}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 hora</SelectItem>
                            <SelectItem value="6">6 horas</SelectItem>
                            <SelectItem value="12">12 horas</SelectItem>
                            <SelectItem value="24">24 horas</SelectItem>
                            <SelectItem value="48">48 horas</SelectItem>
                            <SelectItem value="72">72 horas</SelectItem>
                            <SelectItem value="168">7 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={handleGenerate}
                      disabled={generateMutation.isPending}
                      className="gap-2"
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      Gerar Link de Pagamento
                    </Button>
                  </CardContent>
                </Card>

                {generatedLink && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-base text-primary">✅ Link Gerado com Sucesso!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Valor original:</span>
                          <p className="font-semibold">R$ {generatedLink.valor_original.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor com taxa ({generatedLink.taxa_percentual}%):</span>
                          <p className="font-semibold">R$ {generatedLink.valor_com_taxa.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expira em:</span>
                          <p className="font-semibold">
                            {format(new Date(generatedLink.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input value={generatedLink.payment_url} readOnly className="font-mono text-xs bg-muted/50" />
                        <Button variant="outline" size="icon" onClick={() => copyLink(generatedLink.payment_url)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" asChild>
                          <a href={generatedLink.payment_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Você não tem permissão para gerar links de pagamento.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Links Gerados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : linkHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum link gerado ainda</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {linkHistory.map((link: any) => {
                      const isExpired = new Date(link.expires_at) < new Date();
                      return (
                        <div
                          key={link.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{link.empresa}</span>
                              <Badge variant={isExpired ? "secondary" : "default"} className="text-xs shrink-0">
                                {isExpired ? 'Expirado' : 'Ativo'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                R$ {Number(link.valor_original).toFixed(2)} → R$ {Number(link.valor_com_taxa).toFixed(2)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(link.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                              {link.created_by_email && (
                                <span className="truncate">{link.created_by_email}</span>
                              )}
                            </div>
                          </div>
                          {!isExpired && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(link.payment_url)}
                              className="shrink-0"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canShare && (
            <TabsContent value="acessos">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Links de Acesso Temporário
                  </CardTitle>
                  <CardDescription>
                    Gere links que permitem acesso temporário ao módulo de geração de pagamentos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tokensLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : shareTokens.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum link temporário criado</p>
                  ) : (
                    <div className="space-y-2">
                      {shareTokens.map((tk: any) => {
                        const isExpired = new Date(tk.expires_at) < new Date();
                        const baseUrl = window.location.hostname.includes('lovable')
                          ? 'https://atendimento-astros-acd.lovable.app'
                          : window.location.origin;
                        const link = `${baseUrl}/link-pagamento/${tk.token}`;
                        return (
                          <div
                            key={tk.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={isExpired ? "secondary" : "default"} className="text-xs">
                                  {isExpired ? 'Expirado' : 'Ativo'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Criado em {format(new Date(tk.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Expira em {format(new Date(tk.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isExpired && (
                                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!'); }}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => deleteTokenMutation.mutate(tk.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Acesso Temporário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gere um link que permite acesso temporário ao gerador de links de pagamento, sem precisar de conta no CRM.
            </p>
            <div className="space-y-2">
              <Label>Validade do Acesso</Label>
              <Select value={shareExpiry} onValueChange={setShareExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="48">2 dias</SelectItem>
                  <SelectItem value="72">3 dias</SelectItem>
                  <SelectItem value="168">7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => createShareTokenMutation.mutate(parseInt(shareExpiry))}
              disabled={createShareTokenMutation.isPending}
              className="gap-2"
            >
              {createShareTokenMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              Gerar e Copiar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
