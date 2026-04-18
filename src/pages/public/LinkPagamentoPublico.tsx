import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Link2, Copy, ExternalLink, Loader2, ShieldX, Clock, Search, Plus, XCircle
} from 'lucide-react';

type Provider = 'mercadopago' | 'stripe';

const providerLabels: Record<Provider, string> = {
  mercadopago: 'Mercado Pago',
  stripe: 'Stripe',
};

export default function LinkPagamentoPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [allowedProviders, setAllowedProviders] = useState<Provider[]>([]);
  const [allowStatusCheck, setAllowStatusCheck] = useState(false);

  const [empresa, setEmpresa] = useState('');
  const [valorVenda, setValorVenda] = useState('');
  const [validadeHoras, setValidadeHoras] = useState('24');
  const [provider, setProvider] = useState<Provider>('mercadopago');
  const [generating, setGenerating] = useState(false);
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

  // Status check state
  const [queryProvider, setQueryProvider] = useState<Provider>('mercadopago');
  const [queryId, setQueryId] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('validate_payment_link_token', {
          p_token: token,
        });
        if (error) throw error;

        const valid = !!data?.valid;
        setIsValid(valid);
        if (valid) {
          setExpiresAt(data.expires_at || null);
          setAllowStatusCheck(!!data.allow_status_check);
          const providers = Array.isArray(data.allowed_providers)
            ? data.allowed_providers.filter((item: string): item is Provider => item === 'mercadopago' || item === 'stripe')
            : [];
          setAllowedProviders(providers);
          if (providers.length > 0) {
            setProvider(providers[0]);
            setQueryProvider(providers[0]);
          }
        }
      } catch {
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleGenerate = async () => {
    if (!empresa.trim()) return toast.error('Informe o nome da empresa');
    const val = parseFloat(valorVenda.replace(',', '.'));
    if (isNaN(val) || val <= 0) return toast.error('Informe um valor válido');
    if (!allowedProviders.includes(provider)) return toast.error('Este provedor não está liberado neste link');

    setGenerating(true);
    try {
      const res = await supabase.functions.invoke('generate-payment-link', {
        body: {
          empresa: empresa.trim(),
          valor_da_venda: valorVenda.replace(',', '.'),
          validade_horas: parseInt(validadeHoras),
          share_token: token,
          provider,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      setGeneratedLink(res.data);
      toast.success('Link gerado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar link');
    } finally {
      setGenerating(false);
    }
  };

  const handleQuery = async () => {
    if (!queryId.trim()) return toast.error('Informe o ID do pagamento');
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const bodyPayload = queryProvider === 'stripe'
        ? { stripe_payment_id: queryId.trim(), share_token: token }
        : { mp_payment_id: queryId.trim(), share_token: token };
      const res = await supabase.functions.invoke('check-payment-link-status', {
        body: bodyPayload,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.not_found || res.data?.error) {
        throw new Error(res.data.error || 'Código não encontrado');
      }
      setQueryResult(res.data);
    } catch (err: any) {
      setQueryError(err.message || 'Erro ao consultar pagamento');
    } finally {
      setQueryLoading(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldX className="h-12 w-12 mx-auto text-destructive opacity-70" />
            <h2 className="text-xl font-semibold text-destructive">Link Inválido ou Expirado</h2>
            <p className="text-muted-foreground text-sm">
              Este link de acesso não é mais válido. Solicite um novo link ao administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const generatorCard = (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-primary" />
          Gerador de Link de Pagamento
        </CardTitle>
        <CardDescription>
          Este acesso usa as configurações do módulo Cobrança → Pagamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider">Provedor</Label>
          <Select value={provider} onValueChange={(value) => setProvider(value as Provider)}>
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedProviders.map((item) => (
                <SelectItem key={item} value={item}>{providerLabels[item]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full gap-2"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Gerar Link de Pagamento
        </Button>
      </CardContent>
    </Card>
  );

  const queryCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-primary" />
          Consultar Status de Pagamento
        </CardTitle>
        <CardDescription>
          Informe o ID do pagamento (Mercado Pago ou Stripe) para verificar o status atual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select value={queryProvider} onValueChange={(v) => setQueryProvider(v as Provider)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedProviders.map((item) => (
                <SelectItem key={item} value={item}>{providerLabels[item]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ID do Pagamento</Label>
          <Input
            placeholder={queryProvider === 'stripe' ? 'Ex: pi_xxx ou cs_xxx' : 'Ex: 12345678'}
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
          />
        </div>
        <Button
          onClick={handleQuery}
          disabled={queryLoading || !queryId.trim()}
          className="w-full gap-2"
        >
          {queryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar
        </Button>

        {queryError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{queryError}</span>
          </div>
        )}

        {queryResult && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Resultado da Consulta</span>
              <Button variant="ghost" size="sm" onClick={() => setQueryResult(null)}>✕</Button>
            </div>
            <p><strong>ID:</strong> <span className="font-mono text-xs">{queryResult.payment_id}</span></p>
            <p>
              <strong>Status:</strong>{' '}
              <Badge variant={queryResult.status === 'approved' || queryResult.status === 'paid' ? 'default' : 'secondary'}>
                {queryResult.status}
              </Badge>
            </p>
            <p><strong>Valor:</strong> {queryResult.currency || 'BRL'} {Number(queryResult.amount || 0).toFixed(2)}</p>
            {queryResult.payer_email && <p><strong>Pagador:</strong> {queryResult.payer_email}</p>}
            {queryResult.payment_method && <p><strong>Método:</strong> {queryResult.payment_method}</p>}
            {queryResult.date_approved && (
              <p><strong>Aprovado em:</strong> {format(new Date(queryResult.date_approved), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
            {queryResult.date_created && (
              <p><strong>Criado em:</strong> {format(new Date(queryResult.date_created), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
            {queryResult.description && <p><strong>Descrição:</strong> {queryResult.description}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        {expiresAt && (
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Acesso expira em {format(new Date(expiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}

        {allowStatusCheck ? (
          <Tabs defaultValue="gerar" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="gerar" className="gap-2">
                <Plus className="h-4 w-4" />
                Gerar Link
              </TabsTrigger>
              <TabsTrigger value="consultar" className="gap-2">
                <Search className="h-4 w-4" />
                Consultar Status
              </TabsTrigger>
            </TabsList>
            <TabsContent value="gerar" className="space-y-4">
              {generatorCard}
              {generatedLink && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-base text-primary">✅ Link Gerado!</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Provedor:</span>
                        <p className="font-semibold">{generatedLink.provider_label}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor original:</span>
                        <p className="font-semibold">{generatedLink.currency === 'USD' ? 'US$' : 'R$'} {generatedLink.valor_original.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Com taxa ({generatedLink.taxa_percentual}%):</span>
                        <p className="font-semibold">{generatedLink.currency === 'USD' ? 'US$' : 'R$'} {generatedLink.valor_com_taxa.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Origem:</span>
                        <p className="font-semibold">{generatedLink.config_source}</p>
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
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expira em {format(new Date(generatedLink.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="consultar">
              {queryCard}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {generatorCard}
            {generatedLink && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base text-primary">✅ Link Gerado!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Provedor:</span>
                      <p className="font-semibold">{generatedLink.provider_label}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor original:</span>
                      <p className="font-semibold">{generatedLink.currency === 'USD' ? 'US$' : 'R$'} {generatedLink.valor_original.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Com taxa ({generatedLink.taxa_percentual}%):</span>
                      <p className="font-semibold">{generatedLink.currency === 'USD' ? 'US$' : 'R$'} {generatedLink.valor_com_taxa.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Origem:</span>
                      <p className="font-semibold">{generatedLink.config_source}</p>
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
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expira em {format(new Date(generatedLink.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
