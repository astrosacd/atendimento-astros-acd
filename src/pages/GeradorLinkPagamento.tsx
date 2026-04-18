import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { copyToClipboard } from '@/utils/clipboard';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSiteUrl } from '@/hooks/useSiteUrl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Link2, Copy, ExternalLink, Loader2, Clock, Trash2, Share2, History,
  DollarSign, Building2, Plus, RefreshCw, Search, CheckCircle2, XCircle, AlertCircle,
  Webhook, Info
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

type Provider = 'mercadopago' | 'stripe';

const providerLabels: Record<Provider, string> = {
  mercadopago: 'Mercado Pago',
  stripe: 'Stripe',
};

export default function GeradorLinkPagamento() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const siteUrl = useSiteUrl();
  const queryClient = useQueryClient();
  const { logActivity } = useSystemActivities();

  const [empresa, setEmpresa] = useState('');
  const [valorVenda, setValorVenda] = useState('');
  const [validadeHoras, setValidadeHoras] = useState('24');
  const [provider, setProvider] = useState<Provider>('mercadopago');
  const [generatedLink, setGeneratedLink] = useState<{
    provider_label: string;
    config_source: string;
    payment_url: string;
    valor_original: number;
    valor_com_taxa: number;
    taxa_percentual: number;
    expires_at: string;
    currency?: string;
  } | null>(null);

  // Payment status checking
  const [queryId, setQueryId] = useState('');
  const [queryProvider, setQueryProvider] = useState<'mercadopago' | 'stripe'>('mercadopago');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [showNotFoundDialog, setShowNotFoundDialog] = useState(false);

  // Share token dialog
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareExpiry, setShareExpiry] = useState('1');
  const [shareProviders, setShareProviders] = useState<Provider[]>(['mercadopago', 'stripe']);

  const { data: providerConfig } = useQuery({
    queryKey: ['payment-link-provider-config'],
    queryFn: async () => {
      const [{ data: billingData, error: billingError }, { data: stripeData, error: stripeError }] = await Promise.all([
        supabase
          .from('billing_config')
          .select('config_key, config_value')
          .in('config_key', ['mp_access_token', 'mp_taxa_cartao', 'mp_link_enabled']),
        supabase
          .from('billing_stripe_config')
          .select('stripe_enabled, stripe_tax_percent, stripe_secret_key')
          .limit(1)
          .single(),
      ]);

      if (billingError) throw billingError;
      if (stripeError && stripeError.code !== 'PGRST116') throw stripeError;

      const getConfig = (key: string) => billingData?.find((item) => item.config_key === key)?.config_value || '';

      return {
        mercadopago: {
          enabled: getConfig('mp_link_enabled') === 'true' && !!getConfig('mp_access_token'),
          fee: Number(getConfig('mp_taxa_cartao') || 0),
          source: 'Módulo Cobrança → Pagamentos',
        },
        stripe: {
          enabled: !!stripeData?.stripe_enabled && !!stripeData?.stripe_secret_key,
          fee: Number(stripeData?.stripe_tax_percent || 0),
          source: 'Módulo Cobrança → Pagamentos',
        },
      };
    },
  });

  useEffect(() => {
    if (!providerConfig) return;

    const enabledProviders = (Object.entries(providerConfig) as [Provider, { enabled: boolean }][])
      .filter(([, config]) => config.enabled)
      .map(([key]) => key);

    if (enabledProviders.length > 0 && !enabledProviders.includes(provider)) {
      setProvider(enabledProviders[0]);
    }

    if (enabledProviders.length > 0) {
      setShareProviders((current) => {
        const filtered = current.filter((item) => enabledProviders.includes(item));
        return filtered.length > 0 ? filtered : enabledProviders;
      });
    }
  }, [providerConfig, provider]);

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
      const res = await supabase.functions.invoke('generate-payment-link', {
        body: {
          empresa: empresa.trim(),
          valor_da_venda: valorVenda.replace(',', '.'),
          validade_horas: parseInt(validadeHoras),
          provider,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Erro ao gerar link');
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedLink(data);
      queryClient.invalidateQueries({ queryKey: ['payment-links-history'] });
      logActivity(`Gerou link de pagamento para ${empresa}`, 'pagamento', `Valor: ${valorVenda}`);
      toast.success('Link de pagamento gerado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao gerar link');
    },
  });

  // Create share token mutation
  const createShareTokenMutation = useMutation({
    mutationFn: async ({ expiryHours, allowedProviders }: { expiryHours: number; allowedProviders: Provider[] }) => {
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('payment_link_share_tokens')
        .insert({
          created_by: user?.id,
          created_by_email: user?.email,
          expires_at: expiresAt,
          allowed_providers: allowedProviders,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['payment-link-share-tokens'] });
      const link = `${siteUrl}/link-pagamento/${data.token}`;
      copyToClipboard(link).then(() => toast.success('Link de acesso temporário copiado!')).catch(() => toast.error('Erro ao copiar'));
      setShowShareDialog(false);
      setShowShareDialog(false);
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao gerar link temporário'),
  });

  // Delete share token
  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
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

  // Check all pending payment links status
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('check-payment-link-status', {
        body: {},
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['payment-links-history'] });
      if (data.updated > 0) {
        toast.success(`${data.updated} link(s) atualizado(s) de ${data.checked} verificado(s)`);
      } else {
        toast.info(`${data.checked} link(s) verificado(s), nenhuma alteração`);
      }
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao verificar pagamentos'),
  });

  // Query a specific payment ID (MP or Stripe)
  const queryPaymentMutation = useMutation({
    mutationFn: async ({ paymentId, prov }: { paymentId: string; prov: 'mercadopago' | 'stripe' }) => {
      const bodyPayload = prov === 'stripe'
        ? { stripe_payment_id: paymentId }
        : { mp_payment_id: paymentId };
      const res = await supabase.functions.invoke('check-payment-link-status', {
        body: bodyPayload,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.not_found || res.data?.error) {
        throw new Error(res.data.error || 'Código não encontrado ou não existe');
      }
      return res.data;
    },
    onSuccess: (data: any) => {
      setQueryResult(data);
    },
    onError: (err: any) => {
      setQueryResult(null);
      if (err.message?.includes('não encontrado') || err.message?.includes('não existe')) {
        setShowNotFoundDialog(true);
      } else {
        toast.error(err.message || 'Erro ao consultar pagamento');
      }
    },
  });

  const handleGenerate = () => {
    if (!empresa.trim()) return toast.error('Informe o nome da empresa');
    const val = parseFloat(valorVenda.replace(',', '.'));
    if (isNaN(val) || val <= 0) return toast.error('Informe um valor válido');
    if (!providerConfig?.[provider]?.enabled) return toast.error(`Configure ${providerLabels[provider]} em Cobrança primeiro`);
    generateMutation.mutate();
  };

  const toggleShareProvider = (target: Provider, checked: boolean) => {
    setShareProviders((current) => {
      if (checked) {
        return current.includes(target) ? current : [...current, target];
      }
      return current.filter((item) => item !== target);
    });
  };

  const copyLink = async (url: string) => {
    const textToCopy = `Segue Link de Pagamento:\n${url}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Link copiado com texto!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Link copiado com texto!');
    }
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
                      Escolha o provedor e o sistema aplica automaticamente a taxa configurada em Cobrança.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(['mercadopago', 'stripe'] as Provider[]).map((option) => {
                        const config = providerConfig?.[option];
                        const isActive = provider === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => config?.enabled && setProvider(option)}
                            className={`rounded-lg border p-4 text-left transition-colors ${isActive ? 'border-primary bg-primary/5' : 'border-border bg-card'} ${config?.enabled ? '' : 'opacity-60'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{providerLabels[option]}</span>
                              <Badge variant={config?.enabled ? 'default' : 'secondary'}>
                                {config?.enabled ? 'Disponível' : 'Não configurado'}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">Origem: {config?.source || 'Módulo Cobrança → Pagamentos'}</p>
                            <p className="text-xs text-muted-foreground">Taxa aplicada: {Number(config?.fee || 0).toFixed(2)}%</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="empresa">Nome da Empresa / Título</Label>
                        <Input
                          id="empresa"
                          value={empresa}
                          onChange={(e) => setEmpresa(e.target.value)}
                          placeholder="Ex: Gravum Digital"
                          maxLength={100}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valor">Valor da Venda ({provider === 'stripe' ? 'US$' : 'R$'})</Label>
                        <Input
                          id="valor"
                          value={valorVenda}
                          onChange={(e) => setValorVenda(e.target.value)}
                          placeholder={provider === 'stripe' ? 'Ex: 50.00' : 'Ex: 150,00'}
                          required
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
                          <span className="text-muted-foreground">Provedor:</span>
                          <p className="font-semibold">{generatedLink.provider_label}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor original:</span>
                          <p className="font-semibold">{generatedLink.currency === 'USD' ? 'US$' : 'R$'} {generatedLink.valor_original.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor com taxa ({generatedLink.taxa_percentual}%):</span>
                          <p className="font-semibold">{generatedLink.currency === 'USD' ? 'US$' : 'R$'} {generatedLink.valor_com_taxa.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Origem:</span>
                          <p className="font-semibold">{generatedLink.config_source}</p>
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Links Gerados
                </CardTitle>
                <div className="flex gap-2">
                  {hasPermission('check_payment_link_status') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={checkStatusMutation.isPending}
                      onClick={() => checkStatusMutation.mutate()}
                    >
                      {checkStatusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Verificar Pagamentos
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Consultar código de pagamento */}
                {hasPermission('check_payment_link_status') && (
                  <div className="mb-4 space-y-2">
                    <div className="flex gap-2">
                      <Select value={queryProvider} onValueChange={(v) => setQueryProvider(v as 'mercadopago' | 'stripe')}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                          <SelectItem value="stripe">Stripe</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={queryProvider === 'stripe' ? 'ID Stripe (ex: pi_xxx ou cs_xxx)' : 'Código MP (ex: 12345678)'}
                        value={queryId}
                        onChange={(e) => setQueryId(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={queryPaymentMutation.isPending || !queryId.trim()}
                        onClick={() => queryPaymentMutation.mutate({ paymentId: queryId.trim(), prov: queryProvider })}
                        className="gap-2"
                      >
                        {queryPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Consultar
                      </Button>
                    </div>
                  </div>
                )}

                {queryResult && (
                  <div className="mb-4 p-3 rounded-lg border bg-muted/30 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Resultado da Consulta ({queryResult.provider === 'stripe' ? 'Stripe' : 'Mercado Pago'})</span>
                      <Button variant="ghost" size="sm" onClick={() => setQueryResult(null)}>✕</Button>
                    </div>
                    <p><strong>ID:</strong> {queryResult.payment_id}</p>
                    <p><strong>Status:</strong> <Badge variant={queryResult.status === 'approved' ? 'default' : 'secondary'}>{queryResult.status}</Badge></p>
                    <p><strong>Valor:</strong> {queryResult.currency || 'BRL'} {Number(queryResult.amount || 0).toFixed(2)}</p>
                    {queryResult.payer_email && <p><strong>Pagador:</strong> {queryResult.payer_email}</p>}
                    {queryResult.payment_method && <p><strong>Método:</strong> {queryResult.payment_method}</p>}
                    {queryResult.date_approved && <p><strong>Aprovado em:</strong> {format(new Date(queryResult.date_approved), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>}
                    {queryResult.date_created && <p><strong>Criado em:</strong> {format(new Date(queryResult.date_created), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>}
                    {queryResult.description && <p><strong>Descrição:</strong> {queryResult.description}</p>}
                  </div>
                )}

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
                      const status = link.status || (isExpired ? 'expired' : 'pending');
                      const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
                        paid: { label: 'Pago', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
                        pending: { label: isExpired ? 'Expirado' : 'Pendente', variant: isExpired ? 'secondary' : 'outline', icon: isExpired ? <XCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" /> },
                        expired: { label: 'Expirado', variant: 'secondary', icon: <XCircle className="h-3 w-3" /> },
                        rejected: { label: 'Rejeitado', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
                      };
                      const sc = statusConfig[status] || statusConfig.pending;

                      return (
                        <div
                          key={link.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{link.empresa}</span>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {link.provider_label}
                              </Badge>
                              <Badge variant={sc.variant} className="text-xs shrink-0 gap-1">
                                {sc.icon}
                                {sc.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {link.provider === 'stripe' ? 'US$' : 'R$'} {Number(link.valor_original).toFixed(2)} → {link.provider === 'stripe' ? 'US$' : 'R$'} {Number(link.valor_com_taxa).toFixed(2)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(link.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                              {link.mp_payment_id && (
                                <span className="font-mono text-primary">
                                  MP: {link.mp_payment_id}
                                </span>
                              )}
                              {link.paid_at && (
                                <span className="text-green-500">
                                  Pago em {format(new Date(link.paid_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              )}
                              {link.created_by_email && (
                                <span className="truncate">Criado por: {link.created_by_email}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {status !== 'expired' && status !== 'rejected' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyLink(link.payment_url)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
                        const link = `${siteUrl}/link-pagamento/${tk.token}`;
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
                              <div className="flex flex-wrap items-center gap-1 mt-2">
                                {(tk.allowed_providers || []).map((item: Provider) => (
                                  <Badge key={item} variant="outline" className="text-[10px]">
                                    {providerLabels[item]}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Expira em {format(new Date(tk.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </div>
                              {tk.created_by_email && (
                                <div className="text-xs text-muted-foreground mt-1">Criado por: {tk.created_by_email}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isExpired && (
                                <Button variant="ghost" size="icon" onClick={() => { copyToClipboard(link).then(() => toast.success('Link copiado!')).catch(() => toast.error('Erro ao copiar')); }}>
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
            <div className="space-y-3">
              <Label>Provedores liberados no link</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {(['mercadopago', 'stripe'] as Provider[]).map((option) => {
                  const enabled = !!providerConfig?.[option]?.enabled;
                  return (
                    <label key={option} className={`flex items-center justify-between gap-3 ${enabled ? '' : 'opacity-60'}`}>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{providerLabels[option]}</p>
                        <p className="text-xs text-muted-foreground">Origem: {providerConfig?.[option]?.source || 'Módulo Cobrança → Pagamentos'}</p>
                      </div>
                      <Checkbox
                        checked={shareProviders.includes(option)}
                        disabled={!enabled}
                        onCheckedChange={(checked) => toggleShareProvider(option, checked === true)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
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
              onClick={() => {
                if (shareProviders.length === 0) {
                  toast.error('Selecione pelo menos um provedor');
                  return;
                }
                createShareTokenMutation.mutate({ expiryHours: parseInt(shareExpiry), allowedProviders: shareProviders });
              }}
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

      {/* Not Found Dialog */}
      <Dialog open={showNotFoundDialog} onOpenChange={setShowNotFoundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Código Não Encontrado
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O código informado não foi encontrado ou não existe na base do provedor selecionado. Verifique o código e tente novamente.
          </p>
          <DialogFooter>
            <Button onClick={() => setShowNotFoundDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
