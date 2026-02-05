import { useState, useEffect, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageSquare, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import { useSendProposal, useProposalSendConfig } from '@/hooks/useProposalSending';
import { toast } from 'sonner';

interface RemarketingProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  proposalTitle: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export function RemarketingProposalDialog({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
  clientName,
  clientEmail,
  clientPhone,
}: RemarketingProposalDialogProps) {
  const { config, isLoading: isLoadingConfig } = useProposalSendConfig();
  const sendProposal = useSendProposal();

  const footerRef = useRef<HTMLDivElement>(null);

  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // Default remarketing messages
  const defaultWhatsAppMessage = `👋 Olá ${recipientName || clientName || 'Cliente'}, percebi que você visualizou a proposta "${proposalTitle}" mas ainda não assinou. Posso ajudar com alguma dúvida?`;
  const defaultEmailMessage = `Percebi que você visualizou a proposta, mas ainda não deu seu retorno. Posso ajudar com alguma dúvida?`;

  // Scroll footer into view on mobile
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, channel]);

  useEffect(() => {
    if (open) {
      setRecipientName(clientName || '');
      setRecipientEmail(clientEmail || '');
      setRecipientPhone(clientPhone || '');
      
      // Set default message based on channel
      const whatsappTemplate = (config as any)?.whatsapp_remarketing_template || defaultWhatsAppMessage;
      const emailTemplate = (config as any)?.email_remarketing_body_template || defaultEmailMessage;
      
      // Replace placeholders
      const processedWhatsapp = whatsappTemplate
        .replace(/\{\{clientName\}\}/g, clientName || 'Cliente')
        .replace(/\{\{proposalTitle\}\}/g, proposalTitle);
      
      const processedEmail = emailTemplate
        .replace(/\{\{clientName\}\}/g, clientName || 'Cliente')
        .replace(/\{\{proposalTitle\}\}/g, proposalTitle);
      
      setCustomMessage(channel === 'email' ? processedEmail : processedWhatsapp);
      
      // Auto-select channel
      if (clientEmail && clientPhone && config?.email_enabled && config?.whatsapp_enabled) {
        setChannel('both');
      } else if (clientEmail && config?.email_enabled) {
        setChannel('email');
      } else if (clientPhone && config?.whatsapp_enabled) {
        setChannel('whatsapp');
      } else if (config?.email_enabled) {
        setChannel('email');
      } else if (config?.whatsapp_enabled) {
        setChannel('whatsapp');
      }
    }
  }, [open, clientName, clientEmail, clientPhone, config, proposalTitle]);

  // Update message when channel changes
  useEffect(() => {
    if (!open) return;
    
    const whatsappTemplate = (config as any)?.whatsapp_remarketing_template || defaultWhatsAppMessage;
    const emailTemplate = (config as any)?.email_remarketing_body_template || defaultEmailMessage;
    
    const processedWhatsapp = whatsappTemplate
      .replace(/\{\{clientName\}\}/g, recipientName || clientName || 'Cliente')
      .replace(/\{\{proposalTitle\}\}/g, proposalTitle);
    
    const processedEmail = emailTemplate
      .replace(/\{\{clientName\}\}/g, recipientName || clientName || 'Cliente')
      .replace(/\{\{proposalTitle\}\}/g, proposalTitle);
    
    if (channel === 'whatsapp') {
      setCustomMessage(processedWhatsapp);
    } else {
      setCustomMessage(processedEmail);
    }
  }, [channel, open]);

  const canSendEmail = config?.email_enabled && recipientEmail.trim();
  const canSendWhatsapp = config?.whatsapp_enabled && recipientPhone.trim();
  
  const canSend = (channel === 'email' && canSendEmail) ||
                  (channel === 'whatsapp' && canSendWhatsapp) ||
                  (channel === 'both' && (canSendEmail || canSendWhatsapp));

  const getValidationMessage = () => {
    if (channel === 'email' && !recipientEmail.trim()) {
      return 'Informe o email do destinatário';
    }
    if (channel === 'whatsapp' && !recipientPhone.trim()) {
      return 'Informe o WhatsApp do destinatário';
    }
    if (channel === 'both' && !recipientEmail.trim() && !recipientPhone.trim()) {
      return 'Informe pelo menos um email ou WhatsApp';
    }
    return null;
  };

  const validationMessage = getValidationMessage();

  const handleSend = async () => {
    if (!canSend) {
      toast.error(validationMessage || 'Preencha os dados de contato');
      return;
    }

    try {
      await sendProposal.mutateAsync({
        proposalId,
        channel,
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        isRemarketing: true,
        remarketingMessage: customMessage,
      } as any);

      window.scrollTo({ top: 0, behavior: 'smooth' });
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md h-[85vh] overflow-y-scroll overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-orange-500" />
            Remarketing
          </DialogTitle>
          <DialogDescription>
            Reenvie a proposta com uma mensagem de follow-up para clientes que visualizaram mas não assinaram
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
              <Label>
                Email
                {channel === 'email' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className={channel === 'email' && !recipientEmail.trim() ? 'border-destructive' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>
                WhatsApp
                {channel === 'whatsapp' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                placeholder="5511999999999"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className={channel === 'whatsapp' && !recipientPhone.trim() ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Formato: código do país + DDD + número (ex: 5511999999999)
              </p>
            </div>
          </div>

          {/* Canal de envio */}
          <div className="space-y-2">
            <Label>Enviar via</Label>
            <RadioGroup value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="email" 
                  id="remarketing-email" 
                  disabled={!config?.email_enabled}
                />
                <Label htmlFor="remarketing-email" className="flex items-center gap-2 cursor-pointer">
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
                  id="remarketing-whatsapp"
                  disabled={!config?.whatsapp_enabled}
                />
                <Label htmlFor="remarketing-whatsapp" className="flex items-center gap-2 cursor-pointer">
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
                  id="remarketing-both"
                  disabled={!config?.email_enabled || !config?.whatsapp_enabled}
                />
                <Label htmlFor="remarketing-both" className="flex items-center gap-2 cursor-pointer">
                  Ambos
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Mensagem personalizada */}
          <div className="space-y-2">
            <Label>Mensagem de Remarketing</Label>
            <Textarea
              placeholder="Escreva sua mensagem de follow-up..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Esta mensagem será enviada junto com o link da proposta
            </p>
          </div>

          {/* Mensagens de aviso */}
          {!config?.email_enabled && !config?.whatsapp_enabled && (
            <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Nenhum canal de envio está configurado. Configure em Propostas → Configuração de Envio.</p>
            </div>
          )}

          {validationMessage && (config?.email_enabled || config?.whatsapp_enabled) && (
            <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{validationMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <div ref={footerRef} className="w-full flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendProposal.isPending || !canSend || isLoadingConfig}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {sendProposal.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              Enviar Remarketing
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
