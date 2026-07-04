import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, RotateCcw, AlertTriangle, ShieldPlus, CreditCard, Loader2 } from 'lucide-react';
import { Cliente, useClientes, Moeda } from '@/hooks/useClientes';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyInput, parseCurrency } from '@/utils/formatters';

interface Props {
  cliente: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function formatNow() {
  return new Date().toLocaleString('pt-BR');
}

export function CancelClientDialog({ cliente, open, onOpenChange, onSuccess }: Props) {
  const { updateCliente } = useClientes();
  const { toast } = useToast();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo('');
      setShowConfirm(false);
    }
  }, [open, cliente?.id]);

  const validate = () => {
    const trimmed = motivo.trim();
    if (trimmed.length < 3) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Descreva em ao menos 3 caracteres por que o cliente cancelou.',
        variant: 'destructive',
      });
      return false;
    }
    if (trimmed.length > 500) {
      toast({
        title: 'Motivo muito longo',
        description: 'Máximo de 500 caracteres.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleRequestConfirm = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleFinalConfirm = async () => {
    if (!cliente) return;
    const trimmed = motivo.trim();

    setSaving(true);
    try {
      const existingTags = Array.isArray(cliente.tags) ? cliente.tags : [];
      const newTags = existingTags.includes('cancelado')
        ? existingTags
        : [...existingTags, 'cancelado'];

      const stamp = `[Cancelado em ${formatNow()}] Motivo: ${trimmed}`;
      const newObservacao = cliente.observacao
        ? `${cliente.observacao}\n\n${stamp}`
        : stamp;

      const result = await updateCliente(
        cliente.id,
        {
          cobranca_ativa: false,
          observacao: newObservacao,
          tags: newTags,
        },
        cliente,
      );

      if (result) {
        toast({
          title: 'Cliente cancelado',
          description: `${cliente.nome} não será mais cobrado. Histórico preservado.`,
        });
        setShowConfirm(false);
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancelar cliente
            </DialogTitle>
            <DialogDescription>
              <strong className="text-foreground">{cliente?.nome}</strong> deixará de ser cobrado
              mensalmente. O cadastro <em>continua ativo</em> — histórico, tarefas e timeline são
              preservados. Você pode reativar quando quiser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p><strong>Efeitos imediatos:</strong></p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-500/90">
                  <li>Sai do MRR do dashboard</li>
                  <li>Para de aparecer em cobranças e lembretes automáticos</li>
                  <li>Recebe a tag <code>cancelado</code></li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo-cancelamento" className="text-foreground font-medium">
                Motivo do cancelamento <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo-cancelamento"
                placeholder="Ex: Cliente relatou que não usa mais o serviço, migrou para outra ferramenta..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="bg-secondary border-border text-foreground min-h-[100px]"
                maxLength={500}
                disabled={saving}
                autoFocus
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Obrigatório (mín. 3 caracteres) — será salvo na Observação e no histórico.</span>
                <span>{motivo.length}/500</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-border"
            >
              Voltar
            </Button>
            <Button
              onClick={handleRequestConfirm}
              disabled={saving || motivo.trim().length < 3}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Prosseguir para cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação extra "tem certeza?" */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-card border-destructive/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Tem certeza que deseja cancelar?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Você está prestes a cancelar <strong className="text-foreground">{cliente?.nome}</strong>.
                Esta ação:
              </span>
              <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                <li>Remove o cliente do <strong>MRR imediatamente</strong></li>
                <li>Interrompe todas as <strong>cobranças automáticas</strong></li>
                <li>Fica registrado no histórico com o motivo informado</li>
              </ul>
              <span className="block text-xs pt-1">
                É possível reativar depois, mas o cliente perderá continuidade na cobrança recorrente até lá.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Não, voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalConfirm}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Cancelando...' : 'Sim, cancelar cliente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ReactivateClientDialog({ cliente, open, onOpenChange, onSuccess }: Props) {
  const { updateCliente } = useClientes();
  const { registerEarlyPayment, registerLinkPayment, registerOtherPayment } = usePaymentStatus();
  const { toast } = useToast();

  const [novaRenovacao, setNovaRenovacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  // Pagamento opcional
  const [exigirPagamento, setExigirPagamento] = useState(false);
  const [valor, setValor] = useState<number>(0);
  const [moeda, setMoeda] = useState<Moeda>('BRL');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [pixProof, setPixProof] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [otherObs, setOtherObs] = useState('');
  const [otherProof, setOtherProof] = useState<File | null>(null);

  useEffect(() => {
    if (open && cliente) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setNovaRenovacao(d.toISOString().slice(0, 10));
      setMotivo('');
      setExigirPagamento(false);
      setValor(Number(cliente.valor) || 0);
      setMoeda((cliente.moeda as Moeda) || 'BRL');
      setPaymentMethod('');
      setPixProof(null);
      setLinkUrl('');
      setOtherObs('');
      setOtherProof(null);
    }
  }, [open, cliente?.id]);

  const validatePayment = (): boolean => {
    if (!exigirPagamento) return true;
    if (valor <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' });
      return false;
    }
    if (!paymentMethod) {
      toast({ title: 'Meio de pagamento', description: 'Selecione o meio de pagamento.', variant: 'destructive' });
      return false;
    }
    if (paymentMethod === 'pix' && !pixProof) {
      toast({ title: 'Comprovante obrigatório', description: 'Anexe o comprovante Pix.', variant: 'destructive' });
      return false;
    }
    if (paymentMethod === 'link_pagamento' && !linkUrl.trim()) {
      toast({ title: 'Link obrigatório', description: 'Cole a URL do link de pagamento.', variant: 'destructive' });
      return false;
    }
    if (paymentMethod === 'other' && !otherObs.trim()) {
      toast({ title: 'Observação obrigatória', description: 'Descreva a forma do pagamento.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleConfirm = async () => {
    if (!cliente) return;
    if (!novaRenovacao) {
      toast({
        title: 'Data obrigatória',
        description: 'Informe a nova data de renovação.',
        variant: 'destructive',
      });
      return;
    }
    if (!validatePayment()) return;

    setSaving(true);
    try {
      const existingTags = Array.isArray(cliente.tags) ? cliente.tags : [];
      const newTags = existingTags.filter((t) => t.toLowerCase() !== 'cancelado');

      const motivoTrim = motivo.trim();
      const parts = [`[Reativado em ${formatNow()}] Nova renovação: ${novaRenovacao}`];
      if (exigirPagamento) {
        parts.push(`Novo pagamento: ${moeda} ${valor.toFixed(2)} via ${paymentMethod} (enviado p/ Segurança de Pagamento)`);
      }
      if (motivoTrim) parts.push(`Observação: ${motivoTrim}`);
      const stamp = parts.join(' — ');

      const newObservacao = cliente.observacao
        ? `${cliente.observacao}\n\n${stamp}`
        : stamp;

      const result = await updateCliente(
        cliente.id,
        {
          cobranca_ativa: true,
          data_renovacao: novaRenovacao,
          observacao: newObservacao,
          tags: newTags,
          valor: exigirPagamento ? Number(valor) : cliente.valor,
          moeda: exigirPagamento ? moeda : cliente.moeda,
        },
        cliente,
      );

      if (!result) return;

      // Se pediu pagamento, registra em client_payments → Segurança de Pagamento
      let pagamentoOk = true;
      if (exigirPagamento) {
        if (paymentMethod === 'pix') {
          pagamentoOk = await registerEarlyPayment(cliente.id, Number(valor), pixProof!);
        } else if (paymentMethod === 'link_pagamento') {
          const r = await registerLinkPayment({
            clienteId: cliente.id,
            declaredAmount: Number(valor),
            paymentLinkUrl: linkUrl.trim(),
          });
          pagamentoOk = r.ok;
        } else if (paymentMethod === 'other') {
          pagamentoOk = await registerOtherPayment({
            clienteId: cliente.id,
            declaredAmount: Number(valor),
            observation: otherObs.trim(),
            proof: otherProof || undefined,
          });
        }
      }

      toast({
        title: 'Cliente reativado',
        description: exigirPagamento
          ? pagamentoOk
            ? `${cliente.nome} reativado. Pagamento enviado para Segurança de Pagamento.`
            : `${cliente.nome} reativado, mas houve falha ao registrar o pagamento. Registre manualmente.`
          : `${cliente.nome} voltou a ser cobrado. Próxima renovação: ${new Date(novaRenovacao + 'T12:00:00').toLocaleDateString('pt-BR')}.`,
        variant: exigirPagamento && !pagamentoOk ? 'destructive' : undefined,
      });
      onOpenChange(false);
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-display flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-emerald-500" />
            Reativar cliente
          </DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{cliente?.nome}</strong> voltará a ser cobrado
            mensalmente e entrará novamente no MRR. A tag <code>cancelado</code> será removida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="nova-renovacao" className="text-foreground font-medium">
              Nova data de renovação <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nova-renovacao"
              type="date"
              value={novaRenovacao}
              onChange={(e) => setNovaRenovacao(e.target.value)}
              className="bg-secondary border-border text-foreground h-10"
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">
              Padrão sugerido: hoje + 30 dias. Ajuste conforme o combinado com o cliente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-reativacao" className="text-foreground font-medium">
              Observação (opcional)
            </Label>
            <Textarea
              id="motivo-reativacao"
              placeholder="Ex: Cliente voltou após 3 meses, aceitou nova proposta com desconto..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="bg-secondary border-border text-foreground min-h-[70px]"
              maxLength={500}
              disabled={saving}
            />
            <div className="text-right text-[10px] text-muted-foreground">{motivo.length}/500</div>
          </div>

          {/* Toggle pagamento */}
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={exigirPagamento}
                onCheckedChange={(v) => setExigirPagamento(v === true)}
                disabled={saving}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <ShieldPlus className="h-4 w-4 text-emerald-500" />
                  Exigir novo pagamento com aprovação
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Registra um pagamento agora e envia para <strong>Segurança de Pagamento</strong> aguardando análise.
                  Desmarque se já cobrou por fora.
                </p>
              </div>
            </label>

            {exigirPagamento && (
              <div className="space-y-3 pt-2 border-t border-emerald-500/20 animate-in fade-in slide-in-from-top-1">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Novo valor</Label>
                    <Input
                      value={valor ? formatCurrencyInput(Math.round(valor * 100).toString(), moeda) : ''}
                      onChange={(e) => setValor(parseCurrency(e.target.value))}
                      placeholder={moeda === 'USD' ? '$ 0.00' : 'R$ 0,00'}
                      className="h-10 bg-secondary"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Moeda</Label>
                    <Select value={moeda} onValueChange={(v) => setMoeda(v as Moeda)} disabled={saving}>
                      <SelectTrigger className="h-10 w-24 bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">BRL</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" />
                    Meio de pagamento <span className="text-destructive">*</span>
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={saving}>
                    <SelectTrigger className="h-10 bg-secondary">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">📱 Pix (OCR automático)</SelectItem>
                      <SelectItem value="link_pagamento">🔗 Link de Pagamento (MP / Stripe)</SelectItem>
                      <SelectItem value="other">💳 Outros / Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === 'pix' && (
                  <div className="space-y-1 animate-in fade-in">
                    <Label className="text-xs text-amber-500">
                      Comprovante Pix <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setPixProof(e.target.files?.[0] || null)}
                      className="h-10 pt-2 cursor-pointer text-xs bg-secondary"
                      disabled={saving}
                    />
                  </div>
                )}

                {paymentMethod === 'link_pagamento' && (
                  <div className="space-y-1 animate-in fade-in">
                    <Label className="text-xs text-amber-500">
                      URL do link <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://... (MP ou Stripe)"
                      className="h-10 text-xs bg-secondary"
                      disabled={saving}
                    />
                  </div>
                )}

                {paymentMethod === 'other' && (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-500">
                        Observação <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        value={otherObs}
                        onChange={(e) => setOtherObs(e.target.value)}
                        placeholder="Ex: Boleto pago em 04/07..."
                        className="min-h-[60px] text-xs bg-secondary"
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comprovante (opcional)</Label>
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setOtherProof(e.target.files?.[0] || null)}
                        className="h-10 pt-2 cursor-pointer text-xs bg-secondary"
                        disabled={saving}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-border"
          >
            Voltar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !novaRenovacao}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reativando...</>
            ) : exigirPagamento ? (
              <><ShieldPlus className="h-4 w-4 mr-2" />Reativar e enviar p/ aprovação</>
            ) : (
              'Confirmar reativação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
