import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldPlus, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useClientes, Cliente, CicloCobranca, Moeda } from '@/hooks/useClientes';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyInput, parseCurrency } from '@/utils/formatters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  cliente: Cliente;
  onUpdated?: () => void;
}

/**
 * Botão exclusivo para clientes SEM histórico de pagamento (legado / migrados).
 * Permite atualizar dados (valor, CPF, plano, ciclo, data renovação) e
 * registrar um pagamento que vai direto para "Segurança de Pagamento".
 *
 * Só aparece se o cliente não tiver NENHUM registro em client_payments.
 */
export function RenovarComPagamentoButton({ cliente, onUpdated }: Props) {
  const { toast } = useToast();
  const { updateCliente } = useClientes();
  const { registerEarlyPayment, registerLinkPayment, registerOtherPayment } = usePaymentStatus();

  const [hasHistory, setHasHistory] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form
  const [valor, setValor] = useState<number>(Number(cliente.valor) || 0);
  const [moeda, setMoeda] = useState<Moeda>((cliente.moeda as Moeda) || 'BRL');
  const [cpf, setCpf] = useState<string>(cliente.cpf || '');
  const [plano, setPlano] = useState<string>(cliente.plano || 'Individual');
  const [ciclo, setCiclo] = useState<CicloCobranca>(
    (cliente.ciclo_cobranca as CicloCobranca) || 'mensal',
  );
  const [dataRenovacao, setDataRenovacao] = useState<string>(
    cliente.data_renovacao || new Date().toISOString().split('T')[0],
  );

  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [pixProof, setPixProof] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [otherObs, setOtherObs] = useState<string>('');
  const [otherProof, setOtherProof] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { count } = await supabase
        .from('client_payments')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', cliente.id);
      if (active) setHasHistory((count || 0) > 0);
    })();
    return () => {
      active = false;
    };
  }, [cliente.id]);

  // Não renderiza nada enquanto carrega ou se já existe histórico
  if (hasHistory !== false) return null;

  const resetForm = () => {
    setValor(Number(cliente.valor) || 0);
    setMoeda((cliente.moeda as Moeda) || 'BRL');
    setCpf(cliente.cpf || '');
    setPlano(cliente.plano || 'Individual');
    setCiclo((cliente.ciclo_cobranca as CicloCobranca) || 'mensal');
    setDataRenovacao(cliente.data_renovacao || new Date().toISOString().split('T')[0]);
    setPaymentMethod('');
    setPixProof(null);
    setLinkUrl('');
    setOtherObs('');
    setOtherProof(null);
  };

  const handleSubmit = async () => {
    if (valor <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' });
      return;
    }
    if (!paymentMethod) {
      toast({ title: 'Meio de pagamento', description: 'Selecione o meio de pagamento.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'pix' && !pixProof) {
      toast({ title: 'Comprovante obrigatório', description: 'Anexe o comprovante Pix.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'link_pagamento' && !linkUrl.trim()) {
      toast({ title: 'Link obrigatório', description: 'Cole a URL do link de pagamento.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'other' && !otherObs.trim()) {
      toast({ title: 'Observação obrigatória', description: 'Descreva a forma do pagamento.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      // 1) Atualiza dados do cliente
      const updated = await updateCliente(
        cliente.id,
        {
          valor: Number(valor),
          moeda,
          cpf: cpf || undefined,
          plano,
          ciclo_cobranca: ciclo,
          data_renovacao: dataRenovacao,
        },
        cliente,
      );
      if (!updated) return;

      // 2) Registra pagamento → vai para Segurança de Pagamento
      let ok = false;
      if (paymentMethod === 'pix') {
        ok = await registerEarlyPayment(cliente.id, Number(valor), pixProof!);
      } else if (paymentMethod === 'link_pagamento') {
        const r = await registerLinkPayment({
          clienteId: cliente.id,
          declaredAmount: Number(valor),
          paymentLinkUrl: linkUrl.trim(),
        });
        ok = r.ok;
      } else if (paymentMethod === 'other') {
        ok = await registerOtherPayment({
          clienteId: cliente.id,
          declaredAmount: Number(valor),
          observation: otherObs.trim(),
          proof: otherProof || undefined,
        });
      }

      if (ok) {
        setHasHistory(true);
        setOpen(false);
        resetForm();
        onUpdated?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setOpen(true)}
              variant="ghost"
              size="sm"
              className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 gap-1.5 h-8 px-2.5"
            >
              <ShieldPlus className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline">Renovar c/ Pagamento</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Cliente sem histórico de cobrança — atualize os dados e envie um pagamento para Segurança de Pagamento.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldPlus className="h-5 w-5 text-emerald-500" />
              Renovar c/ Pagamento — {cliente.nome}
            </DialogTitle>
            <DialogDescription>
              Cliente sem histórico. Atualize os dados e registre um pagamento que será enviado para{' '}
              <strong>Segurança de Pagamento</strong> para aprovação manual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dados do cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <Select value={plano} onValueChange={setPlano}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Plano Starter">Plano Starter</SelectItem>
                    <SelectItem value="Plano Pro">Plano Pro</SelectItem>
                    <SelectItem value="Plano Agência">Plano Agência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Valor</Label>
                <div className="flex gap-2">
                  <Input
                    value={valor ? formatCurrencyInput(Math.round(valor * 100).toString(), moeda) : ''}
                    onChange={(e) => setValor(parseCurrency(e.target.value))}
                    placeholder={moeda === 'USD' ? '$ 0.00' : 'R$ 0,00'}
                    className="h-10 flex-1"
                  />
                  <Select value={moeda} onValueChange={(v) => setMoeda(v as Moeda)}>
                    <SelectTrigger className="h-10 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ciclo de Cobrança</Label>
                <Select value={ciclo} onValueChange={(v) => setCiclo(v as CicloCobranca)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="bimestral">Bimestral</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Data de Renovação</Label>
                <Input
                  type="date"
                  value={dataRenovacao}
                  onChange={(e) => setDataRenovacao(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {/* Meio de pagamento */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <Label className="font-medium">
                  Meio de Pagamento <span className="text-destructive">*</span>
                </Label>
              </div>

              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className={`h-11 ${!paymentMethod && 'border-destructive/50'}`}>
                  <SelectValue placeholder="Selecione o meio de pagamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">📱 Pix (Análise OCR Automática)</SelectItem>
                  <SelectItem value="link_pagamento">🔗 Link de Pagamento (MP / Stripe)</SelectItem>
                  <SelectItem value="other">💳 Outros / Manual</SelectItem>
                </SelectContent>
              </Select>

              {paymentMethod === 'pix' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-xs text-amber-500">
                    Comprovante Pix <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPixProof(e.target.files?.[0] || null)}
                    className="h-11 pt-2.5 cursor-pointer text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground bg-amber-500/5 p-2 rounded border border-amber-500/20">
                    ⚠️ OCR + checagem de duplicidade. Aprovação manual em "Segurança de Pagamento".
                  </p>
                </div>
              )}

              {paymentMethod === 'link_pagamento' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-xs text-amber-500">
                    URL do Link de Pagamento <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://... (MP ou Stripe)"
                    className="h-11 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground bg-amber-500/5 p-2 rounded border border-amber-500/20">
                    ⚠️ O link será validado no gateway e enviado para aprovação manual.
                  </p>
                </div>
              )}

              {paymentMethod === 'other' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-xs text-amber-500">
                    Observação do pagamento <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={otherObs}
                    onChange={(e) => setOtherObs(e.target.value)}
                    placeholder="Ex: Pago via boleto bancário em 25/04/2026..."
                    className="min-h-[70px] text-xs"
                  />
                  <Label className="text-xs text-muted-foreground">Comprovante (opcional)</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setOtherProof(e.target.files?.[0] || null)}
                    className="h-11 pt-2.5 cursor-pointer text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground bg-amber-500/5 p-2 rounded border border-amber-500/20">
                    ⚠️ Ficará pendente em "Segurança de Pagamento" para aprovação manual.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <ShieldPlus className="h-4 w-4 mr-2" />
                  Atualizar e Enviar p/ Aprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
