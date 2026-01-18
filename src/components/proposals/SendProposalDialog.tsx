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
import { Switch } from '@/components/ui/switch';
import { Mail, MessageSquare, Loader2, AlertCircle, Lock, Info } from 'lucide-react';
import { useSendProposal, useProposalSendConfig } from '@/hooks/useProposalSending';
import { toast } from 'sonner';

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
  const { config, isLoading: isLoadingConfig } = useProposalSendConfig();
  const sendProposal = useSendProposal();

  const footerRef = useRef<HTMLDivElement>(null);

  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [enablePasswordProtection, setEnablePasswordProtection] = useState(false);

  // Garante que o botão "Enviar" fica visível no mobile (scroll dentro do modal)
  useEffect(() => {
    if (!open) return;

    const t = window.setTimeout(() => {
      footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);

    return () => window.clearTimeout(t);
  }, [open, channel, enablePasswordProtection]);
  useEffect(() => {
    if (open) {
      setRecipientName(clientName || '');
      setRecipientEmail(clientEmail || '');
      setRecipientPhone(clientPhone || '');
      
      // Auto-selecionar canal baseado nos dados disponíveis
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
  }, [open, clientName, clientEmail, clientPhone, config]);

  // Verificar se pode enviar
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

  // Gera a senha automática (prioriza SEMPRE o telefone quando existir)
  const getPasswordInfo = () => {
    const phone = recipientPhone.replace(/\D/g, '');

    if (phone.length >= 4) {
      return { password: phone.slice(-4), channel: 'whatsapp' as const };
    }

    if (recipientEmail.trim()) {
      return { password: recipientEmail.split('@')[0].toLowerCase(), channel: 'email' as const };
    }

    return { password: '', channel: undefined };
  };

  const passwordInfo = getPasswordInfo();

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
        enablePasswordProtection,
        autoPassword: enablePasswordProtection ? passwordInfo.password : undefined,
        passwordChannel: enablePasswordProtection ? passwordInfo.channel : undefined,
      });

      // Garante que o usuário “volta pro topo” após enviar/reenviar
      window.scrollTo({ top: 0, behavior: 'smooth' });

      onOpenChange(false);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Proposta</DialogTitle>
          <DialogDescription>
            {clientName ? (
              <>Enviar proposta para <strong>{clientName}</strong></>
            ) : (
              'Preencha os dados do destinatário'
            )}
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

          {/* Proteção por Senha */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="password-protection">Proteção por Senha</Label>
              </div>
              <Switch
                id="password-protection"
                checked={enablePasswordProtection}
                onCheckedChange={setEnablePasswordProtection}
              />
            </div>
            
            {enablePasswordProtection && (
              <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Senha automática:</p>
                  {channel === 'whatsapp' || (channel === 'both' && recipientPhone.trim()) ? (
                    <p>Últimos 4 dígitos do telefone: <strong>{recipientPhone.replace(/\D/g, '').slice(-4) || '----'}</strong></p>
                  ) : recipientEmail.trim() ? (
                    <p>Usuário do email: <strong>{recipientEmail.split('@')[0].toLowerCase() || '----'}</strong></p>
                  ) : (
                    <p className="text-muted-foreground">Preencha email ou telefone</p>
                  )}
                </div>
              </div>
            )}
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
            >
              {sendProposal.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Enviar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
