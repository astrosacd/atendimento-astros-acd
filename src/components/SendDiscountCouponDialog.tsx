import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Gift, Loader2, Link2, MessageSquare, Mail, Sparkles, Copy, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | null;
}

type Step = 'config' | 'preview';
type Provider = 'mercadopago' | 'stripe';

interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  numero: string | null;
  produto: string | null;
  valor: number | null;
  moeda: string | null;
}

interface ScoreData {
  score: number | null;
  desconto_sugerido: number | null;
}

interface GeneratedLink {
  payment_url: string;
  valor_original: number;
  valor_com_taxa: number;
  taxa_percentual: number;
  currency: string;
  expires_at: string;
}

const buildDefaultMessage = (
  clienteNome: string,
  produto: string,
  desconto: number,
  valorOriginal: number,
  valorComDesconto: number,
  moeda: string,
  link: string,
  validadeHoras: number,
) => {
  const sym = moeda === 'USD' ? '$' : 'R$';
  return `🎁 *Oferta exclusiva para você, ${clienteNome.split(' ')[0]}!*

Como cliente especial, liberamos um *cupom de ${desconto}% de desconto* na sua próxima renovação de *${produto}*. 🚀

💰 De ~${sym} ${valorOriginal.toFixed(2)}~ por *${sym} ${valorComDesconto.toFixed(2)}*

Aproveite agora pelo link abaixo (expira em ${validadeHoras}h):
👉 ${link}

Qualquer dúvida estamos à disposição.
Obrigado pela confiança! 💜`;
};

export function SendDiscountCouponDialog({ open, onOpenChange, clienteId }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('config');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const [discount, setDiscount] = useState<number>(10);
  const [provider, setProvider] = useState<Provider>('mercadopago');
  const [validadeHoras, setValidadeHoras] = useState<number>(72);
  const [channels, setChannels] = useState<Record<'whatsapp' | 'email', boolean>>({ whatsapp: true, email: false });
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [message, setMessage] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [cooldown, setCooldown] = useState<{ last_sent_at: string; days_remaining: number } | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) {
      setStep('config');
      setCliente(null);
      setScore(null);
      setGenerated(null);
      setMessage('');
      setDiscount(10);
      setChannels({ whatsapp: true, email: false });
      setCooldown(null);
      return;
    }
    if (!clienteId) return;
    (async () => {
      setLoadingClient(true);
      try {
        const [{ data: cli }, { data: sc }] = await Promise.all([
          supabase.from('clientes').select('id,nome,email,numero,produto,valor,moeda').eq('id', clienteId).single(),
          supabase
            .from('client_scores')
            .select('score,desconto_sugerido')
            .eq('cliente_id', clienteId)
            .maybeSingle(),
        ]);
        if (cli) setCliente(cli as Cliente);
        if (sc) {
          setScore(sc as ScoreData);
          const sug = Number((sc as any).desconto_sugerido);
          if (Number.isFinite(sug) && sug > 0 && sug <= 50) setDiscount(Math.round(sug));
        }
      } finally {
        setLoadingClient(false);
      }
    })();
  }, [open, clienteId]);

  const valorOriginal = Number(cliente?.valor || 0);
  const valorComDesconto = useMemo(() => {
    if (!valorOriginal) return 0;
    return Number((valorOriginal * (1 - discount / 100)).toFixed(2));
  }, [valorOriginal, discount]);

  const produtoLabel = (cliente?.produto || 'Plano').trim();
  const empresaLabel = `${produtoLabel} ${discount}`; // Ex: "Hub 10" => 10% de desconto

  const handleGenerate = async () => {
    if (!cliente) return;
    if (discount <= 0 || discount > 50) {
      toast({ title: 'Desconto inválido', description: 'Use um valor entre 1% e 50%.', variant: 'destructive' });
      return;
    }
    if (!valorComDesconto || valorComDesconto <= 0) {
      toast({ title: 'Valor inválido', description: 'Cliente não tem valor cadastrado.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke('generate-payment-link', {
        body: {
          empresa: empresaLabel,
          valor_da_venda: valorComDesconto.toFixed(2),
          validade_horas: validadeHoras,
          provider,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Erro ao gerar link');
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      const data = res.data as GeneratedLink;
      setGenerated(data);
      const msg = buildDefaultMessage(
        cliente.nome,
        produtoLabel,
        discount,
        valorOriginal,
        valorComDesconto,
        cliente.moeda || 'BRL',
        data.payment_url,
        validadeHoras,
      );
      setMessage(msg);
      setSubject(`🎁 ${discount}% de desconto exclusivo - ${produtoLabel}`);
      setStep('preview');
      toast({ title: 'Link gerado!', description: 'Revise a mensagem antes de enviar.' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar link', description: err.message || 'Falha', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!cliente || !generated) return;
    const selectedChannels = (Object.entries(channels).filter(([, v]) => v).map(([k]) => k)) as Array<'whatsapp' | 'email'>;
    if (selectedChannels.length === 0) {
      toast({ title: 'Selecione um canal', description: 'WhatsApp e/ou E-mail.', variant: 'destructive' });
      return;
    }
    if (channels.whatsapp && !cliente.numero) {
      toast({ title: 'Sem WhatsApp', description: 'Cliente não tem número cadastrado.', variant: 'destructive' });
      return;
    }
    if (channels.email && !cliente.email) {
      toast({ title: 'Sem e-mail', description: 'Cliente não tem e-mail cadastrado.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await supabase.functions.invoke('send-discount-coupon', {
        body: {
          clienteId: cliente.id,
          discountPercent: discount,
          paymentUrl: generated.payment_url,
          message,
          subject,
          channels: selectedChannels,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Erro ao enviar');
      const data: any = res.data;
      if (data?.error) throw new Error(data.error);

      const results = data?.results || {};
      const ok: string[] = [];
      const fail: string[] = [];
      for (const ch of selectedChannels) {
        if (results[ch]?.sent) ok.push(ch);
        else fail.push(`${ch} (${results[ch]?.error || 'erro'})`);
      }
      if (ok.length > 0) {
        toast({ title: 'Cupom enviado!', description: `Enviado por: ${ok.join(', ')}${fail.length ? `. Falhas: ${fail.join('; ')}` : ''}` });
      }
      if (ok.length > 0 && fail.length === 0) onOpenChange(false);
      else if (fail.length > 0 && ok.length === 0) {
        toast({ title: 'Falha no envio', description: fail.join('; '), variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao enviar', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.payment_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-pink-500" />
            Enviar cupom de desconto
          </DialogTitle>
          <DialogDescription>
            {cliente ? <>Para <span className="font-semibold text-foreground">{cliente.nome}</span> — {produtoLabel}</> : 'Carregando cliente...'}
          </DialogDescription>
        </DialogHeader>

        {loadingClient && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
          </div>
        )}

        {!loadingClient && cliente && step === 'config' && (
          <div className="space-y-4">
            {score && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>
                  Score IA: <strong>{score.score ?? '—'}</strong> · Desconto sugerido pela IA:{' '}
                  <strong>{score.desconto_sugerido ? `${Number(score.desconto_sugerido).toFixed(0)}%` : '—'}</strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                />
                <p className="text-xs text-muted-foreground">Operador pode editar a sugestão da IA.</p>
              </div>
              <div className="space-y-2">
                <Label>Validade do link (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={validadeHoras}
                  onChange={(e) => setValidadeHoras(Math.max(1, Math.min(168, Number(e.target.value) || 24)))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gateway de pagamento</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={provider === 'mercadopago' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProvider('mercadopago')}
                >
                  Mercado Pago (BRL)
                </Button>
                <Button
                  type="button"
                  variant={provider === 'stripe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProvider('stripe')}
                >
                  Stripe (USD)
                </Button>
              </div>
            </div>

            <Separator />

            <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Produto</span><span className="font-medium">{produtoLabel}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor original</span><span>{cliente.moeda === 'USD' ? '$' : 'R$'} {valorOriginal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto aplicado</span><Badge variant="secondary">{discount}%</Badge></div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-border/40">
                <span>Total com desconto</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {cliente.moeda === 'USD' ? '$' : 'R$'} {valorComDesconto.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Link será gerado com o nome <strong>"{empresaLabel}"</strong> ({discount}% de desconto sobre o valor padrão).
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Gerar link de pagamento
              </Button>
            </DialogFooter>
          </div>
        )}

        {!loadingClient && cliente && step === 'preview' && generated && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Link gerado com sucesso
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={generated.payment_url} className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={copyLink} className="gap-1 shrink-0">
                  {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {generated.currency} {generated.valor_com_taxa.toFixed(2)} (taxa {generated.taxa_percentual}%) · Expira em{' '}
                {new Date(generated.expires_at).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Canais de envio</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={channels.whatsapp}
                    onCheckedChange={(v) => setChannels((c) => ({ ...c, whatsapp: !!v }))}
                  />
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">WhatsApp {cliente.numero ? `(${cliente.numero})` : <span className="text-destructive">— sem número</span>}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={channels.email}
                    onCheckedChange={(v) => setChannels((c) => ({ ...c, email: !!v }))}
                  />
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">E-mail {cliente.email ? `(${cliente.email})` : <span className="text-destructive">— sem e-mail</span>}</span>
                </label>
              </div>
            </div>

            {channels.email && (
              <div className="space-y-2">
                <Label>Assunto do e-mail</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensagem (pré-visualização editável)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Esta mensagem será enviada nos canais selecionados. O link já está embutido no texto.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep('config')} disabled={sending}>
                Voltar
              </Button>
              <Button onClick={handleSend} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                Enviar cupom
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
