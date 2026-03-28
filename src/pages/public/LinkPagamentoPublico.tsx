import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Link2, Copy, ExternalLink, Loader2, ShieldX, Clock, Building2
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
          const providers = Array.isArray(data.allowed_providers)
            ? data.allowed_providers.filter((item: string): item is Provider => item === 'mercadopago' || item === 'stripe')
            : [];
          setAllowedProviders(providers);
          if (providers.length > 0) setProvider(providers[0]);
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Link2 className="h-5 w-5 text-primary" />
              Gerador de Link de Pagamento
            </CardTitle>
            {expiresAt && (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                <Clock className="h-3 w-3" />
                Acesso expira em {format(new Date(expiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
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
      </div>
    </div>
  );
}
