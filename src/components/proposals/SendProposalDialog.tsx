import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mail, MessageSquare, Loader2 } from 'lucide-react';
import { useSendProposal, useProposalSendConfig } from '@/hooks/useProposalSending';

interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  proposalId,
  clientName,
  clientEmail,
  clientPhone,
}: SendProposalDialogProps) {
  const { config } = useProposalSendConfig();
  const sendProposal = useSendProposal();

  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [recipientName, setRecipientName] = useState(clientName || '');
  const [recipientEmail, setRecipientEmail] = useState(clientEmail || '');
  const [recipientPhone, setRecipientPhone] = useState(clientPhone || '');

  const emailAvailable = config?.email_enabled && (recipientEmail || clientEmail);
  const whatsappAvailable = config?.whatsapp_enabled && (recipientPhone || clientPhone);

  const handleSend = async () => {
    await sendProposal.mutateAsync({
      proposalId,
      channel,
      recipientEmail: recipientEmail || clientEmail,
      recipientPhone: recipientPhone || clientPhone,
      recipientName: recipientName || clientName,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Proposta</DialogTitle>
          <DialogDescription>
            Escolha como enviar a proposta para o cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dados do destinatário */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                placeholder="Nome do cliente"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Canal de envio */}
          <div className="space-y-2">
            <Label>Enviar via</Label>
            <RadioGroup value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="email" 
                  id="email" 
                  disabled={!config?.email_enabled}
                />
                <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                  <Mail className="h-4 w-4" />
                  Email
                  {!config?.email_enabled && (
                    <span className="text-xs text-muted-foreground">(não configurado)</span>
                  )}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="whatsapp" 
                  id="whatsapp"
                  disabled={!config?.whatsapp_enabled}
                />
                <Label htmlFor="whatsapp" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                  {!config?.whatsapp_enabled && (
                    <span className="text-xs text-muted-foreground">(não configurado)</span>
                  )}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="both" 
                  id="both"
                  disabled={!config?.email_enabled || !config?.whatsapp_enabled}
                />
                <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer">
                  Ambos
                </Label>
              </div>
            </RadioGroup>
          </div>

          {!config?.email_enabled && !config?.whatsapp_enabled && (
            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
              Nenhum canal de envio está configurado. Configure em Propostas → Configuração de Envio.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sendProposal.isPending || (!emailAvailable && !whatsappAvailable)}
          >
            {sendProposal.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
