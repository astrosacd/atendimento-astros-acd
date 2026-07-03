import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Cliente, useClientes } from '@/hooks/useClientes';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (open) setMotivo('');
  }, [open, cliente?.id]);

  const handleConfirm = async () => {
    if (!cliente) return;
    const trimmed = motivo.trim();
    if (trimmed.length < 3) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Descreva em ao menos 3 caracteres por que o cliente cancelou.',
        variant: 'destructive',
      });
      return;
    }
    if (trimmed.length > 500) {
      toast({
        title: 'Motivo muito longo',
        description: 'Máximo de 500 caracteres.',
        variant: 'destructive',
      });
      return;
    }

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
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
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
            onClick={handleConfirm}
            disabled={saving || motivo.trim().length < 3}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReactivateClientDialog({ cliente, open, onOpenChange, onSuccess }: Props) {
  const { updateCliente } = useClientes();
  const { toast } = useToast();
  const [novaRenovacao, setNovaRenovacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // padrão: hoje + 30 dias
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setNovaRenovacao(d.toISOString().slice(0, 10));
      setMotivo('');
    }
  }, [open, cliente?.id]);

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

    setSaving(true);
    try {
      const existingTags = Array.isArray(cliente.tags) ? cliente.tags : [];
      const newTags = existingTags.filter((t) => t.toLowerCase() !== 'cancelado');

      const motivoTrim = motivo.trim();
      const parts = [`[Reativado em ${formatNow()}] Nova renovação: ${novaRenovacao}`];
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
        },
        cliente,
      );

      if (result) {
        toast({
          title: 'Cliente reativado',
          description: `${cliente.nome} voltou a ser cobrado. Próxima renovação: ${new Date(novaRenovacao + 'T12:00:00').toLocaleDateString('pt-BR')}.`,
        });
        onOpenChange(false);
        onSuccess?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md w-[95vw]">
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
              className="bg-secondary border-border text-foreground min-h-[80px]"
              maxLength={500}
              disabled={saving}
            />
            <div className="text-right text-[10px] text-muted-foreground">{motivo.length}/500</div>
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
            {saving ? 'Reativando...' : 'Confirmar reativação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
